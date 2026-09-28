from __future__ import annotations

from pathlib import Path

import aws_cdk as cdk
from aws_cdk import (
    Duration,
    RemovalPolicy,
    Stack,
    aws_apigateway as apigateway,
    aws_budgets as budgets,
    aws_certificatemanager as acm,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_cloudwatch as cloudwatch,
    aws_cloudwatch_actions as cloudwatch_actions,
    aws_ec2 as ec2,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_logs as logs,
    aws_rds as rds,
    aws_route53 as route53,
    aws_route53_targets as targets,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    aws_secretsmanager as secretsmanager,
    aws_ses as ses,
    aws_sns as sns,
)
from constructs import Construct


class ForgeArcPlatformStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        root: Path,
        config: dict,
        hosted_zone: route53.IHostedZone | None = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)
        self.root = root
        self.config = config
        self.stage = config["stage"]
        self.domain = config["domainName"]

        zone = hosted_zone or self._hosted_zone()
        edge_certificate = acm.DnsValidatedCertificate(
            self,
            "EdgeCertificate",
            domain_name=self.domain,
            subject_alternative_names=[
                f"www.{self.domain}",
                config["docsDomainName"],
            ],
            hosted_zone=zone,
            region="us-east-1",
        )
        api_certificate = acm.Certificate(
            self,
            "ApiCertificate",
            domain_name=config["apiDomainName"],
            validation=acm.CertificateValidation.from_dns(zone),
        )

        vpc = ec2.Vpc(
            self,
            "Vpc",
            max_azs=2,
            nat_gateways=int(config["natGateways"]),
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="public", subnet_type=ec2.SubnetType.PUBLIC, cidr_mask=24
                ),
                ec2.SubnetConfiguration(
                    name="application",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="database",
                    subnet_type=ec2.SubnetType.PRIVATE_ISOLATED,
                    cidr_mask=24,
                ),
            ],
        )
        lambda_sg = ec2.SecurityGroup(self, "CommerceLambdaSg", vpc=vpc)
        database_sg = ec2.SecurityGroup(self, "CommerceDatabaseSg", vpc=vpc)
        database_sg.add_ingress_rule(lambda_sg, ec2.Port.tcp(5432), "Commerce Lambda")

        database = rds.DatabaseInstance(
            self,
            "CommerceDatabase",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_16_6
            ),
            credentials=rds.Credentials.from_generated_secret("forgearc"),
            database_name=config["databaseName"],
            instance_type=self._database_instance_type(config["databaseInstanceType"]),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[database_sg],
            publicly_accessible=False,
            multi_az=bool(config["databaseMultiAz"]),
            allocated_storage=20,
            max_allocated_storage=100,
            storage_encrypted=True,
            backup_retention=Duration.days(int(config["databaseBackupRetentionDays"])),
            deletion_protection=True,
            removal_policy=RemovalPolicy.SNAPSHOT,
            cloudwatch_logs_exports=["postgresql"],
            cloudwatch_logs_retention=logs.RetentionDays.ONE_MONTH,
        )

        payment_secret = secretsmanager.Secret(
            self,
            "PaymentCredentials",
            secret_name=f"/forgearc/{self.stage}/payments",
            description="Stripe and Razorpay credentials; replace placeholder values after first deploy",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                secret_string_template=(
                    '{"stripeSecretKey":"","stripeWebhookSecret":"",'
                    '"razorpayKeyId":"","razorpayKeySecret":"",'
                    '"razorpayWebhookSecret":""}'
                ),
                generate_string_key="deploymentNonce",
                exclude_punctuation=True,
            ),
        )

        commerce = lambda_.Function(
            self,
            "CommerceApi",
            function_name=f"forgearc-commerce-{self.stage}",
            runtime=lambda_.Runtime.PYTHON_3_12,
            architecture=lambda_.Architecture.ARM_64,
            handler="app.lambda_handler.handler",
            code=lambda_.Code.from_asset(str(root / ".build" / "commerce-lambda")),
            memory_size=1024,
            timeout=Duration.seconds(30),
            tracing=lambda_.Tracing.ACTIVE,
            log_retention=logs.RetentionDays.ONE_MONTH,
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            security_groups=[lambda_sg],
            environment={
                "COMMERCE_TEST_MODE": "false",
                "COMMERCE_PUBLIC_BASE_URL": f"https://{self.domain}",
                "COMMERCE_DATABASE_SECRET_ARN": database.secret.secret_arn,
                "COMMERCE_PAYMENT_SECRET_ARN": payment_secret.secret_arn,
                "COMMERCE_CATALOG": "/var/task/catalog.yaml",
                "COMMERCE_ARTIFACT_DIR": "/var/task/artifacts",
                "SES_REGION": self.region,
                "SMTP_FROM": f"ForgeArc <{config['senderEmail']}>",
            },
        )
        database.secret.grant_read(commerce)
        payment_secret.grant_read(commerce)

        email_identity = ses.EmailIdentity(
            self,
            "ForgeArcEmailIdentity",
            identity=ses.Identity.public_hosted_zone(zone),
        )
        commerce.add_to_role_policy(
            iam.PolicyStatement(
                actions=["ses:SendEmail"],
                resources=[email_identity.email_identity_arn],
            )
        )

        api_access_logs = logs.LogGroup(
            self,
            "CommerceApiAccessLogs",
            retention=logs.RetentionDays.ONE_MONTH,
            removal_policy=RemovalPolicy.DESTROY,
        )
        api = apigateway.LambdaRestApi(
            self,
            "CommerceGateway",
            handler=commerce,
            proxy=True,
            cloud_watch_role=False,
            deploy_options=apigateway.StageOptions(
                stage_name=self.stage,
                tracing_enabled=True,
                metrics_enabled=True,
                data_trace_enabled=False,
                access_log_destination=apigateway.LogGroupLogDestination(api_access_logs),
                access_log_format=apigateway.AccessLogFormat.json_with_standard_fields(
                    caller=True,
                    http_method=True,
                    ip=True,
                    protocol=True,
                    request_time=True,
                    resource_path=True,
                    response_length=True,
                    status=True,
                    user=True,
                ),
            ),
        )
        api_domain = api.add_domain_name(
            "ApiDomain",
            domain_name=config["apiDomainName"],
            certificate=api_certificate,
            endpoint_type=apigateway.EndpointType.REGIONAL,
            security_policy=apigateway.SecurityPolicy.TLS_1_2,
        )
        route53.ARecord(
            self,
            "ApiAlias",
            zone=zone,
            record_name="api",
            target=route53.RecordTarget.from_alias(
                targets.ApiGatewayDomain(api_domain)
            ),
        )

        marketing_bucket = self._site_bucket("MarketingBucket")
        docs_bucket = self._site_bucket("DocsBucket")
        cache_policy = cloudfront.CachePolicy.CACHING_DISABLED
        api_origin_policy = cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER

        marketing_distribution = cloudfront.Distribution(
            self,
            "MarketingDistribution",
            domain_names=[self.domain, f"www.{self.domain}"],
            certificate=edge_certificate,
            default_root_object="index.html",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(marketing_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                compress=True,
            ),
            additional_behaviors={
                "api/*": cloudfront.BehaviorOptions(
                    origin=origins.RestApiOrigin(api),
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    cache_policy=cache_policy,
                    origin_request_policy=api_origin_policy,
                    compress=True,
                )
            },
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.seconds(0),
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.seconds(0),
                ),
            ],
            price_class=cloudfront.PriceClass.PRICE_CLASS_200,
            minimum_protocol_version=cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        )
        docs_distribution = cloudfront.Distribution(
            self,
            "DocsDistribution",
            domain_names=[config["docsDomainName"]],
            certificate=edge_certificate,
            default_root_object="index.html",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(docs_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                compress=True,
            ),
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=404,
                    response_page_path="/404.html",
                    ttl=Duration.minutes(5),
                )
            ],
            price_class=cloudfront.PriceClass.PRICE_CLASS_200,
            minimum_protocol_version=cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        )
        self._aliases(zone, marketing_distribution, docs_distribution)

        s3deploy.BucketDeployment(
            self,
            "DeployMarketing",
            destination_bucket=marketing_bucket,
            sources=[s3deploy.Source.asset(str(root / "apps" / "marketing" / "dist"))],
            distribution=marketing_distribution,
            distribution_paths=["/*"],
            prune=True,
        )
        s3deploy.BucketDeployment(
            self,
            "DeployDocs",
            destination_bucket=docs_bucket,
            sources=[
                s3deploy.Source.asset(
                    str(root / "apps" / "docs" / ".vitepress" / "dist")
                )
            ],
            distribution=docs_distribution,
            distribution_paths=["/*"],
            prune=True,
        )

        alarm_topic = sns.Topic(self, "OperationalAlarms")
        commerce.metric_errors(period=Duration.minutes(5)).create_alarm(
            self,
            "CommerceErrors",
            threshold=1,
            evaluation_periods=1,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cloudwatch_actions.SnsAction(alarm_topic))
        api.metric_server_error(period=Duration.minutes(5)).create_alarm(
            self,
            "ApiServerErrors",
            threshold=1,
            evaluation_periods=1,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cloudwatch_actions.SnsAction(alarm_topic))
        self._budget(config)

        cdk.CfnOutput(self, "WebsiteUrl", value=f"https://{self.domain}")
        cdk.CfnOutput(
            self,
            "MarketingCloudFrontUrl",
            value=f"https://{marketing_distribution.distribution_domain_name}",
        )
        cdk.CfnOutput(self, "DocsUrl", value=f"https://{config['docsDomainName']}")
        cdk.CfnOutput(
            self,
            "DocsCloudFrontUrl",
            value=f"https://{docs_distribution.distribution_domain_name}",
        )
        cdk.CfnOutput(self, "ApiUrl", value=f"https://{config['apiDomainName']}")
        cdk.CfnOutput(self, "PaymentSecretArn", value=payment_secret.secret_arn)
        cdk.CfnOutput(self, "AlarmTopicArn", value=alarm_topic.topic_arn)
        cdk.CfnOutput(self, "HostedZoneId", value=zone.hosted_zone_id)

    def _hosted_zone(self) -> route53.IHostedZone:
        zone_id = self.config.get("hostedZoneId", "")
        if zone_id:
            return route53.HostedZone.from_hosted_zone_attributes(
                self,
                "HostedZone",
                hosted_zone_id=zone_id,
                zone_name=self.config["hostedZoneName"],
            )
        raise ValueError(
            "hostedZoneId is empty and no hosted zone was supplied by the DNS stack"
        )

    def _site_bucket(self, construct_id: str) -> s3.Bucket:
        return s3.Bucket(
            self,
            construct_id,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            versioned=True,
            removal_policy=RemovalPolicy.RETAIN,
            auto_delete_objects=False,
        )

    def _aliases(
        self,
        zone: route53.IHostedZone,
        marketing: cloudfront.Distribution,
        docs: cloudfront.Distribution,
    ) -> None:
        for identifier, record_name, distribution in (
            ("Root", None, marketing),
            ("Www", "www", marketing),
            ("Docs", "docs", docs),
        ):
            route53.ARecord(
                self,
                f"Alias{identifier}",
                zone=zone,
                record_name=record_name,
                target=route53.RecordTarget.from_alias(
                    targets.CloudFrontTarget(distribution)
                ),
            )
            route53.AaaaRecord(
                self,
                f"AliasV6{identifier}",
                zone=zone,
                record_name=record_name,
                target=route53.RecordTarget.from_alias(
                    targets.CloudFrontTarget(distribution)
                ),
            )

    def _budget(self, config: dict) -> None:
        budgets.CfnBudget(
            self,
            "MonthlyBudget",
            budget=budgets.CfnBudget.BudgetDataProperty(
                budget_type="COST",
                time_unit="MONTHLY",
                budget_limit=budgets.CfnBudget.SpendProperty(
                    amount=float(config["monthlyBudgetUsd"]), unit="USD"
                ),
            ),
            notifications_with_subscribers=[
                budgets.CfnBudget.NotificationWithSubscribersProperty(
                    notification=budgets.CfnBudget.NotificationProperty(
                        comparison_operator="GREATER_THAN",
                        notification_type="FORECASTED",
                        threshold=80,
                        threshold_type="PERCENTAGE",
                    ),
                    subscribers=[
                        budgets.CfnBudget.SubscriberProperty(
                            address=config["senderEmail"],
                            subscription_type="EMAIL",
                        )
                    ],
                )
            ],
        )

    @staticmethod
    def _database_instance_type(value: str) -> ec2.InstanceType:
        return ec2.InstanceType(value)

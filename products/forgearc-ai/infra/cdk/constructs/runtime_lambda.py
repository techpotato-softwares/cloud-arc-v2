"""VPC-attached Lambda API (Mangum) and SQS worker."""

from __future__ import annotations

from aws_cdk import Aws, Duration
from aws_cdk import aws_apigatewayv2_authorizers as authorizers
from aws_cdk import aws_apigatewayv2_integrations as integrations
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_lambda_event_sources as sources
from aws_cdk import aws_logs as logs
from constructs import Construct

from constructs.bundling import lambda_code
from constructs.gateway import http_api
from constructs.iam import grant_application, runtime_environment
from constructs.platform import Platform


class LambdaRuntime(Construct):
    def __init__(self, scope: Construct, construct_id: str, *, platform: Platform):
        super().__init__(scope, construct_id)
        self.platform = platform
        security_group = ec2.SecurityGroup(
            self,
            "FunctionSecurityGroup",
            vpc=platform.vpc,
            description="ForgeArc AI Lambda functions",
            allow_all_outbound=False,
        )
        security_group.add_egress_rule(
            platform.proxy_security_group,
            ec2.Port.tcp(5432),
            "RDS Proxy",
        )
        security_group.add_egress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(443), "AWS APIs")
        platform.proxy_security_group.add_ingress_rule(
            security_group,
            ec2.Port.tcp(5432),
            "Lambda",
        )
        environment = runtime_environment(platform)
        code = lambda_code()
        retention = logs.RetentionDays.ONE_MONTH
        self.api_function = lambda_.Function(
            self,
            "ApiFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            architecture=lambda_.Architecture.X86_64,
            handler="handler.api_handler",
            code=code,
            timeout=Duration.seconds(29),
            memory_size=1024,
            environment=environment,
            vpc=platform.vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[security_group],
            log_retention=retention,
        )
        self.worker = lambda_.Function(
            self,
            "IngestFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            architecture=lambda_.Architecture.X86_64,
            handler="handler.handler",
            code=code,
            timeout=Duration.seconds(120),
            memory_size=1024,
            environment=environment,
            vpc=platform.vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[security_group],
            log_retention=retention,
        )
        self.worker.add_event_source(
            sources.SqsEventSource(
                platform.queue,
                batch_size=1,
                report_batch_item_failures=True,
                max_concurrency=20 if platform.is_prod else 2,
            )
        )
        if self.api_function.role is None or self.worker.role is None:
            raise RuntimeError("Lambda functions require execution roles.")
        grant_application(self.api_function.role, platform, worker=False)
        grant_application(self.worker.role, platform, worker=True)
        issuer = f"https://cognito-idp.{Aws.REGION}.amazonaws.com/{platform.user_pool.user_pool_id}"
        authorizer = authorizers.HttpJwtAuthorizer(
            "CognitoAuthorizer",
            issuer,
            jwt_audience=[platform.user_pool_client.user_pool_client_id],
        )
        self.http_api = http_api(
            self,
            "HttpApi",
            environment_name=platform.environment_name,
            authorizer=authorizer,
            integration=lambda name: integrations.HttpLambdaIntegration(name, self.api_function),
        )
        self.error_metric = self.api_function.metric_errors(period=Duration.minutes(5))
        self.latency_metric = self.api_function.metric_duration(
            period=Duration.minutes(5),
            statistic="p95",
        )
        self.unhealthy_metric = self.api_function.metric_throttles(period=Duration.minutes(5))
        self.latency_threshold = 10000

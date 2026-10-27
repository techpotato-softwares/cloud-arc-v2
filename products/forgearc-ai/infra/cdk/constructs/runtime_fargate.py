"""Private ECS Fargate API and worker behind API Gateway and an internal ALB."""

from __future__ import annotations

from aws_cdk import Aws, Duration, RemovalPolicy
from aws_cdk import aws_apigatewayv2 as apigwv2
from aws_cdk import aws_apigatewayv2_authorizers as authorizers
from aws_cdk import aws_apigatewayv2_integrations as integrations
from aws_cdk import aws_applicationautoscaling as appscaling
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_ecr as ecr
from aws_cdk import aws_ecs as ecs
from aws_cdk import aws_elasticloadbalancingv2 as elbv2
from aws_cdk import aws_logs as logs
from constructs import Construct

from constructs.gateway import http_api
from constructs.iam import grant_application, runtime_environment
from constructs.platform import Platform


class FargateRuntime(Construct):
    def __init__(self, scope: Construct, construct_id: str, *, platform: Platform):
        super().__init__(scope, construct_id)
        self.platform = platform
        image_tag = str(self.node.try_get_context("image_tag") or "latest")
        self.repository = ecr.Repository(
            self,
            "Images",
            repository_name=f"forgearc-ai-{platform.environment_name}",
            image_scan_on_push=True,
            encryption=ecr.RepositoryEncryption.KMS,
            encryption_key=platform.key,
            removal_policy=RemovalPolicy.RETAIN if platform.is_prod else RemovalPolicy.DESTROY,
            empty_on_delete=not platform.is_prod,
            lifecycle_rules=[ecr.LifecycleRule(max_image_count=20)],
        )
        image = ecs.ContainerImage.from_ecr_repository(self.repository, image_tag)
        self.cluster = ecs.Cluster(
            self,
            "Cluster",
            vpc=platform.vpc,
            cluster_name=f"forgearc-ai-{platform.environment_name}",
            container_insights=True,
        )
        environment = runtime_environment(platform)
        environment["AWS_REGION"] = Aws.REGION
        environment["AWS_DEFAULT_REGION"] = Aws.REGION
        log_retention = logs.RetentionDays.THREE_MONTHS if platform.is_prod else logs.RetentionDays.ONE_WEEK
        self.api_service, self.target_group, listener, vpc_link = self._api_service(
            platform,
            image,
            environment,
            log_retention,
        )
        self.worker_service = self._worker_service(platform, image, environment, log_retention)
        self.migration_task = self._migration_task(platform, image, environment, log_retention)
        self._scale(platform)
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
            integration=lambda name: integrations.HttpAlbIntegration(
                name,
                listener,
                vpc_link=vpc_link,
            ),
        )
        self.error_metric = cloudwatch.Metric(
            namespace="AWS/ApplicationELB",
            metric_name="HTTPCode_Target_5XX_Count",
            dimensions_map={
                "LoadBalancer": listener.load_balancer.load_balancer_full_name,
                "TargetGroup": self.target_group.target_group_full_name,
            },
            statistic="Sum",
            period=Duration.minutes(5),
        )
        self.latency_metric = self.target_group.metric_target_response_time(
            period=Duration.minutes(5),
            statistic="p95",
        )
        self.unhealthy_metric = self.target_group.metric_unhealthy_host_count(
            period=Duration.minutes(1),
            statistic="Maximum",
        )
        self.latency_threshold = 10

    def _api_service(self, platform, image, environment, log_retention):
        vpc_link_sg = ec2.SecurityGroup(
            self,
            "VpcLinkSecurityGroup",
            vpc=platform.vpc,
            description="API Gateway VPC link",
            allow_all_outbound=True,
        )
        alb_sg = ec2.SecurityGroup(
            self,
            "AlbSecurityGroup",
            vpc=platform.vpc,
            description="Internal API load balancer",
            allow_all_outbound=False,
        )
        api_sg = ec2.SecurityGroup(
            self,
            "ApiSecurityGroup",
            vpc=platform.vpc,
            description="ForgeArc AI API tasks",
            allow_all_outbound=False,
        )
        alb_sg.add_ingress_rule(vpc_link_sg, ec2.Port.tcp(80), "VPC link")
        alb_sg.add_egress_rule(api_sg, ec2.Port.tcp(8080), "API tasks")
        api_sg.add_ingress_rule(alb_sg, ec2.Port.tcp(8080), "Load balancer")
        api_sg.add_egress_rule(platform.proxy_security_group, ec2.Port.tcp(5432), "RDS Proxy")
        api_sg.add_egress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(443), "AWS APIs")
        platform.proxy_security_group.add_ingress_rule(api_sg, ec2.Port.tcp(5432), "API tasks")
        alb = elbv2.ApplicationLoadBalancer(
            self,
            "ApiLoadBalancer",
            vpc=platform.vpc,
            internet_facing=False,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_group=alb_sg,
            drop_invalid_header_fields=True,
        )
        listener = alb.add_listener("Http", port=80, open=False)
        task = self._task("ApiTask", platform, image, environment, log_retention, command=["api"], port=8080)
        grant_application(task.task_role, platform, worker=False)
        platform.key.grant_decrypt(task.obtain_execution_role())
        service = ecs.FargateService(
            self,
            "ApiService",
            cluster=self.cluster,
            task_definition=task,
            desired_count=2 if platform.is_prod else 1,
            assign_public_ip=False,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[api_sg],
            circuit_breaker=ecs.DeploymentCircuitBreaker(rollback=True),
            min_healthy_percent=100,
            max_healthy_percent=200,
            health_check_grace_period=Duration.seconds(60),
            platform_version=ecs.FargatePlatformVersion.LATEST,
        )
        target_group = elbv2.ApplicationTargetGroup(
            self,
            "ApiTargets",
            vpc=platform.vpc,
            port=8080,
            protocol=elbv2.ApplicationProtocol.HTTP,
            target_type=elbv2.TargetType.IP,
            deregistration_delay=Duration.seconds(30),
            health_check=elbv2.HealthCheck(
                path="/ready",
                healthy_http_codes="200",
                interval=Duration.seconds(30),
                timeout=Duration.seconds(5),
                healthy_threshold_count=2,
                unhealthy_threshold_count=3,
            ),
        )
        listener.add_target_groups("Api", target_groups=[target_group])
        service.attach_to_application_target_group(target_group)
        vpc_link = apigwv2.VpcLink(
            self,
            "VpcLink",
            vpc=platform.vpc,
            security_groups=[vpc_link_sg],
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
        )
        self.api_target_group = target_group
        return service, target_group, listener, vpc_link

    def _worker_service(self, platform, image, environment, log_retention):
        worker_sg = ec2.SecurityGroup(
            self,
            "WorkerSecurityGroup",
            vpc=platform.vpc,
            description="ForgeArc AI worker tasks",
            allow_all_outbound=False,
        )
        worker_sg.add_egress_rule(platform.proxy_security_group, ec2.Port.tcp(5432), "RDS Proxy")
        worker_sg.add_egress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(443), "AWS APIs")
        platform.proxy_security_group.add_ingress_rule(worker_sg, ec2.Port.tcp(5432), "Worker tasks")
        task = self._task(
            "WorkerTask",
            platform,
            image,
            environment,
            log_retention,
            command=["worker"],
            port=None,
        )
        grant_application(task.task_role, platform, worker=True)
        platform.key.grant_decrypt(task.obtain_execution_role())
        return ecs.FargateService(
            self,
            "WorkerService",
            cluster=self.cluster,
            task_definition=task,
            desired_count=1,
            assign_public_ip=False,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[worker_sg],
            circuit_breaker=ecs.DeploymentCircuitBreaker(rollback=True),
            min_healthy_percent=100,
            max_healthy_percent=200,
            platform_version=ecs.FargatePlatformVersion.LATEST,
        )

    def _migration_task(self, platform, image, environment, log_retention):
        migration_sg = ec2.SecurityGroup(
            self,
            "MigrationSecurityGroup",
            vpc=platform.vpc,
            description="One-off schema migration task",
            allow_all_outbound=False,
        )
        migration_sg.add_egress_rule(platform.proxy_security_group, ec2.Port.tcp(5432), "RDS Proxy")
        migration_sg.add_egress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(443), "AWS APIs")
        platform.proxy_security_group.add_ingress_rule(
            migration_sg,
            ec2.Port.tcp(5432),
            "Migration task",
        )
        self.migration_security_group = migration_sg
        task = self._task(
            "MigrationTask",
            platform,
            image,
            environment,
            log_retention,
            command=["migrate"],
            port=None,
            cpu=256,
            memory=512,
        )
        platform.database_secret.grant_read(task.task_role)
        platform.key.grant_decrypt(task.task_role)
        platform.key.grant_decrypt(task.obtain_execution_role())
        return task

    def _task(
        self,
        construct_id,
        platform,
        image,
        environment,
        log_retention,
        *,
        command,
        port,
        cpu=512,
        memory=1024,
    ):
        task = ecs.FargateTaskDefinition(
            self,
            construct_id,
            cpu=cpu,
            memory_limit_mib=memory,
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.X86_64,
                operating_system_family=ecs.OperatingSystemFamily.LINUX,
            ),
        )
        task.add_volume(name="tmp")
        linux = ecs.LinuxParameters(self, f"{construct_id}Linux", init_process_enabled=True)
        linux.drop_capabilities(ecs.Capability.ALL)
        container = task.add_container(
            "App",
            image=image,
            command=command,
            essential=True,
            environment=environment,
            logging=ecs.LogDrivers.aws_logs(stream_prefix=construct_id.lower(), log_retention=log_retention),
            readonly_root_filesystem=True,
            user="1000:1000",
            linux_parameters=linux,
            health_check=self._health_check(command[0]),
        )
        container.add_mount_points(
            ecs.MountPoint(container_path="/tmp", source_volume="tmp", read_only=False)
        )
        if port is not None:
            container.add_port_mappings(ecs.PortMapping(container_port=port, protocol=ecs.Protocol.TCP))
        return task

    def _health_check(self, command: str) -> ecs.HealthCheck | None:
        if command == "migrate":
            return None
        if command == "worker":
            probe = (
                "python -c \"import os,time; "
                "assert time.time()-os.path.getmtime('/tmp/worker-heartbeat')<90\""
            )
        else:
            probe = (
                "python -c \"import urllib.request; "
                "urllib.request.urlopen('http://127.0.0.1:8080/ready')\""
            )
        return ecs.HealthCheck(
            command=["CMD-SHELL", probe],
            interval=Duration.seconds(30),
            timeout=Duration.seconds(5),
            retries=3,
            start_period=Duration.seconds(40),
        )

    def _scale(self, platform: Platform) -> None:
        api_max = 10 if platform.is_prod else 4
        api_scaling = self.api_service.auto_scale_task_count(
            min_capacity=2 if platform.is_prod else 1,
            max_capacity=api_max,
        )
        api_scaling.scale_on_cpu_utilization("Cpu", target_utilization_percent=60)
        api_scaling.scale_on_request_count(
            "Requests",
            requests_per_target=100,
            target_group=self.api_target_group,
        )
        worker_scaling = self.worker_service.auto_scale_task_count(
            min_capacity=1,
            max_capacity=8 if platform.is_prod else 4,
        )
        worker_scaling.scale_on_metric(
            "QueueDepth",
            metric=platform.queue.metric_approximate_number_of_messages_visible(
                period=Duration.minutes(1),
                statistic="Average",
            ),
            scaling_steps=[
                appscaling.ScalingInterval(upper=0, change=-1),
                appscaling.ScalingInterval(lower=0, upper=5, change=0),
                appscaling.ScalingInterval(lower=5, upper=20, change=+1),
                appscaling.ScalingInterval(lower=20, change=+2),
            ],
            adjustment_type=appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
            cooldown=Duration.seconds(60),
        )

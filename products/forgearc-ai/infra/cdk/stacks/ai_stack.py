"""ForgeArc AI stack. Select the compute path with context runtime=lambda|fargate."""

from __future__ import annotations

from aws_cdk import CfnOutput, Stack, Tags
from constructs import Construct

from constructs.alarms import Monitoring
from constructs.data import DataPlane
from constructs.network import Network
from constructs.platform import Platform
from constructs.runtime_fargate import FargateRuntime
from constructs.runtime_lambda import LambdaRuntime
from constructs.security import Security


class AiStack(Stack):
    def __init__(
        self,
        scope: Construct,
        stack_id: str,
        *,
        environment_name: str,
        runtime: str | None = None,
        **kwargs,
    ):
        super().__init__(scope, stack_id, **kwargs)
        selected = str(runtime or self.node.try_get_context("runtime") or "lambda").lower()
        if selected not in {"lambda", "fargate"}:
            raise ValueError("runtime must be lambda or fargate")
        is_prod = environment_name == "prod"
        Tags.of(self).add("product", "forgearc-ai")
        Tags.of(self).add("environment", environment_name)
        Tags.of(self).add("runtime", selected)
        network = Network(self, "Network", environment_name=environment_name, is_prod=is_prod)
        security = Security(self, "Security", environment_name=environment_name, is_prod=is_prod)
        data = DataPlane(
            self,
            "Data",
            network=network,
            key=security.key,
            environment_name=environment_name,
            is_prod=is_prod,
        )
        platform = Platform(
            environment_name=environment_name,
            is_prod=is_prod,
            vpc=network.vpc,
            key=security.key,
            documents=data.documents,
            queue=data.queue,
            dead_letter=data.dead_letter,
            provider_secret=data.provider_secret,
            cluster=data.cluster,
            database_secret=data.database_secret,
            proxy=data.proxy,
            proxy_security_group=data.proxy_security_group,
            user_pool=security.user_pool,
            user_pool_client=security.user_pool_client,
            alarm_topic=security.alarm_topic,
            database_name=data.database_name,
        )
        if selected == "lambda":
            compute = LambdaRuntime(self, "LambdaRuntime", platform=platform)
            migration_arn = None
            cluster_name = None
            image_uri = None
        else:
            compute = FargateRuntime(self, "FargateRuntime", platform=platform)
            migration_arn = compute.migration_task.task_definition_arn
            cluster_name = compute.cluster.cluster_name
            image_uri = compute.repository.repository_uri
        max_capacity = 16 if is_prod else 2
        Monitoring(
            self,
            "Monitoring",
            platform=platform,
            http_api_id=compute.http_api.api_id,
            error_metric=compute.error_metric,
            latency_metric=compute.latency_metric,
            unhealthy_metric=compute.unhealthy_metric,
            latency_threshold=compute.latency_threshold,
            max_capacity=max_capacity,
        )
        CfnOutput(self, "Runtime", value=selected)
        CfnOutput(self, "ApiUrl", value=compute.http_api.api_endpoint)
        CfnOutput(self, "DocumentsBucket", value=data.documents.bucket_name)
        CfnOutput(self, "QueueUrl", value=data.queue.queue_url)
        CfnOutput(self, "DatabaseProxyEndpoint", value=data.proxy.endpoint)
        CfnOutput(self, "UserPoolId", value=security.user_pool.user_pool_id)
        CfnOutput(self, "UserPoolClientId", value=security.user_pool_client.user_pool_client_id)
        if migration_arn:
            CfnOutput(self, "MigrationTaskDefinitionArn", value=migration_arn)
        if cluster_name:
            CfnOutput(self, "ClusterName", value=cluster_name)
        if image_uri:
            CfnOutput(self, "ImageRepositoryUri", value=image_uri)
            CfnOutput(self, "MigrationSecurityGroupId", value=compute.migration_security_group.security_group_id)

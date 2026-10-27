"""Private VPC for ForgeArc AI workloads and Aurora."""

from __future__ import annotations

from aws_cdk import RemovalPolicy
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_logs as logs
from constructs import Construct


class Network(Construct):
    def __init__(self, scope: Construct, construct_id: str, *, environment_name: str, is_prod: bool):
        super().__init__(scope, construct_id)
        self.vpc = ec2.Vpc(
            self,
            "Vpc",
            vpc_name=f"forgearc-ai-{environment_name}",
            max_azs=2,
            nat_gateways=2 if is_prod else 1,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="isolated",
                    subnet_type=ec2.SubnetType.PRIVATE_ISOLATED,
                    cidr_mask=24,
                ),
            ],
        )
        self.vpc.add_gateway_endpoint(
            "S3Endpoint",
            service=ec2.GatewayVpcEndpointAwsService.S3,
        )
        retention = logs.RetentionDays.THREE_MONTHS if is_prod else logs.RetentionDays.ONE_WEEK
        flow_logs = logs.LogGroup(
            self,
            "FlowLogs",
            retention=retention,
            removal_policy=RemovalPolicy.RETAIN if is_prod else RemovalPolicy.DESTROY,
        )
        ec2.FlowLog(
            self,
            "VpcFlowLog",
            resource_type=ec2.FlowLogResourceType.from_vpc(self.vpc),
            destination=ec2.FlowLogDestination.to_cloud_watch_logs(flow_logs),
        )

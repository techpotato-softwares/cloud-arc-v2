"""Synth checks for the selectable Lambda and Fargate architectures."""

from __future__ import annotations

import pytest
from aws_cdk import App
from aws_cdk.assertions import Match, Template

from stacks.ai_stack import AiStack


def _template(runtime: str, environment_name: str = "dev") -> Template:
    app = App()
    stack = AiStack(
        app,
        f"AiStack-{environment_name}",
        environment_name=environment_name,
        runtime=runtime,
    )
    return Template.from_stack(stack)


def test_runtime_must_be_lambda_or_fargate():
    with pytest.raises(ValueError, match="runtime must be lambda or fargate"):
        AiStack(App(), "AiStack-dev", environment_name="dev", runtime="ec2")


def test_lambda_and_fargate_share_private_data_and_cognito():
    template = _template("lambda")
    template.has_resource_properties(
        "AWS::RDS::DBCluster",
        {
            "Engine": "aurora-postgresql",
            "StorageEncrypted": True,
            "DeletionProtection": False,
            "DatabaseName": "forgearc_ai",
            "ServerlessV2ScalingConfiguration": {"MinCapacity": 0.5, "MaxCapacity": 2},
        },
    )
    template.has_resource_properties(
        "AWS::RDS::DBProxy",
        {"RequireTLS": True, "EngineFamily": "POSTGRESQL"},
    )
    template.resource_count_is("AWS::Cognito::UserPoolGroup", 4)
    template.has_resource_properties(
        "AWS::Cognito::UserPool",
        {"Schema": Match.array_with([Match.object_like({"Name": "tenant_id"})])},
    )
    template.has_resource_properties(
        "AWS::S3::Bucket",
        {"PublicAccessBlockConfiguration": Match.object_like({"BlockPublicAcls": True})},
    )
    template.has_resource_properties("AWS::Lambda::Function", {"Handler": "handler.api_handler"})
    template.has_resource_properties(
        "AWS::Lambda::Function",
        {"Handler": "handler.handler", "VpcConfig": Match.any_value()},
    )
    template.has_resource_properties(
        "AWS::Lambda::EventSourceMapping",
        {"FunctionResponseTypes": ["ReportBatchItemFailures"]},
    )
    template.resource_count_is("AWS::ECS::Service", 0)
    assert template.find_resources("AWS::CloudWatch::Alarm")
    assert template.find_resources("AWS::Budgets::Budget")
    _assert_scoped_data_policies(template)
    _assert_no_public_ingress(template)


def test_fargate_is_private_and_keeps_a_migration_task():
    template = _template("fargate")
    template.resource_count_is("AWS::ECS::Service", 2)
    template.has_resource_properties(
        "AWS::ElasticLoadBalancingV2::LoadBalancer",
        {"Scheme": "internal"},
    )
    template.resource_count_is("AWS::ApiGatewayV2::VpcLink", 1)
    template.has_resource_properties(
        "AWS::ECS::Service",
        {
            "LaunchType": "FARGATE",
            "DeploymentConfiguration": {
                "DeploymentCircuitBreaker": {"Enable": True, "Rollback": True},
            },
        },
    )
    commands = []
    readonly = False
    dropped_all = False
    for task in template.find_resources("AWS::ECS::TaskDefinition").values():
        for container in task["Properties"]["ContainerDefinitions"]:
            commands.append(container.get("Command"))
            readonly = readonly or container.get("ReadonlyRootFilesystem") is True
            dropped = ((container.get("LinuxParameters") or {}).get("Capabilities") or {}).get("Drop") or []
            dropped_all = dropped_all or "ALL" in dropped
    assert ["migrate"] in commands
    assert ["worker"] in commands
    assert ["api"] in commands
    assert readonly and dropped_all
    handlers = [
        resource["Properties"].get("Handler")
        for resource in template.find_resources("AWS::Lambda::Function").values()
    ]
    assert "handler.api_handler" not in handlers
    assert template.find_resources("AWS::ApplicationAutoScaling::ScalingPolicy")
    _assert_no_public_ingress(template)


def test_production_fargate_protects_the_database():
    template = _template("fargate", "prod")
    template.has_resource_properties(
        "AWS::RDS::DBCluster",
        {
            "DeletionProtection": True,
            "ServerlessV2ScalingConfiguration": {"MinCapacity": 1, "MaxCapacity": 16},
        },
    )


def _assert_scoped_data_policies(template: Template) -> None:
    for resource in template.find_resources("AWS::IAM::Policy").values():
        for statement in resource["Properties"].get("PolicyDocument", {}).get("Statement", []):
            actions = statement.get("Action", [])
            if isinstance(actions, str):
                actions = [actions]
            if not any(action.startswith(("s3:", "sqs:", "bedrock:")) for action in actions):
                continue
            assert "*" not in actions
            resources = statement.get("Resource", [])
            if isinstance(resources, str):
                resources = [resources]
            assert "*" not in resources


def _assert_no_public_ingress(template: Template) -> None:
    rules = []
    for resource in template.find_resources("AWS::EC2::SecurityGroup").values():
        rules.extend(resource["Properties"].get("SecurityGroupIngress") or [])
    for resource in template.find_resources("AWS::EC2::SecurityGroupIngress").values():
        rules.append(resource["Properties"])
    for rule in rules:
        assert rule.get("CidrIp") != "0.0.0.0/0"
        assert rule.get("CidrIpv6") != "::/0"

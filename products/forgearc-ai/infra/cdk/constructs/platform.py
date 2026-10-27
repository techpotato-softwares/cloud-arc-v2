"""Shared values passed from the data plane into a runtime."""

from __future__ import annotations

from dataclasses import dataclass

from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_kms as kms
from aws_cdk import aws_rds as rds
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_secretsmanager as secrets
from aws_cdk import aws_sns as sns
from aws_cdk import aws_sqs as sqs


@dataclass
class Platform:
    environment_name: str
    is_prod: bool
    vpc: ec2.IVpc
    key: kms.IKey
    documents: s3.IBucket
    queue: sqs.IQueue
    dead_letter: sqs.IQueue
    provider_secret: secrets.ISecret
    cluster: rds.IDatabaseCluster
    database_secret: secrets.ISecret
    proxy: rds.DatabaseProxy
    proxy_security_group: ec2.ISecurityGroup
    user_pool: cognito.IUserPool
    user_pool_client: cognito.IUserPoolClient
    alarm_topic: sns.ITopic
    database_name: str = "forgearc_ai"

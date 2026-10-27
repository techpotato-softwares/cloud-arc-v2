"""S3, SQS, Aurora Serverless v2, and RDS Proxy."""

from __future__ import annotations

from aws_cdk import Duration, RemovalPolicy
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_kms as kms
from aws_cdk import aws_rds as rds
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_secretsmanager as secrets
from aws_cdk import aws_sqs as sqs
from constructs import Construct

from constructs.network import Network

DATABASE_NAME = "forgearc_ai"
SECRET_EXCLUDE = " %+~`#$&*()|[]{}:;<>?!'/@\"\\"


class DataPlane(Construct):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        network: Network,
        key: kms.IKey,
        environment_name: str,
        is_prod: bool,
    ):
        super().__init__(scope, construct_id)
        self.database_name = DATABASE_NAME
        removal = RemovalPolicy.RETAIN if is_prod else RemovalPolicy.DESTROY
        self.documents = s3.Bucket(
            self,
            "Documents",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.KMS,
            encryption_key=key,
            bucket_key_enabled=True,
            enforce_ssl=True,
            versioned=True,
            auto_delete_objects=not is_prod,
            removal_policy=removal,
            lifecycle_rules=[
                s3.LifecycleRule(abort_incomplete_multipart_upload_after=Duration.days(7)),
            ],
        )
        self.dead_letter = sqs.Queue(
            self,
            "IngestDeadLetter",
            retention_period=Duration.days(14),
            encryption=sqs.QueueEncryption.SQS_MANAGED,
            enforce_ssl=True,
        )
        self.queue = sqs.Queue(
            self,
            "IngestQueue",
            visibility_timeout=Duration.seconds(180),
            retention_period=Duration.days(4),
            encryption=sqs.QueueEncryption.SQS_MANAGED,
            enforce_ssl=True,
            dead_letter_queue=sqs.DeadLetterQueue(max_receive_count=3, queue=self.dead_letter),
        )
        self.provider_secret = secrets.Secret(
            self,
            "ProviderSecrets",
            secret_name=f"forgearc-ai/{environment_name}",
            encryption_key=key,
            description="ForgeArc AI provider credentials",
        )
        self.database_security_group = ec2.SecurityGroup(
            self,
            "DatabaseSecurityGroup",
            vpc=network.vpc,
            description="Aurora PostgreSQL for ForgeArc AI",
            allow_all_outbound=False,
        )
        self.proxy_security_group = ec2.SecurityGroup(
            self,
            "ProxySecurityGroup",
            vpc=network.vpc,
            description="RDS Proxy for ForgeArc AI",
            allow_all_outbound=True,
        )
        self.database_security_group.add_ingress_rule(
            self.proxy_security_group,
            ec2.Port.tcp(5432),
            "RDS Proxy",
        )
        if is_prod:
            writer = rds.ClusterInstance.serverless_v2(
                "Writer",
                publicly_accessible=False,
                enable_performance_insights=True,
                performance_insight_encryption_key=key,
            )
        else:
            writer = rds.ClusterInstance.serverless_v2("Writer", publicly_accessible=False)
        cluster_args: dict = {
            "engine": rds.DatabaseClusterEngine.aurora_postgres(
                version=rds.AuroraPostgresEngineVersion.VER_16_6
            ),
            "credentials": rds.Credentials.from_generated_secret(
                "forgearc",
                secret_name=f"forgearc-ai/{environment_name}/database",
                encryption_key=key,
                exclude_characters=SECRET_EXCLUDE,
            ),
            "writer": writer,
            "serverless_v2_min_capacity": 1 if is_prod else 0.5,
            "serverless_v2_max_capacity": 16 if is_prod else 2,
            "vpc": network.vpc,
            "vpc_subnets": ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            "security_groups": [self.database_security_group],
            "default_database_name": DATABASE_NAME,
            "storage_encrypted": True,
            "storage_encryption_key": key,
            "deletion_protection": is_prod,
            "removal_policy": RemovalPolicy.SNAPSHOT if is_prod else RemovalPolicy.DESTROY,
            "backup": rds.BackupProps(retention=Duration.days(14 if is_prod else 1)),
            "cloudwatch_logs_exports": ["postgresql"],
            "iam_authentication": False,
        }
        if is_prod:
            cluster_args["readers"] = [
                rds.ClusterInstance.serverless_v2(
                    "Reader",
                    scale_with_writer=True,
                    publicly_accessible=False,
                )
            ]
        self.cluster = rds.DatabaseCluster(self, "Cluster", **cluster_args)
        secret = self.cluster.secret
        if secret is None:
            raise RuntimeError("Aurora cluster did not create a credentials secret.")
        self.database_secret = secret
        rotation_sg = ec2.SecurityGroup(
            self,
            "RotationSecurityGroup",
            vpc=network.vpc,
            description="Database password rotation",
            allow_all_outbound=False,
        )
        rotation_sg.add_egress_rule(self.database_security_group, ec2.Port.tcp(5432), "Aurora")
        rotation_sg.add_egress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(443), "Secrets Manager")
        self.database_security_group.add_ingress_rule(
            rotation_sg,
            ec2.Port.tcp(5432),
            "Password rotation",
        )
        self.cluster.add_rotation_single_user(
            automatically_after=Duration.days(30),
            rotate_immediately_on_update=False,
            security_group=rotation_sg,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            exclude_characters=SECRET_EXCLUDE,
        )
        self.proxy = rds.DatabaseProxy(
            self,
            "Proxy",
            proxy_target=rds.ProxyTarget.from_cluster(self.cluster),
            secrets=[self.database_secret],
            vpc=network.vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[self.proxy_security_group],
            require_tls=True,
            iam_auth=False,
            debug_logging=False,
            max_connections_percent=90,
            max_idle_connections_percent=50,
            borrow_timeout=Duration.seconds(30),
        )

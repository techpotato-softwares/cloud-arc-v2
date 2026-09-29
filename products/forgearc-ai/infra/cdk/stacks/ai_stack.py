from __future__ import annotations

from aws_cdk import Duration, Stack
from aws_cdk import aws_apigateway as apigw
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_cloudwatch_actions as actions
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_lambda_event_sources as sources
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_secretsmanager as secrets
from aws_cdk import aws_sns as sns
from aws_cdk import aws_sqs as sqs
from constructs import Construct

from forgearc_ai_aws.aws import api_statements, worker_statements


class AiStack(Stack):
    def __init__(self, scope: Construct, stack_id: str, environment_name: str, **kwargs):
        super().__init__(scope, stack_id, **kwargs)
        region = self.region
        documents = s3.Bucket(
            self,
            "Documents",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
        )
        dead_letter = sqs.Queue(self, "IngestDeadLetter", retention_period=Duration.days(14))
        queue = sqs.Queue(
            self,
            "IngestQueue",
            visibility_timeout=Duration.seconds(180),
            dead_letter_queue=sqs.DeadLetterQueue(max_receive_count=3, queue=dead_letter),
        )
        secret = secrets.Secret(self, "ProviderSecrets", secret_name=f"forgearc-ai/{environment_name}")
        code = lambda_.Code.from_asset("assets")
        runtime_environment = {
            "APP_NAME": "forgearc-ai",
            "FORGEARC_AI_ENVIRONMENT": (
                "prod" if environment_name == "prod" else "local"
            ),
            "FORGEARC_AI_CLOUD": "aws",
            "FORGEARC_AI_BUCKET": documents.bucket_name,
            "FORGEARC_AI_QUEUE_URL": queue.queue_url,
            "FORGEARC_AI_SECRET_ID": secret.secret_name,
        }
        api_function = lambda_.Function(
            self,
            "ApiFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="handler.api_handler",
            code=code,
            timeout=Duration.seconds(30),
            memory_size=512,
            environment=runtime_environment,
        )
        worker = lambda_.Function(
            self,
            "IngestFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=code,
            timeout=Duration.seconds(120),
            memory_size=1024,
            environment=runtime_environment,
        )
        worker.add_event_source(sources.SqsEventSource(queue, batch_size=1, report_batch_item_failures=True))
        self._grant(api_function, api_statements(documents.bucket_arn, queue.queue_arn, secret.secret_arn, region))
        self._grant(worker, worker_statements(documents.bucket_arn, queue.queue_arn, secret.secret_arn, region))
        apigw.LambdaRestApi(
            self,
            "HttpApi",
            handler=api_function,
            proxy=True,
            deploy_options=apigw.StageOptions(stage_name=environment_name),
        )
        alarm = cloudwatch.Alarm(
            self,
            "DeadLetterAlarm",
            metric=dead_letter.metric_approximate_number_of_messages_visible(),
            threshold=1,
            evaluation_periods=1,
            alarm_description="ForgeArc AI ingestion jobs reached the dead-letter queue.",
        )
        topic = sns.Topic(self, "DeadLetterTopic")
        alarm.add_alarm_action(actions.SnsAction(topic))

    def _grant(self, function: lambda_.Function, statements: list[dict]) -> None:
        for statement in statements:
            function.add_to_role_policy(iam.PolicyStatement(actions=statement["actions"], resources=statement["resources"]))

"""Alarms for the queue, API, tasks, database, and monthly budget."""

from __future__ import annotations

from aws_cdk import Duration
from aws_cdk import aws_budgets as budgets
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_cloudwatch_actions as actions
from constructs import Construct

from constructs.platform import Platform


class Monitoring(Construct):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        platform: Platform,
        http_api_id: str,
        error_metric: cloudwatch.IMetric,
        latency_metric: cloudwatch.IMetric,
        unhealthy_metric: cloudwatch.IMetric,
        latency_threshold: float,
        max_capacity: float,
    ):
        super().__init__(scope, construct_id)
        topic = platform.alarm_topic
        self._alarm(
            "DeadLetterAlarm",
            platform.dead_letter.metric_approximate_number_of_messages_visible(
                period=Duration.minutes(1),
                statistic="Maximum",
            ),
            threshold=1,
            description="ForgeArc AI ingestion jobs reached the dead-letter queue.",
            topic=topic,
        )
        self._alarm(
            "Api5xxAlarm",
            cloudwatch.Metric(
                namespace="AWS/ApiGateway",
                metric_name="5xx",
                dimensions_map={"ApiId": http_api_id, "Stage": "$default"},
                statistic="Sum",
                period=Duration.minutes(5),
            ),
            threshold=5,
            description="ForgeArc AI API Gateway is returning 5xx responses.",
            topic=topic,
        )
        self._alarm(
            "ApiLatencyAlarm",
            cloudwatch.Metric(
                namespace="AWS/ApiGateway",
                metric_name="Latency",
                dimensions_map={"ApiId": http_api_id, "Stage": "$default"},
                statistic="p95",
                period=Duration.minutes(5),
            ),
            threshold=10000,
            description="ForgeArc AI API Gateway p95 latency is above 10 seconds.",
            topic=topic,
            evaluation_periods=3,
        )
        self._alarm(
            "RuntimeErrors",
            error_metric,
            threshold=5,
            description="ForgeArc AI runtime errors are elevated.",
            topic=topic,
        )
        self._alarm(
            "Latency",
            latency_metric,
            threshold=latency_threshold,
            description="ForgeArc AI runtime p95 latency is elevated.",
            topic=topic,
            evaluation_periods=3,
        )
        self._alarm(
            "Unhealthy",
            unhealthy_metric,
            threshold=1,
            description="ForgeArc AI tasks or functions are unhealthy.",
            topic=topic,
        )
        cluster_id = platform.cluster.cluster_identifier
        self._alarm(
            "DatabaseConnections",
            cloudwatch.Metric(
                namespace="AWS/RDS",
                metric_name="DatabaseConnections",
                dimensions_map={"DBClusterIdentifier": cluster_id},
                statistic="Average",
                period=Duration.minutes(5),
            ),
            threshold=80 if platform.is_prod else 40,
            description="Aurora connection count is high.",
            topic=topic,
        )
        self._alarm(
            "DatabaseCapacity",
            cloudwatch.Metric(
                namespace="AWS/RDS",
                metric_name="ServerlessDatabaseCapacity",
                dimensions_map={"DBClusterIdentifier": cluster_id},
                statistic="Average",
                period=Duration.minutes(5),
            ),
            threshold=max_capacity * 0.9,
            description="Aurora Serverless v2 capacity is near its maximum.",
            topic=topic,
            evaluation_periods=3,
        )
        self._alarm(
            "ProxyConnections",
            cloudwatch.Metric(
                namespace="AWS/RDS",
                metric_name="DatabaseConnectionsCurrentlyBorrowed",
                dimensions_map={"ProxyName": platform.proxy.db_proxy_name},
                statistic="Average",
                period=Duration.minutes(5),
            ),
            threshold=80 if platform.is_prod else 40,
            description="RDS Proxy borrowed connection count is high.",
            topic=topic,
        )
        amount = self.node.try_get_context("monthly_budget_usd")
        limit = float(amount or (500 if platform.is_prod else 100))
        budgets.CfnBudget(
            self,
            "MonthlyBudget",
            budget=budgets.CfnBudget.BudgetDataProperty(
                budget_name=f"forgearc-ai-{platform.environment_name}",
                budget_type="COST",
                time_unit="MONTHLY",
                budget_limit=budgets.CfnBudget.SpendProperty(amount=limit, unit="USD"),
            ),
            notifications_with_subscribers=[
                budgets.CfnBudget.NotificationWithSubscribersProperty(
                    notification=budgets.CfnBudget.NotificationProperty(
                        comparison_operator="GREATER_THAN",
                        notification_type="ACTUAL",
                        threshold=80,
                        threshold_type="PERCENTAGE",
                    ),
                    subscribers=[
                        budgets.CfnBudget.SubscriberProperty(
                            address=topic.topic_arn,
                            subscription_type="SNS",
                        )
                    ],
                )
            ],
        )

    def _alarm(self, name, metric, *, threshold, description, topic, evaluation_periods=1):
        alarm = cloudwatch.Alarm(
            self,
            name,
            metric=metric,
            threshold=threshold,
            evaluation_periods=evaluation_periods,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
            alarm_description=description,
        )
        alarm.add_alarm_action(actions.SnsAction(topic))
        return alarm

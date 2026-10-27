"""KMS, Cognito, and the alarm topic shared by both runtimes."""

from __future__ import annotations

from aws_cdk import Aws, Duration, RemovalPolicy
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_iam as iam
from aws_cdk import aws_kms as kms
from aws_cdk import aws_sns as sns
from constructs import Construct

GROUP_PERMISSIONS = {
    "ai-admin": ["ai:chat", "ai:ingest", "ai:read", "ai:delete", "ai:decide", "ai:agent", "ai:evaluate", "ai:approve"],
    "ai-operator": ["ai:chat", "ai:ingest", "ai:read", "ai:decide", "ai:agent"],
    "ai-reviewer": ["ai:read", "ai:approve"],
    "ai-reader": ["ai:read"],
}


class Security(Construct):
    def __init__(self, scope: Construct, construct_id: str, *, environment_name: str, is_prod: bool):
        super().__init__(scope, construct_id)
        self.key = kms.Key(
            self,
            "DataKey",
            alias=f"alias/forgearc-ai-{environment_name}",
            description=f"ForgeArc AI data key ({environment_name})",
            enable_key_rotation=True,
            removal_policy=RemovalPolicy.RETAIN if is_prod else RemovalPolicy.DESTROY,
        )
        self.key.add_to_resource_policy(
            iam.PolicyStatement(
                principals=[iam.ServicePrincipal("cloudwatch.amazonaws.com")],
                actions=["kms:Decrypt", "kms:GenerateDataKey*"],
                resources=["*"],
            )
        )
        self.key.add_to_resource_policy(
            iam.PolicyStatement(
                principals=[iam.ServicePrincipal("budgets.amazonaws.com")],
                actions=["kms:Decrypt", "kms:GenerateDataKey*"],
                resources=["*"],
            )
        )
        self.alarm_topic = sns.Topic(
            self,
            "Alarms",
            topic_name=f"forgearc-ai-{environment_name}-alarms",
            master_key=self.key,
        )
        self.alarm_topic.add_to_resource_policy(
            iam.PolicyStatement(
                principals=[iam.ServicePrincipal("budgets.amazonaws.com")],
                actions=["sns:Publish"],
                resources=[self.alarm_topic.topic_arn],
                conditions={"StringEquals": {"aws:SourceAccount": Aws.ACCOUNT_ID}},
            )
        )
        callback = self.node.try_get_context("cognito_callback_url") or "https://localhost/oauth/callback"
        logout = self.node.try_get_context("cognito_logout_url") or "https://localhost/oauth/logout"
        removal = RemovalPolicy.RETAIN if is_prod else RemovalPolicy.DESTROY
        self.user_pool = cognito.UserPool(
            self,
            "Users",
            user_pool_name=f"forgearc-ai-{environment_name}",
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(email=True),
            sign_in_case_sensitive=False,
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
            ),
            custom_attributes={
                "tenant_id": cognito.StringAttribute(min_len=1, max_len=64, mutable=True),
            },
            password_policy=cognito.PasswordPolicy(
                min_length=12,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
            ),
            mfa=cognito.Mfa.OPTIONAL,
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=removal,
        )
        self.user_pool_client = self.user_pool.add_client(
            "ApiClient",
            user_pool_client_name=f"forgearc-ai-{environment_name}",
            generate_secret=False,
            prevent_user_existence_errors=True,
            auth_flows=cognito.AuthFlow(user_srp=True, admin_user_password=True),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE,
                ],
                callback_urls=[callback],
                logout_urls=[logout],
            ),
            supported_identity_providers=[cognito.UserPoolClientIdentityProvider.COGNITO],
            access_token_validity=Duration.hours(1),
            id_token_validity=Duration.hours(1),
            refresh_token_validity=Duration.days(30),
        )
        for index, (name, permissions) in enumerate(GROUP_PERMISSIONS.items()):
            cognito.CfnUserPoolGroup(
                self,
                f"Group{name}",
                user_pool_id=self.user_pool.user_pool_id,
                group_name=name,
                description=f"ForgeArc AI permissions: {','.join(permissions)}",
                precedence=index + 1,
            )

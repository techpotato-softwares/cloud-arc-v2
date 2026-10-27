"""HTTP API routes shared by the Lambda and Fargate integrations."""

from __future__ import annotations

from collections.abc import Callable

from aws_cdk import Duration
from aws_cdk import aws_apigatewayv2 as apigwv2
from constructs import Construct


def http_api(
    scope: Construct,
    construct_id: str,
    *,
    environment_name: str,
    authorizer: apigwv2.IHttpRouteAuthorizer,
    integration: Callable[[str], apigwv2.HttpRouteIntegration],
) -> apigwv2.HttpApi:
    origin = scope.node.try_get_context("cors_origin")
    cors = None
    if origin:
        cors = apigwv2.CorsPreflightOptions(
            allow_origins=[str(origin)],
            allow_methods=[
                apigwv2.CorsHttpMethod.GET,
                apigwv2.CorsHttpMethod.POST,
                apigwv2.CorsHttpMethod.DELETE,
                apigwv2.CorsHttpMethod.OPTIONS,
            ],
            allow_headers=["authorization", "content-type"],
            max_age=Duration.hours(1),
        )
    api = apigwv2.HttpApi(
        scope,
        construct_id,
        api_name=f"forgearc-ai-{environment_name}",
        default_authorizer=authorizer,
        cors_preflight=cors,
        create_default_stage=True,
    )
    none = apigwv2.HttpNoneAuthorizer()
    api.add_routes(
        path="/health",
        methods=[apigwv2.HttpMethod.GET],
        integration=integration("Health"),
        authorizer=none,
    )
    api.add_routes(
        path="/ready",
        methods=[apigwv2.HttpMethod.GET],
        integration=integration("Ready"),
        authorizer=none,
    )
    api.add_routes(
        path="/",
        methods=[apigwv2.HttpMethod.ANY],
        integration=integration("Root"),
    )
    api.add_routes(
        path="/{proxy+}",
        methods=[apigwv2.HttpMethod.ANY],
        integration=integration("Proxy"),
    )
    return api

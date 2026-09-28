from __future__ import annotations

import aws_cdk as cdk
from aws_cdk import Stack, aws_route53 as route53
from constructs import Construct


class ForgeArcDnsStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        zone_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)
        self.zone = route53.PublicHostedZone(
            self,
            "HostedZone",
            zone_name=zone_name,
            comment="ForgeArc public DNS",
        )

        cdk.CfnOutput(self, "HostedZoneId", value=self.zone.hosted_zone_id)
        cdk.CfnOutput(
            self,
            "NameServers",
            value=cdk.Fn.join(",", self.zone.hosted_zone_name_servers or []),
            description="Set these nameservers at the domain registrar",
        )

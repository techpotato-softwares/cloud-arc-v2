# @arcforge/infra

Stub package for the **7-stack** ArcForge CDK layout from the Technical Initiation doc.

| Stack | File | Purpose |
|-------|------|---------|
| Network | `src/stacks/network-stack.ts` | VPC, subnets, NAT |
| Data | `src/stacks/data-stack.ts` | RDS, RDS Proxy, Redis |
| Storage | `src/stacks/storage-stack.ts` | S3, CloudFront origins |
| Queue | `src/stacks/queue-stack.ts` | SQS, SNS, EventBridge |
| Services | `src/stacks/services-stack.ts` | Lambda + ECS service wiring |
| ApiGateway | `src/stacks/api-gateway-stack.ts` | HTTP API v2, WAF |
| Monitoring | `src/stacks/monitoring-stack.ts` | CloudWatch, alarms |

**Current deploy path:** [`cdk/`](../../cdk/) (CloudArc `ApiStack` + constructs). Phase 1 copies constructs here and splits stacks incrementally.

Constructs: `src/constructs/core/solar-ecs-express-service.ts` (ECS Express Mode for auth, invoicing, mobile-api, ai-service).

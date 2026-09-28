# Deploy the ForgeArc platform

The `Deploy ForgeArc platform` GitHub Actions workflow builds and deploys:

- the Vue marketing and checkout website on CloudFront
- the VitePress documentation on CloudFront
- the FastAPI commerce API on Lambda and API Gateway, served through the
  marketing distribution at `/api/*`
- private S3 origins, on-demand DynamoDB, Secrets Manager, CloudWatch alarms,
  and an AWS Budget

Infrastructure settings are committed in `infra/cdk/config.json`. The workflow
requires only `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as GitHub Actions
secrets. The IAM identity behind those keys must be allowed to bootstrap and
deploy CDK/CloudFormation and create the resources listed above.

## Deploy without a custom domain (default)

`"customDomain": false` deploys on the default CloudFront URLs. No certificate,
Route 53 zone, or registrar change is needed, so nothing waits on DNS.

1. Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub repository
   **Settings → Secrets and variables → Actions → Repository secrets**.
2. Run **Deploy ForgeArc platform** from the Actions tab with **dns_only**
   disabled.

The marketing site reads the documentation URL from `runtime-config.json`,
which CDK writes at deploy time. Checkout redirects back to the CloudFront URL
the buyer used.

Purchase email is stored but not sent in this mode, because SES needs a
verified domain. Enable a custom domain before taking real orders.

## Add the custom domain later

1. Set `"customDomain": true` in `infra/cdk/config.json` and confirm the
   `domainName`, `docsDomainName`, and `apiDomainName` values.
2. Run the workflow with **dns_only** enabled. Copy the `NameServers` output
   from the job summary and set them as the nameservers at your registrar.
3. When the nameservers are visible publicly, run the workflow with
   **dns_only** disabled. ACM certificates validate, and the stack adds the
   domains, Route 53 records, and SES domain identity.

If the Route 53 zone already exists, set `hostedZoneId` in
`infra/cdk/config.json` instead of running the DNS-only step.

If the full deploy runs before the registrar uses the Route 53 nameservers,
certificate validation waits silently for up to 72 hours and the stack appears
stuck.

## Deployment URLs

The GitHub Actions job summary lists:

- `WebsiteUrl` and `MarketingCloudFrontUrl`: marketing website
- `DocsUrl` and `DocsCloudFrontUrl`: documentation
- `ApiUrl`: commerce API base
- `StripeWebhookUrl` and `RazorpayWebhookUrl`: provider webhook endpoints

Without a custom domain, the branded and CloudFront URLs are the same.

## Payment credentials

CDK creates the payment secret at `/forgearc/prod/payments` with empty fields.
After the first deployment, set its value in AWS Secrets Manager:

```json
{
  "stripeSecretKey": "sk_live_...",
  "stripeWebhookSecret": "whsec_...",
  "razorpayKeyId": "rzp_live_...",
  "razorpayKeySecret": "...",
  "razorpayWebhookSecret": "..."
}
```

Payment credentials never belong in GitHub Actions or the repository.

Register the `StripeWebhookUrl` output for `checkout.session.completed` and the
`RazorpayWebhookUrl` output for `payment.captured`. Store the resulting signing
secrets in `/forgearc/prod/payments`.

## Email

With a custom domain, CDK verifies the domain with SES and grants only the
commerce Lambda permission to send. New AWS accounts remain in the SES sandbox
until AWS approves production access. Request production access before launch
so purchase mail can be sent to arbitrary buyers.

## Recovering a failed first deploy

If `forgearc-prod` fails or is stuck in `CREATE_IN_PROGRESS`, delete it in
CloudFormation. When the deletion finishes, remove the payment secret so its
name can be reused immediately:

```bash
aws secretsmanager delete-secret --region ap-south-1 \
  --secret-id /forgearc/prod/payments --force-delete-without-recovery
```

The commerce DynamoDB table and site buckets are retained on deletion. A retained
empty on-demand table costs nothing and does not block the next deploy.

## Costs and operations

The stack uses CloudFront, API Gateway, Lambda, and on-demand DynamoDB, with no
RDS instance and no NAT gateway, so nothing bills while idle apart from the
Secrets Manager secret. `monthlyBudgetUsd` in `infra/cdk/config.json` controls
the forecast alert threshold. Subscribe an operator to the `AlarmTopicArn`
output to receive Lambda and API 5xx alarms.

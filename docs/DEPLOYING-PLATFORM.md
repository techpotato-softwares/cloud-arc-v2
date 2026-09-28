# Deploy the ForgeArc platform

The `Deploy ForgeArc platform` GitHub Actions workflow builds and deploys:

- `forgearc.dev` and `www.forgearc.dev`: Vue marketing and checkout UI
- `docs.forgearc.dev`: VitePress documentation
- `api.forgearc.dev`: FastAPI commerce API on Lambda and API Gateway
- private CloudFront S3 origins, VPC, NAT, private PostgreSQL RDS, Secrets Manager,
  SES identity, Route 53 records, CloudWatch alarms, and an AWS Budget

Infrastructure settings are committed in `infra/cdk/config.json`. The workflow
requires only `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as GitHub Actions
secrets. The IAM identity behind those keys must be allowed to bootstrap and
deploy CDK/CloudFormation and create the resources listed above.

## Before the first deploy

1. Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub repository
   **Settings → Secrets and variables → Actions**.
2. Run **Deploy ForgeArc platform** from the Actions tab with **dns_only**
   enabled. Copy the `NameServers` values from the job summary and set them as
   the authoritative nameservers at the `forgearc.dev` domain registrar.
3. After DNS delegation is visible, run the workflow again with **dns_only**
   disabled. This deploys the certificates and complete platform.

If an existing Route 53 zone must be reused, set its ID in `hostedZoneId` in
`infra/cdk/config.json`; the DNS-only bootstrap is then unnecessary. DNS
delegation is the only registrar-side step and requires no repository secret.

## Deployment URLs

After a full deployment, the GitHub Actions job summary includes both branded
URLs and direct CloudFront URLs:

- `WebsiteUrl`: marketing website at `https://forgearc.dev`
- `MarketingCloudFrontUrl`: direct marketing CloudFront distribution URL
- `DocsUrl`: documentation at `https://docs.forgearc.dev`
- `DocsCloudFrontUrl`: direct documentation CloudFront distribution URL
- `ApiUrl`: commerce API at `https://api.forgearc.dev`

The direct CloudFront URLs are useful for deployment verification while DNS is
still propagating. Use the branded URLs for public links.

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

## Provider webhooks

Configure the providers after DNS and certificates become active:

- Stripe: `https://api.forgearc.dev/api/webhooks/stripe`
- Razorpay: `https://api.forgearc.dev/api/webhooks/razorpay`

Use `checkout.session.completed` for Stripe and `payment.captured` for Razorpay.
Store the resulting signing secrets in `/forgearc/prod/payments`.

## Email

CDK verifies the `forgearc.dev` domain with SES and grants only the commerce
Lambda permission to send. New AWS accounts remain in the SES sandbox until AWS
approves production access. Request production access before launch so purchase
mail can be sent to arbitrary buyers.

## AWS Free Tier

`databaseBackupRetentionDays` is 1 because an AWS Free Tier account rejects a
longer RDS backup window. Raise it after the account is upgraded. API access
logs use a log group owned by this stack, so a retry does not try to recreate
the API Gateway account log group left behind by a failed deployment.

If `forgearc-prod` is in `ROLLBACK_COMPLETE`, delete that stack in
CloudFormation and run the workflow again. Keep `forgearc-dns-prod` when its
nameservers are already set at the registrar.

## Costs and operations

The production stack intentionally uses one NAT gateway, a private RDS instance,
CloudFront, and API Gateway. `monthlyBudgetUsd` in `infra/cdk/config.json`
controls the forecast alert threshold. Subscribe an operator to the
`AlarmTopicArn` output to receive Lambda and API 5xx alarms.

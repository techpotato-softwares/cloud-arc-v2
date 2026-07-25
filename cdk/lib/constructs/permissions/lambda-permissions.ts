import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { EnvironmentConfig } from "../../config/environment";

/**
 * Interface for constructs that provide permissions
 */
export interface IPermissionProvider {
  /** IAM policy statements to be applied to Lambda functions */
  permissions: iam.PolicyStatement[];
}

/**
 * Props for LambdaPermissions construct
 */
export interface LambdaPermissionsProps {
  /** Environment configuration */
  config: EnvironmentConfig;
  /** Lambda functions to apply permissions to */
  lambdaFunctions: Record<string, lambda.Function>;
  /** Permission providers (constructs that generate permissions) */
  permissionProviders: IPermissionProvider[];
}

/**
 * Lambda Permissions Construct
 *
 * Aggregates IAM permissions from various constructs and applies them
 * to Lambda functions. This centralizes permission management.
 *
 * Usage:
 * ```typescript
 * new LambdaPermissions(this, 'Permissions', {
 *   config,
 *   lambdaFunctions: lambdaConstruct.functions,
 *   permissionProviders: [s3Construct, sqsConstruct, dynamodbConstruct],
 * });
 * ```
 */
export class LambdaPermissions extends Construct {
  /** All collected permissions */
  public readonly allPermissions: iam.PolicyStatement[] = [];

  constructor(scope: Construct, id: string, props: LambdaPermissionsProps) {
    super(scope, id);

    const { config, lambdaFunctions, permissionProviders } = props;

    // Collect all permissions from providers
    for (const provider of permissionProviders) {
      this.allPermissions.push(...provider.permissions);
    }

    // Add base permissions that all Lambdas need
    this.addBasePermissions();

    // Add environment-specific permissions
    this.addEnvironmentSpecificPermissions(config);

    // Apply permissions to all Lambda functions
    this.applyPermissionsToFunctions(lambdaFunctions);

    console.log(
      `   🔐 Applied ${this.allPermissions.length} permission statements to ${Object.keys(lambdaFunctions).length} Lambda function(s)`,
    );
  }

  /**
   * Add base permissions required by all Lambdas
   */
  private addBasePermissions(): void {
    // These are typically already added in lambda-construct.ts,
    // but you can add additional base permissions here if needed.
    // Example: CloudWatch metrics permissions
    // this.allPermissions.push(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: ['cloudwatch:PutMetricData'],
    //     resources: ['*'],
    //   })
    // );
  }

  /**
   * Add environment-specific permissions
   */
  private addEnvironmentSpecificPermissions(config: EnvironmentConfig): void {
    // Example: Additional permissions for production
    if (config.environment === "prod") {
      // Add production-specific permissions if needed
      // this.allPermissions.push(...);
    }

    // Example: X-Ray permissions when enabled
    if (config.enableXRay) {
      this.allPermissions.push(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "xray:PutTraceSegments",
            "xray:PutTelemetryRecords",
            "xray:GetSamplingRules",
            "xray:GetSamplingTargets",
            "xray:GetSamplingStatisticSummaries",
          ],
          resources: ["*"],
        }),
      );
    }
  }

  /**
   * Apply all collected permissions to Lambda functions
   */
  private applyPermissionsToFunctions(
    lambdaFunctions: Record<string, lambda.Function>,
  ): void {
    for (const [, fn] of Object.entries(lambdaFunctions)) {
      for (const permission of this.allPermissions) {
        fn.addToRolePolicy(permission);
      }
    }
  }

  /**
   * Add a custom permission to a specific Lambda function
   *
   * Use this for function-specific permissions that shouldn't
   * be applied to all Lambdas.
   */
  public addPermissionToFunction(
    fn: lambda.Function,
    statement: iam.PolicyStatement,
  ): void {
    fn.addToRolePolicy(statement);
  }

  /**
   * Create a permission statement for Secrets Manager access
   *
   * Helper method to generate common permission patterns
   */
  public static createSecretsManagerPermission(
    secretIds: string[],
  ): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: secretIds.map(
        (id) => `arn:aws:secretsmanager:*:*:secret:${id}*`,
      ),
    });
  }

  /**
   * Create a permission statement for SQS access
   *
   * Helper method for future SQS integration
   */
  public static createSQSPermission(queueArns: string[]): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
      ],
      resources: queueArns,
    });
  }

  /**
   * Create a permission statement for DynamoDB access
   *
   * Helper method for future DynamoDB integration
   */
  public static createDynamoDBPermission(
    tableArns: string[],
  ): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
      ],
      resources: [...tableArns, ...tableArns.map((arn) => `${arn}/index/*`)],
    });
  }

  /**
   * Create a permission statement for SES email sending
   *
   * Helper method for future SES integration
   */
  public static createSESPermission(
    identityArns?: string[],
  ): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
      resources: identityArns || ["*"],
    });
  }

  /**
   * Create a permission statement for KMS encryption/decryption
   *
   * Helper method for future KMS integration
   */
  public static createKMSPermission(keyArns: string[]): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:GenerateDataKeyWithoutPlaintext",
      ],
      resources: keyArns,
    });
  }
}

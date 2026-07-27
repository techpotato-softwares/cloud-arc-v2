import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Duration, CfnOutput } from "aws-cdk-lib";
import * as path from "path";
import { EnvironmentConfig } from "../../config/environment";

/**
 * Configuration for a scheduled Lambda function
 */
export interface ScheduledLambdaConfig {
  /** Unique name for the Lambda */
  name: string;
  /** Handler path (e.g., dist/lambdas/fileCleanup.lambda.handler) */
  handler: string;
  /** Description of the Lambda function */
  description: string;
  /** Schedule expression - e.g., "rate(6 hours)" or "cron(0 0/6 * * ? *)" */
  scheduleExpression: string;
  /** Optional memory size override (default: from config) */
  memorySize?: number;
  /** Optional timeout override in seconds (default: from config) */
  timeout?: number;
  /** Optional additional environment variables */
  environment?: Record<string, string>;
  /** Enable/disable the schedule rule (default: true) */
  enabled?: boolean;
}

export interface ScheduledLambdaConstructProps {
  /** Environment configuration */
  config: EnvironmentConfig;
  /** Shared Lambda layer */
  sharedLayer: lambda.LayerVersion;
  /** Array of scheduled Lambda configurations */
  scheduledLambdas: ScheduledLambdaConfig[];
  /** Optional database host override (from RDS) */
  dbHost?: string;
  /** S3 bucket name for file operations */
  s3BucketName?: string;
}

/**
 * Scheduled Lambda Construct
 *
 * Creates Lambda functions with CloudWatch Events (EventBridge) triggers
 * for scheduled/cron jobs like file cleanup.
 */
export class ScheduledLambdaConstruct extends Construct {
  /** Map of Lambda function names to function instances */
  public readonly functions: Record<string, lambda.Function> = {};

  /** Map of EventBridge rules */
  public readonly rules: Record<string, events.Rule> = {};

  constructor(
    scope: Construct,
    id: string,
    props: ScheduledLambdaConstructProps,
  ) {
    super(scope, id);

    const { config, sharedLayer, scheduledLambdas, dbHost, s3BucketName } =
      props;

    console.log(
      `\n⏰ Creating ${scheduledLambdas.length} scheduled Lambda function(s)...`,
    );

    for (const lambdaConfig of scheduledLambdas) {
      const { fn, rule } = this.createScheduledLambda(
        lambdaConfig,
        config,
        sharedLayer,
        dbHost,
        s3BucketName,
      );
      this.functions[lambdaConfig.name] = fn;
      this.rules[lambdaConfig.name] = rule;
    }
  }

  private createScheduledLambda(
    lambdaConfig: ScheduledLambdaConfig,
    config: EnvironmentConfig,
    sharedLayer: lambda.LayerVersion,
    dbHost?: string,
    s3BucketName?: string,
  ): { fn: lambda.Function; rule: events.Rule } {
    const logRetention = this.getLogRetention(config.logRetentionDays);

    // Build environment variables
    const environment: Record<string, string> = {
      ENVIRONMENT: config.environment,
      // Database connection settings
      DB_HOST: dbHost || config.database.host,
      DB_PORT: config.database.port.toString(),
      DB_NAME: config.database.name,
      DB_SSL: config.database.ssl.toString(),
      DB_SECRET_ID: config.dbSecretId,
      // JWT configuration
      JWT_SECRET_ID: config.jwt.secretId,
      JWT_EXPIRES_IN: config.jwt.expiresIn,
      JWT_REFRESH_EXPIRES_IN: config.jwt.refreshExpiresIn,
      LOG_LEVEL: config.environment === "prod" ? "INFO" : "DEBUG",
      NODE_OPTIONS: "--enable-source-maps",
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      // S3 configuration
      ...(s3BucketName ? { S3_BUCKET_NAME: s3BucketName } : {}),
      // Additional environment variables from config
      ...(lambdaConfig.environment || {}),
    };

    // Create Lambda function
    const fn = new lambda.Function(this, `${lambdaConfig.name}Function`, {
      functionName: `arcforge-${lambdaConfig.name}-${config.environment}`,
      description: `${lambdaConfig.description} - ${config.environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: lambdaConfig.handler,
      code: lambda.Code.fromAsset(path.join(__dirname, "../../../../api"), {
        exclude: [
          "node_modules",
          "node_modules/**",
          "layers",
          "layers/**",
          "src",
          "src/**",
          "scripts",
          "scripts/**",
          "*.ts",
          "*.md",
          ".git",
          ".git/**",
          ".eslint*",
          "tsconfig.json",
          "jest.config.*",
          "coverage",
          "coverage/**",
          "*.test.*",
          "*.spec.*",
          "*.d.ts.map",
          "*.js.map",
          "**/*.d.ts.map",
          "**/*.js.map",
          ".env*",
          "*.log",
        ],
      }),
      memorySize: lambdaConfig.memorySize || config.lambdaMemorySize,
      timeout: Duration.seconds(lambdaConfig.timeout || config.lambdaTimeout),
      environment,
      layers: [sharedLayer],
      tracing: config.enableXRay
        ? lambda.Tracing.ACTIVE
        : lambda.Tracing.DISABLED,
      logRetention,
    });

    // Grant Secrets Manager access
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:*:*:secret:${config.dbSecretId}*`,
          `arn:aws:secretsmanager:*:*:secret:${config.jwt.secretId}*`,
        ],
      }),
    );

    // Grant CloudWatch Logs permissions
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
      }),
    );

    // Create EventBridge rule for scheduling
    const rule = new events.Rule(this, `${lambdaConfig.name}Schedule`, {
      ruleName: `arcforge-${lambdaConfig.name}-schedule-${config.environment}`,
      description: `Schedule for ${lambdaConfig.name}: ${lambdaConfig.scheduleExpression}`,
      schedule: this.parseScheduleExpression(lambdaConfig.scheduleExpression),
      enabled: lambdaConfig.enabled !== false,
    });

    // Add Lambda as target
    rule.addTarget(new targets.LambdaFunction(fn));

    // Output
    new CfnOutput(this, `${lambdaConfig.name}FunctionArn`, {
      value: fn.functionArn,
      description: `${lambdaConfig.name} Lambda ARN - ${config.environment}`,
      exportName: `ArcForge${this.capitalize(lambdaConfig.name)}FunctionArn-${config.environment}`,
    });

    new CfnOutput(this, `${lambdaConfig.name}ScheduleArn`, {
      value: rule.ruleArn,
      description: `${lambdaConfig.name} Schedule Rule ARN - ${config.environment}`,
      exportName: `ArcForge${this.capitalize(lambdaConfig.name)}ScheduleArn-${config.environment}`,
    });

    console.log(
      `   Created scheduled Lambda: arcforge-${lambdaConfig.name}-${config.environment}`,
    );
    console.log(`   Schedule: ${lambdaConfig.scheduleExpression}`);

    return { fn, rule };
  }

  private parseScheduleExpression(expression: string): events.Schedule {
    if (expression.startsWith("rate(")) {
      return events.Schedule.expression(expression);
    }
    if (expression.startsWith("cron(")) {
      return events.Schedule.expression(expression);
    }
    // Default to rate expression
    return events.Schedule.rate(Duration.hours(6));
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getLogRetention(days: number): logs.RetentionDays {
    const retentionMap: Record<number, logs.RetentionDays> = {
      1: logs.RetentionDays.ONE_DAY,
      3: logs.RetentionDays.THREE_DAYS,
      5: logs.RetentionDays.FIVE_DAYS,
      7: logs.RetentionDays.ONE_WEEK,
      14: logs.RetentionDays.TWO_WEEKS,
      30: logs.RetentionDays.ONE_MONTH,
      60: logs.RetentionDays.TWO_MONTHS,
      90: logs.RetentionDays.THREE_MONTHS,
      180: logs.RetentionDays.SIX_MONTHS,
      365: logs.RetentionDays.ONE_YEAR,
    };
    return retentionMap[days] || logs.RetentionDays.ONE_WEEK;
  }
}

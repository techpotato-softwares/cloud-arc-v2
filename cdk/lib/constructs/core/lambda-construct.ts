import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Duration, CfnOutput } from "aws-cdk-lib";
import * as path from "path";
import * as fs from "fs";
import { EnvironmentConfig } from "../../config/environment";
import { AppManifest } from "../../utils/manifest-reader";

// Load local env vars from env.local.json for SAM Local development
const loadLocalEnvVars = (): Record<string, string> => {
  const envFilePath = path.join(__dirname, "../../../env.local.json");
  if (fs.existsSync(envFilePath)) {
    try {
      const envConfig = JSON.parse(fs.readFileSync(envFilePath, "utf-8"));
      // Try multiple possible keys (function name, logical ID, etc.)
      const envVars =
        envConfig["arcforge-po-dev"] ||
        envConfig["LambdaConstructpoFunction7E547944"] ||
        envConfig["Parameters"] ||
        {};
      console.log("   📋 Loaded local env vars from env.local.json");
      return envVars;
    } catch (e) {
      console.warn("   ⚠️  Failed to parse env.local.json:", e);
    }
  }
  return {};
};

export interface LambdaConstructProps {
  config: EnvironmentConfig;
  sharedLayer: lambda.LayerVersion;
  manifest: AppManifest;
  /** Optional database host override (e.g., from RDS construct) */
  dbHost?: string;
}

export class LambdaConstruct extends Construct {
  public readonly functions: Record<string, lambda.Function> = {};

  /** Database host (from RDS or config) */
  private readonly dbHost: string;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    const { config, sharedLayer, manifest, dbHost } = props;

    // Use provided dbHost (from RDS) or fall back to config
    this.dbHost = dbHost || config.database.host;

    if (dbHost) {
      console.log(`   📡 Using database host from RDS: ${dbHost}`);
    }

    // Create Lambda functions from manifest
    for (const [lambdaName, lambdaConfig] of Object.entries(manifest.lambdas)) {
      const fn = this.createLambdaFunction(
        lambdaName,
        lambdaConfig.handler,
        config,
        sharedLayer,
      );
      this.functions[lambdaName] = fn;
    }

    // If no functions in manifest, create default PO function
    if (Object.keys(this.functions).length === 0) {
      console.log("   No lambdas in manifest, creating default PO function");
      const fn = this.createLambdaFunction(
        "po",
        "dist/handlers/po.handler.handler",
        config,
        sharedLayer,
      );
      this.functions["po"] = fn;
    }
  }

  private createLambdaFunction(
    name: string,
    handler: string,
    config: EnvironmentConfig,
    sharedLayer: lambda.LayerVersion,
  ): lambda.Function {
    const logRetention = this.getLogRetention(config.logRetentionDays);

    const fn = new lambda.Function(this, `${name}Function`, {
      functionName: `arcforge-${name}-${config.environment}`,
      description: `${name.toUpperCase()} Lambda - ${config.environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: handler,
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
      memorySize: config.lambdaMemorySize,
      timeout: Duration.seconds(config.lambdaTimeout),
      environment: {
        ENVIRONMENT: config.environment,
        // Database connection settings (non-sensitive)
        // DB_HOST comes from RDS construct (if enabled) or config.database.host
        DB_HOST: this.dbHost,
        DB_PORT: config.database.port.toString(),
        DB_NAME: config.database.name,
        DB_SSL: config.database.ssl.toString(),
        // Secrets Manager secret ID for credentials (username/password only)
        DB_SECRET_ID: config.dbSecretId,
        // JWT configuration
        // Secrets (JWT_SECRET, JWT_REFRESH_SECRET) are fetched from Secrets Manager at runtime
        JWT_SECRET_ID: config.jwt.secretId,
        JWT_EXPIRES_IN: config.jwt.expiresIn,
        JWT_REFRESH_EXPIRES_IN: config.jwt.refreshExpiresIn,
        LOG_LEVEL: config.environment === "prod" ? "INFO" : "DEBUG",
        NODE_OPTIONS: "--enable-source-maps",
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
        // Include local env vars for SAM Local development (dev environment only)
        ...(config.environment === "dev" ? loadLocalEnvVars() : {}),
      },
      layers: [sharedLayer],
      tracing: config.enableXRay
        ? lambda.Tracing.ACTIVE
        : lambda.Tracing.DISABLED,
      logRetention,
      // Note: Reserved concurrency is not set to allow Lambda to scale automatically.
      // If you need to limit concurrency or guarantee capacity, set reservedConcurrentExecutions
      // but ensure total across all functions doesn't exceed (account limit - 10).
    });

    // Grant Secrets Manager access for DB and JWT secrets
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

    // Output function ARN
    new CfnOutput(this, `${name}FunctionArn`, {
      value: fn.functionArn,
      description: `${name.toUpperCase()} Lambda ARN - ${config.environment}`,
      exportName: `ArcForge${name.charAt(0).toUpperCase() + name.slice(1)}FunctionArn-${config.environment}`,
    });

    console.log(`   Created Lambda: arcforge-${name}-${config.environment}`);

    return fn;
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

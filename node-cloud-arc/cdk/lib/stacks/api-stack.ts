import { Stack, StackProps, Tags, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { EnvironmentConfig } from "../config/environment";
import { LambdaConstruct } from "../constructs/core/lambda-construct";
import { ApiGatewayConstruct } from "../constructs/core/api-gateway-construct";
import {
  ScheduledLambdaConstruct,
  ScheduledLambdaConfig,
} from "../constructs/core/scheduled-lambda-construct";
import { S3Construct } from "../constructs/storage/s3-construct";
import { StaticSiteConstruct } from "../constructs/hosting/static-site-construct";
import { RDSConstruct } from "../constructs/database/rds-construct";
import { RDSSchedulerConstruct } from "../constructs/database/rds-scheduler-construct";
import { getRDSConfig } from "../../config/rds.config";
import { JwtSecretsConstruct } from "../constructs/security/jwt-secrets-construct";
import {
  LambdaPermissions,
  IPermissionProvider,
} from "../constructs/permissions/lambda-permissions";
import { readManifest } from "../utils/manifest-reader";

export interface ApiStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, {
      ...props,
      description: props.config.description,
    });

    const { config } = props;

    console.log(`\n🚀 Building stack: ${config.stackName}`);

    // Apply tags to all resources
    Object.entries(config.tags).forEach(([key, value]) => {
      Tags.of(this).add(key, value);
    });

    // Read app manifest
    const manifest = readManifest();

    // Collect permission providers from enabled constructs
    const permissionProviders: IPermissionProvider[] = [];

    // ==========================================
    // DATABASE CONSTRUCTS (CREATE FIRST!)
    // ==========================================
    // RDS must be created before Lambda so we can pass the dynamic DB_HOST

    let rdsConstruct: RDSConstruct | undefined;

    if (config.features.rds) {
      console.log("\n🗄️  Creating RDS PostgreSQL instance...");
      rdsConstruct = new RDSConstruct(this, "RDSConstruct", {
        config,
      });
      permissionProviders.push(rdsConstruct);

      // Setup RDS scheduler for cost savings (if configured)
      const rdsConfig = getRDSConfig(config.environment);
      if (rdsConfig.schedule?.enabled) {
        console.log("\n⏰ Setting up RDS auto-start/stop scheduler...");
        new RDSSchedulerConstruct(this, "RDSSchedulerConstruct", {
          config,
          rdsInstance: rdsConstruct.instance,
          scheduleConfig: rdsConfig.schedule,
        });
      }
    }

    // Determine database host (from RDS if enabled, otherwise from config)
    const dbHost = rdsConstruct
      ? rdsConstruct.instance.instanceEndpoint.hostname
      : undefined;

    // ==========================================
    // LAMBDA LAYER & FUNCTIONS
    // ==========================================

    // Create Shared Lambda Layer (using bundled output to avoid Windows long path issues)
    console.log("\n📦 Creating shared Lambda layer...");
    const sharedLayer = new lambda.LayerVersion(this, "SharedLayer", {
      layerVersionName: `arcforge-shared-layer-${config.environment}`,
      description: "Shared utilities, database connection, and middleware",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../../api/layers/shared/bundled"),
      ),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      compatibleArchitectures: [
        lambda.Architecture.X86_64,
        lambda.Architecture.ARM_64,
      ],
      removalPolicy:
        config.environment === "prod"
          ? RemovalPolicy.RETAIN
          : RemovalPolicy.DESTROY,
    });

    // Create Lambda Functions from manifest
    // If RDS is enabled, dbHost will be the dynamic RDS endpoint
    console.log("\n⚡ Creating Lambda functions...");
    const lambdaConstruct = new LambdaConstruct(this, "LambdaConstruct", {
      config,
      sharedLayer,
      manifest,
      dbHost, // Pass RDS host (or undefined to use config.database.host)
    });

    // ==========================================
    // STATIC SITE HOSTING (UI) - CREATE FIRST FOR CORS
    // ==========================================

    // Create StaticSiteConstruct first to get CloudFront URL for S3 CORS
    // IMPORTANT: Uses RemovalPolicy.RETAIN for prod to preserve hosted files!
    let staticSiteConstruct: StaticSiteConstruct | undefined;
    let cloudFrontUrl: string | undefined;

    if (config.features.staticSite) {
      console.log("\n🌐 Creating static site hosting (S3 + CloudFront)...");
      staticSiteConstruct = new StaticSiteConstruct(
        this,
        "StaticSiteConstruct",
        {
          config,
          uiBuildPath: path.join(__dirname, "../../../ui/build"),
        },
      );
      // Get CloudFront URL for S3 CORS configuration
      cloudFrontUrl = `https://${staticSiteConstruct.distribution.distributionDomainName}`;
      console.log(
        `   📍 CloudFront URL will be used for S3 CORS: ${cloudFrontUrl}`,
      );
    }

    // ==========================================
    // STORAGE CONSTRUCTS
    // ==========================================

    // S3 Construct (enabled via features.s3)
    let s3BucketName: string | undefined;
    if (config.features.s3) {
      console.log("\n📦 Creating S3 buckets...");

      // Pass CloudFront URL and optional custom domain for CORS
      const additionalCorsOrigins: string[] = [];
      if (cloudFrontUrl) {
        additionalCorsOrigins.push(cloudFrontUrl);
      }
      if (config.customDomain) {
        additionalCorsOrigins.push(`https://${config.customDomain}`);
      }

      const s3Construct = new S3Construct(this, "S3Construct", {
        config,
        additionalCorsOrigins,
      });
      permissionProviders.push(s3Construct);

      // Get the files bucket name for Lambda environment variables
      const filesBucket = s3Construct.getBucket("files");
      if (filesBucket) {
        s3BucketName = filesBucket.bucketName;
      }
    }

    // ==========================================
    // SCHEDULED LAMBDA FUNCTIONS
    // ==========================================

    // File Cleanup Lambda - runs every 6 hours to clean orphaned uploads
    let scheduledLambdaConstruct: ScheduledLambdaConstruct | undefined;

    const scheduledLambdas: ScheduledLambdaConfig[] = [
      {
        name: "fileCleanup",
        handler: "dist/lambdas/fileCleanup.lambda.handler",
        description: "Cleanup orphaned pending file uploads",
        // Run every 6 hours
        scheduleExpression: "rate(6 hours)",
        // Cleanup job needs more time
        timeout: 300, // 5 minutes
        memorySize: 256,
        environment: {
          FILE_CLEANUP_HOURS: "24",
          FILE_CLEANUP_DRY_RUN: config.environment === "dev" ? "true" : "false",
        },
        enabled: true,
      },
    ];

    if (scheduledLambdas.length > 0 && config.features.s3) {
      console.log("\n⏰ Creating scheduled Lambda functions...");
      scheduledLambdaConstruct = new ScheduledLambdaConstruct(
        this,
        "ScheduledLambdaConstruct",
        {
          config,
          sharedLayer,
          scheduledLambdas,
          dbHost,
          s3BucketName,
        },
      );
    }

    // DynamoDB Construct (enabled via features.dynamodb)
    // Uncomment when DynamoDB construct is implemented
    // if (config.features.dynamodb) {
    //   console.log('\n📊 Creating DynamoDB tables...');
    //   const dynamodbConstruct = new DynamoDBConstruct(this, 'DynamoDBConstruct', { config });
    //   permissionProviders.push(dynamodbConstruct);
    // }

    // ==========================================
    // MESSAGING CONSTRUCTS
    // ==========================================

    // SQS Construct (enabled via features.sqs)
    // Uncomment when SQS construct is implemented
    // if (config.features.sqs) {
    //   console.log('\n📨 Creating SQS queues...');
    //   const sqsConstruct = new SQSConstruct(this, 'SQSConstruct', { config });
    //   permissionProviders.push(sqsConstruct);
    // }

    // SES Construct (enabled via features.ses)
    // Uncomment when SES construct is implemented
    // if (config.features.ses) {
    //   console.log('\n📧 Configuring SES...');
    //   const sesConstruct = new SESConstruct(this, 'SESConstruct', { config });
    //   permissionProviders.push(sesConstruct);
    // }

    // ==========================================
    // SECURITY CONSTRUCTS
    // ==========================================

    // JWT Secrets Construct - Auto-generates JWT_SECRET and JWT_REFRESH_SECRET
    console.log("\n🔐 Creating JWT secrets...");
    const jwtSecretsConstruct = new JwtSecretsConstruct(
      this,
      "JwtSecretsConstruct",
      {
        config,
      },
    );
    permissionProviders.push(jwtSecretsConstruct);

    // Cognito Construct (enabled via features.cognito)
    // Uncomment when Cognito construct is implemented
    // if (config.features.cognito) {
    //   console.log('\n🔐 Creating Cognito user pool...');
    //   const cognitoConstruct = new CognitoConstruct(this, 'CognitoConstruct', { config });
    //   permissionProviders.push(cognitoConstruct);
    // }

    // KMS Construct (enabled via features.kms)
    // Uncomment when KMS construct is implemented
    // if (config.features.kms) {
    //   console.log('\n🔑 Creating KMS keys...');
    //   const kmsConstruct = new KMSConstruct(this, 'KMSConstruct', { config });
    //   permissionProviders.push(kmsConstruct);
    // }

    // VPC Construct (enabled via features.vpc)
    // Uncomment when VPC construct is implemented
    // if (config.features.vpc) {
    //   console.log('\n🌐 Creating VPC...');
    //   const vpcConstruct = new VPCConstruct(this, 'VPCConstruct', { config });
    //   // VPC doesn't typically provide permissions, but you can integrate it here
    // }

    // ==========================================
    // APPLY PERMISSIONS TO LAMBDAS
    // ==========================================

    // Apply all collected permissions to Lambda functions
    if (permissionProviders.length > 0) {
      console.log("\n🔐 Applying permissions to Lambda functions...");

      // Combine API lambdas with scheduled lambdas
      const allLambdaFunctions: Record<string, lambda.Function> = {
        ...lambdaConstruct.functions,
        ...(scheduledLambdaConstruct?.functions || {}),
      };

      new LambdaPermissions(this, "LambdaPermissions", {
        config,
        lambdaFunctions: allLambdaFunctions,
        permissionProviders,
      });

      // Add S3_BUCKET_NAME environment variable to all API lambdas
      if (s3BucketName) {
        console.log(
          `\n📦 Adding S3_BUCKET_NAME (${s3BucketName}) to Lambda environment...`,
        );
        Object.values(lambdaConstruct.functions).forEach((fn) => {
          fn.addEnvironment("S3_BUCKET_NAME", s3BucketName);
        });
      }
    }

    // ==========================================
    // API GATEWAY
    // ==========================================

    // Create API Gateway with routes from manifest
    console.log("\n🌐 Creating API Gateway routes...");
    new ApiGatewayConstruct(this, "ApiGatewayConstruct", {
      config,
      lambdaFunctions: lambdaConstruct.functions,
      manifest,
    });

    // Note: StaticSiteConstruct is created earlier in the stack to provide
    // CloudFront URL for S3 CORS configuration

    console.log(`\n✅ Stack ${config.stackName} ready\n`);
  }
}

import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { EnvironmentConfig } from "../../config/environment";
import { S3BucketConfig, getS3Config } from "../../../config/s3.config";

/**
 * Props for S3Construct
 */
export interface S3ConstructProps {
  /** Environment configuration */
  config: EnvironmentConfig;
  /**
   * Additional CORS origins to allow (e.g., CloudFront distribution URL).
   * These are merged with origins defined in s3.config.ts.
   * Any "__AUTO__" placeholder in config will be replaced with these origins.
   */
  additionalCorsOrigins?: string[];
}

/**
 * S3 Construct
 *
 * Creates S3 buckets based on configuration and generates
 * IAM policy statements for Lambda permissions.
 *
 * Usage:
 * ```typescript
 * const s3Construct = new S3Construct(this, 'S3', { config });
 * // Access buckets: s3Construct.buckets['uploads']
 * // Access permissions: s3Construct.permissions
 * ```
 */
export class S3Construct extends Construct {
  /** Map of bucket IDs to bucket instances */
  public readonly buckets: Record<string, s3.Bucket> = {};

  /** IAM policy statements for Lambda to access the buckets */
  public readonly permissions: iam.PolicyStatement[] = [];

  /** List of bucket ARNs for reference */
  public readonly bucketArns: string[] = [];

  private additionalCorsOrigins: string[];

  constructor(scope: Construct, id: string, props: S3ConstructProps) {
    super(scope, id);

    const { config, additionalCorsOrigins = [] } = props;
    this.additionalCorsOrigins = additionalCorsOrigins;
    const s3EnvConfig = getS3Config(config.environment);

    console.log(
      `   📦 Creating ${s3EnvConfig.buckets.length} S3 bucket(s) for ${config.environment}...`,
    );

    if (additionalCorsOrigins.length > 0) {
      console.log(
        `   🌐 Additional CORS origins will be added: CloudFront URL (resolved at deploy)`,
      );
    }

    // Create buckets from configuration
    for (const bucketConfig of s3EnvConfig.buckets) {
      const bucket = this.createBucket(bucketConfig, config);
      this.buckets[bucketConfig.id] = bucket;
      this.bucketArns.push(bucket.bucketArn);

      // Output bucket name
      new CfnOutput(this, `${bucketConfig.id}BucketName`, {
        value: bucket.bucketName,
        description: `S3 Bucket Name for ${bucketConfig.id} - ${config.environment}`,
        exportName: `ArcForge-${bucketConfig.id}-BucketName-${config.environment}`,
      });

      console.log(`   Created S3 bucket: ${bucket.bucketName}`);
    }

    // Generate permissions for all buckets
    this.permissions = this.generatePermissions();
  }

  /**
   * Create a single S3 bucket based on configuration
   */
  private createBucket(
    bucketConfig: S3BucketConfig,
    envConfig: EnvironmentConfig,
  ): s3.Bucket {
    const bucketName = `${bucketConfig.bucketNamePrefix}-${envConfig.environment}`;

    // Build CORS origins: filter out __AUTO__ placeholder and add additional origins
    let corsOrigins: string[] = [];
    if (bucketConfig.corsAllowedOrigins) {
      // Filter out __AUTO__ placeholder and add actual origins from config
      corsOrigins = bucketConfig.corsAllowedOrigins.filter(
        (origin) => origin !== "__AUTO__",
      );
    }
    // Add additional CORS origins (e.g., CloudFront URL)
    if (this.additionalCorsOrigins.length > 0) {
      corsOrigins = [...corsOrigins, ...this.additionalCorsOrigins];
    }
    // Fallback to wildcard if no origins specified
    if (corsOrigins.length === 0) {
      corsOrigins = ["*"];
    }

    const corsRules: s3.CorsRule[] = bucketConfig.enableCors
      ? [
          {
            allowedHeaders: ["*"],
            allowedMethods: this.mapCorsMethodsToEnum(
              bucketConfig.corsAllowedMethods || [],
            ),
            allowedOrigins: corsOrigins,
            exposedHeaders: ["ETag"],
            maxAge: 3600,
          },
        ]
      : [];

    return new s3.Bucket(this, `${bucketConfig.id}Bucket`, {
      bucketName,
      versioned: bucketConfig.versioned ?? false,
      encryption: bucketConfig.encryption
        ? s3.BucketEncryption.S3_MANAGED
        : s3.BucketEncryption.UNENCRYPTED,
      blockPublicAccess: bucketConfig.blockPublicAccess
        ? s3.BlockPublicAccess.BLOCK_ALL
        : undefined,
      removalPolicy: bucketConfig.removalPolicy ?? RemovalPolicy.RETAIN,
      autoDeleteObjects:
        bucketConfig.removalPolicy === RemovalPolicy.DESTROY ? true : false,
      cors: corsRules.length > 0 ? corsRules : undefined,
      lifecycleRules: [
        {
          // Clean up incomplete multipart uploads after 7 days
          abortIncompleteMultipartUploadAfter: Duration.days(7),
        },
      ],
    });
  }

  /**
   * Map string methods to S3 HttpMethods enum
   */
  private mapCorsMethodsToEnum(
    methods: ("GET" | "PUT" | "POST" | "DELETE" | "HEAD")[],
  ): s3.HttpMethods[] {
    const methodMap: Record<string, s3.HttpMethods> = {
      GET: s3.HttpMethods.GET,
      PUT: s3.HttpMethods.PUT,
      POST: s3.HttpMethods.POST,
      DELETE: s3.HttpMethods.DELETE,
      HEAD: s3.HttpMethods.HEAD,
    };
    return methods.map((m) => methodMap[m]);
  }

  /**
   * Generate IAM policy statements for Lambda access
   *
   * Creates permissions for:
   * - Read/Write objects
   * - List bucket contents
   * - Get bucket location
   */
  private generatePermissions(): iam.PolicyStatement[] {
    if (this.bucketArns.length === 0) {
      return [];
    }

    const statements: iam.PolicyStatement[] = [];

    // Permission to read/write objects in buckets
    statements.push(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion",
          "s3:GetObjectTagging",
          "s3:PutObjectTagging",
        ],
        resources: this.bucketArns.map((arn) => `${arn}/*`),
      }),
    );

    // Permission to list bucket contents
    statements.push(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:ListBucket", "s3:GetBucketLocation"],
        resources: this.bucketArns,
      }),
    );

    return statements;
  }

  /**
   * Get a specific bucket by ID
   */
  public getBucket(id: string): s3.Bucket | undefined {
    return this.buckets[id];
  }

  /**
   * Get all bucket names
   */
  public getBucketNames(): string[] {
    return Object.values(this.buckets).map((b) => b.bucketName);
  }
}

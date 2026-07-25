import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { EnvironmentConfig } from "../../config/environment";

/**
 * Props for StaticSiteConstruct
 */
export interface StaticSiteConstructProps {
  /** Environment configuration */
  config: EnvironmentConfig;
  /** Path to the built UI folder */
  uiBuildPath: string;
}

/**
 * Static Site Construct
 *
 * Creates S3 bucket for hosting static files and CloudFront distribution for CDN.
 * Uses Origin Access Control (OAC) for secure S3 access.
 *
 * IMPORTANT: Uses RemovalPolicy.RETAIN for production to prevent accidental deletion.
 *
 * Usage:
 * ```typescript
 * const staticSite = new StaticSiteConstruct(this, 'StaticSite', {
 *   config,
 *   uiBuildPath: path.join(__dirname, '../../../ui/build'),
 * });
 * ```
 */
export class StaticSiteConstruct extends Construct {
  /** S3 bucket for static site hosting */
  public readonly bucket: s3.Bucket;

  /** CloudFront distribution */
  public readonly distribution: cloudfront.Distribution;

  /** Website URL */
  public readonly websiteUrl: string;

  constructor(scope: Construct, id: string, props: StaticSiteConstructProps) {
    super(scope, id);

    const { config, uiBuildPath } = props;
    const isProd = config.environment === "prod";

    console.log(
      `   🌐 Creating static site hosting for ${config.environment}...`,
    );

    // S3 bucket for hosting static files
    // RETAIN for production to preserve data on stack deletion
    this.bucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: `arcforge-ui-${config.environment}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: isProd, // Enable versioning for production
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd, // Only auto-delete for non-prod
    });

    // CloudFront Origin Access Control
    const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
      originAccessControlName: `arcforge-ui-oac-${config.environment}`,
      description: `Origin Access Control for ArcForge UI - ${config.environment}`,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    // Optional custom domain (e.g. app.example.com). Certificate must be in us-east-1.
    const useCustomDomain =
      config.customDomain && config.cloudFrontCertificateArn;
    const certificate = useCustomDomain
      ? acm.Certificate.fromCertificateArn(
          this,
          "CustomCert",
          config.cloudFrontCertificateArn!,
        )
      : undefined;

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `ArcForge UI - ${config.environment}`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
      },
      defaultRootObject: "index.html",
      // Handle SPA routing - redirect 404s and 403s to index.html
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: undefined,
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: undefined,
        },
      ],
      priceClass: isProd
        ? cloudfront.PriceClass.PRICE_CLASS_ALL
        : cloudfront.PriceClass.PRICE_CLASS_100, // Cost optimization for non-prod
      enabled: true,
      ...(useCustomDomain && {
        domainNames: [config.customDomain!],
        certificate,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      }),
    });

    // Grant CloudFront access to S3 bucket
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [this.bucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${process.env.CDK_DEFAULT_ACCOUNT || "*"}:distribution/${this.distribution.distributionId}`,
          },
        },
      }),
    );

    // Deploy UI build files to S3
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(uiBuildPath)],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ["/*"], // Invalidate CloudFront cache on deploy
      memoryLimit: 512, // Increase memory for larger builds
    });

    this.websiteUrl = `https://${this.distribution.distributionDomainName}`;

    // Outputs
    new CfnOutput(this, "WebsiteURL", {
      value: this.websiteUrl,
      description: `CloudFront URL for ArcForge UI - ${config.environment}`,
      exportName: `ArcForge-UI-URL-${config.environment}`,
    });

    new CfnOutput(this, "WebsiteBucketName", {
      value: this.bucket.bucketName,
      description: `S3 Bucket for ArcForge UI - ${config.environment}`,
      exportName: `ArcForge-UI-BucketName-${config.environment}`,
    });

    new CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
      description: `CloudFront Distribution ID - ${config.environment}`,
      exportName: `ArcForge-UI-DistributionId-${config.environment}`,
    });

    if (useCustomDomain) {
      const customUrl = `https://${config.customDomain}`;
      new CfnOutput(this, "CustomDomainURL", {
        value: customUrl,
        description: `Custom domain URL for ArcForge UI - ${config.environment}`,
        exportName: `ArcForge-UI-CustomDomainURL-${config.environment}`,
      });
      console.log(
        `   ✅ Static site will be available at: ${customUrl} and CloudFront URL`,
      );
    } else {
      console.log(
        `   ✅ Static site will be available at: CloudFront URL (output after deploy)`,
      );
    }
  }
}

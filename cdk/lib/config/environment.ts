export type Environment = "dev" | "qa" | "prod";

/**
 * Feature flags to enable/disable AWS services per environment.
 * Set to true to enable the service, false to disable.
 */
export interface FeatureFlags {
  s3: boolean;
  sqs: boolean;
  dynamodb: boolean;
  ses: boolean;
  vpc: boolean;
  cognito: boolean;
  kms: boolean;
  /** Enable static site hosting (S3 + CloudFront) for UI */
  staticSite: boolean;
  /** Enable RDS PostgreSQL database (recommended for prod only) */
  rds: boolean;
}

/**
 * Default feature flags - all disabled by default.
 * Override in environment-specific configs as needed.
 */
const defaultFeatures: FeatureFlags = {
  s3: false,
  sqs: false,
  dynamodb: false,
  ses: false,
  vpc: false,
  cognito: false,
  kms: false,
  staticSite: false,
  rds: false,
};

/**
 * Database connection configuration (non-sensitive).
 * Credentials (username/password) are stored in AWS Secrets Manager.
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  ssl: boolean;
}

/**
 * JWT configuration.
 * Secrets (JWT_SECRET, JWT_REFRESH_SECRET) are stored in AWS Secrets Manager.
 * Non-sensitive settings (expiry times) are passed as Lambda environment variables.
 */
export interface JwtConfig {
  /** Secrets Manager secret ID for JWT secrets */
  secretId: string;
  /** Access token expiry time (e.g., "15m", "30m", "1h") */
  expiresIn: string;
  /** Refresh token expiry time (e.g., "1d", "7d", "30d") */
  refreshExpiresIn: string;
}

export interface EnvironmentConfig {
  environment: Environment;
  stackName: string;
  description: string;
  /** Secrets Manager secret ID for database credentials (username/password only) */
  dbSecretId: string;
  logRetentionDays: number;
  lambdaMemorySize: number;
  lambdaTimeout: number;
  apiStageName: string;
  enableXRay: boolean;
  tags: Record<string, string>;
  /** Feature flags to enable/disable AWS services */
  features: FeatureFlags;
  /** Database connection settings (non-sensitive) */
  database: DatabaseConfig;
  /** JWT configuration (secrets in Secrets Manager, expiry in env vars) */
  jwt: JwtConfig;
  /**
   * Optional custom domain for the CloudFront UI (buyer-supplied).
   * When set, also provide cloudFrontCertificateArn (ACM cert must be in us-east-1).
   */
  customDomain?: string;
  /**
   * ACM certificate ARN for the custom domain. Must be in us-east-1 for CloudFront.
   * Leave empty until you create a cert in your own AWS account.
   */
  cloudFrontCertificateArn?: string;
}

const APP = process.env.APP_NAME || "arcforge";

const baseConfig = {
  tags: {
    Project: "ArcForge",
    Application: "CloudArc",
    ManagedBy: "CDK",
  },
};

export const environmentConfigs: Record<Environment, EnvironmentConfig> = {
  dev: {
    ...baseConfig,
    environment: "dev",
    stackName: "ApiStack-dev",
    description: "ArcForge API - Development Environment",
    dbSecretId: `/${APP}/dev/db`,
    logRetentionDays: 7,
    lambdaMemorySize: 256,
    lambdaTimeout: 30,
    apiStageName: "dev",
    enableXRay: false,
    tags: {
      ...baseConfig.tags,
      Environment: "dev",
    },
    features: {
      ...defaultFeatures,
      s3: true,
      staticSite: true,
      rds: false,
    },
    database: {
      host: process.env.DB_HOST || "localhost",
      port: 5432,
      name: process.env.DB_NAME || "arcforge",
      ssl: false,
    },
    jwt: {
      secretId: `/${APP}/dev/jwt`,
      expiresIn: "15m",
      refreshExpiresIn: "1d",
    },
  },
  qa: {
    ...baseConfig,
    environment: "qa",
    stackName: "ApiStack-qa",
    description: "ArcForge API - QA Environment",
    dbSecretId: `/${APP}/qa/db`,
    logRetentionDays: 14,
    lambdaMemorySize: 512,
    lambdaTimeout: 30,
    apiStageName: "qa",
    enableXRay: true,
    tags: {
      ...baseConfig.tags,
      Environment: "qa",
    },
    features: {
      ...defaultFeatures,
      s3: true,
      staticSite: true,
      rds: false,
    },
    database: {
      host: process.env.DB_HOST || "REPLACE_WITH_YOUR_DB_HOST",
      port: 5432,
      name: process.env.DB_NAME || "arcforge",
      ssl: true,
    },
    jwt: {
      secretId: `/${APP}/qa/jwt`,
      expiresIn: "15m",
      refreshExpiresIn: "7d",
    },
  },
  prod: {
    ...baseConfig,
    environment: "prod",
    stackName: "ApiStack-prod",
    description: "ArcForge API - Production Environment",
    dbSecretId: `/${APP}/prod/db`,
    logRetentionDays: 90,
    lambdaMemorySize: 1024,
    lambdaTimeout: 30,
    apiStageName: "prod",
    enableXRay: true,
    tags: {
      ...baseConfig.tags,
      Environment: "prod",
    },
    features: {
      ...defaultFeatures,
      s3: true,
      staticSite: true,
      rds: true,
    },
    database: {
      host: "", // Set from RDS construct output
      port: 5432,
      name: process.env.DB_NAME || "arcforge",
      ssl: true,
    },
    jwt: {
      secretId: `/${APP}/prod/jwt`,
      expiresIn: "2h",
      refreshExpiresIn: "30d",
    },
    // Buyer supplies domain + ACM ARN in us-east-1 when ready
    customDomain: process.env.CUSTOM_DOMAIN || undefined,
    cloudFrontCertificateArn: process.env.CLOUDFRONT_CERTIFICATE_ARN || undefined,
  },
};

export const getEnvironmentConfig = (env: Environment): EnvironmentConfig => {
  return environmentConfigs[env];
};

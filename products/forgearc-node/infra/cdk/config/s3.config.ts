/**
 * S3 Bucket Configuration
 *
 * Define S3 buckets for each environment.
 * Each bucket can have environment-specific settings.
 */

import { Environment } from "../lib/config/environment";
import { RemovalPolicy } from "aws-cdk-lib";

/**
 * Configuration for a single S3 bucket
 */
export interface S3BucketConfig {
  /** Unique identifier for the bucket (used in construct IDs) */
  id: string;
  /** Base bucket name (environment suffix will be appended) */
  bucketNamePrefix: string;
  /** Enable versioning for the bucket */
  versioned?: boolean;
  /** Enable CORS for web access */
  enableCors?: boolean;
  /** Block all public access (recommended) */
  blockPublicAccess?: boolean;
  /** Enable server-side encryption */
  encryption?: boolean;
  /** Removal policy for the bucket */
  removalPolicy?: RemovalPolicy;
  /** Allowed CORS origins (if enableCors is true) */
  corsAllowedOrigins?: string[];
  /** Allowed CORS methods */
  corsAllowedMethods?: ("GET" | "PUT" | "POST" | "DELETE" | "HEAD")[];
}

/**
 * S3 configuration per environment
 */
export interface S3EnvironmentConfig {
  /** Array of bucket configurations for this environment */
  buckets: S3BucketConfig[];
}

/**
 * Default bucket configuration
 */
const defaultBucketConfig: Partial<S3BucketConfig> = {
  versioned: false,
  enableCors: true,
  blockPublicAccess: true,
  encryption: true,
  corsAllowedOrigins: ["*"],
  corsAllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
};

/**
 * S3 configuration for all environments
 *
 * Add or modify buckets as needed. Each environment can have
 * different bucket configurations.
 *
 * The "files" bucket is used for all file uploads (dispatch documents,
 * delivery proofs, commissioning docs, warranty certificates, etc.)
 *
 * CORS Origins:
 * - Use "__AUTO__" to automatically include the CloudFront distribution URL
 * - Additional origins can be specified alongside "__AUTO__"
 * - For dev, localhost origins are used for local development
 */
export const s3Config: Record<Environment, S3EnvironmentConfig> = {
  dev: {
    buckets: [
      {
        ...defaultBucketConfig,
        id: "files",
        bucketNamePrefix: "forgearc-files",
        versioned: false,
        removalPolicy: RemovalPolicy.DESTROY,
        enableCors: true,
        // Dev: Include localhost for local development + __AUTO__ for CloudFront
        corsAllowedOrigins: [
          "__AUTO__", // Will be replaced with CloudFront URL
          "http://localhost:3000",
          "http://localhost:4000",
        ],
        corsAllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      },
    ],
  },
  qa: {
    buckets: [
      {
        ...defaultBucketConfig,
        id: "files",
        bucketNamePrefix: "forgearc-files",
        versioned: true,
        removalPolicy: RemovalPolicy.DESTROY,
        enableCors: true,
        // QA: CloudFront URL is automatically added via __AUTO__
        corsAllowedOrigins: ["__AUTO__"],
        corsAllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      },
    ],
  },
  prod: {
    buckets: [
      {
        ...defaultBucketConfig,
        id: "files",
        bucketNamePrefix: "forgearc-files",
        versioned: true,
        removalPolicy: RemovalPolicy.RETAIN,
        enableCors: true,
        // Prod: CloudFront URL is automatically added via __AUTO__
        // Add custom domains here if you have them (e.g., "https://app.forgearc.com")
        corsAllowedOrigins: ["__AUTO__"],
        corsAllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      },
    ],
  },
};

/**
 * Get S3 configuration for a specific environment
 */
export const getS3Config = (env: Environment): S3EnvironmentConfig => {
  return s3Config[env];
};

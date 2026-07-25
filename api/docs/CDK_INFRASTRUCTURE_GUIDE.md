# CDK Infrastructure Guide

This document provides a comprehensive guide to the ArcForge CloudArc CDK infrastructure architecture. Use this as a reference when adding new AWS services, constructs, or configurations.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Core Concepts](#core-concepts)
4. [Existing Components](#existing-components)
5. [Adding a New AWS Service](#adding-a-new-aws-service)
6. [Service-Specific Templates](#service-specific-templates)
7. [Deployment Guide](#deployment-guide)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The CDK infrastructure follows a **modular, config-driven architecture** where:

- **Configurations** define what resources to create per environment
- **Constructs** are reusable infrastructure components
- **Stacks** compose constructs based on feature flags
- **Permissions** are automatically aggregated and applied to Lambdas

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CDK SYNTH/DEPLOY                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            cdk/bin/cdk.ts                                │
│  - Reads environment (dev/qa/prod)                                       │
│  - Creates ApiStack for each environment                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     cdk/lib/config/environment.ts                        │
│  - Environment configs (dev, qa, prod)                                   │
│  - Feature flags (s3, sqs, dynamodb, ses, vpc, cognito, kms, rds, staticSite) │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      cdk/lib/stacks/api-stack.ts                         │
│  - Checks feature flags                                                  │
│  - Conditionally creates constructs                                      │
│  - Aggregates permissions                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  Core Constructs  │   │ Storage Constructs│   │  Other Constructs │
│  - Lambda         │   │  - S3             │   │  - SQS            │
│  - API Gateway    │   │  - DynamoDB       │   │  - SES            │
└───────────────────┘   └───────────────────┘   │  - Cognito, etc.  │
                                                └───────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              cdk/lib/constructs/permissions/lambda-permissions.ts        │
│  - Collects permissions from all constructs                              │
│  - Applies IAM policies to Lambda functions                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
cdk/
├── bin/
│   └── cdk.ts                              # Entry point - creates stacks per environment
├── config/                                 # Service-specific configurations
│   ├── index.ts                            # Exports all configs
│   ├── s3.config.ts                        # S3 bucket configurations
│   ├── rds.config.ts                       # RDS database configurations
│   ├── sqs.config.ts                       # [Future] SQS queue configurations
│   ├── dynamodb.config.ts                  # [Future] DynamoDB table configurations
│   ├── cognito.config.ts                   # [Future] Cognito pool configurations
│   ├── kms.config.ts                       # [Future] KMS key configurations
│   ├── vpc.config.ts                       # [Future] VPC configurations
│   └── ses.config.ts                       # [Future] SES configurations
├── lib/
│   ├── config/
│   │   └── environment.ts                  # Environment configs & feature flags
│   ├── constructs/
│   │   ├── core/                           # Core infrastructure
│   │   │   ├── lambda-construct.ts         # Lambda function creation
│   │   │   └── api-gateway-construct.ts    # API Gateway routes
│   │   ├── storage/                        # Storage services
│   │   │   ├── s3-construct.ts             # S3 bucket creation
│   │   │   └── dynamodb-construct.ts       # [Future] DynamoDB tables
│   │   ├── database/                       # Database services
│   │   │   └── rds-construct.ts            # RDS PostgreSQL (prod)
│   │   ├── hosting/                        # Hosting services
│   │   │   └── static-site-construct.ts    # UI hosting (S3 + CloudFront)
│   │   ├── messaging/                      # Messaging services
│   │   │   ├── sqs-construct.ts            # [Future] SQS queues
│   │   │   └── ses-construct.ts            # [Future] SES email
│   │   ├── security/                       # Security services
│   │   │   ├── cognito-construct.ts        # [Future] Cognito user pools
│   │   │   ├── kms-construct.ts            # [Future] KMS encryption keys
│   │   │   └── vpc-construct.ts            # [Future] VPC networking
│   │   └── permissions/
│   │       └── lambda-permissions.ts       # Permission aggregation
│   ├── stacks/
│   │   └── api-stack.ts                    # Main stack composition
│   └── utils/
│       └── manifest-reader.ts              # API manifest reader
└── env.local.json                          # Local environment variables
```

---

## Core Concepts

### 1. Environments

Three environments are supported: `dev`, `qa`, and `prod`. Each has its own configuration in `cdk/lib/config/environment.ts`.

```typescript
export type Environment = "dev" | "qa" | "prod";
```

Environment-specific settings include:
- Stack name and description
- Lambda memory size and timeout
- Log retention days
- X-Ray tracing enable/disable
- Feature flags for AWS services

### 2. Feature Flags

Feature flags control which AWS services are created per environment:

```typescript
export interface FeatureFlags {
  s3: boolean;         // S3 buckets
  sqs: boolean;        // SQS queues
  dynamodb: boolean;   // DynamoDB tables
  ses: boolean;        // SES email
  vpc: boolean;        // VPC networking
  cognito: boolean;    // Cognito auth
  kms: boolean;        // KMS encryption
  staticSite: boolean; // UI hosting (S3 + CloudFront)
  rds: boolean;        // RDS PostgreSQL database
}
```

Enable a feature in `environment.ts`:

```typescript
features: {
  ...defaultFeatures,
  s3: true,      // Enable S3 for this environment
  sqs: true,     // Enable SQS for this environment
},
```

### 3. Constructs

Constructs are reusable CDK components that:
1. Read their configuration from config files
2. Create AWS resources
3. Export IAM permissions for Lambda access

Every construct that provides permissions must implement `IPermissionProvider`:

```typescript
export interface IPermissionProvider {
  permissions: iam.PolicyStatement[];
}
```

### 4. Permission Aggregation

The `LambdaPermissions` construct:
1. Collects `permissions` arrays from all enabled constructs
2. Applies them to all Lambda functions
3. Adds environment-specific permissions (e.g., X-Ray)

---

## Existing Components

### Lambda Construct (`core/lambda-construct.ts`)

Creates Lambda functions from the app manifest.

**Key Features:**
- Reads function configs from `api/app-manifest.json`
- Applies environment-specific settings (memory, timeout, etc.)
- Attaches shared layer for database/utilities
- Grants Secrets Manager and CloudWatch permissions

### API Gateway Construct (`core/api-gateway-construct.ts`)

Creates REST API with routes from the app manifest.

**Key Features:**
- Generates API routes from manifest
- Configures CORS
- Enables X-Ray tracing per environment

### S3 Construct (`storage/s3-construct.ts`)

Creates S3 buckets based on configuration.

**Configuration file:** `cdk/config/s3.config.ts`

**Key Features:**
- Per-environment bucket configurations
- Versioning, CORS, encryption settings
- Auto-generates Lambda permissions for bucket access

### RDS Construct (`database/rds-construct.ts`)

Creates RDS PostgreSQL database for production.

**Configuration file:** `cdk/config/rds.config.ts`

**Key Features:**
- PostgreSQL 16.4 on ARM64 (cost-effective)
- Automatic VPC creation with proper subnets
- Secrets Manager integration for credentials
- `RemovalPolicy.SNAPSHOT` for production (creates snapshot on delete)
- Deletion protection enabled for production
- Configurable instance sizes (db.t4g.micro to db.t4g.large)

**Cost Reference:**
| Instance | Single-AZ | Multi-AZ |
|----------|-----------|----------|
| db.t4g.micro | ~$12/mo | ~$24/mo |
| db.t4g.small | ~$24/mo | ~$48/mo |
| db.t4g.medium | ~$48/mo | ~$96/mo |

### Static Site Construct (`hosting/static-site-construct.ts`)

Creates S3 + CloudFront for UI hosting.

**Key Features:**
- S3 bucket for static file storage
- CloudFront CDN for global distribution
- Origin Access Control (OAC) for secure S3 access
- SPA routing (404/403 → index.html)
- Automatic cache invalidation on deploy
- `RemovalPolicy.RETAIN` for production (preserves files)
- HTTPS enabled by default

**Outputs after deploy:**
- `WebsiteURL` - CloudFront URL (e.g., https://d123.cloudfront.net)
- `WebsiteBucketName` - S3 bucket name
- `DistributionId` - CloudFront distribution ID

### Lambda Permissions (`permissions/lambda-permissions.ts`)

Aggregates and applies IAM permissions to Lambda functions.

**Key Features:**
- Collects permissions from all constructs
- Provides helper methods for common permissions:
  - `createSecretsManagerPermission()`
  - `createSQSPermission()`
  - `createDynamoDBPermission()`
  - `createSESPermission()`
  - `createKMSPermission()`

---

## Adding a New AWS Service

Follow these steps to add a new AWS service (e.g., DynamoDB, SQS):

### Step 1: Create the Configuration File

Create `cdk/config/{service}.config.ts`:

```typescript
/**
 * {ServiceName} Configuration
 */

import { Environment } from "../lib/config/environment";

/**
 * Configuration for a single {resource}
 */
export interface {ServiceName}Config {
  id: string;
  // Add service-specific properties
}

/**
 * {ServiceName} configuration per environment
 */
export interface {ServiceName}EnvironmentConfig {
  resources: {ServiceName}Config[];
}

/**
 * {ServiceName} configuration for all environments
 */
export const {serviceName}Config: Record<Environment, {ServiceName}EnvironmentConfig> = {
  dev: {
    resources: [
      // Dev resources
    ],
  },
  qa: {
    resources: [
      // QA resources
    ],
  },
  prod: {
    resources: [
      // Prod resources
    ],
  },
};

/**
 * Get {ServiceName} configuration for a specific environment
 */
export const get{ServiceName}Config = (env: Environment): {ServiceName}EnvironmentConfig => {
  return {serviceName}Config[env];
};
```

### Step 2: Export from Config Index

Add to `cdk/config/index.ts`:

```typescript
export * from "./{serviceName}.config";
```

### Step 3: Create the Construct

Create `cdk/lib/constructs/{category}/{serviceName}-construct.ts`:

```typescript
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
// Import service-specific modules
import { EnvironmentConfig } from "../../config/environment";
import { get{ServiceName}Config } from "../../../config/{serviceName}.config";

export interface {ServiceName}ConstructProps {
  config: EnvironmentConfig;
}

export class {ServiceName}Construct extends Construct {
  /** Resources created by this construct */
  public readonly resources: Record<string, /* resource type */> = {};
  
  /** IAM permissions for Lambda access */
  public readonly permissions: iam.PolicyStatement[] = [];

  constructor(scope: Construct, id: string, props: {ServiceName}ConstructProps) {
    super(scope, id);

    const { config } = props;
    const serviceConfig = get{ServiceName}Config(config.environment);

    // Create resources from configuration
    for (const resourceConfig of serviceConfig.resources) {
      // Create resource
      // Store in this.resources
    }

    // Generate permissions
    this.permissions = this.generatePermissions();
  }

  private generatePermissions(): iam.PolicyStatement[] {
    // Return IAM policy statements for Lambda access
    return [];
  }
}
```

### Step 4: Add Feature Flag

In `cdk/lib/config/environment.ts`, ensure the feature flag exists:

```typescript
export interface FeatureFlags {
  // ... existing flags
  {serviceName}: boolean;
}
```

### Step 5: Wire Up in api-stack.ts

Add to `cdk/lib/stacks/api-stack.ts`:

```typescript
// Import the construct
import { {ServiceName}Construct } from "../constructs/{category}/{serviceName}-construct";

// In the stack constructor, add:
if (config.features.{serviceName}) {
  console.log('\n📦 Creating {ServiceName} resources...');
  const {serviceName}Construct = new {ServiceName}Construct(this, '{ServiceName}Construct', {
    config,
  });
  permissionProviders.push({serviceName}Construct);
}
```

### Step 6: Enable in Environment

In `cdk/lib/config/environment.ts`, enable for desired environments:

```typescript
dev: {
  // ... other config
  features: {
    ...defaultFeatures,
    {serviceName}: true,
  },
},
```

---

## Service-Specific Templates

### DynamoDB Construct Template

```typescript
// cdk/config/dynamodb.config.ts
import { Environment } from "../lib/config/environment";
import { RemovalPolicy } from "aws-cdk-lib";
import { BillingMode } from "aws-cdk-lib/aws-dynamodb";

export interface DynamoDBTableConfig {
  id: string;
  tableName: string;
  partitionKey: { name: string; type: "STRING" | "NUMBER" | "BINARY" };
  sortKey?: { name: string; type: "STRING" | "NUMBER" | "BINARY" };
  billingMode?: BillingMode;
  removalPolicy?: RemovalPolicy;
  globalSecondaryIndexes?: {
    indexName: string;
    partitionKey: { name: string; type: "STRING" | "NUMBER" | "BINARY" };
    sortKey?: { name: string; type: "STRING" | "NUMBER" | "BINARY" };
  }[];
}

export interface DynamoDBEnvironmentConfig {
  tables: DynamoDBTableConfig[];
}

export const dynamodbConfig: Record<Environment, DynamoDBEnvironmentConfig> = {
  dev: {
    tables: [
      {
        id: "orders",
        tableName: "arcforge-orders",
        partitionKey: { name: "PK", type: "STRING" },
        sortKey: { name: "SK", type: "STRING" },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    ],
  },
  qa: {
    tables: [
      {
        id: "orders",
        tableName: "arcforge-orders",
        partitionKey: { name: "PK", type: "STRING" },
        sortKey: { name: "SK", type: "STRING" },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    ],
  },
  prod: {
    tables: [
      {
        id: "orders",
        tableName: "arcforge-orders",
        partitionKey: { name: "PK", type: "STRING" },
        sortKey: { name: "SK", type: "STRING" },
        billingMode: BillingMode.PROVISIONED,
        removalPolicy: RemovalPolicy.RETAIN,
      },
    ],
  },
};

export const getDynamoDBConfig = (env: Environment): DynamoDBEnvironmentConfig => {
  return dynamodbConfig[env];
};
```

```typescript
// cdk/lib/constructs/storage/dynamodb-construct.ts
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { EnvironmentConfig } from "../../config/environment";
import { getDynamoDBConfig, DynamoDBTableConfig } from "../../../config/dynamodb.config";

export interface DynamoDBConstructProps {
  config: EnvironmentConfig;
}

export class DynamoDBConstruct extends Construct {
  public readonly tables: Record<string, dynamodb.Table> = {};
  public readonly permissions: iam.PolicyStatement[] = [];
  private readonly tableArns: string[] = [];

  constructor(scope: Construct, id: string, props: DynamoDBConstructProps) {
    super(scope, id);

    const { config } = props;
    const dynamoConfig = getDynamoDBConfig(config.environment);

    for (const tableConfig of dynamoConfig.tables) {
      const table = this.createTable(tableConfig, config);
      this.tables[tableConfig.id] = table;
      this.tableArns.push(table.tableArn);

      new CfnOutput(this, `${tableConfig.id}TableName`, {
        value: table.tableName,
        description: `DynamoDB Table Name for ${tableConfig.id}`,
        exportName: `ArcForge-${tableConfig.id}-TableName-${config.environment}`,
      });
    }

    this.permissions = this.generatePermissions();
  }

  private createTable(
    tableConfig: DynamoDBTableConfig,
    envConfig: EnvironmentConfig
  ): dynamodb.Table {
    const table = new dynamodb.Table(this, `${tableConfig.id}Table`, {
      tableName: `${tableConfig.tableName}-${envConfig.environment}`,
      partitionKey: {
        name: tableConfig.partitionKey.name,
        type: dynamodb.AttributeType[tableConfig.partitionKey.type],
      },
      sortKey: tableConfig.sortKey
        ? {
            name: tableConfig.sortKey.name,
            type: dynamodb.AttributeType[tableConfig.sortKey.type],
          }
        : undefined,
      billingMode: tableConfig.billingMode || dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: tableConfig.removalPolicy || RemovalPolicy.RETAIN,
      pointInTimeRecovery: envConfig.environment === "prod",
    });

    // Add GSIs if configured
    if (tableConfig.globalSecondaryIndexes) {
      for (const gsi of tableConfig.globalSecondaryIndexes) {
        table.addGlobalSecondaryIndex({
          indexName: gsi.indexName,
          partitionKey: {
            name: gsi.partitionKey.name,
            type: dynamodb.AttributeType[gsi.partitionKey.type],
          },
          sortKey: gsi.sortKey
            ? {
                name: gsi.sortKey.name,
                type: dynamodb.AttributeType[gsi.sortKey.type],
              }
            : undefined,
        });
      }
    }

    return table;
  }

  private generatePermissions(): iam.PolicyStatement[] {
    if (this.tableArns.length === 0) return [];

    return [
      new iam.PolicyStatement({
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
        resources: [
          ...this.tableArns,
          ...this.tableArns.map((arn) => `${arn}/index/*`),
        ],
      }),
    ];
  }
}
```

### SQS Construct Template

```typescript
// cdk/config/sqs.config.ts
import { Environment } from "../lib/config/environment";
import { Duration } from "aws-cdk-lib";

export interface SQSQueueConfig {
  id: string;
  queueName: string;
  visibilityTimeout?: Duration;
  retentionPeriod?: Duration;
  deadLetterQueue?: boolean;
  maxReceiveCount?: number;
}

export interface SQSEnvironmentConfig {
  queues: SQSQueueConfig[];
}

export const sqsConfig: Record<Environment, SQSEnvironmentConfig> = {
  dev: {
    queues: [
      {
        id: "orderEvents",
        queueName: "arcforge-order-events",
        visibilityTimeout: Duration.seconds(30),
        deadLetterQueue: true,
        maxReceiveCount: 3,
      },
    ],
  },
  qa: { queues: [] },
  prod: { queues: [] },
};

export const getSQSConfig = (env: Environment): SQSEnvironmentConfig => {
  return sqsConfig[env];
};
```

```typescript
// cdk/lib/constructs/messaging/sqs-construct.ts
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { CfnOutput, Duration } from "aws-cdk-lib";
import { EnvironmentConfig } from "../../config/environment";
import { getSQSConfig, SQSQueueConfig } from "../../../config/sqs.config";

export interface SQSConstructProps {
  config: EnvironmentConfig;
}

export class SQSConstruct extends Construct {
  public readonly queues: Record<string, sqs.Queue> = {};
  public readonly permissions: iam.PolicyStatement[] = [];
  private readonly queueArns: string[] = [];

  constructor(scope: Construct, id: string, props: SQSConstructProps) {
    super(scope, id);

    const { config } = props;
    const sqsEnvConfig = getSQSConfig(config.environment);

    for (const queueConfig of sqsEnvConfig.queues) {
      const queue = this.createQueue(queueConfig, config);
      this.queues[queueConfig.id] = queue;
      this.queueArns.push(queue.queueArn);

      new CfnOutput(this, `${queueConfig.id}QueueUrl`, {
        value: queue.queueUrl,
        description: `SQS Queue URL for ${queueConfig.id}`,
        exportName: `ArcForge-${queueConfig.id}-QueueUrl-${config.environment}`,
      });
    }

    this.permissions = this.generatePermissions();
  }

  private createQueue(
    queueConfig: SQSQueueConfig,
    envConfig: EnvironmentConfig
  ): sqs.Queue {
    let dlq: sqs.Queue | undefined;

    if (queueConfig.deadLetterQueue) {
      dlq = new sqs.Queue(this, `${queueConfig.id}DLQ`, {
        queueName: `${queueConfig.queueName}-dlq-${envConfig.environment}`,
        retentionPeriod: Duration.days(14),
      });
    }

    return new sqs.Queue(this, `${queueConfig.id}Queue`, {
      queueName: `${queueConfig.queueName}-${envConfig.environment}`,
      visibilityTimeout: queueConfig.visibilityTimeout || Duration.seconds(30),
      retentionPeriod: queueConfig.retentionPeriod || Duration.days(4),
      deadLetterQueue: dlq
        ? {
            queue: dlq,
            maxReceiveCount: queueConfig.maxReceiveCount || 3,
          }
        : undefined,
    });
  }

  private generatePermissions(): iam.PolicyStatement[] {
    if (this.queueArns.length === 0) return [];

    return [
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ],
        resources: this.queueArns,
      }),
    ];
  }
}
```

### Cognito Construct Template

```typescript
// cdk/config/cognito.config.ts
import { Environment } from "../lib/config/environment";
import { RemovalPolicy } from "aws-cdk-lib";

export interface CognitoConfig {
  userPoolName: string;
  selfSignUpEnabled: boolean;
  signInAliases: {
    email?: boolean;
    username?: boolean;
    phone?: boolean;
  };
  passwordPolicy?: {
    minLength?: number;
    requireLowercase?: boolean;
    requireUppercase?: boolean;
    requireDigits?: boolean;
    requireSymbols?: boolean;
  };
  mfa?: "OFF" | "OPTIONAL" | "REQUIRED";
  removalPolicy?: RemovalPolicy;
}

export interface CognitoEnvironmentConfig {
  config: CognitoConfig;
}

export const cognitoConfig: Record<Environment, CognitoEnvironmentConfig> = {
  dev: {
    config: {
      userPoolName: "arcforge-users",
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      mfa: "OFF",
      removalPolicy: RemovalPolicy.DESTROY,
    },
  },
  qa: {
    config: {
      userPoolName: "arcforge-users",
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: "OPTIONAL",
      removalPolicy: RemovalPolicy.DESTROY,
    },
  },
  prod: {
    config: {
      userPoolName: "arcforge-users",
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: "REQUIRED",
      removalPolicy: RemovalPolicy.RETAIN,
    },
  },
};

export const getCognitoConfig = (env: Environment): CognitoEnvironmentConfig => {
  return cognitoConfig[env];
};
```

### KMS Construct Template

```typescript
// cdk/config/kms.config.ts
import { Environment } from "../lib/config/environment";
import { RemovalPolicy } from "aws-cdk-lib";

export interface KMSKeyConfig {
  id: string;
  alias: string;
  description: string;
  enableKeyRotation?: boolean;
  removalPolicy?: RemovalPolicy;
}

export interface KMSEnvironmentConfig {
  keys: KMSKeyConfig[];
}

export const kmsConfig: Record<Environment, KMSEnvironmentConfig> = {
  dev: {
    keys: [
      {
        id: "dataKey",
        alias: "arcforge-data-key",
        description: "Key for encrypting sensitive data",
        enableKeyRotation: false,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    ],
  },
  qa: { keys: [] },
  prod: {
    keys: [
      {
        id: "dataKey",
        alias: "arcforge-data-key",
        description: "Key for encrypting sensitive data",
        enableKeyRotation: true,
        removalPolicy: RemovalPolicy.RETAIN,
      },
    ],
  },
};

export const getKMSConfig = (env: Environment): KMSEnvironmentConfig => {
  return kmsConfig[env];
};
```

### VPC Construct Template

```typescript
// cdk/config/vpc.config.ts
import { Environment } from "../lib/config/environment";

export interface VPCConfig {
  vpcName: string;
  maxAzs: number;
  natGateways: number;
  cidr?: string;
}

export interface VPCEnvironmentConfig {
  config: VPCConfig;
}

export const vpcConfig: Record<Environment, VPCEnvironmentConfig> = {
  dev: {
    config: {
      vpcName: "arcforge-vpc",
      maxAzs: 2,
      natGateways: 1,
      cidr: "10.0.0.0/16",
    },
  },
  qa: {
    config: {
      vpcName: "arcforge-vpc",
      maxAzs: 2,
      natGateways: 1,
      cidr: "10.1.0.0/16",
    },
  },
  prod: {
    config: {
      vpcName: "arcforge-vpc",
      maxAzs: 3,
      natGateways: 3,
      cidr: "10.2.0.0/16",
    },
  },
};

export const getVPCConfig = (env: Environment): VPCEnvironmentConfig => {
  return vpcConfig[env];
};
```

### SES Construct Template

```typescript
// cdk/config/ses.config.ts
import { Environment } from "../lib/config/environment";

export interface SESConfig {
  emailIdentity?: string;
  domainIdentity?: string;
  configurationSetName?: string;
}

export interface SESEnvironmentConfig {
  config: SESConfig;
}

export const sesConfig: Record<Environment, SESEnvironmentConfig> = {
  dev: {
    config: {
      emailIdentity: "noreply@dev.arcforge.example.com",
    },
  },
  qa: {
    config: {
      emailIdentity: "noreply@qa.arcforge.example.com",
    },
  },
  prod: {
    config: {
      domainIdentity: "arcforge.example.com",
      configurationSetName: "arcforge-email-tracking",
    },
  },
};

export const getSESConfig = (env: Environment): SESEnvironmentConfig => {
  return sesConfig[env];
};
```

---

## Deployment Guide

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18+ installed
3. CDK CLI installed: `npm install -g aws-cdk`

### Commands

```bash
# Navigate to CDK directory
cd cdk

# Install dependencies
npm install

# Synthesize CloudFormation templates (validates your code)
npx cdk synth

# Deploy a specific environment
npx cdk deploy ApiStack-dev      # Deploy dev
npx cdk deploy ApiStack-qa       # Deploy QA
npx cdk deploy ApiStack-prod     # Deploy production

# Deploy all environments
npx cdk deploy --all

# Compare deployed stack with current code
npx cdk diff ApiStack-dev

# Destroy a stack (use with caution!)
npx cdk destroy ApiStack-dev
```

### Environment-Specific Deployment

To deploy only certain environments, modify `cdk/bin/cdk.ts`:

```typescript
// Deploy only dev and qa (comment out prod)
const environments: Environment[] = ["dev", "qa"];
```

### CI/CD Considerations

For GitHub Actions or similar CI/CD:

```yaml
# Example workflow step
- name: Deploy CDK Stack
  run: |
    cd cdk
    npm ci
    npx cdk deploy ApiStack-${{ env.ENVIRONMENT }} --require-approval never
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: ap-south-1
    ENVIRONMENT: dev
```

---

## Troubleshooting

### Common Issues

#### 1. "Resource already exists" error

This usually happens when:
- A resource with the same name exists in another stack
- You're redeploying after a failed deployment

**Solution:** Add environment suffix to resource names or delete the conflicting resource.

#### 2. "Maximum policy size exceeded" error

Too many IAM permissions attached to Lambda role.

**Solution:**
- Create managed policies instead of inline policies
- Split permissions across multiple Lambda functions
- Use more specific resource ARNs instead of wildcards

#### 3. Circular dependency error

Constructs referencing each other.

**Solution:** Use `addDependency()` or restructure constructs to avoid circular references.

#### 4. Stack deployment timeout

Large stacks or slow resource creation.

**Solution:**
- Check CloudFormation events in AWS Console
- Increase timeout for specific resources
- Split into multiple stacks

### Debugging Tips

1. **Verbose output:**
   ```bash
   CDK_DEBUG=true npx cdk synth
   ```

2. **Check synthesized template:**
   ```bash
   npx cdk synth ApiStack-dev > template.yaml
   cat template.yaml
   ```

3. **View CloudFormation events:**
   ```bash
   aws cloudformation describe-stack-events --stack-name ApiStack-dev
   ```

4. **Test locally with SAM:**
   ```bash
   cd cdk
   npm run sam:start
   ```

### Permission Issues

If Lambda can't access a resource:

1. Check the construct's `permissions` array is properly populated
2. Verify the construct is added to `permissionProviders` in api-stack.ts
3. Check the feature flag is enabled for the environment
4. Look at Lambda's IAM role in AWS Console

---

## Quick Reference

### Adding a New Bucket

1. Edit `cdk/config/s3.config.ts`
2. Add bucket config to desired environment
3. Redeploy: `npx cdk deploy ApiStack-{env}`

### Adding a New Lambda Permission

1. Edit the relevant construct's `generatePermissions()` method
2. Or use `LambdaPermissions.createXXXPermission()` helper methods
3. Redeploy

### Enabling a Service for an Environment

1. Edit `cdk/lib/config/environment.ts`
2. Set the feature flag to `true` for the environment
3. Redeploy

---

*Last updated: December 2025*


import { Construct } from "constructs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { EnvironmentConfig } from "../../config/environment";
import { RDSEnvironmentConfig, getRDSConfig } from "../../../config/rds.config";
import { IPermissionProvider } from "../permissions/lambda-permissions";

/**
 * Props for RDSConstruct
 */
export interface RDSConstructProps {
  /** Environment configuration */
  config: EnvironmentConfig;
  /** Optional VPC to use (if not provided, a new VPC will be created) */
  vpc?: ec2.IVpc;
}

/**
 * RDS Construct
 *
 * Creates an RDS PostgreSQL instance with:
 * - Automatic secret management via Secrets Manager
 * - VPC with public/private subnets (if not provided)
 * - Security group for database access
 * - Automated backups and maintenance windows
 *
 * CRITICAL: Uses RemovalPolicy.SNAPSHOT for production to prevent data loss!
 * This creates a final snapshot before any deletion attempt.
 *
 * Usage:
 * ```typescript
 * const rdsConstruct = new RDSConstruct(this, 'RDS', { config });
 * // Access: rdsConstruct.instance, rdsConstruct.secret
 * ```
 */
export class RDSConstruct extends Construct implements IPermissionProvider {
  /** RDS Database Instance */
  public readonly instance: rds.DatabaseInstance;

  /** Database credentials secret */
  public readonly secret: secretsmanager.ISecret;

  /** VPC containing the database */
  public readonly vpc: ec2.IVpc;

  /** Security group for database access */
  public readonly securityGroup: ec2.SecurityGroup;

  /** IAM policy statements for Lambda to access the database */
  public readonly permissions: iam.PolicyStatement[] = [];

  constructor(scope: Construct, id: string, props: RDSConstructProps) {
    super(scope, id);

    const { config } = props;
    const rdsConfig = getRDSConfig(config.environment);
    const isProd = config.environment === "prod";

    console.log(
      `   🗄️  Creating RDS PostgreSQL instance for ${config.environment}...`,
    );

    // Create or use existing VPC
    this.vpc = props.vpc ?? this.createVpc(config, rdsConfig);

    // Create security group for database
    this.securityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `arcforge-db-sg-${config.environment}`,
      description: `Security group for ArcForge RDS - ${config.environment}`,
      allowAllOutbound: false,
    });

    // Allow Lambda access (from within VPC or via public access for dev/qa)
    if (rdsConfig.publiclyAccessible) {
      // For dev/qa - allow access from anywhere (be careful in production!)
      this.securityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(rdsConfig.port),
        "Allow PostgreSQL access",
      );
    } else {
      // For production - only allow access from within the VPC
      this.securityGroup.addIngressRule(
        ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
        ec2.Port.tcp(rdsConfig.port),
        "Allow PostgreSQL access from VPC",
      );
    }

    // Create database credentials secret
    this.secret = new secretsmanager.Secret(this, "DatabaseSecret", {
      secretName: config.dbSecretId,
      description: `Database credentials for ArcForge - ${config.environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: rdsConfig.username,
        }),
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // Determine removal policy based on environment
    // CRITICAL: Use SNAPSHOT for production to create a final snapshot before deletion
    const removalPolicy = isProd
      ? RemovalPolicy.SNAPSHOT
      : rdsConfig.deletionProtection
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY;

    // Create RDS PostgreSQL instance
    this.instance = new rds.DatabaseInstance(this, "Database", {
      instanceIdentifier: `arcforge-db-${config.environment}`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_18_1,
      }),
      instanceType: ec2.InstanceType.of(
        rdsConfig.instanceClass,
        rdsConfig.instanceSize,
      ),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: rdsConfig.publiclyAccessible
          ? ec2.SubnetType.PUBLIC
          : ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.securityGroup],
      credentials: rds.Credentials.fromSecret(this.secret),
      databaseName: rdsConfig.databaseName,
      port: rdsConfig.port,

      // Storage configuration
      allocatedStorage: rdsConfig.allocatedStorage,
      maxAllocatedStorage: rdsConfig.maxAllocatedStorage,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,

      // Backup configuration
      backupRetention: Duration.days(rdsConfig.backupRetentionDays),
      preferredBackupWindow: "03:00-04:00", // 3-4 AM UTC
      preferredMaintenanceWindow: "Sun:04:00-Sun:05:00", // Sunday 4-5 AM UTC

      // High availability
      multiAz: rdsConfig.multiAz,

      // Protection settings
      deletionProtection: rdsConfig.deletionProtection,
      removalPolicy: removalPolicy,

      // Performance and monitoring
      enablePerformanceInsights: isProd,
      performanceInsightRetention: isProd
        ? rds.PerformanceInsightRetention.DEFAULT
        : undefined,
      monitoringInterval: isProd ? Duration.seconds(60) : undefined,

      // Network settings
      publiclyAccessible: rdsConfig.publiclyAccessible,

      // Auto minor version upgrade
      autoMinorVersionUpgrade: true,
    });

    // Generate permissions for Lambda to access Secrets Manager
    this.permissions = this.generatePermissions();

    // Outputs
    new CfnOutput(this, "DatabaseEndpoint", {
      value: this.instance.instanceEndpoint.hostname,
      description: `RDS Endpoint for ArcForge - ${config.environment}`,
      exportName: `ArcForge-RDS-Endpoint-${config.environment}`,
    });

    new CfnOutput(this, "DatabasePort", {
      value: this.instance.instanceEndpoint.port.toString(),
      description: `RDS Port for ArcForge - ${config.environment}`,
      exportName: `ArcForge-RDS-Port-${config.environment}`,
    });

    new CfnOutput(this, "DatabaseSecretArn", {
      value: this.secret.secretArn,
      description: `Secrets Manager ARN for database credentials - ${config.environment}`,
      exportName: `ArcForge-RDS-SecretArn-${config.environment}`,
    });

    new CfnOutput(this, "DatabaseName", {
      value: rdsConfig.databaseName,
      description: `Database name for ArcForge - ${config.environment}`,
      exportName: `ArcForge-RDS-DatabaseName-${config.environment}`,
    });

    console.log(`   ✅ RDS instance created: arcforge-db-${config.environment}`);
    console.log(
      `   ⚠️  RemovalPolicy: ${removalPolicy} (${isProd ? "will create snapshot on delete" : "will be destroyed"})`,
    );
  }

  /**
   * Create a VPC for the database
   * COST OPTIMIZATION: Only creates NAT Gateway if private access is required
   *
   * NOTE: AWS RDS requires DB subnet groups to span at least 2 AZs,
   * regardless of whether Multi-AZ is enabled. This is an AWS requirement.
   */
  private createVpc(
    config: EnvironmentConfig,
    rdsConfig: RDSEnvironmentConfig,
  ): ec2.Vpc {
    // AWS RDS requires at least 2 AZs for DB subnet groups, even for single-AZ deployments
    const requiredAzs = 2;

    return new ec2.Vpc(this, "DatabaseVpc", {
      vpcName: `arcforge-vpc-${config.environment}`,
      maxAzs: requiredAzs, // Only use multiple AZs if Multi-AZ is enabled
      natGateways: rdsConfig.publiclyAccessible ? 0 : 1, // NAT Gateway costs ~$32/month, skip if public
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        ...(rdsConfig.publiclyAccessible
          ? []
          : [
              {
                name: "Private",
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                cidrMask: 24,
              },
            ]),
      ],
    });
  }

  /**
   * Generate IAM policy statements for Lambda access
   */
  private generatePermissions(): iam.PolicyStatement[] {
    const statements: iam.PolicyStatement[] = [];

    // Permission to read database secret
    statements.push(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ],
        resources: [this.secret.secretArn],
      }),
    );

    // Permission to connect to RDS (if using IAM authentication)
    statements.push(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["rds-db:connect"],
        resources: [
          `arn:aws:rds-db:*:*:dbuser:${this.instance.instanceIdentifier}/*`,
        ],
      }),
    );

    return statements;
  }

  /**
   * Get database connection details for Lambda environment variables
   * Note: DB_SECRET_ID is already passed via config.dbSecretId, so only host/port needed
   */
  public getConnectionEnvVars(): Record<string, string> {
    return {
      DB_HOST: this.instance.instanceEndpoint.hostname,
      DB_PORT: this.instance.instanceEndpoint.port.toString(),
    };
  }
}

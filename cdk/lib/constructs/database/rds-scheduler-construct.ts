import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as rds from "aws-cdk-lib/aws-rds";
import { Duration, CfnOutput, Stack } from "aws-cdk-lib";
import * as path from "path";
import { EnvironmentConfig } from "../../config/environment";

/**
 * Schedule configuration for RDS instance
 */
export interface RDSScheduleConfig {
  /** Enable scheduling (default: false) */
  enabled: boolean;
  /**
   * Cron expression to START the RDS instance (UTC timezone)
   * Format: cron(minutes hours day-of-month month day-of-week year)
   * Example: "cron(0 6 ? * MON-FRI *)" = 6:00 AM UTC, Monday-Friday
   */
  startSchedule?: string;
  /**
   * Cron expression to STOP the RDS instance (UTC timezone)
   * Format: cron(minutes hours day-of-month month day-of-week year)
   * Example: "cron(0 18 ? * MON-FRI *)" = 6:00 PM UTC, Monday-Friday
   */
  stopSchedule?: string;
  /**
   * Timezone reference (for documentation only - cron runs in UTC)
   * @default "UTC"
   */
  timezone?: string;
}

/**
 * Props for RDSSchedulerConstruct
 */
export interface RDSSchedulerConstructProps {
  /** Environment configuration */
  config: EnvironmentConfig;
  /** RDS Database Instance to schedule */
  rdsInstance: rds.DatabaseInstance;
  /** Schedule configuration */
  scheduleConfig: RDSScheduleConfig;
}

/**
 * RDS Scheduler Construct
 *
 * Creates EventBridge rules and a Lambda function to automatically
 * start and stop an RDS instance on a schedule for cost savings.
 *
 * COST SAVINGS EXAMPLE:
 * - db.t4g.micro running 24/7: ~$12/month
 * - db.t4g.micro running 12 hours/day (business hours): ~$6/month
 * - Savings: 50%!
 *
 * IMPORTANT NOTES:
 * - Stopping an RDS instance is free, but you still pay for storage and backups
 * - RDS automatically starts after 7 days if left stopped (AWS limitation)
 * - The scheduler re-stops it on the next scheduled stop time
 *
 * Usage:
 * ```typescript
 * new RDSSchedulerConstruct(this, 'RDSScheduler', {
 *   config,
 *   rdsInstance: rds.instance,
 *   scheduleConfig: {
 *     enabled: true,
 *     // Start at 7 AM IST (01:30 UTC) on weekdays
 *     startSchedule: 'cron(30 1 ? * MON-SAT *)',
 *     // Stop at 10 PM IST (16:30 UTC) on weekdays
 *     stopSchedule: 'cron(30 16 ? * MON-SAT *)',
 *   },
 * });
 * ```
 */
export class RDSSchedulerConstruct extends Construct {
  /** The Lambda function that controls RDS start/stop */
  public readonly schedulerFunction: lambda.Function;

  /** EventBridge rule for starting RDS */
  public readonly startRule?: events.Rule;

  /** EventBridge rule for stopping RDS */
  public readonly stopRule?: events.Rule;

  constructor(scope: Construct, id: string, props: RDSSchedulerConstructProps) {
    super(scope, id);

    const { config, rdsInstance, scheduleConfig } = props;

    if (!scheduleConfig.enabled) {
      console.log(`   ⏰ RDS scheduling is disabled for ${config.environment}`);
      // Create a dummy function to satisfy the readonly property
      this.schedulerFunction = new lambda.Function(this, "DummyScheduler", {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromInline(
          'exports.handler = async () => "disabled"',
        ),
        functionName: `arcforge-rds-scheduler-disabled-${config.environment}`,
      });
      return;
    }

    console.log(`   ⏰ Setting up RDS scheduling for ${config.environment}...`);

    // Create the scheduler Lambda function using NodejsFunction for proper bundling
    // Lambda code is in api/src/lambdas/rdsScheduler.lambda.ts for consistency
    this.schedulerFunction = new NodejsFunction(this, "SchedulerFunction", {
      functionName: `arcforge-rds-scheduler-${config.environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      entry: path.join(
        __dirname,
        "../../../../api/src/lambdas/rdsScheduler.lambda.ts",
      ),
      environment: {
        DB_INSTANCE_IDENTIFIER: rdsInstance.instanceIdentifier,
      },
      timeout: Duration.seconds(30),
      memorySize: 128,
      description: `Start/Stop RDS instance for ArcForge - ${config.environment}`,
      bundling: {
        // Bundle the AWS SDK since we need @aws-sdk/client-rds
        externalModules: [],
        minify: true,
        sourceMap: false,
      },
    });

    // Grant permissions to start/stop RDS
    this.schedulerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "rds:StartDBInstance",
          "rds:StopDBInstance",
          "rds:DescribeDBInstances",
        ],
        resources: [
          `arn:aws:rds:${Stack.of(this).region}:*:db:${rdsInstance.instanceIdentifier}`,
        ],
      }),
    );

    // Create EventBridge rule for starting RDS
    if (scheduleConfig.startSchedule) {
      this.startRule = new events.Rule(this, "StartRule", {
        ruleName: `arcforge-rds-start-${config.environment}`,
        description: `Start RDS instance for ArcForge - ${config.environment}`,
        schedule: events.Schedule.expression(scheduleConfig.startSchedule),
        enabled: true,
      });

      this.startRule.addTarget(
        new targets.LambdaFunction(this.schedulerFunction, {
          event: events.RuleTargetInput.fromObject({
            action: "start",
            dbInstanceIdentifier: rdsInstance.instanceIdentifier,
          }),
        }),
      );

      console.log(`   🌅 Start schedule: ${scheduleConfig.startSchedule}`);
    }

    // Create EventBridge rule for stopping RDS
    if (scheduleConfig.stopSchedule) {
      this.stopRule = new events.Rule(this, "StopRule", {
        ruleName: `arcforge-rds-stop-${config.environment}`,
        description: `Stop RDS instance for ArcForge - ${config.environment}`,
        schedule: events.Schedule.expression(scheduleConfig.stopSchedule),
        enabled: true,
      });

      this.stopRule.addTarget(
        new targets.LambdaFunction(this.schedulerFunction, {
          event: events.RuleTargetInput.fromObject({
            action: "stop",
            dbInstanceIdentifier: rdsInstance.instanceIdentifier,
          }),
        }),
      );

      console.log(`   🌙 Stop schedule: ${scheduleConfig.stopSchedule}`);
    }

    // Outputs
    new CfnOutput(this, "SchedulerFunctionArn", {
      value: this.schedulerFunction.functionArn,
      description: `RDS Scheduler Lambda ARN - ${config.environment}`,
      exportName: `ArcForge-RDS-SchedulerArn-${config.environment}`,
    });

    if (this.startRule) {
      new CfnOutput(this, "StartRuleArn", {
        value: this.startRule.ruleArn,
        description: `RDS Start Schedule Rule - ${config.environment}`,
      });
    }

    if (this.stopRule) {
      new CfnOutput(this, "StopRuleArn", {
        value: this.stopRule.ruleArn,
        description: `RDS Stop Schedule Rule - ${config.environment}`,
      });
    }

    const timezone = scheduleConfig.timezone || "UTC";
    console.log(
      `   ✅ RDS scheduling configured (timezone reference: ${timezone})`,
    );
    console.log(
      `   💡 Note: AWS EventBridge uses UTC. Adjust times accordingly for ${timezone}.`,
    );
  }
}

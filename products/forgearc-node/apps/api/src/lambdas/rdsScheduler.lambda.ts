/**
 * RDS Scheduler Lambda
 *
 * Scheduled job to start/stop RDS instances for cost savings.
 * Triggered by EventBridge scheduled rules.
 *
 * This Lambda:
 * 1. Checks the current state of the RDS instance
 * 2. Starts or stops it based on the event action
 * 3. Handles edge cases (already running/stopped, transitioning states)
 *
 * Environment Variables:
 *   - DB_INSTANCE_IDENTIFIER: The RDS instance identifier to control
 */

import {
  RDSClient,
  StartDBInstanceCommand,
  StopDBInstanceCommand,
  DescribeDBInstancesCommand,
} from '@aws-sdk/client-rds';

// Types
interface SchedulerEvent {
  action: 'start' | 'stop';
  dbInstanceIdentifier?: string;
}

interface SchedulerResponse {
  statusCode: number;
  body: string;
}

// Initialize RDS client
const rdsClient = new RDSClient({});

/**
 * Lambda handler for RDS start/stop operations
 */
export const handler = async (event: SchedulerEvent): Promise<SchedulerResponse> => {
  const dbInstanceIdentifier = event.dbInstanceIdentifier || process.env.DB_INSTANCE_IDENTIFIER;

  if (!dbInstanceIdentifier) {
    console.error('DB_INSTANCE_IDENTIFIER not provided');
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'DB_INSTANCE_IDENTIFIER is required',
      }),
    };
  }

  const action = event.action;
  console.log(
    `🔄 ${action.toUpperCase()} action requested for RDS instance: ${dbInstanceIdentifier}`
  );

  try {
    // First, check the current state of the instance
    const describeCommand = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: dbInstanceIdentifier,
    });
    const describeResponse = await rdsClient.send(describeCommand);
    const instance = describeResponse.DBInstances?.[0];

    if (!instance) {
      throw new Error(`RDS instance not found: ${dbInstanceIdentifier}`);
    }

    const currentStatus = instance.DBInstanceStatus;
    console.log(`📊 Current instance status: ${currentStatus}`);

    if (action === 'start') {
      return handleStart(dbInstanceIdentifier, currentStatus ?? 'unknown');
    } else if (action === 'stop') {
      return handleStop(dbInstanceIdentifier, currentStatus ?? 'unknown');
    } else {
      console.error(`❌ Invalid action: ${action}`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Invalid action: ${action}. Must be 'start' or 'stop'`,
        }),
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error ${action}ing RDS instance:`, errorMessage);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `Failed to ${action} RDS instance`,
        details: errorMessage,
      }),
    };
  }
};

/**
 * Handle start action
 */
async function handleStart(
  dbInstanceIdentifier: string,
  currentStatus: string
): Promise<SchedulerResponse> {
  if (currentStatus === 'available') {
    console.log('✅ Instance is already running, no action needed');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Instance is already running',
        status: currentStatus,
      }),
    };
  }

  if (currentStatus !== 'stopped') {
    console.log(`⚠️ Instance is in ${currentStatus} state, cannot start now`);
    return {
      statusCode: 409,
      body: JSON.stringify({
        message: `Instance is in ${currentStatus} state, cannot start`,
        status: currentStatus,
      }),
    };
  }

  console.log('🚀 Starting RDS instance...');
  const startCommand = new StartDBInstanceCommand({
    DBInstanceIdentifier: dbInstanceIdentifier,
  });
  await rdsClient.send(startCommand);

  console.log('✅ Start command sent successfully');
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'RDS instance is starting',
      dbInstanceIdentifier,
      previousStatus: currentStatus,
    }),
  };
}

/**
 * Handle stop action
 */
async function handleStop(
  dbInstanceIdentifier: string,
  currentStatus: string
): Promise<SchedulerResponse> {
  if (currentStatus === 'stopped') {
    console.log('✅ Instance is already stopped, no action needed');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Instance is already stopped',
        status: currentStatus,
      }),
    };
  }

  if (currentStatus !== 'available') {
    console.log(`⚠️ Instance is in ${currentStatus} state, cannot stop now`);
    return {
      statusCode: 409,
      body: JSON.stringify({
        message: `Instance is in ${currentStatus} state, cannot stop`,
        status: currentStatus,
      }),
    };
  }

  console.log('🛑 Stopping RDS instance...');
  const stopCommand = new StopDBInstanceCommand({
    DBInstanceIdentifier: dbInstanceIdentifier,
  });
  await rdsClient.send(stopCommand);

  console.log('✅ Stop command sent successfully');
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'RDS instance is stopping',
      dbInstanceIdentifier,
      previousStatus: currentStatus,
    }),
  };
}

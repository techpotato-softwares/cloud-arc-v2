/**
 * Production Database Truncate Script
 *
 * Truncate production data by mode:
 *   --mode=full            => transactional + master tables
 *   --mode=transactional   => transactional tables only
 *   --mode=master          => master tables only
 *
 * Safety:
 * - Intended for GitHub Actions with explicit confirmation gating.
 * - Deletes S3 objects referenced by file_uploads before truncating file_uploads.
 *
 * Environment Variables:
 *   AWS_REGION   (default: ap-south-1)
 *   DB_SECRET_ID (default: /arcforge/prod/db)
 *   STACK_NAME   (default: ApiStack-prod)
 *   DB_HOST      (optional override; auto-resolved from CloudFormation when absent)
 *   DB_PORT      (default: 5432)
 *   DB_NAME      (default: arcforge)
 *   DB_SSL       (default: true; set DB_SSL=false to disable)
 */

const { Client } = require("pg");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require("@aws-sdk/client-cloudformation");
const {
  RDSClient,
  DescribeDBInstancesCommand,
  CreateDBSnapshotCommand,
} = require("@aws-sdk/client-rds");
const {
  S3Client,
  DeleteObjectsCommand,
  CopyObjectCommand,
} = require("@aws-sdk/client-s3");

const TRANSACTIONAL_TABLES = [
  "purchase_orders",
  "po_items",
  "dispatches",
  "dispatched_items",
  "services",
  "accounting_entries",
  "file_uploads",
];

const MASTER_TABLES = [
  "clients",
  "categories",
  "oems",
  "products",
  "users",
  "roles",
  "permissions",
  "role_permissions",
];

const MODE_TO_TABLES = {
  transactional: TRANSACTIONAL_TABLES,
  master: MASTER_TABLES,
  full: [...TRANSACTIONAL_TABLES, ...MASTER_TABLES],
};

function resolveArg(key, defaultValue = null) {
  const arg = process.argv.find((entry) => entry.startsWith(`--${key}=`));
  return arg ? arg.split("=")[1] : defaultValue;
}

function resolveBooleanArg(key, defaultValue) {
  const value = resolveArg(key, String(defaultValue));
  return String(value).toLowerCase() === "true";
}

function resolveMode() {
  const mode = resolveArg("mode", "full");
  if (!MODE_TO_TABLES[mode]) {
    throw new Error(
      `Unknown mode "${mode}". Valid modes: ${Object.keys(MODE_TO_TABLES).join(", ")}`
    );
  }
  return mode;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function resolveDbHost(region, stackName) {
  if (process.env.DB_HOST) {
    console.log(`   Using DB_HOST from environment: ${process.env.DB_HOST}`);
    return process.env.DB_HOST;
  }

  console.log(`   Fetching RDS endpoint from CloudFormation stack (${stackName})...`);
  const cfnClient = new CloudFormationClient({ region });
  const stackResponse = await cfnClient.send(
    new DescribeStacksCommand({ StackName: stackName })
  );

  const outputs = stackResponse.Stacks?.[0]?.Outputs || [];
  const endpointOutput = outputs.find(
    (output) => output.ExportName === "ArcForge-RDS-Endpoint-prod"
  );

  if (!endpointOutput?.OutputValue) {
    throw new Error(
      "Could not find RDS endpoint export (ArcForge-RDS-Endpoint-prod) in CloudFormation outputs."
    );
  }

  console.log(`   Found RDS endpoint: ${endpointOutput.OutputValue}`);
  return endpointOutput.OutputValue;
}

async function fetchDbCredentials(region, secretId) {
  console.log(`   Fetching DB credentials from Secrets Manager (${secretId})...`);
  const secretsClient = new SecretsManagerClient({ region });
  const secret = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );
  const parsed = JSON.parse(secret.SecretString || "{}");

  if (!parsed.username || !parsed.password) {
    throw new Error('Secret must contain "username" and "password".');
  }
  return parsed;
}

function getTimestampId() {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 15);
}

async function resolveDbInstanceIdentifier(region, dbHost) {
  if (process.env.DB_INSTANCE_IDENTIFIER) {
    console.log(
      `   Using DB_INSTANCE_IDENTIFIER from environment: ${process.env.DB_INSTANCE_IDENTIFIER}`
    );
    return process.env.DB_INSTANCE_IDENTIFIER;
  }

  const rdsClient = new RDSClient({ region });
  let marker = undefined;
  do {
    const response = await rdsClient.send(
      new DescribeDBInstancesCommand({ Marker: marker })
    );
    const match = (response.DBInstances || []).find(
      (instance) => instance.Endpoint && instance.Endpoint.Address === dbHost
    );
    if (match?.DBInstanceIdentifier) {
      return match.DBInstanceIdentifier;
    }
    marker = response.Marker;
  } while (marker);

  throw new Error(
    "Could not resolve DB instance identifier. Set DB_INSTANCE_IDENTIFIER explicitly."
  );
}

async function createPreTruncateSnapshot(region, dbHost) {
  const identifier = await resolveDbInstanceIdentifier(region, dbHost);
  const snapshotId = `arcforge-pretruncate-${getTimestampId()}`;
  const rdsClient = new RDSClient({ region });

  console.log(`   Creating DB snapshot: ${snapshotId}`);
  await rdsClient.send(
    new CreateDBSnapshotCommand({
      DBInstanceIdentifier: identifier,
      DBSnapshotIdentifier: snapshotId,
    })
  );
  console.log(`   Snapshot request submitted for instance: ${identifier}`);

  return { snapshotId, dbInstanceIdentifier: identifier };
}

async function listFileUploads(pgClient) {
  const result = await pgClient.query(
    `SELECT s3_bucket, s3_key
     FROM file_uploads
     WHERE s3_bucket IS NOT NULL
       AND s3_key IS NOT NULL`
  );
  return result.rows;
}

function groupObjectsByBucket(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const bucket = String(row.s3_bucket || "").trim();
    const key = String(row.s3_key || "").trim();
    if (!bucket || !key) {
      continue;
    }
    if (!grouped.has(bucket)) {
      grouped.set(bucket, []);
    }
    grouped.get(bucket).push(key);
  }
  return grouped;
}

async function backupS3ObjectsForFileUploads(rows, region, backupBucket, backupPrefix) {
  if (!backupBucket) {
    throw new Error(
      "BACKUP_S3_BUCKET is required when S3 backup is enabled and file_uploads is selected."
    );
  }

  const grouped = groupObjectsByBucket(rows);
  if (grouped.size === 0) {
    console.log("   No S3 objects found to backup.");
    return { copiedCount: 0, bucketCount: 0, backupPrefix };
  }

  const s3Client = new S3Client({ region });
  let copiedCount = 0;
  const safePrefix = backupPrefix.endsWith("/") ? backupPrefix : `${backupPrefix}/`;

  for (const [bucket, keys] of grouped.entries()) {
    const uniqueKeys = [...new Set(keys)];
    console.log(
      `   Backing up ${uniqueKeys.length} object(s) from bucket ${bucket} to s3://${backupBucket}/${safePrefix}${bucket}/`
    );
    for (const key of uniqueKeys) {
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: backupBucket,
          Key: `${safePrefix}${bucket}/${key}`,
          CopySource: `${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
        })
      );
      copiedCount++;
    }
  }

  return { copiedCount, bucketCount: grouped.size, backupPrefix: safePrefix };
}

async function deleteS3ObjectsForFileUploads(rows, region) {
  const grouped = groupObjectsByBucket(rows);
  if (grouped.size === 0) {
    console.log("   No S3 objects found in file_uploads.");
    return { deletedCount: 0, bucketCount: 0 };
  }

  const s3Client = new S3Client({ region });
  let deletedCount = 0;

  for (const [bucket, keys] of grouped.entries()) {
    const uniqueKeys = [...new Set(keys)];
    const chunks = chunkArray(uniqueKeys, 1000);
    console.log(
      `   Deleting ${uniqueKeys.length} object(s) from bucket ${bucket} in ${chunks.length} batch(es)...`
    );
    for (const keyChunk of chunks) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: keyChunk.map((key) => ({ Key: key })),
            Quiet: true,
          },
        })
      );
      deletedCount += keyChunk.length;
    }
  }

  return { deletedCount, bucketCount: grouped.size };
}

async function run() {
  const region = process.env.AWS_REGION || "ap-south-1";
  const secretId = process.env.DB_SECRET_ID || "/arcforge/prod/db";
  const stackName = process.env.STACK_NAME || "ApiStack-prod";
  const dbPort = process.env.DB_PORT || "5432";
  const dbName = process.env.DB_NAME || "arcforge";
  const dbSsl = process.env.DB_SSL !== "false";
  const mode = resolveMode();
  const backupBeforeTruncate = resolveBooleanArg("backup", true);
  const backupS3Objects = resolveBooleanArg("backup-s3", true);
  const backupS3Bucket = process.env.BACKUP_S3_BUCKET || "";
  const backupS3Prefix =
    process.env.BACKUP_S3_PREFIX || `arcforge/prod/pretruncate/${mode}-${getTimestampId()}`;
  const selectedTables = MODE_TO_TABLES[mode];

  console.log("⚠️  Production DB truncate requested.");
  console.log(`   Mode: ${mode}`);
  console.log(`   Backup before truncate: ${backupBeforeTruncate}`);
  console.log(`   S3 backup enabled: ${backupS3Objects}`);
  console.log(`   Table count: ${selectedTables.length}`);
  console.log(`   Tables: ${selectedTables.join(", ")}`);

  const dbHost = await resolveDbHost(region, stackName);
  const { username, password } = await fetchDbCredentials(region, secretId);

  const pgClient = new Client({
    host: dbHost,
    port: parseInt(dbPort, 10),
    database: dbName,
    user: username,
    password,
    ssl: dbSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log(`   Connecting to ${dbHost}:${dbPort}/${dbName} ...`);
    await pgClient.connect();
    console.log("   Connected.");

    if (backupBeforeTruncate) {
      const { snapshotId, dbInstanceIdentifier } = await createPreTruncateSnapshot(
        region,
        dbHost
      );
      console.log(
        `   Backup snapshot created: ${snapshotId} (instance: ${dbInstanceIdentifier})`
      );
    }

    // Ensure file references are safely backed up and then cleaned from S3 before DB row deletion.
    if (selectedTables.includes("file_uploads")) {
      const fileUploads = await listFileUploads(pgClient);
      console.log(`   file_uploads rows with S3 references: ${fileUploads.length}`);

      if (backupBeforeTruncate && backupS3Objects) {
        const { copiedCount, bucketCount, backupPrefix: usedPrefix } =
          await backupS3ObjectsForFileUploads(
            fileUploads,
            region,
            backupS3Bucket,
            backupS3Prefix
          );
        console.log(
          `   S3 backup done. Copied ${copiedCount} object(s) across ${bucketCount} bucket(s) to s3://${backupS3Bucket}/${usedPrefix}`
        );
      }

      console.log("   S3 cleanup for file_uploads is enabled.");
      const { deletedCount, bucketCount } = await deleteS3ObjectsForFileUploads(
        fileUploads,
        region
      );
      console.log(
        `   S3 cleanup done. Deleted ${deletedCount} object(s) across ${bucketCount} bucket(s).`
      );
    }

    const quotedTables = selectedTables.map((table) => `"${table}"`).join(", ");
    const truncateSql = `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`;

    console.log("   Executing truncate...");
    await pgClient.query(truncateSql);
    console.log("✅ Truncate completed successfully.");
  } catch (error) {
    console.error("❌ Truncate failed:", error.message);
    process.exit(1);
  } finally {
    try {
      await pgClient.end();
    } catch (_) {}
  }
}

run().catch((error) => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});

/**
 * Seed Admin User Script
 *
 * Interactive seeder — choose exactly what you want to seed.
 *
 * Usage (interactive menu):
 *   node scripts/seed-admin.js
 *
 * Usage (non-interactive, skip menu):
 *   node scripts/seed-admin.js --mode=full
 *   node scripts/seed-admin.js --mode=permissions
 *   node scripts/seed-admin.js --mode=user
 *   node scripts/seed-admin.js --mode=role
 *   node scripts/seed-admin.js --mode=assign
 *   node scripts/seed-admin.js --mode=permissions-role
 *
 * Available --mode values:
 *   full             → All 5 steps (fresh install)
 *   permissions      → Upsert permissions only
 *   user             → Create / update admin user only
 *   role             → Create / update admin role only
 *   assign           → Re-assign all permissions to admin role
 *   permissions-role → Permissions + Role + Assign (no user)
 *
 * Database connection (set ONE of these):
 *   DATABASE_URL=postgres://...      (direct connection string)
 *   DB_HOST + DB_SECRET_ID           (AWS Secrets Manager, production)
 *
 * Default admin credentials (CHANGE AFTER FIRST LOGIN!):
 *   Username: admin
 *   Password: admin
 */

const readline = require("readline");
const bcrypt = require("bcryptjs");

// ─── Configuration ────────────────────────────────────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

// ─── Permission Definitions ───────────────────────────────────────────────────
const PERMISSIONS = [
  { code: "admin", name: "Admin", description: "Full administrative access" },
  { code: "user:create", name: "User Create", description: "Create users" },
  { code: "user:write", name: "User Write", description: "Update users" },
  { code: "user:read", name: "User Read", description: "Read users" },
  { code: "demo:read", name: "Demo Read", description: "Read demo items" },
  { code: "demo:write", name: "Demo Write", description: "Write demo items" },
  { code: "ai:chat", name: "AI Chat", description: "Use AI chat endpoint" },
  { code: "role:write", name: "Role Write", description: "Manage roles" },
  { code: "permission:write", name: "Permission Write", description: "Manage permissions" },
  { code: "files:read", name: "Files Read", description: "Download files" },
  { code: "files:write", name: "Files Write", description: "Upload files" },
];

// ─── Menu Definition ──────────────────────────────────────────────────────────
const MENU = [
  {
    key: "1",
    mode: "full",
    label: "Full Setup",
    description: "All 5 steps — recommended for a fresh install",
    steps: ["user", "permissions", "role", "assign", "link"],
  },
  {
    key: "2",
    mode: "permissions",
    label: "Update Permissions Only",
    description: "Add new permissions / update descriptions (safe to re-run anytime)",
    steps: ["permissions"],
  },
  {
    key: "3",
    mode: "user",
    label: "Create / Update Admin User",
    description: "Create admin user or reset password",
    steps: ["user"],
  },
  {
    key: "4",
    mode: "role",
    label: "Create / Update Admin Role",
    description: "Create or refresh the admin role",
    steps: ["role"],
  },
  {
    key: "5",
    mode: "assign",
    label: "Re-assign Permissions → Admin Role",
    description: "Sync all existing permissions to the admin role",
    steps: ["assign"],
  },
  {
    key: "6",
    mode: "permissions-role",
    label: "Permissions + Role + Assign",
    description: "Steps 2-5: update permissions, role, and re-assign (no user creation)",
    steps: ["permissions", "role", "assign"],
  },
];

// ─── Interactive Menu ─────────────────────────────────────────────────────────
function showMenu() {
  console.log("\n┌─────────────────────────────────────────────────────┐");
  console.log("│          🌱  ArcForge DB Seeder  —  What to seed?     │");
  console.log("├─────────────────────────────────────────────────────┤");
  for (const item of MENU) {
    console.log(`│  [${item.key}] ${item.label.padEnd(30)} │`);
    console.log(`│      ${item.description.substring(0, 47).padEnd(47)} │`);
    console.log("│                                                     │");
  }
  console.log(`│  [0] Exit                                           │`);
  console.log("└─────────────────────────────────────────────────────┘");
}

function promptChoice() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("\nEnter your choice: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function resolveMode() {
  // Check for --mode=xxx CLI argument
  const modeArg = process.argv.find((a) => a.startsWith("--mode="));
  if (modeArg) {
    return modeArg.split("=")[1];
  }
  return null;
}

// ─── Database Connection ──────────────────────────────────────────────────────
async function getDbConnection() {
  if (process.env.DATABASE_URL) {
    console.log("   Using DATABASE_URL from environment");
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    };
  }

  const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
  const region   = process.env.AWS_REGION    || "ap-south-1";
  const secretId = process.env.DB_SECRET_ID  || "/arcforge/prod/db";
  const dbHost   = process.env.DB_HOST;
  const dbPort   = process.env.DB_PORT       || "5432";
  const dbName   = process.env.DB_NAME       || "arcforge";

  if (!dbHost) {
    throw new Error(
      "DB_HOST is required when not using DATABASE_URL.\n" +
      "Either set DATABASE_URL or set DB_HOST along with DB_SECRET_ID."
    );
  }

  console.log(`   Fetching credentials from AWS Secrets Manager (${secretId})...`);
  const secretsClient = new SecretsManagerClient({ region });
  const secret = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretId }));
  const { username, password } = JSON.parse(secret.SecretString);

  console.log(`   Connecting to: ${dbHost}:${dbPort}/${dbName}`);
  return {
    host: dbHost,
    port: parseInt(dbPort),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  };
}

// ─── Step Helpers ─────────────────────────────────────────────────────────────

/** Fetch the existing admin user id from the DB (without creating). */
async function fetchAdminUserId(client) {
  const result = await client.query(
    "SELECT user_id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
    [ADMIN_USERNAME, ADMIN_EMAIL]
  );
  if (result.rows.length === 0) {
    throw new Error(
      `Admin user '${ADMIN_USERNAME}' not found in the database.\n` +
      "Run 'Create / Update Admin User' first (option 3 or Full Setup)."
    );
  }
  return result.rows[0].user_id;
}

/** Fetch the existing admin role id from the DB (without creating). */
async function fetchAdminRoleId(client) {
  const result = await client.query(
    "SELECT role_id FROM roles WHERE role_name = $1 LIMIT 1",
    ["admin"]
  );
  if (result.rows.length === 0) {
    throw new Error(
      "Admin role not found in the database.\n" +
      "Run 'Create / Update Admin Role' first (option 4 or Full Setup)."
    );
  }
  return result.rows[0].role_id;
}

/** Step: Create or update admin user. Returns adminUserId. */
async function stepCreateUser(client) {
  console.log("\n👨‍💼  Creating / updating admin user...");
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await client.query(
    "SELECT user_id FROM users WHERE username = $1 OR email = $2",
    [ADMIN_USERNAME, ADMIN_EMAIL]
  );

  let adminUserId;
  if (existing.rows.length > 0) {
    adminUserId = existing.rows[0].user_id;
    console.log(`   ⚠️  User '${ADMIN_USERNAME}' already exists (ID: ${adminUserId}) — updating password.`);
    await client.query(
      `UPDATE users SET password = $1, is_active = true, updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [hashedPassword, adminUserId]
    );
    console.log("   ✅ Password updated.");
  } else {
    const res = await client.query(
      `INSERT INTO users (username, email, password, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING user_id`,
      [ADMIN_USERNAME, ADMIN_EMAIL, hashedPassword]
    );
    adminUserId = res.rows[0].user_id;
    console.log(`   ✅ Admin user created (ID: ${adminUserId}).`);
  }

  return adminUserId;
}

/** Step: Upsert all permissions. Requires adminUserId for audit columns. */
async function stepSeedPermissions(client, adminUserId) {
  console.log(`\n📋  Seeding ${PERMISSIONS.length} permissions...`);
  let added = 0, updated = 0;

  for (const perm of PERMISSIONS) {
    const existing = await client.query(
      "SELECT permission_id FROM permissions WHERE permission_code = $1",
      [perm.code]
    );
    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE permissions SET permission_name = $1, description = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
         WHERE permission_code = $4`,
        [perm.name, perm.description, adminUserId, perm.code]
      );
      updated++;
    } else {
      await client.query(
        `INSERT INTO permissions (permission_code, permission_name, description, is_active, created_by, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, true, $4, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [perm.code, perm.name, perm.description, adminUserId]
      );
      added++;
    }
  }
  console.log(`   ✅ Permissions done — ${added} added, ${updated} updated.`);
}

/** Step: Create or update admin role. Returns adminRoleId. */
async function stepCreateRole(client, adminUserId) {
  console.log("\n👤  Creating / updating admin role...");

  const existing = await client.query(
    "SELECT role_id FROM roles WHERE role_name = $1",
    ["admin"]
  );

  let adminRoleId;
  if (existing.rows.length > 0) {
    adminRoleId = existing.rows[0].role_id;
    console.log(`   ⚠️  Admin role already exists (ID: ${adminRoleId}) — updating.`);
    await client.query(
      `UPDATE roles SET description = 'Admin user will have all access to platform',
         is_active = true, updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE role_id = $2`,
      [adminUserId, adminRoleId]
    );
    console.log("   ✅ Admin role updated.");
  } else {
    const res = await client.query(
      `INSERT INTO roles (role_name, description, is_active, created_by, updated_by, created_at, updated_at)
       VALUES ('admin', 'Admin user will have all access to platform', true, $1, $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING role_id`,
      [adminUserId]
    );
    adminRoleId = res.rows[0].role_id;
    console.log(`   ✅ Admin role created (ID: ${adminRoleId}).`);
  }

  return adminRoleId;
}

/** Step: Assign all DB permissions to admin role. */
async function stepAssignPermissions(client, adminRoleId, adminUserId) {
  console.log("\n🔗  Assigning all permissions → admin role...");
  const allPerms = await client.query("SELECT permission_id FROM permissions WHERE is_active = true");

  for (const row of allPerms.rows) {
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id, is_active, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, true, $3, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (role_id, permission_id) DO UPDATE SET
         is_active = true, updated_by = $3, updated_at = CURRENT_TIMESTAMP`,
      [adminRoleId, row.permission_id, adminUserId]
    );
  }
  console.log(`   ✅ ${allPerms.rows.length} permissions assigned to admin role.`);
}

/** Step: Link admin role to admin user. */
async function stepLinkRoleToUser(client, adminUserId, adminRoleId) {
  console.log("\n🔄  Linking admin role → admin user...");
  await client.query(
    `UPDATE users SET role_id = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2`,
    [adminRoleId, adminUserId]
  );
  console.log(`   ✅ Admin user linked to role ID: ${adminRoleId}.`);
}

// ─── Main Runner ──────────────────────────────────────────────────────────────
async function run(selectedSteps) {
  const dbConfig = await getDbConnection();
  const { Client } = require("pg");
  const client = new Client(dbConfig);

  try {
    console.log("\n   Connecting to database...");
    await client.connect();
    console.log("   ✅ Connected.\n");

    await client.query("BEGIN");

    let adminUserId  = null;
    let adminRoleId  = null;

    // Resolve user/role IDs lazily — only hit the DB if a step needs them
    // but user/role steps weren't run in this session.
    const getAdminUserId = async () => {
      if (adminUserId) return adminUserId;
      adminUserId = await fetchAdminUserId(client);
      return adminUserId;
    };
    const getAdminRoleId = async () => {
      if (adminRoleId) return adminRoleId;
      adminRoleId = await fetchAdminRoleId(client);
      return adminRoleId;
    };

    for (const step of selectedSteps) {
      switch (step) {
        case "user":
          adminUserId = await stepCreateUser(client);
          break;

        case "permissions":
          adminUserId = await getAdminUserId();
          await stepSeedPermissions(client, adminUserId);
          break;

        case "role":
          adminUserId = await getAdminUserId();
          adminRoleId = await stepCreateRole(client, adminUserId);
          break;

        case "assign":
          adminUserId = await getAdminUserId();
          adminRoleId = await getAdminRoleId();
          await stepAssignPermissions(client, adminRoleId, adminUserId);
          break;

        case "link":
          adminUserId = await getAdminUserId();
          adminRoleId = await getAdminRoleId();
          await stepLinkRoleToUser(client, adminUserId, adminRoleId);
          break;
      }
    }

    await client.query("COMMIT");

    console.log("\n" + "═".repeat(54));
    console.log("  🎉  Seed completed successfully!");
    console.log("═".repeat(54));

    if (selectedSteps.includes("user")) {
      console.log("\n📝  Admin Credentials:");
      console.log(`   Username: ${ADMIN_USERNAME}`);
      console.log(`   Email:    ${ADMIN_EMAIL}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      console.log("\n⚠️  IMPORTANT: Change this password after first login!\n");
    }

  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("\n❌ Seed failed:", error.message);

    if (error.message.includes("Connection terminated")) {
      console.error("\n💡 Hint: RDS Security Group may not allow your IP, or the instance is stopped.");
    } else if (error.message.includes("timeout")) {
      console.error("\n💡 Hint: Check that port 5432 is open and RDS is publicly accessible.");
    } else if (error.message.includes("password")) {
      console.error("\n💡 Hint: Authentication failed — check Secrets Manager credentials.");
    }

    throw error;
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱  ArcForge DB Seeder");

  // Non-interactive mode via --mode= flag
  const cliMode = resolveMode();
  if (cliMode) {
    const match = MENU.find((m) => m.mode === cliMode);
    if (!match) {
      console.error(`\n❌ Unknown --mode value: "${cliMode}"`);
      console.error(`   Valid values: ${MENU.map((m) => m.mode).join(", ")}`);
      process.exit(1);
    }
    console.log(`   Mode: ${match.label} (${match.description})\n`);
    await run(match.steps);
    return;
  }

  // Interactive mode
  showMenu();
  const choice = await promptChoice();

  if (choice === "0") {
    console.log("\n   Exiting. Nothing was seeded.\n");
    process.exit(0);
  }

  const match = MENU.find((m) => m.key === choice);
  if (!match) {
    console.error(`\n❌ Invalid choice: "${choice}". Please enter a number from the menu.`);
    process.exit(1);
  }

  console.log(`\n   Selected: ${match.label}`);
  console.log(`   Steps   : ${match.steps.join(" → ")}\n`);

  await run(match.steps);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

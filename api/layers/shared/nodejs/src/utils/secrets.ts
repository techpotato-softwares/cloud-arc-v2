import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getAppConfig, DatabaseConfig, getLocalDatabaseConfig, buildDatabaseUrl } from '../config';
import { logger } from './logger';

/**
 * Database credentials stored in AWS Secrets Manager.
 * Non-sensitive connection details (host, port, database, ssl) come from environment variables.
 */
interface DatabaseCredentials {
  username: string;
  password: string;
}

// Cache at module level for Lambda container reuse
let secretsClient: SecretsManagerClient | null = null;
let cachedDbConfig: DatabaseConfig | null = null;
let cachedDatabaseUrl: string | null = null;
let configCacheExpiry: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getSecretsClient = (): SecretsManagerClient => {
  if (!secretsClient) {
    const config = getAppConfig();
    secretsClient = new SecretsManagerClient({
      region: config.region,
      // Optimize for Lambda
      maxAttempts: 3,
    });
  }
  return secretsClient;
};

/**
 * Get database configuration with caching.
 * Connection settings (host, port, database, ssl) come from environment variables.
 * Credentials (username, password) are fetched from Secrets Manager.
 * Caches config for 5 minutes to reduce Secrets Manager calls.
 */
export const getDatabaseConfig = async (): Promise<DatabaseConfig> => {
  const now = Date.now();

  // Return cached config if still valid
  if (cachedDbConfig && configCacheExpiry > now) {
    logger.debug('Using cached database configuration');
    return cachedDbConfig;
  }

  const appConfig = getAppConfig();

  // Use local config for local development
  if (appConfig.isLocal) {
    logger.info('Using local database configuration');
    cachedDbConfig = getLocalDatabaseConfig();
    cachedDatabaseUrl = buildDatabaseUrl(cachedDbConfig);
    configCacheExpiry = now + CACHE_TTL_MS;
    return cachedDbConfig;
  }

  try {
    const startTime = Date.now();
    logger.info('Fetching database credentials from Secrets Manager', {
      secretId: appConfig.secretsManagerSecretId,
    });

    const client = getSecretsClient();
    const command = new GetSecretValueCommand({
      SecretId: appConfig.secretsManagerSecretId,
    });

    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    // Only credentials come from Secrets Manager
    const credentials: DatabaseCredentials = JSON.parse(response.SecretString);
    const duration = Date.now() - startTime;

    // Merge connection settings from env vars with credentials from Secrets Manager
    cachedDbConfig = {
      host: appConfig.database.host,
      port: appConfig.database.port,
      database: appConfig.database.database,
      ssl: appConfig.database.ssl,
      username: credentials.username,
      password: credentials.password,
    };

    cachedDatabaseUrl = buildDatabaseUrl(cachedDbConfig);
    configCacheExpiry = now + CACHE_TTL_MS;
    logger.info(`Retrieved database credentials in ${duration}ms`);
    return cachedDbConfig;
  } catch (error) {
    logger.error('Failed to retrieve database credentials from Secrets Manager', error);
    throw error;
  }
};

/**
 * Get DATABASE_URL for Prisma with caching.
 * Fetches credentials from Secrets Manager if needed.
 */
export const getDatabaseUrl = async (): Promise<string> => {
  // Ensure config is loaded (this will populate cachedDatabaseUrl)
  await getDatabaseConfig();

  if (!cachedDatabaseUrl) {
    throw new Error('Database URL not available after config load');
  }

  return cachedDatabaseUrl;
};

/**
 * Clear secrets cache - useful for testing or forced refresh
 */
export const clearSecretsCache = (): void => {
  cachedDbConfig = null;
  cachedDatabaseUrl = null;
  configCacheExpiry = 0;
};

/**
 * Export DatabaseConfig type for use in other modules
 */
export type { DatabaseConfig };

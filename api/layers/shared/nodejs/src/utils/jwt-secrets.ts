import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getAppConfig } from '../config';
import { logger } from './logger';

/**
 * JWT secrets stored in AWS Secrets Manager.
 */
export interface JwtSecrets {
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
}

// Cache at module level for Lambda container reuse
let secretsClient: SecretsManagerClient | null = null;
let cachedJwtSecrets: JwtSecrets | null = null;
let jwtCacheExpiry: number = 0;
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
 * Get local JWT secrets from environment variables.
 * Used for local development with SAM CLI.
 */
const getLocalJwtSecrets = (): JwtSecrets => {
  return {
    JWT_SECRET: process.env.JWT_SECRET || 'local-dev-jwt-secret-change-in-production',
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET || 'local-dev-refresh-secret-change-in-production',
  };
};

/**
 * Get JWT secrets with caching.
 * For local development, reads from environment variables.
 * For deployed environments, fetches from AWS Secrets Manager.
 * Caches secrets for 5 minutes to reduce Secrets Manager calls.
 */
export const getJwtSecrets = async (): Promise<JwtSecrets> => {
  const now = Date.now();

  // Return cached secrets if still valid
  if (cachedJwtSecrets && jwtCacheExpiry > now) {
    logger.debug('Using cached JWT secrets');
    return cachedJwtSecrets;
  }

  const appConfig = getAppConfig();

  // Use local secrets for local development
  if (appConfig.isLocal) {
    logger.info('Using local JWT secrets from environment variables');
    cachedJwtSecrets = getLocalJwtSecrets();
    jwtCacheExpiry = now + CACHE_TTL_MS;
    return cachedJwtSecrets;
  }

  const jwtSecretId = process.env.JWT_SECRET_ID;

  // If no secret ID configured, use environment variables (with warning)
  if (!jwtSecretId) {
    const environment = process.env.ENVIRONMENT || 'dev';
    if (environment === 'prod') {
      throw new Error('JWT_SECRET_ID must be set in production environment');
    }
    logger.warn(
      'JWT_SECRET_ID not set, using environment variables (NOT RECOMMENDED for deployed environments)'
    );
    cachedJwtSecrets = getLocalJwtSecrets();
    jwtCacheExpiry = now + CACHE_TTL_MS;
    return cachedJwtSecrets;
  }

  try {
    const startTime = Date.now();
    logger.info('Fetching JWT secrets from Secrets Manager', {
      secretId: jwtSecretId,
    });

    const client = getSecretsClient();
    const command = new GetSecretValueCommand({
      SecretId: jwtSecretId,
    });

    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('JWT secret value is empty');
    }

    const secrets: JwtSecrets = JSON.parse(response.SecretString);
    const duration = Date.now() - startTime;

    // Validate required fields
    if (!secrets.JWT_SECRET || !secrets.JWT_REFRESH_SECRET) {
      throw new Error('JWT secrets must contain JWT_SECRET and JWT_REFRESH_SECRET');
    }

    cachedJwtSecrets = secrets;
    jwtCacheExpiry = now + CACHE_TTL_MS;
    logger.info(`Retrieved JWT secrets in ${duration}ms`);
    return cachedJwtSecrets;
  } catch (error) {
    logger.error('Failed to retrieve JWT secrets from Secrets Manager', error);
    throw error;
  }
};

/**
 * Initialize JWT secrets cache.
 * Call this during Lambda cold start to pre-warm the cache.
 * Returns true if secrets were successfully loaded.
 */
export const initializeJwtSecrets = async (): Promise<boolean> => {
  try {
    await getJwtSecrets();
    return true;
  } catch (error) {
    logger.error('Failed to initialize JWT secrets', error);
    return false;
  }
};

/**
 * Clear JWT secrets cache - useful for testing or forced refresh
 */
export const clearJwtSecretsCache = (): void => {
  cachedJwtSecrets = null;
  jwtCacheExpiry = 0;
};

/**
 * Check if JWT secrets are cached and valid
 */
export const isJwtSecretsCached = (): boolean => {
  return cachedJwtSecrets !== null && jwtCacheExpiry > Date.now();
};

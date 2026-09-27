export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

/**
 * Database connection settings (non-sensitive).
 * These come from Lambda environment variables.
 */
export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

export interface AppConfig {
  environment: string;
  isLocal: boolean;
  secretsManagerSecretId: string;
  region: string;
  appName: string;
  /** Database connection settings from env vars (non-sensitive) */
  database: DatabaseConnectionConfig;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `${name} must be set. Copy .env.example and provide secrets via environment or Secrets Manager.`
    );
  }
  return value;
}

export const getAppConfig = (): AppConfig => {
  const environment = process.env.ENVIRONMENT || 'dev';
  const isLocal = process.env.AWS_SAM_LOCAL === 'true' || process.env.IS_LOCAL === 'true';
  const appName = process.env.APP_NAME || 'forgearc';

  return {
    environment,
    isLocal,
    appName,
    secretsManagerSecretId: process.env.DB_SECRET_ID || `/${appName}/${environment}/db`,
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    database: {
      host: isLocal
        ? process.env.DB_HOST || 'localhost'
        : requireEnv('DB_HOST'),
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: isLocal ? process.env.DB_NAME || 'forgearc' : requireEnv('DB_NAME'),
      ssl: process.env.DB_SSL === 'true',
    },
  };
};

export const getLocalDatabaseConfig = (): DatabaseConfig => {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'forgearc',
    username: requireEnv('DB_USERNAME', process.env.IS_LOCAL === 'true' ? 'postgres' : undefined),
    password: requireEnv('DB_PASSWORD', process.env.IS_LOCAL === 'true' ? 'secret' : undefined),
    ssl: process.env.DB_SSL === 'true',
  };
};

/**
 * Build DATABASE_URL from config for Prisma
 */
export const buildDatabaseUrl = (config: DatabaseConfig): string => {
  const encodedPassword = encodeURIComponent(config.password);
  const sslParam = config.ssl ? '?sslmode=require' : '';
  return `postgresql://${config.username}:${encodedPassword}@${config.host}:${config.port}/${config.database}${sslParam}`;
};

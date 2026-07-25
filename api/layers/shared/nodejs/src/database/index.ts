import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from '../utils/secrets';
import { logger } from '../utils/logger';

// PrismaClient instance cached at module level for Lambda container reuse
let prismaInstance: PrismaClient | null = null;
let isConnecting = false;
let connectionPromise: Promise<PrismaClient> | null = null;

/**
 * Get PrismaClient instance with connection pooling optimized for Lambda.
 * Uses singleton pattern to reuse connection across warm Lambda invocations.
 */
export const getPrismaClient = async (): Promise<PrismaClient> => {
  // Return existing instance if available
  if (prismaInstance) {
    return prismaInstance;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = createConnection();

  try {
    prismaInstance = await connectionPromise;
    return prismaInstance;
  } finally {
    isConnecting = false;
    connectionPromise = null;
  }
};

const createConnection = async (): Promise<PrismaClient> => {
  const startTime = Date.now();
  logger.info('Creating Prisma database connection...');

  // Get DATABASE_URL from secrets/config
  const databaseUrl = await getDatabaseUrl();

  // Create PrismaClient with Lambda-optimized settings
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log:
      process.env.LOG_LEVEL === 'DEBUG'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

  // Set up logging if in debug mode
  if (process.env.LOG_LEVEL === 'DEBUG') {
    prisma.$on('query' as never, (e: { query: string; duration: number }) => {
      logger.debug(`Query: ${e.query} (${e.duration}ms)`);
    });
  }

  prisma.$on('error' as never, (e: { message: string }) => {
    logger.error('Prisma error:', e.message);
  });

  try {
    // Test connection
    await prisma.$connect();
    const duration = Date.now() - startTime;
    logger.info(`Prisma database connection established in ${duration}ms`);
    return prisma;
  } catch (error) {
    logger.error('Failed to connect to database', error);
    throw error;
  }
};

/**
 * Close database connection.
 * Call this in Lambda cleanup if needed.
 */
export const closeConnection = async (): Promise<void> => {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.warn('Error closing database connection', error);
    } finally {
      prismaInstance = null;
    }
  }
};

/**
 * Check if connection is healthy by running a simple query
 */
export const isConnectionHealthy = async (): Promise<boolean> => {
  if (!prismaInstance) return false;
  try {
    await prismaInstance.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

// Re-export everything from Prisma - all model types are automatically available
// No need to manually add new types when adding tables to schema
export * from '@prisma/client';

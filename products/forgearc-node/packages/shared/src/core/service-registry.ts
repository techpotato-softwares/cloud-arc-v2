import 'reflect-metadata';
import { Container, interfaces } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database';
import { logger } from '../utils/logger';

/**
 * Service binding configuration for DI container
 */
export interface ServiceBinding {
  /** Inversify symbol for the service */
  symbol: symbol;
  /** Implementation class */
  implementation: interfaces.Newable<unknown>;
  /** Scope: singleton (default) or transient */
  scope?: 'singleton' | 'transient';
}

/**
 * Lambda configuration for auto-wiring DI and handlers
 */
export interface LambdaConfig {
  /** Lambda name (used for routing and manifest) */
  name: string;
  /**
   * Controller classes (must have @Controller decorator with matching lambdaName)
   * Supports multiple controllers per lambda for grouping related functionality
   * e.g., Admin lambda can have UserController, RoleController, PermissionController
   */
  controllers: interfaces.Newable<unknown>[];
  /** Service and repository bindings */
  bindings: ServiceBinding[];
  /** Symbol for PrismaClient in DI container (defaults to 'PrismaClient') */
  prismaSymbol?: symbol;
}

/**
 * Lambda Registry - manages lambda configurations for auto-wiring
 */
class LambdaRegistry {
  private configs: Map<string, LambdaConfig> = new Map();
  private containers: Map<string, Container> = new Map();
  private prismaInstances: Map<string, PrismaClient> = new Map();

  /**
   * Register a lambda configuration
   */
  register(config: LambdaConfig): void {
    if (this.configs.has(config.name)) {
      logger.warn(`Lambda '${config.name}' already registered, overwriting...`);
    }
    this.configs.set(config.name, config);
    logger.debug(
      `Lambda '${config.name}' registered with ${config.controllers.length} controller(s) and ${config.bindings.length} bindings`
    );
  }

  /**
   * Get lambda configuration by name
   */
  getConfig(name: string): LambdaConfig | undefined {
    return this.configs.get(name);
  }

  /**
   * Get all registered lambda names
   */
  getLambdaNames(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Create or get cached DI container for a lambda
   * Note: Prisma handles reconnection automatically, no need for health checks
   */
  async getContainer(lambdaName: string): Promise<Container> {
    // Return cached container (Prisma handles reconnection automatically)
    const cached = this.containers.get(lambdaName);
    if (cached) {
      return cached;
    }

    const config = this.configs.get(lambdaName);
    if (!config) {
      throw new Error(
        `Lambda '${lambdaName}' not registered. ` +
          `Available lambdas: ${this.getLambdaNames().join(', ') || 'none'}`
      );
    }

    return this.createContainer(config);
  }

  /**
   * Create a new DI container for a lambda config
   */
  private async createContainer(config: LambdaConfig): Promise<Container> {
    const startTime = Date.now();
    logger.info(`Creating DI container for '${config.name}'...`);

    const container = new Container({ defaultScope: 'Singleton' });

    // Initialize database connection
    const prisma = await getPrismaClient();

    // Bind PrismaClient
    const prismaSymbol = config.prismaSymbol || Symbol.for('PrismaClient');
    container.bind<PrismaClient>(prismaSymbol).toConstantValue(prisma);

    // Bind services and repositories
    for (const binding of config.bindings) {
      if (binding.scope === 'transient') {
        container.bind(binding.symbol).to(binding.implementation).inTransientScope();
      } else {
        container.bind(binding.symbol).to(binding.implementation).inSingletonScope();
      }
    }

    // Bind all controllers
    for (const controller of config.controllers) {
      container.bind(controller).toSelf().inSingletonScope();
    }

    // Cache container and prisma reference
    this.containers.set(config.name, container);
    this.prismaInstances.set(config.name, prisma);

    const duration = Date.now() - startTime;
    logger.info(`DI container for '${config.name}' created in ${duration}ms`);

    return container;
  }

  /**
   * Reset container cache (useful for testing)
   */
  resetContainer(lambdaName: string): void {
    this.containers.delete(lambdaName);
    this.prismaInstances.delete(lambdaName);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.configs.clear();
    this.containers.clear();
    this.prismaInstances.clear();
  }
}

// Export singleton instance
export const lambdaRegistry = new LambdaRegistry();

/**
 * Helper function to define a lambda configuration
 * Use this in lambda config files for type safety
 *
 * @example
 * ```typescript
 * // Single controller lambda (e.g., src/lambdas/po.lambda.ts)
 * import { defineLambda, createLambdaHandler } from '@forgearc/shared';
 * import { TYPES } from '../types/types';
 * import { POController } from '../controllers/POController';
 * import { POService } from '../services/POService';
 * import { PORepository } from '../repositories/PORepository';
 *
 * defineLambda({
 *   name: 'po',
 *   controllers: [POController],
 *   bindings: [
 *     { symbol: TYPES.POService, implementation: POService },
 *     { symbol: TYPES.PORepository, implementation: PORepository },
 *   ],
 *   prismaSymbol: TYPES.PrismaClient,
 * });
 *
 * export const handler = createLambdaHandler('po');
 * ```
 *
 * @example
 * ```typescript
 * // Multi-controller lambda (e.g., src/lambdas/admin.lambda.ts)
 * import { defineLambda, createLambdaHandler } from '@forgearc/shared';
 * import { TYPES } from '../types/types';
 * import { UserController } from '../controllers/admin/UserController';
 * import { RoleController } from '../controllers/admin/RoleController';
 * import { PermissionController } from '../controllers/admin/PermissionController';
 * import { UserService } from '../services/admin/UserService';
 * import { RoleService } from '../services/admin/RoleService';
 * import { PermissionService } from '../services/admin/PermissionService';
 *
 * defineLambda({
 *   name: 'admin',
 *   controllers: [UserController, RoleController, PermissionController],
 *   bindings: [
 *     { symbol: TYPES.UserService, implementation: UserService },
 *     { symbol: TYPES.RoleService, implementation: RoleService },
 *     { symbol: TYPES.PermissionService, implementation: PermissionService },
 *   ],
 *   prismaSymbol: TYPES.PrismaClient,
 * });
 *
 * export const handler = createLambdaHandler('admin');
 * ```
 */
export function defineLambda(config: LambdaConfig): LambdaConfig {
  // Register immediately when imported
  lambdaRegistry.register(config);
  return config;
}

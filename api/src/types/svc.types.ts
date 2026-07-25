/**
 * Inversify DI symbols — single registry for all modules.
 * Add a section per module; bind implementations in src/lambdas/*.lambda.ts via defineLambda().
 */

/** Platform: auth, users, roles, permissions (ArcForge Phase 1 keep) */
export const PlatformTypes = {
  AuthController: Symbol.for('Platform.AuthController'),
  UserController: Symbol.for('Platform.UserController'),
  RoleController: Symbol.for('Platform.RoleController'),
  PermissionController: Symbol.for('Platform.PermissionController'),

  AuthService: Symbol.for('Platform.AuthService'),
  UserService: Symbol.for('Platform.UserService'),
  RoleService: Symbol.for('Platform.RoleService'),
  PermissionService: Symbol.for('Platform.PermissionService'),

  AuthRepository: Symbol.for('Platform.AuthRepository'),
  UserRepository: Symbol.for('Platform.UserRepository'),
  RoleRepository: Symbol.for('Platform.RoleRepository'),
  PermissionRepository: Symbol.for('Platform.PermissionRepository'),
} as const;

/** Shared infrastructure */
export const InfraTypes = {
  PrismaClient: Symbol.for('PrismaClient'),
} as const;

/**
 * @deprecated Use PlatformTypes / module-specific types. Re-exported for existing ArcForge lambdas until Phase 1 cleanup.
 */
export { TYPES } from './types';

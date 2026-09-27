/**
 * Inversify DI symbols — platform module (auth, users, roles, permissions).
 */
export const PlatformTypes = {
  AuthController: Symbol.for("Platform.AuthController"),
  UserController: Symbol.for("Platform.UserController"),
  RoleController: Symbol.for("Platform.RoleController"),
  PermissionController: Symbol.for("Platform.PermissionController"),

  AuthService: Symbol.for("Platform.AuthService"),
  UserService: Symbol.for("Platform.UserService"),
  RoleService: Symbol.for("Platform.RoleService"),
  PermissionService: Symbol.for("Platform.PermissionService"),

  AuthRepository: Symbol.for("Platform.AuthRepository"),
  UserRepository: Symbol.for("Platform.UserRepository"),
  RoleRepository: Symbol.for("Platform.RoleRepository"),
  PermissionRepository: Symbol.for("Platform.PermissionRepository"),

  PrismaClient: Symbol.for("PrismaClient"),
} as const;

/** @deprecated Use PlatformTypes — alias for migration */
export const TYPES = PlatformTypes;

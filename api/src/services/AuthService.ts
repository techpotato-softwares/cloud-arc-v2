import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IAuthRepository } from '../repositories/AuthRepository';
import { LoginRequest, LoginResponse, RefreshRequest, RefreshResponse } from '../schemas';
import { ValidationError, AppError } from '@arcforge/shared';
import { generateTokens, verifyRefreshToken, JWTPayload } from '@arcforge/shared';

export interface IAuthService {
  login(data: LoginRequest): Promise<LoginResponse>;
  refresh(data: RefreshRequest): Promise<RefreshResponse>;
}

@injectable()
export class AuthService implements IAuthService {
  constructor(@inject(TYPES.AuthRepository) private authRepository: IAuthRepository) {}

  async login(data: LoginRequest): Promise<LoginResponse> {
    if (!data.username || !data.password) {
      throw new ValidationError('Username and password are required');
    }

    const user = await this.authRepository.findByUsernameOrEmail(data.username);

    if (!user) {
      throw new AppError('Invalid username or password', 401, 'UNAUTHORIZED');
    }

    const isPasswordValid = await this.authRepository.validatePassword(user, data.password);

    if (!isPasswordValid) {
      throw new AppError('Invalid username or password', 401, 'UNAUTHORIZED');
    }

    // Extract role and permissions
    const userWithRole = user as unknown as {
      role?: {
        roleId: number;
        roleName: string;
        rolePermissions?: Array<{
          permission: {
            permissionCode: string;
            isActive: boolean;
          };
        }>;
      } | null;
    };

    const role = userWithRole.role;

    // Extract permission codes from role permissions (only active permissions)
    const permissionCodes: string[] =
      role?.rolePermissions
        ?.filter((rp) => rp.permission.isActive)
        .map((rp) => rp.permission.permissionCode)
        .filter((code): code is string => Boolean(code)) || [];

    // Generate JWT tokens after successful password validation
    const tokenPayload: JWTPayload = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: role?.roleName,
    };

    // Generate both access and refresh tokens
    const tokens = await generateTokens(tokenPayload);

    // Verify tokens were generated successfully
    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new AppError('Failed to generate authentication tokens', 500, 'TOKEN_GENERATION_ERROR');
    }

    // Return login response with tokens
    return {
      success: true,
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        roleName: role?.roleName || null,
        roleId: role?.roleId || null,
        permissions: permissionCodes,
      },
    };
  }

  async refresh(data: RefreshRequest): Promise<RefreshResponse> {
    if (!data.refreshToken?.trim()) {
      throw new ValidationError('Refresh token is required');
    }

    const decodedPayload = await verifyRefreshToken(data.refreshToken);

    // Strip JWT standard claims (exp, iat, iss, aud, nbf, jti) before generating new tokens
    // Only keep custom claims (userId, username, email, role)
    const cleanPayload: JWTPayload = {
      userId: decodedPayload.userId,
      username: decodedPayload.username,
      email: decodedPayload.email,
      role: decodedPayload.role,
    };

    const tokens = await generateTokens(cleanPayload);

    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new AppError('Failed to generate new tokens', 500, 'TOKEN_GENERATION_ERROR');
    }

    return {
      success: true,
      message: 'Token refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn,
    };
  }
}

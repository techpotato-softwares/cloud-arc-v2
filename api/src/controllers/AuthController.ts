import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Post,
  Body,
  createSuccessResponse,
  ValidationError,
  createErrorResponse,
} from '@arcforge/shared';
import { TYPES } from '../types/types';
import { IAuthService } from '../services/AuthService';
import { LoginRequest, LoginResponse, RefreshRequest, RefreshResponse } from '../schemas';

export interface IAuthController {
  login(data: LoginRequest): Promise<APIGatewayProxyResult>;
  refresh(data: RefreshRequest): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api', lambdaName: 'auth' })
@injectable()
export class AuthController implements IAuthController {
  constructor(@inject(TYPES.AuthService) private authService: IAuthService) {}

  @Post('/login')
  async login(@Body() data: LoginRequest): Promise<APIGatewayProxyResult> {
    if (!data.username || !data.password) {
      throw new ValidationError('Username and password are required');
    }

    try {
      const result: LoginResponse = await this.authService.login(data);
      if (!result.accessToken || !result.refreshToken) {
        throw new Error('Tokens were not generated during login');
      }
      return createSuccessResponse(result, 200);
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }

  @Post('/auth/refresh')
  async refresh(@Body() data: RefreshRequest): Promise<APIGatewayProxyResult> {
    if (!data?.refreshToken?.trim()) {
      throw new ValidationError('Refresh token is required');
    }

    try {
      const result: RefreshResponse = await this.authService.refresh(data);
      if (!result.accessToken || !result.refreshToken) {
        throw new Error('Tokens were not generated during refresh');
      }
      return createSuccessResponse(result, 200);
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }
}

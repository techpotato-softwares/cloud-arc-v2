import "reflect-metadata";
import { injectable, inject } from "inversify";
import { APIGatewayProxyResult } from "aws-lambda";
import {
  Controller,
  Post,
  Body,
  ApiBody,
  ApiPublic,
  OpenApiResponse,
  ApiTags,
  createSuccessResponse,
  createErrorResponse,
} from "@forgearc/shared";
import { PlatformTypes } from "../types/svc.types";
import { IAuthService } from "../services/AuthService";
import {
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  LoginRequestSchema,
  RefreshRequestSchema,
  LoginResponseSchema,
  RefreshResponseSchema,
} from "../schemas";

export interface IAuthController {
  login(data: LoginRequest): Promise<APIGatewayProxyResult>;
  refresh(data: RefreshRequest): Promise<APIGatewayProxyResult>;
}

@Controller({ path: "/api", lambdaName: "auth" })
@injectable()
export class AuthController implements IAuthController {
  constructor(
    @inject(PlatformTypes.AuthService) private authService: IAuthService,
  ) {}

  @Post("/login")
  @ApiPublic()
  @ApiTags("Auth")
  @ApiBody(LoginRequestSchema)
  @OpenApiResponse(200, LoginResponseSchema)
  async login(@Body() data: LoginRequest): Promise<APIGatewayProxyResult> {
    try {
      const result: LoginResponse = await this.authService.login(data);
      if (!result.accessToken || !result.refreshToken) {
        throw new Error("Tokens were not generated during login");
      }
      return createSuccessResponse(result, 200);
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }

  @Post("/auth/refresh")
  @ApiPublic()
  @ApiTags("Auth")
  @ApiBody(RefreshRequestSchema)
  @OpenApiResponse(200, RefreshResponseSchema)
  async refresh(@Body() data: RefreshRequest): Promise<APIGatewayProxyResult> {
    try {
      const result: RefreshResponse = await this.authService.refresh(data);
      if (!result.accessToken || !result.refreshToken) {
        throw new Error("Tokens were not generated during refresh");
      }
      return createSuccessResponse(result, 200);
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }
}

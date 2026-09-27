import "reflect-metadata";
import { injectable, inject } from "inversify";
import { APIGatewayProxyResult } from "aws-lambda";
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  CurrentUser,
  ApiBody,
  ApiTags,
  createSuccessResponse,
  NotFoundError,
  ValidationError,
  JWTPayload,
} from "@forgearc/shared";
import { TYPES } from "../types/svc.types";
import { IPermissionService } from "../services/PermissionService";
import {
  CreatePermissionRequest,
  UpdatePermissionRequest,
  CreatePermissionRequestSchema,
  UpdatePermissionRequestSchema,
} from "../schemas";

@Controller({ path: "/api/permission", lambdaName: "permission" })
@injectable()
export class PermissionController {
  constructor(
    @inject(TYPES.PermissionService)
    private permissionService: IPermissionService,
  ) {}

  @Post("/")
  @ApiTags("Permissions")
  @ApiBody(CreatePermissionRequestSchema)
  async create(
    @Body() data: CreatePermissionRequest,
    @CurrentUser() currentUser: JWTPayload,
  ) {
    const enrichedData = {
      ...data,
      createdById: currentUser.userId,
      updatedById: currentUser.userId,
    };
    const permission =
      await this.permissionService.createPermission(enrichedData);
    return createSuccessResponse(permission, 201);
  }

  @Get("/")
  async getAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("isActive") isActive?: string,
    @Query("searchKey") searchKey?: string,
    @Query("searchTerm") searchTerm?: string,
  ): Promise<APIGatewayProxyResult> {
    const result = await this.permissionService.getAllPermissions({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      isActive: isActive ? isActive === "true" : undefined,
      searchKey: searchKey || undefined,
      searchTerm: searchTerm || undefined,
    });
    const { data, pagination } = result;
    return createSuccessResponse({ data, pagination }, 200);
  }

  @Get("/{id}")
  async getById(@Param("id") id: string) {
    const permissionId = parseInt(id, 10);
    if (isNaN(permissionId)) throw new ValidationError("Invalid permission ID");
    const permission =
      await this.permissionService.getPermissionById(permissionId);
    if (!permission)
      throw new NotFoundError(`Permission with ID ${id} not found`);
    return createSuccessResponse(permission);
  }

  @Put("/{id}")
  @ApiTags("Permissions")
  @ApiBody(UpdatePermissionRequestSchema)
  async update(
    @Param("id") id: string,
    @Body() data: UpdatePermissionRequest,
    @CurrentUser() currentUser: JWTPayload,
  ) {
    const permissionId = parseInt(id, 10);
    if (isNaN(permissionId)) throw new ValidationError("Invalid permission ID");
    const enrichedData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const permission = await this.permissionService.updatePermission(
      permissionId,
      enrichedData,
    );
    if (!permission)
      throw new NotFoundError(`Permission with ID ${id} not found`);
    return createSuccessResponse(permission);
  }

  @Delete("/{id}")
  async delete(@Param("id") id: string) {
    const permissionId = parseInt(id, 10);
    if (isNaN(permissionId)) throw new ValidationError("Invalid permission ID");
    const deleted = await this.permissionService.deletePermission(permissionId);
    if (!deleted) throw new NotFoundError(`Permission with ID ${id} not found`);
    return createSuccessResponse({ permissionId: permissionId, deleted: true });
  }
}

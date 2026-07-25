import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  CurrentUser,
  createSuccessResponse,
  ValidationError,
  NotFoundError,
  JWTPayload,
} from '@arcforge/shared';
import { TYPES } from '../types/types';
import { IRoleService } from '../services/RoleService';
import { CreateRoleRequest, UpdateRoleRequest } from '../schemas';

@Controller({ path: '/api/role', lambdaName: 'role' })
@injectable()
export class RoleController {
  constructor(@inject(TYPES.RoleService) private service: IRoleService) {}

  @Post('/')
  async create(@Body() data: CreateRoleRequest, @CurrentUser() currentUser: JWTPayload) {
    if (!data.roleName) throw new ValidationError('roleName is required');
    const enrichedData = {
      ...data,
      createdById: currentUser.userId,
      updatedById: currentUser.userId,
    };
    const result = await this.service.createRole(enrichedData);
    return createSuccessResponse(result, 201);
  }

  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('isActive') isActive?: string,
    @Query('searchKey') searchKey?: string,
    @Query('searchTerm') searchTerm?: string
  ) {
    const result = await this.service.getAllRoles({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
      isActive: isActive ? isActive === 'true' : undefined,
      searchKey: searchKey || undefined,
      searchTerm: searchTerm || undefined,
    });
    const { data, pagination } = result;
    return createSuccessResponse({ data, pagination }, 200);
  }

  @Get('/{id}')
  async getById(@Param('id') id: string) {
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) throw new ValidationError('Invalid role ID');
    const role = await this.service.getRoleById(roleId);
    if (!role) throw new NotFoundError(`Role ${id} not found`);
    return createSuccessResponse(role, 200);
  }

  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateRoleRequest,
    @CurrentUser() currentUser: JWTPayload
  ) {
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) throw new ValidationError('Invalid role ID');
    const enrichedData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const role = await this.service.updateRole(roleId, enrichedData);
    if (!role) throw new NotFoundError(`Role ${id} not found`);
    return createSuccessResponse(role);
  }

  @Delete('/{id}')
  async delete(@Param('id') id: string) {
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) throw new ValidationError('Invalid role ID');
    const deleted = await this.service.deleteRole(roleId);
    if (!deleted) throw new NotFoundError(`Role ${id} not found`);

    return createSuccessResponse({ id: roleId, deleted: true });
  }
}

import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  CurrentUser,
  ApiBody,
  RequirePermission,
  RequireModule,
  OpenApiResponse,
  ApiTags,
  createSuccessResponse,
  NotFoundError,
  JWTPayload,
} from '@arcforge/shared';
import { TYPES } from '../types/svc.types';
import { IDemoItemService } from '../services/DemoItemService';
import {
  CreateDemoItemRequest,
  UpdateDemoItemRequest,
  CreateDemoItemSchema,
  UpdateDemoItemSchema,
  DemoItemResponseSchema,
} from '../schemas/demo';

@Controller({ path: '/api/demo/items', lambdaName: 'demo' })
@injectable()
export class DemoItemController {
  constructor(@inject(TYPES.DemoItemService) private service: IDemoItemService) {}

  @Post('/')
  @RequireModule('demo')
  @RequirePermission('demo:write', 'admin')
  @ApiTags('Demo')
  @ApiBody(CreateDemoItemSchema)
  @OpenApiResponse(201, DemoItemResponseSchema)
  async create(
    @Body() data: CreateDemoItemRequest,
    @CurrentUser() user?: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const item = await this.service.create(data, user?.userId, user?.tenantId);
    return createSuccessResponse(item, 201);
  }

  @Get('/')
  @RequireModule('demo')
  @RequirePermission('demo:read', 'admin')
  @ApiTags('Demo')
  async list(@CurrentUser() user?: JWTPayload): Promise<APIGatewayProxyResult> {
    const items = await this.service.list(user?.tenantId);
    return createSuccessResponse(items);
  }

  @Get('/{id}')
  @RequireModule('demo')
  @RequirePermission('demo:read', 'admin')
  @ApiTags('Demo')
  async get(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const item = await this.service.get(parseInt(id, 10));
    if (!item) throw new NotFoundError('Demo item not found');
    return createSuccessResponse(item);
  }

  @Put('/{id}')
  @RequireModule('demo')
  @RequirePermission('demo:write', 'admin')
  @ApiTags('Demo')
  @ApiBody(UpdateDemoItemSchema)
  async update(
    @Param('id') id: string,
    @Body() data: UpdateDemoItemRequest,
    @CurrentUser() user?: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const item = await this.service.update(parseInt(id, 10), data, user?.userId);
    return createSuccessResponse(item);
  }

  @Delete('/{id}')
  @RequireModule('demo')
  @RequirePermission('demo:write', 'admin')
  @ApiTags('Demo')
  async remove(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    await this.service.remove(parseInt(id, 10));
    return createSuccessResponse({ deleted: true });
  }
}

import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Post,
  Body,
  RequirePermission,
  RequireModule,
  ApiTags,
  createSuccessResponse,
} from '@arcforge/shared';
import { TYPES } from '../types/svc.types';
import { IAiService } from '../services/AiService';

@Controller({ path: '/api/ai', lambdaName: 'ai' })
@injectable()
export class AiController {
  constructor(@inject(TYPES.AiService) private service: IAiService) {}

  @Post('/chat')
  @RequireModule('ai')
  @RequirePermission('ai:chat', 'admin')
  @ApiTags('AI')
  async chat(@Body() body: { message?: string }): Promise<APIGatewayProxyResult> {
    return createSuccessResponse(this.service.chat(body?.message || ''));
  }
}

import { injectable } from 'inversify';
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

@Controller({ path: '/api/ai', lambdaName: 'ai' })
@injectable()
export class AiController {
  @Post('/chat')
  @RequireModule('ai')
  @RequirePermission('ai:chat', 'admin')
  @ApiTags('AI')
  async chat(@Body() body: { message?: string }): Promise<APIGatewayProxyResult> {
    return createSuccessResponse({
      provider: 'stub',
      reply: `Echo: ${body?.message || ''}`,
      hint: 'Use ArcForge for Python for Bedrock/OpenAI providers and LangChain hooks.',
    });
  }
}

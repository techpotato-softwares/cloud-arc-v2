import { injectable } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Controller, Get, ApiPublic, ApiTags, createSuccessResponse } from '@arcforge/shared';

@Controller({ path: '/health', lambdaName: 'auth' })
@injectable()
export class HealthController {
  @Get('/')
  @ApiPublic()
  @ApiTags('Health')
  async health(): Promise<APIGatewayProxyResult> {
    return createSuccessResponse({ status: 'ok', product: 'arcforge-node' });
  }
}

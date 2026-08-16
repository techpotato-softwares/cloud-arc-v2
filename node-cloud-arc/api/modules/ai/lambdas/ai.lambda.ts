import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { AiController } from '../src/controllers/AiController';
import { AiService } from '../src/services/AiService';
import { TYPES } from '../src/types/svc.types';

defineLambda({
  name: 'ai',
  controllers: [AiController],
  bindings: [{ symbol: TYPES.AiService, implementation: AiService }],
});

export const handler = createLambdaHandler('ai');

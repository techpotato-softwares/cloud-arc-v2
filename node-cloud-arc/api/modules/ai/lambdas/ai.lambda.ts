import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { AiController } from '../src/controllers/AiController';

defineLambda({
  name: 'ai',
  controllers: [AiController],
  bindings: [],
});

export const handler = createLambdaHandler('ai');

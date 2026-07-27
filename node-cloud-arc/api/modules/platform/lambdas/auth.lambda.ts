import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../src/types/svc.types';
import { AuthController } from '../src/controllers/AuthController';
import { AuthService } from '../src/services/AuthService';
import { AuthRepository } from '../src/repositories/AuthRepository';

defineLambda({
  name: 'auth',
  controllers: [AuthController],
  bindings: [
    { symbol: TYPES.AuthService, implementation: AuthService },
    { symbol: TYPES.AuthRepository, implementation: AuthRepository },
  ],
});
export const handler = createLambdaHandler('auth');

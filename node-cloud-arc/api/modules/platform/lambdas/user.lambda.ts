import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../src/types/svc.types';

// Import controller (triggers decorator registration)
import { UserController } from '../src/controllers/UserController';

// Import services and repositories
import { UserService } from '../src/services/UserService';
import { UserRepository } from '../src/repositories/UserRepository';

// Define and register the lambda configuration
defineLambda({
  name: 'user',
  controllers: [UserController],
  bindings: [
    { symbol: TYPES.UserService, implementation: UserService },
    { symbol: TYPES.UserRepository, implementation: UserRepository },
    // PrismaClient is automatically bound by the framework
  ],
  prismaSymbol: TYPES.PrismaClient,
});

// Export the Lambda handler
export const handler = createLambdaHandler('user');

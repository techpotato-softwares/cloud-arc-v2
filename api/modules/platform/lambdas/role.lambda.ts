import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../src/types/svc.types';

import { RoleController } from '../src/controllers/RoleController';
import { RoleService } from '../src/services/RoleService';
import { RoleRepository } from '../src/repositories/RoleRepository';

defineLambda({
  name: 'role',
  controllers: [RoleController],
  bindings: [
    { symbol: TYPES.RoleService, implementation: RoleService },
    { symbol: TYPES.RoleRepository, implementation: RoleRepository },
  ],
  prismaSymbol: TYPES.PrismaClient,
});

export const handler = createLambdaHandler('role');

import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../types/types';

// Import controller (triggers decorator registration)
import { FileController } from '../controllers/FileController';

// Import services and repositories
import { FileService } from '../services/FileService';
import { FileRepository } from '../repositories/FileRepository';

// Define and register the lambda configuration
defineLambda({
  name: 'file',
  controllers: [FileController],
  bindings: [
    { symbol: TYPES.FileService, implementation: FileService },
    { symbol: TYPES.FileRepository, implementation: FileRepository },
    // PrismaClient is automatically bound by the framework
  ],
  prismaSymbol: TYPES.PrismaClient,
});

// Export the Lambda handler
export const handler = createLambdaHandler('file');

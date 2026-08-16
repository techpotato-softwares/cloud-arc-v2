import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { FilesController } from '../src/controllers/FilesController';
import { FilesService } from '../src/services/FilesService';
import { TYPES } from '../src/types/svc.types';

defineLambda({
  name: 'files',
  controllers: [FilesController],
  bindings: [{ symbol: TYPES.FilesService, implementation: FilesService }],
});

export const handler = createLambdaHandler('files');

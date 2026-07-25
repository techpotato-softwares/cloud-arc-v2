/**
 * Dispatch Lambda Configuration
 *
 * This file defines the lambda configuration for the Dispatch API.
 * It registers the controller, services, and repositories with the DI container.
 *
 * Handles all Dispatch operations:
 * - POST /api/dispatch - Create dispatch details
 * - GET /api/dispatch - List all dispatches
 * - GET /api/dispatch/po/{poId} - Get dispatches by PO ID
 * - GET /api/dispatch/{id} - Get dispatch by ID
 * - PUT /api/dispatch/{id} - Update dispatch details
 * - PUT /api/dispatch/{id}/documents - Update dispatch documents
 * - PUT /api/dispatch/{id}/delivery - Update delivery confirmation
 * - DELETE /api/dispatch/{id} - Delete dispatch
 */

import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../types/types';

// Import controller (triggers decorator registration)
import { DispatchController } from '../controllers/DispatchController';

// Import services and repositories
import { DispatchService } from '../services/DispatchService';
import { DispatchRepository } from '../repositories/DispatchRepository';

// Define and register the lambda configuration
defineLambda({
  name: 'dispatch',
  controllers: [DispatchController],
  bindings: [
    { symbol: TYPES.DispatchService, implementation: DispatchService },
    { symbol: TYPES.DispatchRepository, implementation: DispatchRepository },
    // PrismaClient is automatically bound by the framework
  ],
  prismaSymbol: TYPES.PrismaClient,
});

// Export the Lambda handler
export const handler = createLambdaHandler('dispatch');

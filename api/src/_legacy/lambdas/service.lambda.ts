/**
 * Service Lambda Configuration
 *
 * This file defines the lambda configuration for the Service API.
 * It registers the controller, services, and repositories with the DI container.
 *
 * Handles all Service operations:
 * - POST /api/service - Create service (Pre-Commissioning)
 * - GET /api/service - List all services
 * - GET /api/service/dispatch/{dispatchId} - Get services by Dispatch ID
 * - GET /api/service/po/{poId} - Get services by PO ID
 * - GET /api/service/{id} - Get service by ID
 * - PUT /api/service/{id} - Update service (Pre-Commissioning)
 * - PUT /api/service/{id}/commissioning - Update commissioning
 * - PUT /api/service/{id}/warranty - Update warranty certificate
 * - DELETE /api/service/{id} - Delete service
 */

import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../types/types';

// Import controller (triggers decorator registration)
import { ServiceController } from '../controllers/ServiceController';

// Import services and repositories
import { ServiceService } from '../services/ServiceService';
import { ServiceRepository } from '../repositories/ServiceRepository';

// Define and register the lambda configuration
defineLambda({
  name: 'service',
  controllers: [ServiceController],
  bindings: [
    { symbol: TYPES.ServiceService, implementation: ServiceService },
    { symbol: TYPES.ServiceRepository, implementation: ServiceRepository },
    // PrismaClient is automatically bound by the framework
  ],
  prismaSymbol: TYPES.PrismaClient,
});

// Export the Lambda handler
export const handler = createLambdaHandler('service');

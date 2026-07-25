/**
 * CreatePO Lambda Configuration
 *
 * This file defines the lambda configuration for the Purchase Order API.
 * It registers the controller, services, and repositories with the DI container.
 *
 * Handles all PO operations:
 * - POST /api/po - Create new PO
 * - GET /api/po - List all POs
 * - GET /api/po/{id} - Get PO by ID
 * - PUT /api/po/{id} - Update PO
 * - DELETE /api/po/{id} - Delete PO
 */

import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../types/types';

// Import controllers (triggers decorator registration)
import { POController } from '../controllers/POController';
import { SummaryController } from '../controllers/SummaryController';

// Import services and repositories
import { POService } from '../services/POService';
import { POCsvImportService } from '../services/POCsvImportService';
import { SummaryService } from '../services/SummaryService';
import { PORepository } from '../repositories/PORepository';
import { AccountingEntryRepository } from '../repositories/AccountingEntryRepository';

// Define and register the lambda configuration
defineLambda({
  name: 'CreatePO',
  controllers: [POController, SummaryController],
  bindings: [
    { symbol: TYPES.POService, implementation: POService },
    { symbol: TYPES.POCsvImportService, implementation: POCsvImportService },
    { symbol: TYPES.SummaryService, implementation: SummaryService },
    { symbol: TYPES.PORepository, implementation: PORepository },
    { symbol: TYPES.AccountingEntryRepository, implementation: AccountingEntryRepository },
    // PrismaClient is automatically bound by the framework
  ],
  prismaSymbol: TYPES.PrismaClient,
});

// Export the Lambda handler
export const handler = createLambdaHandler('CreatePO');

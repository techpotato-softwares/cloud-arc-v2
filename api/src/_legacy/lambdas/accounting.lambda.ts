/**
 * Accounting Lambda Configuration
 *
 * Lambda for the Accounting Entry API.
 * Handles all accounting entry operations:
 * - POST /api/accounting              - Create accounting entry
 * - GET  /api/accounting              - List all entries
 * - GET  /api/accounting/po/{poId}    - Get entries by PO ID
 * - GET  /api/accounting/{id}         - Get entry by ID
 * - PUT  /api/accounting/{id}         - Update entry
 * - DELETE /api/accounting/{id}       - Delete entry
 */

import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../types/types';

import { AccountingEntryController } from '../controllers/AccountingEntryController';
import { AccountingEntryService } from '../services/AccountingEntryService';
import { AccountingEntryRepository } from '../repositories/AccountingEntryRepository';
import { POService } from '../services/POService';
import { PORepository } from '../repositories/PORepository';

defineLambda({
  name: 'accounting',
  controllers: [AccountingEntryController],
  bindings: [
    { symbol: TYPES.AccountingEntryService, implementation: AccountingEntryService },
    { symbol: TYPES.AccountingEntryRepository, implementation: AccountingEntryRepository },
    { symbol: TYPES.POService, implementation: POService },
    { symbol: TYPES.PORepository, implementation: PORepository },
  ],
  prismaSymbol: TYPES.PrismaClient,
});

export const handler = createLambdaHandler('accounting');

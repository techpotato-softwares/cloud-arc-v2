import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../types/types';

// --- Controllers ---
import { CategoryController } from '../controllers/CategoryController';
import { OEMController } from '../controllers/OEMController';
import { ProductController } from '../controllers/ProductController';
import { ClientController } from '../controllers/ClientController';

// --- Services ---
import { CategoryService } from '../services/CategoryService';
import { OEMService } from '../services/OEMService';
import { ProductService } from '../services/ProductService';
import { ClientService } from '../services/ClientService';

// --- Repositories ---
import { CategoryRepository } from '../repositories/CategoryRepository';
import { OEMRepository } from '../repositories/OEMRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { ClientRepository } from '../repositories/ClientRepository';

defineLambda({
  name: 'productManagement',

  controllers: [CategoryController, OEMController, ProductController, ClientController],

  bindings: [
    // Category
    { symbol: TYPES.CategoryService, implementation: CategoryService },
    { symbol: TYPES.CategoryRepository, implementation: CategoryRepository },

    // OEM
    { symbol: TYPES.OEMService, implementation: OEMService },
    { symbol: TYPES.OEMRepository, implementation: OEMRepository },

    // Product
    { symbol: TYPES.ProductService, implementation: ProductService },
    { symbol: TYPES.ProductRepository, implementation: ProductRepository },

    // Client
    { symbol: TYPES.ClientService, implementation: ClientService },
    { symbol: TYPES.ClientRepository, implementation: ClientRepository },
  ],

  prismaSymbol: TYPES.PrismaClient,
});

export const handler = createLambdaHandler('productManagement');

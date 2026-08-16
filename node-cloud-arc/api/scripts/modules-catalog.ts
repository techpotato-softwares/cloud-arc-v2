/**
 * ArcForge sellable modules — CDK / CI use `sku` for selective deploy;
 * runtime uses tenant.modulesEnabled.
 */

export type ModuleCompute = 'lambda' | 'ecs' | 'lambda-sqs' | 'lambda-container';

export interface ModuleCatalogEntry {
  sku: string;
  packageName: string;
  path: string;
  compute: ModuleCompute;
  requiredModules: string[];
  required?: boolean;
  mfe?: string;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    sku: 'platform',
    packageName: '@arcforge/module-platform',
    path: 'modules/platform',
    compute: 'lambda',
    requiredModules: [],
    required: true,
  },
  {
    sku: 'demo',
    packageName: '@arcforge/module-demo',
    path: 'modules/demo',
    compute: 'lambda',
    requiredModules: ['platform'],
  },
  {
    sku: 'ai',
    packageName: '@arcforge/module-ai',
    path: 'modules/ai',
    compute: 'lambda',
    requiredModules: ['platform'],
  },
  {
    sku: 'files',
    packageName: '@arcforge/module-files',
    path: 'modules/files',
    compute: 'lambda',
    requiredModules: ['platform'],
  },
];

export function getModuleBySku(sku: string): ModuleCatalogEntry | undefined {
  return MODULE_CATALOG.find((m) => m.sku === sku);
}

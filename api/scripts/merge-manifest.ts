#!/usr/bin/env ts-node
/**
 * Merges route metadata from all sellable modules + legacy ArcForge controllers
 * into api/app-manifest.json for CDK.
 *
 * Usage: npm run build:manifest
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { routeRegistry, AppManifest } from '@arcforge/shared';
import { MODULE_CATALOG } from './modules-catalog';

const apiRoot = path.join(__dirname, '..');

/** Extended manifest for marketplace / selective deploy */
export interface ArcForgeManifest extends AppManifest {
  modules: Record<
    string,
    {
      sku: string;
      packageName: string;
      compute: string;
      requiredModules: string[];
      required?: boolean;
      mfe?: string;
      lambdas: string[];
    }
  >;
}

function importModuleRegisters(): void {
  routeRegistry.clear();

  for (const mod of MODULE_CATALOG) {
    const registerPath = path.join(apiRoot, mod.path, 'src/register.ts');
    if (fs.existsSync(registerPath)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(registerPath);
      console.log(`  ✓ ${mod.sku} (register.ts)`);
    } else {
      console.log(`  ○ ${mod.sku} (no register.ts yet)`);
    }
  }

  const legacyIndex = path.join(apiRoot, 'src/controllers/legacy.index.ts');
  if (fs.existsSync(legacyIndex)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(legacyIndex);
    console.log('  ✓ legacy ArcForge controllers');
  }
}

async function main(): Promise<void> {
  console.log('🔍 Merging manifests from modules...\n');

  importModuleRegisters();

  const base = routeRegistry.generateManifest();

  const modulesMeta: ArcForgeManifest['modules'] = {};
  for (const mod of MODULE_CATALOG) {
    const relatedLambdas = Object.keys(base.lambdas).filter((lambdaName) => {
      if (mod.sku === 'platform') {
        return ['auth', 'user', 'role', 'permission'].includes(lambdaName);
      }
      return lambdaName === mod.sku || lambdaName.startsWith(`${mod.sku}-`);
    });

    modulesMeta[mod.sku] = {
      sku: mod.sku,
      packageName: mod.packageName,
      compute: mod.compute,
      requiredModules: mod.requiredModules,
      required: mod.required,
      mfe: mod.mfe,
      lambdas: relatedLambdas,
    };
  }

  const output: ArcForgeManifest = {
    ...base,
    version: '2.0',
    modules: modulesMeta,
  };

  const outPath = path.join(apiRoot, 'app-manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const lambdaCount = Object.keys(output.lambdas).length;
  const routeCount = Object.values(output.lambdas).reduce((n, l) => n + l.routes.length, 0);

  console.log(`\n✅ ${outPath}`);
  console.log(`   Modules: ${MODULE_CATALOG.length}`);
  console.log(`   Lambdas: ${lambdaCount}`);
  console.log(`   Routes:  ${routeCount}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

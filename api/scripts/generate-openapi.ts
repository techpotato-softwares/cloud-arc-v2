#!/usr/bin/env ts-node
/**
 * Generates OpenAPI 3.1 from Zod schemas + decorator route metadata.
 * Usage: npm run build:openapi
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { routeRegistry, generateOpenApiYaml, generateOpenApiJson } from '@arcforge/shared';
import { MODULE_CATALOG } from './modules-catalog';

const apiRoot = path.join(__dirname, '..');
const outDir = path.join(apiRoot, 'openapi');
const yamlPath = path.join(outDir, 'openapi.yaml');
const jsonPath = path.join(outDir, 'openapi.json');

function importControllers(): void {
  routeRegistry.clear();

  for (const mod of MODULE_CATALOG) {
    const registerPath = path.join(apiRoot, mod.path, 'src/register.ts');
    if (fs.existsSync(registerPath)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(registerPath);
      console.log(`  ✓ ${mod.sku}`);
    }
  }

  const legacyIndex = path.join(apiRoot, 'src/controllers/legacy.index.ts');
  if (fs.existsSync(legacyIndex)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(legacyIndex);
    console.log('  ✓ legacy controllers');
  }
}

function main(): void {
  console.log('Generating OpenAPI from route registry...');
  importControllers();

  const yaml = generateOpenApiYaml({
    title: 'ArcForge API',
    version: '0.1.0',
    description: 'Generated from Zod schemas and @Controller route metadata',
  });

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(yamlPath, yaml, 'utf8');

  const json = generateOpenApiJson({
    title: 'ArcForge API',
    version: '0.1.0',
    description: 'Generated from Zod schemas and @Controller route metadata',
  });
  fs.writeFileSync(jsonPath, json, 'utf8');
  const doc = JSON.parse(json) as { paths?: Record<string, unknown> };

  const pathCount = Object.keys(doc.paths || {}).length;
  console.log(`✓ Wrote ${yamlPath} (${pathCount} paths)`);
  console.log(`✓ Wrote ${jsonPath}`);
}

main();

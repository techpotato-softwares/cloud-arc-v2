#!/usr/bin/env ts-node
/**
 * Creates stub workspace packages for each catalog module (if missing).
 */
import * as fs from 'fs';
import * as path from 'path';
import { MODULE_CATALOG } from './modules-catalog';

const apiRoot = path.join(__dirname, '..');

for (const mod of MODULE_CATALOG) {
  if (mod.sku === 'platform') continue;

  const modRoot = path.join(apiRoot, mod.path);
  const dirs = [
    'src/controllers',
    'src/services',
    'src/repositories',
    'src/schemas/request',
    'src/schemas/response',
    'lambdas',
  ];

  for (const d of dirs) {
    fs.mkdirSync(path.join(modRoot, d), { recursive: true });
  }

  const pkgPath = path.join(modRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: mod.packageName,
          version: '0.1.0',
          private: true,
          description: `ArcForge module: ${mod.sku}`,
          scripts: {
            build: 'echo "TODO: module build"',
            typecheck: 'tsc -p tsconfig.json --noEmit',
            lint: 'echo "TODO"',
          },
        },
        null,
        2
      ) + '\n'
    );
  }

  const manifestPath = path.join(modRoot, 'module.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          sku: mod.sku,
          packageName: mod.packageName,
          compute: mod.compute,
          requiredModules: mod.requiredModules,
          mfe: mod.mfe,
        },
        null,
        2
      ) + '\n'
    );
  }

  const registerPath = path.join(modRoot, 'src/register.ts');
  if (!fs.existsSync(registerPath)) {
    fs.writeFileSync(
      registerPath,
      `/** ${mod.sku} module — import controllers here when implemented */\n`
    );
  }

  const readmePath = path.join(modRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      `# ${mod.packageName}\n\n| | |\n|---|---|\n| **SKU** | \`${mod.sku}\` |\n| **Compute** | ${mod.compute} |\n| **Requires** | ${mod.requiredModules.join(', ') || 'none'} |\n| **MFE** | ${mod.mfe ?? 'n/a'} |\n\nStub — Phase 1+ implementation.\n`
    );
  }

  const tsconfigPath = path.join(modRoot, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          extends: '../../tsconfig.json',
          compilerOptions: {
            rootDir: '.',
            outDir: './dist',
            noEmit: true,
          },
          include: ['src/**/*', 'lambdas/**/*'],
        },
        null,
        2
      ) + '\n'
    );
  }

  if (mod.compute === 'ecs') {
    const dockerPath = path.join(modRoot, 'Dockerfile');
    if (!fs.existsSync(dockerPath)) {
      fs.writeFileSync(
        dockerPath,
        `# Phase 1: ${mod.sku} — ECS Express Mode\n# FROM node:20-alpine\n`
      );
    }
  }

  console.log(`Scaffolded ${mod.sku}`);
}

console.log('Done.');

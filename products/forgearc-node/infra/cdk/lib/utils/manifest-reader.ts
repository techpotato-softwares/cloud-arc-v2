import * as fs from "fs";
import * as path from "path";

// Manifest types (matching api/src/decorators/metadata.ts)
export interface RouteManifestEntry {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
  path: string;
  controller: string;
  action: string;
}

export interface LambdaManifestEntry {
  handler: string;
  controller: string;
  routes: RouteManifestEntry[];
}

export interface AppManifest {
  version: string;
  generatedAt: string;
  lambdas: Record<string, LambdaManifestEntry>;
}

/**
 * Read and parse the app-manifest.json file
 */
export function readManifest(): AppManifest {
  const manifestPath = path.join(
    __dirname,
    "../../../../apps/api/app-manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    console.warn(`⚠️  Warning: app-manifest.json not found at ${manifestPath}`);
    console.warn(
      '   Run "pnpm --filter @forgearc/api-host build:manifest" first.',
    );
    console.warn("   Using default empty manifest.\n");

    return {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      lambdas: {},
    };
  }

  const content = fs.readFileSync(manifestPath, "utf-8");
  const manifest: AppManifest = JSON.parse(content);

  console.log(`📄 Loaded app-manifest.json (v${manifest.version})`);
  console.log(`   Generated: ${manifest.generatedAt}`);
  console.log(`   Lambdas: ${Object.keys(manifest.lambdas).length}`);

  return manifest;
}

/**
 * Get routes for a specific lambda
 */
export function getRoutesForLambda(
  manifest: AppManifest,
  lambdaName: string,
): RouteManifestEntry[] {
  const lambda = manifest.lambdas[lambdaName];
  return lambda?.routes || [];
}

/**
 * Get all lambda names from manifest
 */
export function getLambdaNames(manifest: AppManifest): string[] {
  return Object.keys(manifest.lambdas);
}

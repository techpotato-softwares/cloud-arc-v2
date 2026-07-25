const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Build script for the shared Lambda layer
 * Creates a bundled layer that eliminates problematic node_modules (inversify long paths)
 * This fixes the Windows SAM CLI "Failed to calculate hash" error
 * 
 * Features:
 * - Smart caching: skips rebuild if layer source hasn't changed
 * - Use --force flag to force rebuild
 * - Use --check flag to only check if rebuild is needed (exit 0 = cached, exit 1 = needs rebuild)
 */

const layerSrcPath = path.join(__dirname, '../layers/shared/nodejs');
const bundledOutputPath = path.join(__dirname, '../layers/shared/bundled');
const hashFilePath = path.join(__dirname, '../layers/shared/.layer-hash');

const forceRebuild = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');

/**
 * Calculate hash of all source files in the layer
 * Includes: all TypeScript files in src/, package.json, prisma/schema.prisma
 */
function calculateLayerHash() {
  const hash = crypto.createHash('sha256');
  
  // Hash package.json
  const packageJsonPath = path.join(layerSrcPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    hash.update(fs.readFileSync(packageJsonPath));
  }
  
  // Hash package-lock.json (dependency versions matter)
  const packageLockPath = path.join(layerSrcPath, 'package-lock.json');
  if (fs.existsSync(packageLockPath)) {
    hash.update(fs.readFileSync(packageLockPath));
  }
  
  // Hash prisma schema
  const schemaPath = path.join(layerSrcPath, 'prisma/schema.prisma');
  if (fs.existsSync(schemaPath)) {
    hash.update(fs.readFileSync(schemaPath));
  }
  
  // Hash all TypeScript source files
  const srcDir = path.join(layerSrcPath, 'src');
  if (fs.existsSync(srcDir)) {
    hashDirectory(srcDir, hash);
  }
  
  // Hash esbuild config
  const esbuildConfigPath = path.join(layerSrcPath, 'esbuild.config.js');
  if (fs.existsSync(esbuildConfigPath)) {
    hash.update(fs.readFileSync(esbuildConfigPath));
  }
  
  return hash.digest('hex');
}

function hashDirectory(dirPath, hash) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      hashDirectory(fullPath, hash);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      hash.update(fs.readFileSync(fullPath));
    }
  }
}

/**
 * Check if cached layer is still valid
 */
function isCacheValid() {
  if (!fs.existsSync(hashFilePath)) {
    return false;
  }
  
  if (!fs.existsSync(bundledOutputPath)) {
    return false;
  }
  
  const cachedHash = fs.readFileSync(hashFilePath, 'utf-8').trim();
  const currentHash = calculateLayerHash();
  
  return cachedHash === currentHash;
}

/**
 * Save the current hash to cache file
 */
function saveHash() {
  const currentHash = calculateLayerHash();
  fs.writeFileSync(hashFilePath, currentHash, 'utf-8');
  console.log('💾 Layer hash cached for future builds');
}

async function buildLayer() {
  // Check-only mode: just report if rebuild is needed
  if (checkOnly) {
    if (isCacheValid()) {
      console.log('✅ Layer cache is valid - no rebuild needed');
      process.exit(0);
    } else {
      console.log('🔄 Layer cache is invalid - rebuild needed');
      process.exit(1);
    }
  }

  // Skip rebuild if cache is valid and not forcing
  if (!forceRebuild && isCacheValid()) {
    console.log('⚡ Layer cache is valid - skipping rebuild');
    console.log('   Use --force to rebuild anyway\n');
    return;
  }

  if (forceRebuild) {
    console.log('🔧 Building shared Lambda layer (forced)...\n');
  } else {
    console.log('🔧 Building shared Lambda layer...\n');
  }

  try {
    // Step 1: Install dependencies in the layer source
    console.log('📦 Installing layer dependencies...');
    execSync('npm install', { cwd: layerSrcPath, stdio: 'inherit' });

    // Step 2: Build with esbuild (bundles inversify, sequelize, reflect-metadata)
    console.log('\n⚡ Bundling layer with esbuild...');
    execSync('npm run build', { cwd: layerSrcPath, stdio: 'inherit' });

    // Step 3: Create bundled output directory
    // Lambda layers for Node.js must have content in nodejs/ subdirectory
    // This ensures content is mounted at /opt/nodejs/ when layer is attached
    console.log('\n📁 Creating bundled layer output...');
    if (fs.existsSync(bundledOutputPath)) {
      fs.rmSync(bundledOutputPath, { recursive: true });
    }
    
    // Create nodejs subdirectory (Lambda layer convention)
    const nodejsPath = path.join(bundledOutputPath, 'nodejs');
    fs.mkdirSync(nodejsPath, { recursive: true });

    // Step 4: Copy bundled dist to nodejs/dist
    const srcDist = path.join(layerSrcPath, 'dist');
    const destDist = path.join(nodejsPath, 'dist');
    fs.cpSync(srcDist, destDist, { recursive: true });

    // Note: pg and all dependencies are now bundled into dist/index.js
    // No need for separate node_modules - everything is in the single bundle
    console.log('📦 All dependencies bundled (including pg)');

    // Step 4b: Copy @prisma/client to node_modules for direct imports
    // This allows Lambdas to import models/types from '@prisma/client'
    const srcNodeModules = path.join(layerSrcPath, 'node_modules');
    const destNodeModules = path.join(nodejsPath, 'node_modules');
    fs.mkdirSync(destNodeModules, { recursive: true });

    // Copy @prisma/client
    const srcPrismaClient = path.join(srcNodeModules, '@prisma', 'client');
    const destPrismaClient = path.join(destNodeModules, '@prisma', 'client');
    if (fs.existsSync(srcPrismaClient)) {
      fs.cpSync(srcPrismaClient, destPrismaClient, { recursive: true });
      console.log('📦 Copied @prisma/client to layer');
    }

    // Copy .prisma (generated client with query engine)
    const srcDotPrisma = path.join(srcNodeModules, '.prisma');
    const destDotPrisma = path.join(destNodeModules, '.prisma');
    if (fs.existsSync(srcDotPrisma)) {
      fs.cpSync(srcDotPrisma, destDotPrisma, { recursive: true });
      console.log('📦 Copied .prisma (generated client) to layer');

      // Remove non-Linux engines and copy Linux engine to nodejs root
      const prismaEngineDir = path.join(destDotPrisma, 'client');
      if (fs.existsSync(prismaEngineDir)) {
        const files = fs.readdirSync(prismaEngineDir);
        for (const file of files) {
          if (file.includes('windows') || file.includes('darwin')) {
            fs.rmSync(path.join(prismaEngineDir, file));
            console.log(`🗑️  Removed ${file} from layer`);
          }
          // Copy Linux engine to nodejs root and remove from node_modules (avoid duplication)
          if (file.includes('linux') && file.endsWith('.node')) {
            fs.copyFileSync(
              path.join(prismaEngineDir, file),
              path.join(nodejsPath, file)
            );
            // Remove from node_modules to save ~14 MB (bundled Prisma uses nodejs root)
            fs.rmSync(path.join(prismaEngineDir, file));
            console.log(`📦 Moved ${file} to nodejs root (removed duplicate)`);
          }
        }
      }
    }

    // Step 5: Create package.json for the bundled layer
    const packageJson = {
      name: '@arcforge/shared-layer',
      version: '1.0.0',
      main: 'dist/index.js',
    };
    fs.writeFileSync(
      path.join(nodejsPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Calculate final size
    const totalSize = getFolderSize(bundledOutputPath);
    console.log(`\n✅ Bundled layer created: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Output: ${bundledOutputPath}`);

    // Save hash for caching
    saveHash();

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

function getFolderSize(folderPath) {
  let totalSize = 0;
  const files = fs.readdirSync(folderPath);
  
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      totalSize += getFolderSize(filePath);
    } else {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

buildLayer();

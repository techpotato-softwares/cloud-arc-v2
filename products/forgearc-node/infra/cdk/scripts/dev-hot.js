#!/usr/bin/env node
/**
 * Hot Reload Development Script
 * 
 * Combines esbuild watch mode with SAM local for instant code updates.
 * Changes to Lambda code are reflected immediately without restart.
 * 
 * Features:
 * - esbuild watch: rebuilds handlers on file change (~100ms)
 * - SAM EAGER containers: keeps containers warm
 * - Automatic restart on layer/schema changes
 * 
 * Usage:
 *   pnpm dev:hot           # Start with hot reload
 *   
 * Environment variables:
 *   API_PORT=5000              # Custom port (default: 4000)
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const port = process.env.API_PORT || '4000';

const cdkDir = __dirname.replace(/[\\/]scripts$/, '');
const apiDir = path.join(cdkDir, '../../apps/api');
const template = path.join(cdkDir, 'cdk.out/ApiStack-dev.template.json');
const envVars = path.join(cdkDir, 'env.local.json');

let samProcess = null;
let watchProcess = null;

async function main() {
  console.log('\n🔥 Hot Reload Development Mode\n');
  console.log('=' .repeat(50));

  // Check prerequisites
  if (!fs.existsSync(envVars)) {
    console.error('❌ Error: env.local.json not found!');
    console.error('   Run: cp env.template.json env.local.json');
    console.error('   Then edit env.local.json with your database credentials.\n');
    process.exit(1);
  }

  const startTime = Date.now();

  // Step 1: Ensure layer is built
  console.log('\n📦 Step 1: Checking shared layer...');
  
  try {
    try {
      execSync('node scripts/build-layer.js --check', { cwd: apiDir, stdio: 'pipe' });
      console.log('   ✅ Layer cached');
    } catch {
      console.log('   Building layer (first time)...');
      execSync('pnpm build:layer', { cwd: apiDir, stdio: 'inherit' });
    }
  } catch (error) {
    console.error('❌ Layer build failed:', error.message);
    process.exit(1);
  }

  // Step 2: Initial build
  console.log('\n⚡ Step 2: Initial Lambda build...');
  
  try {
    execSync('pnpm build', { cwd: apiDir, stdio: 'inherit' });
    execSync('pnpm build:manifest', { cwd: apiDir, stdio: 'pipe' });
    console.log('   ✅ Handlers built');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }

  // Step 3: CDK Synth (only if needed)
  console.log('\n🏗️  Step 3: CDK Synthesis...');
  
  if (!fs.existsSync(template)) {
    console.log('   Running CDK synth...');
    try {
      execSync('cdk synth ApiStack-dev', { cwd: cdkDir, stdio: 'inherit' });
    } catch (error) {
      console.error('❌ CDK synth failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log('   ✅ Using cached template');
  }

  console.log('\n🔥 Step 4: Starting Hot Reload Mode...');
  console.log('=' .repeat(50));
  console.log(`\n✨ Startup time: ${elapsed(startTime)}\n`);

  // Start esbuild in watch mode
  console.log('👀 Starting esbuild watcher...');
  watchProcess = spawn('npm', ['run', 'watch'], {
    cwd: apiDir,
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: true
  });

  watchProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output.includes('Watching') || output.includes('watching')) {
      console.log('   ✅ Watcher active');
    } else if (output.includes('Build') || output.includes('build')) {
      console.log(`   🔄 ${output}`);
    }
  });

  // Start SAM with EAGER warm containers
  console.log(`\n🌐 Starting SAM Local on port ${port}...`);
  
  const samArgs = [
    'local', 'start-api',
    '-p', port,
    '-t', template,
    '--env-vars', envVars,
    '--warm-containers', 'EAGER',
    '--skip-pull-image'
  ];

  samProcess = spawn('sam', samArgs, {
    cwd: cdkDir,
    stdio: 'inherit',
    shell: true
  });

  samProcess.on('error', (err) => {
    console.error('Failed to start SAM:', err.message);
    cleanup();
    process.exit(1);
  });

  samProcess.on('close', (code) => {
    cleanup();
    process.exit(code);
  });

  console.log('\n💡 Hot Reload Tips:');
  console.log('   - Edit Lambda code → esbuild rebuilds in ~100ms');
  console.log('   - Changes are picked up on next request');
  console.log('   - For layer/schema changes, restart with: pnpm dev:fast --init');
  console.log('   - Press Ctrl+C to stop\n');
}

function elapsed(since) {
  const ms = Date.now() - since;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function cleanup() {
  if (watchProcess) {
    watchProcess.kill();
    watchProcess = null;
  }
  if (samProcess) {
    samProcess.kill();
    samProcess = null;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

main().catch((err) => {
  console.error('❌ Startup failed:', err.message);
  cleanup();
  process.exit(1);
});


#!/usr/bin/env node
/**
 * Fast Local Development Script
 * 
 * Optimized for speed - skips unnecessary rebuilds:
 * - Skips layer build if cached (source unchanged)
 * - Skips CDK synth if template exists
 * - Uses EAGER warm containers for fast subsequent requests
 * 
 * Usage:
 *   npm run dev:fast           # Fast start with caching
 *   npm run dev:fast -- --init # Force full rebuild (like first-time setup)
 *   
 * Environment variables:
 *   API_PORT=5000              # Custom port (default: 4000)
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const port = process.env.API_PORT || '4000';
const forceInit = process.argv.includes('--init');

const cdkDir = __dirname.replace(/[\\/]scripts$/, '');
const apiDir = path.join(cdkDir, '../api');
const template = path.join(cdkDir, 'cdk.out/ApiStack-dev.template.json');
const envVars = path.join(cdkDir, 'env.local.json');

async function main() {
  console.log('\n🚀 Fast Local Development Startup\n');
  console.log('=' .repeat(50));

  // Check prerequisites
  if (!fs.existsSync(envVars)) {
    console.error('❌ Error: env.local.json not found!');
    console.error('   Run: cp env.template.json env.local.json');
    console.error('   Then edit env.local.json with your database credentials.\n');
    process.exit(1);
  }

  const startTime = Date.now();
  let stepTime = Date.now();

  // Step 1: Check layer cache
  console.log('\n📦 Step 1: Checking shared layer...');
  stepTime = Date.now();
  
  try {
    if (forceInit) {
      console.log('   Forcing layer rebuild (--init flag)');
      execSync('npm run build:layer -- --force', { cwd: apiDir, stdio: 'inherit' });
    } else {
      // Check if layer needs rebuild
      try {
        execSync('node scripts/build-layer.js --check', { cwd: apiDir, stdio: 'pipe' });
        console.log(`   ✅ Layer cached (${elapsed(stepTime)})`);
      } catch {
        // Cache invalid, rebuild
        console.log('   Cache invalid, rebuilding...');
        execSync('npm run build:layer', { cwd: apiDir, stdio: 'inherit' });
      }
    }
  } catch (error) {
    console.error('❌ Layer build failed:', error.message);
    process.exit(1);
  }

  // Step 2: Build Lambda handlers
  console.log('\n⚡ Step 2: Building Lambda handlers...');
  stepTime = Date.now();
  
  try {
    execSync('npm run build', { cwd: apiDir, stdio: 'inherit' });
    console.log(`   ✅ Handlers built (${elapsed(stepTime)})`);
  } catch (error) {
    console.error('❌ Handler build failed:', error.message);
    process.exit(1);
  }

  // Step 3: Generate manifest (required for routing)
  console.log('\n📋 Step 3: Generating app manifest...');
  stepTime = Date.now();
  
  try {
    execSync('npm run build:manifest', { cwd: apiDir, stdio: 'pipe' });
    console.log(`   ✅ Manifest generated (${elapsed(stepTime)})`);
  } catch (error) {
    console.error('❌ Manifest generation failed:', error.message);
    process.exit(1);
  }

  // Step 4: CDK Synth (only if template missing or --init)
  console.log('\n🏗️  Step 4: CDK Synthesis...');
  stepTime = Date.now();
  
  const templateExists = fs.existsSync(template);
  
  if (forceInit || !templateExists) {
    const reason = forceInit ? '(--init flag)' : '(template not found)';
    console.log(`   Running CDK synth ${reason}...`);
    try {
      execSync('cdk synth ApiStack-dev', { cwd: cdkDir, stdio: 'inherit' });
      console.log(`   ✅ CDK synth complete (${elapsed(stepTime)})`);
    } catch (error) {
      console.error('❌ CDK synth failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log(`   ✅ Using cached template (${elapsed(stepTime)})`);
  }

  // Step 5: Start SAM Local
  console.log('\n🎯 Step 5: Starting SAM Local API...');
  console.log('=' .repeat(50));
  console.log(`\n✨ Total startup time: ${elapsed(startTime)}\n`);

  const samArgs = [
    'local', 'start-api',
    '-p', port,
    '-t', template,
    '--env-vars', envVars,
    '--warm-containers', 'EAGER',  // Keep containers warm for fast subsequent requests
    '--skip-pull-image'
  ];

  if (process.env.SAM_DEBUG === 'true') {
    samArgs.push('--debug');
  }

  console.log(`🌐 API will be available at http://127.0.0.1:${port}\n`);
  console.log('💡 Tips:');
  console.log('   - First request may take 5-10s (cold start)');
  console.log('   - Subsequent requests will be fast (warm container)');
  console.log('   - Run "npm run watch" in api/ for auto-rebuild on changes');
  console.log('   - Press Ctrl+C to stop\n');

  const sam = spawn('sam', samArgs, {
    cwd: cdkDir,
    stdio: 'inherit',
    shell: true
  });

  sam.on('error', (err) => {
    console.error('Failed to start SAM:', err.message);
    process.exit(1);
  });

  sam.on('close', (code) => {
    process.exit(code);
  });
}

function elapsed(since) {
  const ms = Date.now() - since;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error('❌ Startup failed:', err.message);
  process.exit(1);
});


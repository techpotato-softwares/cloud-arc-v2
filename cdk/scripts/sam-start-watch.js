#!/usr/bin/env node
/**
 * SAM Local Start Script with Hot Reload (native file watching)
 * 
 * Watches api/dist/.restart signal file and automatically restarts SAM when build completes.
 * 
 * Usage:
 *   npm run dev:watch
 *   
 * Or with custom port:
 *   API_PORT=5000 npm run dev:watch
 *   
 * Or on Windows PowerShell:
 *   $env:API_PORT=5000; npm run dev:watch
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const port = process.env.API_PORT || '4000';
const template = 'cdk.out/ApiStack-dev.template.json';
const envVars = 'env.local.json';

// Path to restart signal file (written by esbuild on rebuild)
const restartSignalPath = path.join(__dirname, '../../api/dist/.restart');

let samProcess = null;
let restartTimeout = null;

function startSAM() {
  const args = [
    'local', 'start-api',
    '-p', port,
    '-t', template,
    '--env-vars', envVars,
    '--warm-containers', 'EAGER',  // EAGER keeps containers warm for faster subsequent requests
    '--skip-pull-image'
  ];

  if (process.env.SAM_DEBUG === 'true') {
    args.push('--debug');
  }

  console.log(`\n🚀 Starting SAM Local API on port ${port}...\n`);

  samProcess = spawn('sam', args, {
    stdio: 'inherit',
    shell: true
  });

  samProcess.on('error', (err) => {
    console.error('Failed to start SAM:', err.message);
    process.exit(1);
  });

  samProcess.on('close', (code) => {
    // Only exit if not restarting
    if (!restartTimeout) {
      process.exit(code);
    }
  });
}

function restartSAM() {
  if (samProcess) {
    console.log('\n🔄 Restarting SAM Local (code changed)...\n');
    samProcess.kill('SIGTERM');
    samProcess = null;
    
    // Small delay before restart to ensure clean shutdown
    setTimeout(() => {
      startSAM();
    }, 500);
  } else {
    startSAM();
  }
}

// Watch for restart signal file
function watchForRestart() {
  const watchDir = path.dirname(restartSignalPath);
  
  // Ensure directory exists
  if (!fs.existsSync(watchDir)) {
    console.warn('⚠️  api/dist directory not found. Waiting for first build...\n');
    // Watch parent directory until dist is created
    fs.watch(path.dirname(watchDir), { recursive: false }, () => {
      if (fs.existsSync(watchDir)) {
        watchForRestart();
      }
    });
    return;
  }

  // Watch the signal file
  let lastModified = 0;
  
  fs.watchFile(restartSignalPath, { interval: 500 }, (curr, prev) => {
    if (curr.mtimeMs > lastModified && curr.mtimeMs > prev.mtimeMs) {
      lastModified = curr.mtimeMs;
      
      // Debounce rapid restarts
      if (restartTimeout) {
        clearTimeout(restartTimeout);
      }
      
      restartTimeout = setTimeout(() => {
        restartTimeout = null;
        restartSAM();
      }, 1000);
    }
  });

  console.log('👀 Watching for code changes...');
  console.log('   Signal file: api/dist/.restart\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down SAM Local...');
  if (samProcess) {
    samProcess.kill('SIGINT');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (samProcess) {
    samProcess.kill('SIGTERM');
  }
  process.exit(0);
});

// Start SAM and watch for changes
startSAM();
watchForRestart();

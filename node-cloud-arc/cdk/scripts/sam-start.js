#!/usr/bin/env node
/**
 * SAM Local Start Script with configurable port
 * 
 * Usage:
 *   API_PORT=5000 npm run dev:port
 *   
 * Or on Windows PowerShell:
 *   $env:API_PORT=5000; npm run dev:port
 */

const { spawn } = require('child_process');

const port = process.env.API_PORT || '4000';
const template = 'cdk.out/ApiStack-dev.template.json';
const envVars = 'env.local.json';

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

const sam = spawn('sam', args, {
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


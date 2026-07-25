const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

/**
 * Build the shared layer with esbuild bundling
 * This bundles ALL dependencies including pg (which is pure JS, no native code)
 * Only pg-native (optional native bindings) and @aws-sdk (Lambda runtime) are external
 * This eliminates the node_modules folder with long file paths that break Windows SAM CLI
 */

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outdir: 'dist',
  format: 'cjs',
  sourcemap: false, // Disable source maps for smaller bundle
  minify: true, // Minify for smaller bundle and faster parsing
  tsconfigRaw: JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      strict: true,
      esModuleInterop: true,
    },
  }),
  external: [
    // pg-native is optional native bindings - not needed, keep external
    'pg-native',
    // AWS SDK is included in Lambda runtime
    '@aws-sdk/*',
  ],
  // Tree shake unused code
  treeShaking: true,
  metafile: true,
  logLevel: 'info',
};

async function build() {
  try {
    console.log('Building shared layer with esbuild...');
    
    // Clean dist folder
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true });
    }
    
    const result = await esbuild.build(buildOptions);
    
    // Output build size info
    if (result.metafile) {
      const outputs = Object.entries(result.metafile.outputs);
      for (const [file, info] of outputs) {
        const sizeKB = (info.bytes / 1024).toFixed(2);
        console.log(`  ${file}: ${sizeKB} KB`);
      }
    }
    
    // Create a minimal package.json for the bundled layer (needed for pg external dependency)
    const minimalPackageJson = {
      name: '@arcforge/shared-layer',
      version: '1.0.0',
      main: 'dist/index.js',
      dependencies: {
        pg: '^8.11.3',
        'pg-hstore': '^2.3.4',
      },
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'package.bundled.json'),
      JSON.stringify(minimalPackageJson, null, 2)
    );
    
    console.log('Shared layer build complete!');
    console.log('Note: pg dependencies kept external - run npm install for deployment');
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();


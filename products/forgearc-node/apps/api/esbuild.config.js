const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const isWatch = process.argv.includes('--watch');

// Plugin to rewrite @forgearc/shared imports to /opt/nodejs/dist (Lambda layer path)
const sharedLayerPlugin = {
  name: 'shared-layer-alias',
  setup(build) {
    // Intercept @forgearc/shared imports BEFORE default resolution
    // Use a high-priority filter that runs first
    const aliasShared = (args) => {
      const pkg = args.path.startsWith('@forgearc/shared')
        ? args.path.replace('@forgearc/shared', '')
        : args.path.replace('@forgearc/shared', '');
      if (pkg === '' || pkg === '@forgearc/shared' || args.path === '@forgearc/shared') {
        return { path: '/opt/nodejs/dist', external: true };
      }
      const subpath = pkg.startsWith('/') ? pkg.slice(1) : pkg;
      return { path: `/opt/nodejs/dist/${subpath}`, external: true };
    };
    build.onResolve({ filter: /^@forgearc\/shared/ }, aliasShared);
    build.onResolve({ filter: /^@forgearc\/shared/ }, aliasShared);
  },
};

// Plugin to write restart signal file on rebuild (for SAM hot reload)
const restartSignalPlugin = {
  name: 'restart-signal',
  setup(build) {
    const restartSignalPath = path.join(__dirname, 'dist', '.restart');
    build.onEnd(() => {
      try {
        fs.mkdirSync(path.dirname(restartSignalPath), { recursive: true });
        fs.writeFileSync(restartSignalPath, Date.now().toString(), 'utf8');
      } catch (err) {
        // Ignore errors - restart signal is optional
      }
    });
  },
};

/**
 * Auto-discover all lambda configuration files from src/lambdas/*.lambda.ts
 * Each file should export a handler created with createLambdaHandler()
 */
function discoverLambdas() {
  const patterns = [
    path.join(__dirname, 'src/lambdas', '*.lambda.ts'),
    path.join(__dirname, '..', '..', 'modules', '*', 'lambdas', '*.lambda.ts'),
  ];

  const lambdaFiles = patterns.flatMap((p) =>
    glob.sync(p.replace(/\\/g, '/'))
  );

  if (lambdaFiles.length === 0) {
    console.warn('⚠️  No lambda files found under apps/api/src/lambdas or modules/*/lambdas');
    return [];
  }

  console.log(`\n🔍 Discovered ${lambdaFiles.length} lambda(s):`);

  const entryPoints = lambdaFiles.map((file) => {
    const basename = path.basename(file, '.lambda.ts');
    console.log(`   - ${basename} (${path.relative(__dirname, file)})`);

    return {
      in: file,
      out: `handlers/${basename}`,
    };
  });

  console.log('');
  return entryPoints;
}

// Discover lambdas at build time
const entryPoints = discoverLambdas();

// Skip build if no lambdas found
if (entryPoints.length === 0) {
  console.log('No lambdas to build. Exiting.');
  process.exit(0);
}

const buildOptions = {
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node22',
  outdir: 'dist',
  format: 'cjs',
  sourcemap: true,
  minify: false, // Keep false for debugging
  // Don't use tsconfig paths for resolution - our plugin handles @forgearc/shared
  tsconfigRaw: JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  }),
  external: [
    // AWS SDK v3 is included in Lambda runtime
    '@aws-sdk/*',
    // Layer dependencies - will be loaded from /opt/nodejs
    '/opt/nodejs/*',
    // Prisma is bundled in the Lambda layer
    '@prisma/client',
  ],
  plugins: [sharedLayerPlugin, restartSignalPlugin],
  // Optimize for Lambda
  treeShaking: true,
  metafile: true,
  logLevel: 'info',
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      const result = await esbuild.build(buildOptions);
      
      // Output build size info
      if (result.metafile) {
        console.log('\n📦 Build output:');
        const outputs = Object.entries(result.metafile.outputs);
        for (const [file, info] of outputs) {
          if (file.endsWith('.js')) {
            const sizeKB = (info.bytes / 1024).toFixed(2);
            console.log(`   ${file}: ${sizeKB} KB`);
          }
        }
      }
      
      console.log('\n✅ Build complete!\n');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();

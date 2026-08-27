// tsdown.config.ts — dual build: node half (lib/index.js, ESM) + browser half
// (lib/client.js, CJS wrapped in window.__ModuleLoader__.load), mirroring the
// DSH monorepo preset packages/client/tsdown.client.ts (clientBundle) essentials.
//
// Deviation from the monorepo preset: the host config pins
// `outputOptions.entryFileNames: 'index.js'` because tsdown 0.22's extension
// resolver gives platform:node ESM output the `.mjs` suffix in a
// `"type": "module"` package, while the host Loader and package.json
// `main`/`exports` require `lib/index.js`.
const ID = 'subagent-view'

/** Specifiers the loader module table answers (platform seeds + preloaded runtime). */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
]

/** Specifiers the Node half imports from a real install (production deps + peers). */
const isHostExternal = (specifier: string): boolean =>
  specifier === 'react'
  || specifier.startsWith('@deepseek-ai/')
  || /^node:/.test(specifier)

const clientExternal = (specifier: string): boolean =>
  CLIENT_EXTERNALS.includes(specifier)
  || (specifier.startsWith('@deepseek-ai/') && specifier.endsWith('/remote'))

export default [
  {
    // Node half: the host Loader imports lib/index.js.
    name: ID,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    sourcemap: true,
    outputOptions: { entryFileNames: 'index.js' },
    deps: {
      neverBundle: isHostExternal,
      alwaysBundle: (specifier: string) => !/^node:/.test(specifier) && !isHostExternal(specifier),
    },
  },
  {
    // Browser half: served at /plugins/subagent-view/client.js. Executing it only
    // REGISTERS the factory; body runs at materialization.
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      neverBundle: clientExternal,
      alwaysBundle: (specifier: string) => !clientExternal(specifier),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]

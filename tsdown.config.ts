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

/**
 * Specifiers the browser module table (DSH 0.1.5-rc.2 static seed table +
 * preloaded client modules) answers, i.e. the ids the built bundle may
 * `require()` at runtime. Everything else is bundled.
 *
 * The seed table of 0.1.5-rc.2 is `react`, `react/jsx-runtime`, `react-dom`,
 * `react-dom/client`, `@deepseek-ai/cordis`,
 * `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`,
 * `@deepseek-ai/dsh-client-ui-primitives` and
 * `@deepseek-ai/dsh-client-ui-dockkit` (one word more than 0.1.2-rc.1).
 *
 * Invariant: this list must stay a SUBSET of the served id set (seed words plus
 * arrived graph rows) and a SUPERSET of every specifier the built bundle
 * requires. `@deepseek-ai/dsh-client-ui-dockkit` is deliberately absent: the
 * rightbar tab type imports its contract type-only, so nothing in the bundle
 * requires it (types are erased). Everything else — including
 * `@deepseek-ai/dsh-client-ui-sidebar-right` — is either bundled (never
 * external) or reaches the page through the `dsh.client.inject` graph rows,
 * never through `require()`.
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

/** Specifiers the Node half imports from a real install (production deps + peers). */
const isHostExternal = (specifier: string): boolean =>
  specifier === 'react'
  || specifier.startsWith('@deepseek-ai/')
  || /^node:/.test(specifier)

/**
 * Browser-half externals. Note there is deliberately **no** rule for
 * `@deepseek-ai/<pkg>/remote`: the module table only answers bare package ids
 * (the boot-graph row key) and their `/client` alias, so a `<pkg>/remote`
 * external would materialize as an unresolvable `require` and throw in the
 * browser. Those subpaths do exist on disk — they are the generated typert
 * remote-client descriptors (`lib/typert.remote-client.js`, e.g.
 * `dsh-api-session-controller`, `dsh-client-file-upload`) — but no client
 * bundle requires one, and bundling is the correct treatment should a future
 * value import appear: it is a zod-carrying descriptor module, not a service
 * the page provides.
 */
const clientExternal = (specifier: string): boolean =>
  CLIENT_EXTERNALS.includes(specifier)

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

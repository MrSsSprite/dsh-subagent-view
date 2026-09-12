# Migration inventory — platform `0.1.2-rc.1` → `0.1.5-rc.2`

Owner: analyst-migration (t2). Status: **complete**, requirements-grade evidence.
Scope: *every* platform symbol, slot, service, type and module id the plugin's
`src/index.ts`, `src/client/{index.ts,panel.tsx,subagents-tab.tsx,tree.tsx}`,
`tsdown.config.ts` and `package.json` (`dsh.client.inject`) use, classed as
**unchanged / changed (old → new) / removed**, with `file:line` evidence from
**both** platform trees, plus the browser module seed table of the shipped
frontend and the exact `dsh.client.inject` / `CLIENT_EXTERNALS` deltas.

Nothing here edits `src/`, `lib/`, `package.json` or `tsdown.config.ts`; all
scratch artifacts live under `.scratch/`.

---

## 0. Evidence rules and path shorthand

| Shorthand | Real path |
|---|---|
| `OLD/<pkg>` | `<repo>/node_modules/@deepseek-ai/<pkg>` — pnpm symlinks, **0.1.2-rc.1** |
| `NEW/<pkg>` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/<pkg>` — installed runtime, **0.1.5-rc.2** |
| `PUB/<pkg>` | `.scratch/platform-0.1.5-rc.2/deepseek-ai-<pkg>-0.1.5-rc.2/package` — published `0.1.5-rc.2` tarball (`npm pack`) |
| `FRONT` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BKQ_L1z6.js` (shipped shell, 0.1.5-rc.2) |
| `FRONT-OLD` | `.scratch/platform-0.1.2-rc.1/frontend/package/dist/assets/index-Df-65__b.js` (published shell, 0.1.2-rc.1) |

`PUB/*` is used **only** for the four packages that ship exclusively as browser
seed words (see §5): their host-side install is absent from both trees at
0.1.5-rc.2, so the published tarball at the same version is the only readable
source. The *runtime* contents of those ids are proven against `FRONT`, not
against the tarball.

Every `file:line` below was produced by reading the installed/published files in
this session; the commands are in §10.

`file:line` citations of **plugin** files (`package.json`, `tsdown.config.ts`,
`src/**`) refer to the pre-migration tree at `HEAD = f67aa112…` (the tree the
drift was measured against); implementation work after that commit may shift
them.

> Cross-check note (added after t2 completed, from the captain's four-point
> evidence request): §1.1 (CLI `0.1.5-rc.1` vs bundled packages `0.1.5-rc.2`),
> §5.1/§5.4 (installed seed table + `tsdown` reconcile), §5.3 (inject semantics,
> reference contract, type-only imports) and §4.2 (left-bar seats) each carry the
> corresponding confirmation; nothing in the original findings changed.
>
> Cross-check note 2 (from analyst-rightbar's t1 findings): the nine-word seed
> table and the `dockkit` gap are §5.1/§5.4; the bare-name/no-row-is-inert rules
> of `dsh.client.inject` are §5.3 with one wording correction — the host does
> **not** reject subpaths at parse time (`exactPackageSpecifier` governs Loader
> entry names, `index.js:682`), a `<pkg>/client` inject entry is merely inert;
> and the disposition of the shell-singleton packages (`primitives`/`slots`
> required, `store` not needed — measured, §9.2b; `dockkit` only if imported
> directly) is the §1.2 table.

---

## 1. Trees, versions, topologies

### 1.1 Versions

| Package | (a) OLD | (b) NEW |
|---|---|---|
| `@deepseek-ai/cordis` | 4.0.2 | 4.0.2 (byte-identical `lib/index.js`) |
| `dsh-session` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-subagent` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-host-webserver` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-session-projection` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-session-projection-cache` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-session-persistence` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-session-query` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-client-ui-renderer` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-client-ui-session` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-client-ui-conversation` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-client-ui-sidebar` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-client-ui-layout` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-api-session-controller` | 0.1.2-rc.1 | 0.1.5-rc.2 |
| `dsh-client-ui-primitives` | 0.1.2-rc.1 (host install) | **not installed as a node package**; seed word only, published 0.1.5-rc.2 |
| `dsh-client-ui-slots` | 0.1.2-rc.1 (host install) | **not installed as a node package**; seed word only, published 0.1.5-rc.2 |
| `dsh-client-store` | absent (seed word) | absent (seed word), published 0.1.5-rc.2 |
| `dsh-client-ui-sidebar-right` | **absent** | 0.1.5-rc.2 — NEW graph row, declares the rightbar seats |
| `dsh-client-ui-dockkit` | **absent** | **not installed**; NEW seed word, published 0.1.5-rc.2 |

**Version semantics — do not conflate the CLI string with the package version.**
The *CLI package* `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/package.json`
is `@deepseek-ai/dsh@0.1.5-rc.1`, while **every** `@deepseek-ai/*` package
bundled under its `node_modules` is `0.1.5-rc.2` (re-verified this session:
`dsh-web-frontend`, `dsh-client-modules`, `dsh-session-projection`,
`dsh-client-ui-sidebar-right`, … all `0.1.5-rc.2`). The migration target is the
**package** version:

* `devDependencies` (`package.json:65-80`) are exact pins → bump every
  `@deepseek-ai/*` pin from `0.1.2-rc.1` to **`0.1.5-rc.2`** (`cordis` stays
  `4.0.2`, which is what the runtime installs too).
* `peerDependencies` (`package.json:48-63`) are open ranges
  (`>=0.1.0-rc.0`) that already admit `0.1.5-rc.2`; they need **no** edit for
  this migration (raising their floor to `>=0.1.5-rc.2` is a separate product
  choice, not a drift fix). Do **not** write the launcher's `0.1.5-rc.1` string
  anywhere in this manifest.

***Recorded decision (TAKEN):*** the maintainer deliberately raised the
`peerDependencies` floors to `>=0.1.5-rc.2` — a product choice, because the
bundle is built and verified against the `0.1.5-rc.2` package set — **not** a
required drift fix (the previous ranges already admitted the new versions), and
the launcher's `0.1.5-rc.1` string still must never appear in this manifest.
Because the fallback contract requires the plugin to keep working on a
deployment that does not compose `ui-sidebar-right`, the raised floor does **not**
imply a hard dependency: `@deepseek-ai/dsh-client-ui-sidebar-right` must be an
**optional peer** (`peerDependenciesMeta: { "@deepseek-ai/dsh-client-ui-sidebar-right":
{ "optional": true } }`) so a profile without that row can still install.

### 1.2 Topology consequence (load-bearing for the whole migration)

In 0.1.5-rc.2 the three "UI kit" packages (`primitives`, `slots`, `store`) and
the new `dockkit` are **frontend-internal**: the shipped shell bundles them and
answers them from its static table (`FRONT:114`, function `by()`), while the
runtime install tree under `/opt/homebrew/.../dsh/node_modules` contains **no**
`dsh-client-ui-primitives`, `dsh-client-ui-slots`, `dsh-client-store` or
`dsh-client-ui-dockkit` directory. They are still published on npm at
0.1.5-rc.2 (verified with `npm view` / `npm pack`, §10), and the platform's own
client packages require them at runtime — e.g.
`NEW/dsh-client-ui-sidebar-right/lib/client.js` requires
`@deepseek-ai/dsh-client-ui-dockkit`, `@deepseek-ai/dsh-client-ui-primitives`,
`@deepseek-ai/dsh-client-store`, `react`, `react-dom`, `react/jsx-runtime`, and
its `package.json` declares those only as **devDependencies** (the browser
answers them). Consequence for the plugin: they must keep appearing in
`tsdown` `CLIENT_EXTERNALS` (never bundle), and they must keep a
**devDependency** in `package.json` when the plugin's own source imports types
from them, because TypeScript resolves *other* packages' `.d.ts` imports of
them through the plugin's install.

Per-package disposition for the version bump (measured, not assumed):

| Seed word | Installed in the `dsh` tree? | Plugin devDependency? |
|---|---|---|
| `@deepseek-ai/dsh-client-ui-primitives` | no (shell singleton) | **must keep** — `src/client/tree.tsx:29-33` imports the three icons as values |
| `@deepseek-ai/dsh-client-ui-slots` | no (shell singleton) | **must keep** — `PropsRuntime` is imported directly (`panel.tsx:16`, `subagents-tab.tsx:19`) *and* other packages' `.d.ts` resolve it from the plugin's install |
| `@deepseek-ai/dsh-client-store` | no (shell singleton) | **not needed** — the plugin imports no store symbol; verified by typechecking the §9.2 sandbox with the store link removed (`exit 0`). Today's manifest is already correct in omitting it |
| `@deepseek-ai/dsh-client-ui-dockkit` | no (shell singleton) | **only if** the new code imports its types directly; otherwise take `PaneId`/`TabRecord` through `@deepseek-ai/dsh-client-ui-sidebar-right/client`'s re-export (`NEW/…/client/index.d.ts:34`) and add nothing |

---

## 2. Verdict summary

| # | Symbol / surface used by the plugin | Verdict |
|---|---|---|
| H1 | `Context` (`@deepseek-ai/cordis`) + `ctx.effect/on/get/logger` | **unchanged** (cordis 4.0.2 both, byte-identical) |
| H2 | `ctx.sessions` (`SessionStore`), `Session.header.parentSession` | **unchanged** |
| H3 | `Session.ownEvents()`, `SessionHeader.isSeeded` | **unchanged** |
| H4 | `SessionLogOffset`, `SessionId`, `Session`, `SessionEvent`, `SessionHeader` | **unchanged** |
| H5 | `ctx.subagents`, `listDescendants()` + `SubagentDescendantListEntry` | **unchanged** |
| H6 | `subagent/start` / `subagent/end` payloads (`SubagentRunInfo` / `SubagentRunEndInfo`) | **unchanged** |
| H7 | `ctx.webServer.register({kind,path,handler})` | **unchanged** (byte-identical package) |
| H8 | `ctx.sessionProjections.register/snapshot/cachedSnapshot` | **unchanged** (runtime diff is doc-only) |
| H9 | `@deepseek-ai/dsh-session-projection/types` merge (`SessionProjectionMap`, `SessionProjectionStateMap`) | **unchanged** |
| H10 | `ctx.sessionProjectionCache.cachedSnapshot/coldSnapshot`, `SessionLogSnapshot.inheritedEventCount` | **signatures unchanged**, **behaviour changed** (format-version identity, §3.2) |
| H11 | `sessionQuery.listSessions/readSession`, service names `sessionQuery`/`sessionProjectionCache` | **unchanged** |
| H12 | projection keys read: `tokenUsage`, `subagentTiming`, owned `subagentOutcome` | **unchanged** (`subagentCatalog` added, unused) |
| H13 | `dsh.bundle.patch` + `cordis.patch.yml` `insert:` row | **unchanged** (`applyEntryPatches` byte-identical) |
| C1 | `ctx.slots` / `ctx.slots.inject` / `ctx.slots.register` (`@deepseek-ai/dsh-client-ui-renderer/client` + `-slots`) | **unchanged** |
| C2 | `sidebar.footer.action` + `SidebarFooterActionOwnerProps.wide` | **unchanged** |
| C3 | `conversation.view` + `ConvViewOwnerProps` | **unchanged** |
| C4 | `useSessions`, `SessionListState.current/currentAddress`, `ISessions.open/openSubagent` | **unchanged** |
| C5 | `ctx.layout.toggleSidebar()` | **unchanged** |
| C6 | `PropsRuntime`, `SlotMap`, `LocaleNamespaceMap` | **unchanged** (additions only) |
| C7 | `IconChevronRightOutline14`, `IconFolderClose16`, `IconFolderOpen16` | **unchanged** |
| C8 | `ctx.sessions` (client context) | **unchanged** |
| C9 | `@deepseek-ai/dsh-client-ui-layout/client` `conversation` / `details` slots, `openDetails/closeDetails` | **removed** (replaced by `main` / `rightbar`, `openRightbar/closeRightbar`) — *unused by the plugin* |
| C10 | `@deepseek-ai/dsh-client-ui-sidebar-right` seats, `ctx.sidebarRight`, `ctx.sidebarRightTabs` | **new** (needed for the rightbar target) |
| C11 | `@deepseek-ai/dsh-client-ui-dockkit` (`PaneId`, `TabRecord`, …) | **new seed word** (used by rightbar types) |
| E1 | Browser seed table | **changed**: 8 words → same 8 **+** `@deepseek-ai/dsh-client-ui-dockkit` |
| E2 | Browser module system (`dsh-client-modules` client half) | **byte-identical** |
| E3 | `dsh.client.external` | **not new** (exists in 0.1.2-rc.1 too); declares a graph **edge** consumed by host row ordering and browser arrival — optional for this plugin (§5.3, R9) |

---

## 3. Host half — `src/index.ts`

### 3.1 Unchanged symbols (evidence)

| Plugin use (src line) | Symbol | OLD evidence | NEW evidence |
|---|---|---|---|
| `src/index.ts:17` | `Context` from cordis | `OLD/cordis/lib/index.d.ts` (package 4.0.2) | `NEW/cordis/...` same version; `lib/index.js` byte-identical (`diff` = 0 lines) |
| `src/index.ts:18,510,536` | `SessionLogOffset` (value) | `OLD/dsh-session/lib/types/types.d.ts:27` | `NEW/dsh-session/lib/types/types.d.ts:27` |
| `src/index.ts:19` | `Session`, `SessionEvent`, `SessionHeader`, `SessionId` | `OLD/dsh-session/lib/types/index.d.ts`, `.../types.d.ts` | same declarations, line drift only |
| `src/index.ts:205` | `SessionHeader.parentSession` | `OLD/…/types.d.ts:73` | `NEW/…/types.d.ts:71` |
| `src/index.ts:403` | `Session.ownEvents()` | `OLD/dsh-session/lib/types/index.d.ts:189` | `NEW/…/index.d.ts:192` |
| `src/index.ts:511` | `SessionHeader.isSeeded` | `OLD/…/types.d.ts:78` | `NEW/…/types.d.ts:76` |
| `src/index.ts:20` | `SubagentRunInfo`, `SubagentRunEndInfo` | `OLD/dsh-subagent/lib/types/types.d.ts:30` / `:49`; re-exported `index.d.ts:57` | `NEW/…/types.d.ts:74` / `:93`; `index.d.ts:56`. Field sets are **identical** (runId/provider/id/local, +`stopReason`, +`lastAssistantMessage?`) |
| `src/index.ts:263-264` | events `subagent/start`, `subagent/end` | `OLD/dsh-subagent/lib/types/index.d.ts:86,95` | `NEW/dsh-subagent/lib/types/index.d.ts:85,94` — same event names, same payload types |
| `src/index.ts:307-309,805-807` | `ctx.subagents.listDescendants(id)` | `OLD/dsh-subagent/lib/types/list-children.d.ts:64`; `ctx.subagents` at `index.d.ts:61`; entry type `list-children.d.ts:28` (`SubagentDescendantListEntry = SubagentListEntry & {parentId, depth}`) | `NEW/…/list-children.d.ts:64`, `:28`, `index.d.ts:60`/`:217` — `diff` of `list-children.d.ts` = **0 lines**; `SubagentListEntry` (`control-types.d.ts:30-70` both trees) identical |
| `src/index.ts:341-344,882,896-902` | catalog fields `kind/label/mode/depth/parentId/activity/hasChildren/reason` | `OLD/dsh-subagent/lib/types/control-types.d.ts:30-70` | `NEW/…/control-types.d.ts:30-70` (diff = 11 lines, all comment/export drift) |
| `src/index.ts:997,1019` | `ctx.webServer.register({kind:'exact',path,handler})` | `OLD/dsh-host-webserver/lib/types/index.d.ts:17` (`webServer: WebServer`), `:90` (`register(route: WebRoute): () => void`), `:33` (`kind: 'exact' \| 'prefix'`) | identical line numbers; whole `lib/types/index.d.ts` **and** `lib/index.js` byte-identical (`diff` = 0 lines) |
| `src/index.ts:271-294` | `ctx.sessionProjections.register({key,stateVersion,stateSchema,init,apply,wire})` | `OLD/dsh-session-projection/lib/types/index.d.ts:25,37-79,150-159` | `NEW/…/index.d.ts:25,37-79,150-159` — identical; runtime `lib/index.js` diff = 26 lines, **doc comments only** |
| `src/index.ts:632,639` | `.snapshot(live, keys)`, `.cachedSnapshot(live, keys)` | `OLD/…/index.d.ts:185,194` | `NEW/…/index.d.ts:185,194` |
| `src/index.ts:52-59` | `declare module '@deepseek-ai/dsh-session-projection/types'` | `OLD/dsh-session-projection/package.json` `exports["./types"]`; `types.d.ts` diff = 0 lines | `NEW/…/package.json` same subpath; `types.d.ts` diff = 0 lines |
| `src/index.ts:466,487-490,512-516,723-724` | `ctx.get('sessionQuery')`, `listSessions()`, `readSession(id)` | `OLD/dsh-session-query/lib/types/index.d.ts:23,65,72` | `NEW/…/index.d.ts:25,67,74` — same signatures |
| `src/index.ts:40,523,704` | `SessionLogSnapshot.inheritedEventCount` | `OLD/dsh-session-query/lib/types/types.d.ts:34-41` | `NEW/…/types.d.ts:34-41` (identical shape) |
| `src/index.ts:470,546,682` | `ctx.get('sessionProjectionCache')`, `.cachedSnapshot(meta, inheritedEventCount, keys)`, `.coldSnapshot(meta, count, events).values` | `OLD/dsh-session-projection-cache/lib/types/index.d.ts:90,124` | `NEW/…/index.d.ts:90,144` — same signatures |
| `src/index.ts:271,996,1018` | `ctx.effect(fn, label)` | cordis 4.0.2 | cordis 4.0.2 (identical) |
| `src/index.ts:415,495,1010` | `ctx.logger.warn` | cordis 4.0.2 | cordis 4.0.2 (identical) |
| `src/index.ts:187` | `export const inject = ['sessions','subagents','webServer','sessionProjections']` | all four service names declared in `OLD` | all four declared identically in `NEW` (`dsh-session/lib/types/index.d.ts` `sessions`, `dsh-subagent/…/index.d.ts:60`, `dsh-host-webserver/…/index.d.ts:17`, `dsh-session-projection/…/index.d.ts:25`) |
| `src/index.ts:777-780` | `tokenUsage` wire view (4 buckets) | `PUB`-aux: `dsh-token-meter@0.1.2-rc.1` `lib/types/usage-projection.d.ts:121-127` | `NEW/dsh-token-meter/lib/types/usage-projection.d.ts:70-74` — same 4 fields |
| `src/index.ts:781-787` | `subagentTiming` view (`settledMs`, `active{since,through}`) | `OLD/dsh-subagent/lib/types/projection-types.d.ts:9-18` | `NEW/…/projection-types.d.ts:20-29` — identical |
| `src/index.ts:279-285` | `turn/end` `reason.kind` values | `OLD/dsh-session/lib/types/types.d.ts:161-195` | `NEW/…/types.d.ts:165-201` — same variants `completed/aborted/blocked/error/max-tokens/interrupted` (`refusal` exists in neither) |

**Conclusion:** no host-half symbol changed in a way that touches this plugin.
The 0.1.5-rc.2 host half still compiles against the current `src/index.ts`
(proved by experiment, §9).

### 3.2 Changed host-side behaviour that reaches the plugin's cold path

**(1) Session format version 0 → 3.** `NEW/dsh-session/lib/types/types.d.ts:54`
(`SESSION_FORMAT_VERSION = 3`) vs `OLD/dsh-session/lib/types/types.d.ts:55`
(`= 0`). The plugin never
reads `SESSION_FORMAT_VERSION` or `header.version` itself, so this is not a
compile break — but see (2).

**(2) Projection-cache identity now includes the format generation.**
`NEW/dsh-session-projection-cache/lib/index.js:361-371` `identityOf()` returns
`formatVersion: header.version` (line 365; schema field at `:49`); `OLD/…/index.js:321-329`
had no such field. `identityMatches()` (NEW `:379-381`) **refuses an absent format
generation**, and the domain spec moved `version: 5 → 7`,
`compatibleVersions: [3,4] → [3,4,5,6]` (NEW `:88-99`, OLD `:87-88`).

Consequence for this plugin: every projection-cache row written by a 0.1.2-rc.1
install lacks `formatVersion`, so `ctx.sessionProjectionCache.cachedSnapshot()`
(`src/index.ts:682`) returns `undefined` for **every** pre-upgrade cold session
until that session is refolded once. The plugin already has the recovery rung for
this: `src/index.ts:699-706` falls through to a memoized `coldSnapshot`
(`src/index.ts:704`), which writes a refreshed, format-stamped checkpoint back so
later polls take the cheap path. Net effect = *one full log read per cold session
after the upgrade* (degradation, not data loss). Tracked as risk **R2**.

**(3) Cold-log reads still work for v0 logs.** The runtime tree ships
`dsh-session-format-v0-to-v1`, `dsh-session-format-v1-to-v2`,
`dsh-session-format-v2-to-v3`, `dsh-session-format-v1-to-v2`… (see
`ls /opt/homebrew/.../@deepseek-ai | grep dsh-session-format`), i.e. stored v0
logs are migrated on read by `sessionQuery.readSession()`. The plugin's
`SessionLogSnapshot` use (`src/index.ts:40,523`) is unchanged.

**(4) Removed but unused:** `dsh-session` dropped the `./chunk-rows` export
subpath and the `decodeStorageRecord`/`packChunkRuns`/`ChunkRow`/`StorageRecord`
exports (`OLD/dsh-session/package.json` `exports["./chunk-rows"]`,
`OLD/dsh-session/lib/types/index.d.ts` lines 15-18 vs `NEW/…` absent). The plugin
never imports them. `dsh-session` also changed `Session.fromRestore()` to take a
fifth `eventState` argument (NEW `lib/types/index.d.ts:169`) — not used by the
plugin.

---

## 4. Browser half — `src/client/*`

### 4.1 Imports the plugin makes (all type-only except the icons)

| src file:line | Specifier | Verdict | Evidence |
|---|---|---|---|
| `src/client/index.ts:12`, `panel.tsx` | `@deepseek-ai/cordis` (`Context`) | unchanged | cordis 4.0.2 identical |
| `src/client/index.ts:13`, `panel.tsx:13`, `subagents-tab.tsx:24` | `@deepseek-ai/dsh-session/types` (`SessionId`) | unchanged | `OLD/…/types.d.ts` vs `NEW/…/types.d.ts`: `SessionId = Branded<'SessionId'>` present in both; `dsh-session/package.json exports["./types"]` unchanged |
| `src/client/index.ts:14`, `panel.tsx:14`, `subagents-tab.tsx:25` | `@deepseek-ai/dsh-subagent/client` (`SubagentAddress`) | unchanged | `OLD/dsh-subagent/lib/types/control-types.d.ts:77-84` == `NEW/…:77-84`; `client.d.ts` diff = 10 lines, additive only (`SubagentCatalogEntry`) |
| `src/client/index.ts:18` | `@deepseek-ai/dsh-client-ui-renderer/client` | unchanged | `OLD/…/lib/types/client/*.d.ts` vs `NEW/…`: **0 diff lines for every file** (`app/bind/bindings/index/registry/scoped-slots`) |
| `src/client/index.ts:19`, `panel.tsx:19` | `@deepseek-ai/dsh-client-ui-session/client` | unchanged | same file set both trees; every file diff = 0 lines (`index.d.ts`, `session-provider.d.ts`) |
| `src/client/subagents-tab.tsx:20` | `@deepseek-ai/dsh-client-ui-conversation/client` (adds `conversation.view` to `SlotMap`) | slot **unchanged** (package else heavily changed) | `OLD/…/contract/slots.d.ts:111` vs `NEW/…:157` — identical entry `{kind:'list',scope:'session',owner:ConvViewOwnerProps}`; `OLD/…:237-244` == `NEW/…:288-295` for `ConvViewOwnerProps`/`ConvViewProps`. New sibling slots `main.conversation`, `conversation.session.header.corner` |
| `src/client/panel.tsx:15` | `@deepseek-ai/dsh-api-session-controller/client` (`SessionListState`) | unchanged | `OLD/…/sessions/service.d.ts:61-79` == `NEW/…:61-79` line-for-line; `client/contract/sessions.d.ts` diff = **0 lines**; `client/sessions/service.d.ts` diff = **0 lines** |
| `src/client/panel.tsx:16`, `subagents-tab.tsx:19` | `@deepseek-ai/dsh-client-ui-slots` (`PropsRuntime`) | unchanged | `OLD/…/index.d.ts:191` vs `PUB/…/index.d.ts:199` — identical alias; `store.d.ts`/`renderer.d.ts` diff = **0 lines**; only `ResourceProtocolMap` was added |
| `src/client/index.ts:23` | client `inject = ['slots','sessions','layout']` | services all unchanged | `slots` (`ui-renderer/client/index.d.ts:26`), `sessions` (`api-session-controller/client/index.d.ts:20`), `layout` (`ui-layout/client/index.d.ts:16-19`) |
| `src/client/tree.tsx:29-33` | `@deepseek-ai/dsh-client-ui-primitives` icons | unchanged | `OLD/…/lib/types/icons/index.d.ts:35,121,123` vs `PUB/…:35,122,124` — same names, same `(props: IconProps) => JSX.Element` |

### 4.2 Slot registrations the plugin performs

| src line | Registration | Verdict | Evidence |
|---|---|---|---|
| `src/client/index.ts:491-502` | `ctx.slots.inject('sidebar.footer.action', …)` + `ctx.slots.register({name:'sidebar.footer.action', id:'subagent-view', order:100, inject:()=>({toggleSidebar})}, SubagentViewBarPanel)` | **unchanged** | `OLD/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:58` vs `NEW/…:69` — `{kind:'list', scope:'root', owner:SidebarFooterActionOwnerProps}`; `OLD/…:94-97` == `NEW/…:121-124` (`wide: boolean`) |
| `src/client/index.ts:509-524` | `ctx.slots.inject('conversation.view', …)` + register with `label:'Subagents'`, `order:30`, `inject:(sessionId)=>({open, openSubagent})` | **unchanged** | see row above; `PropsRuntime<'conversation.view'>` alias unchanged (`OLD/…:246` vs `NEW/…:297`) |
| `src/client/index.ts:498` | `ctx.layout.toggleSidebar()` | **unchanged** | `OLD/dsh-client-ui-layout/lib/types/client/service.d.ts:23` (`ILayout.toggleSidebar`) vs `NEW/…:37` |
| `src/client/index.ts:30-489` | `ctx.effect` + `<style data-plugin>` | unchanged | cordis + `dsh-client-modules` `claimStyles` (byte-identical client half) |
| `src/client/index.ts:28,508` | `ctx.sessions` (client) | unchanged | `OLD/dsh-api-session-controller/lib/types/client/index.d.ts:20` == `NEW/…:20` (`sessions: ISessions`) |
| `src/client/panel.tsx:220-223` | `props.useSessions`, `select.current`, `select.currentAddress.parentSessionId` | unchanged | `OLD/dsh-client-ui-session/lib/types/client/index.d.ts:37` == `NEW/…:37`; `SessionListState.current`/`currentAddress` at `:66`/`:78` both trees |
| `src/client/panel.tsx:314,442` | `sessionsSvc.open(id)`, `openSubagent(address)` | unchanged | `OLD/api-session-controller/…/service.d.ts:156,161` == `NEW/…:156,161` |
| `src/client/panel.tsx:213-218` | `PropsRuntime<'sidebar.footer.action'>` + `wide` | unchanged | as above |
| `src/client/subagents-tab.tsx:293-301` | `PropsRuntime<'conversation.view'>` + `sessionId` | unchanged | `SessionStandardProps.sessionId` at `OLD/…/session/client/index.d.ts:45` == `NEW/…:45` |

### 4.3 Removed / replaced (not used by the plugin, but they are the *reason* the rightbar work exists)

`@deepseek-ai/dsh-client-ui-layout/client`:

| OLD | NEW |
|---|---|
| `'conversation'` single/session-maybe slot (`OLD/…/client/index.d.ts:48`) | **removed**; replaced by keyed `'main'` (root scope, `NEW/…:48`) with `'main.conversation'` declared by ui-conversation |
| `'details'` single/session slot (`OLD/…:62`) | **removed**; replaced by `'rightbar'` single/root with `RightbarOwnerProps` (`NEW/…:65`, `NEW/…:94`) |
| `ILayout.openDetails()/closeDetails()` (`OLD/…/service.d.ts:25,43`) | **removed**; `openRightbar(track, fullscreen)` / `closeRightbar()` (`NEW/…/service.d.ts:45,68`), plus `selectPanel()`/`beginNavigation()` |
| — | `GlobalStandardProps.usePanelInfo`, `MainPanelId`, `PanelInfo`, `UsePanelInfo` added |

`@deepseek-ai/dsh-client-ui-sidebar/client`: `'sidebar.panellist'` +
`SidebarPanelIconOwnerProps` + `SidebarPanelMetadata` added
(`NEW/…/contract/slots.d.ts:33-45,86-101`); `'sidebar.footer.action'` untouched.

**Cross-check #4 (left bar stays the user-facing way in).** Both seats the current
left-bar panel depends on still exist at 0.1.5-rc.2: `sidebar.footer.action` is
still `{kind:'list', scope:'root'}` with owner
`SidebarFooterActionOwnerProps { wide: boolean }`
(`NEW/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:69` and
`:121-124`), declared/rendered by the same shell package, and
`ctx.layout.toggleSidebar()` still exists on `ILayout`
(`NEW/dsh-client-ui-layout/lib/types/client/service.d.ts:37`). The rail button
(`panel.tsx:384-398`) and the expanded bar/panel (`panel.tsx:423-502`) therefore
keep working unchanged, so the left sidebar remains a valid user-facing entry
point alongside the new rightbar tab.

---

## 5. Browser module table, `dsh.client.inject` and `CLIENT_EXTERNALS`

### 5.1 The seed table of the shipped frontend (authoritative)

`FRONT` (0.1.5-rc.2), line 114, factory `by()` used as
`staticModules: by()` in the boot kernel:

```js
function by(){return{react:ec,"react/jsx-runtime":ic,"react-dom":cc,"react-dom/client":fc,
"@deepseek-ai/cordis":Ha,"@deepseek-ai/dsh-client-store":Hc,
"@deepseek-ai/dsh-client-ui-slots":Ac,"@deepseek-ai/dsh-client-ui-primitives":Zg,
"@deepseek-ai/dsh-client-ui-dockkit":Ey}}
```

`FRONT-OLD` (0.1.2-rc.1), line 107, factory `zp()`:

```js
function zp(){return{react:q5,"react/jsx-runtime":Y5,"react-dom":n6,"react-dom/client":o6,
"@deepseek-ai/cordis":M5,"@deepseek-ai/dsh-client-store":M6,
"@deepseek-ai/dsh-client-ui-slots":T6,"@deepseek-ai/dsh-client-ui-primitives":Fp}}
```

**Delta: `@deepseek-ai/dsh-client-ui-dockkit` added; nothing removed.**

The browser module system itself is unchanged: `dsh-client-modules`' **client
half is byte-identical** between the published 0.1.2-rc.1 tarball and the
installed 0.1.5-rc.2 package (`diff` = 0 lines). Its contract (citations from
`NEW/dsh-client-modules/lib/client.js`):

* `require(spec)` → seed table first (`:300-303`), then a materialized module by
  id with a trailing `/client` stripped (`:304-306`), then a registered factory
  (`:307`), else a loud throw (`:308`).
* arrival order (`:253-269`): `row.external` dependencies, then `row.inject`
  package rows, then the row itself; **seed words are skipped**; non-graph names
  in either list are silently ignored (`graphRows.get(...) === undefined`).
* A require of `<pkg>` or `<pkg>/client` is answered by the *arrived* factory, so
  a graph row may only be required after its inject ordering placed it first.

`NEW/dsh-client-modules/lib/index.js` (host) composes a row per `dsh.client`
package: `parseDshClient` (`:140-152`, `platform` must be a string, `inject`
`external` `immediately` optional), `graphRow` (`:329-337`), graph ordering
`:349-372`, and requires `exports["./client"]` to exist (`:649-660`). The plugin's
declaration satisfies all of this today (`package.json:15,24-27`,
`exports["./client"]` at `package.json:10`), and the only host-half drift is
`static inject = ["webServer","loader"] → ["loader"]` plus a new optional
`fetchBundle` — no plugin impact.

### 5.2 Runtime requires of the plugin today

`lib/client.js` (built with the pinned `0.1.2-rc.1` toolchain) requires exactly:

```
require("react")                                  // seed word, both versions
require("react/jsx-runtime")                      // seed word, both versions
require("@deepseek-ai/dsh-client-ui-primitives")   // seed word, both versions
```

All three are answered in 0.1.5-rc.2 **unchanged**. (The registration id is
`window.__ModuleLoader__.load({id:"subagent-view", …})`, one call, same protocol.)

### 5.3 `dsh.client.inject` — exact deltas

`dsh.client.inject` is a **graph-arrival list** no longer (and never was) a
"preload these packages" list. Each entry is matched verbatim against graph row
ids (`NEW/dsh-client-modules/lib/client.js:265-268`), i.e. `@deepseek-ai/<pkg>`
of a package whose `package.json` has `dsh.client` **and** `exports["./client"]`.
Four rules worth stating exactly (cross-checked against the captain's reviewer
notes, with one wording correction):

* **Write bare package names.** The lookup is verbatim — `graphRows.get(packageName)`
  with no `/client` stripping and no seed check (`client.js:265-268`) — so a
  `<pkg>/client` entry is inert. Subpath entries are *not* rejected at parse
  time: `parseDshClient` validates only "string array" (`index.js:142-152`), and
  `exactPackageSpecifier` (`index.js:132-138`) governs how a **Loader entry
  name** locates its `package.json` (`index.js:682`), not how an `inject` entry
  is validated.
* **A name with no graph row is silently skipped** (`if (dependency !== void 0)`,
  `client.js:267`) — no throw, no warning; that is why the current
  `@deepseek-ai/dsh-client-ui-primitives` entry is inert rather than an error.
* **`inject` does not order the host graph.** `orderByModuleGraph`
  (`index.js:349-372`, cycle and self-edge rejection included) reads only
  `entry.external`; `inject` is consumed at arrival/materialization time
  (`client.js:265-268`) so a requested row is registered before its consumer is
  materialized.
* **Seed words in `inject` are skipped exactly like non-rows** (no `seed.has`
  branch is reached on that path), so they can never be "preloaded" through this
  field.

Current list (`package.json:16-23`) and verdict:

| Entry | Graph row in 0.1.5-rc.2? | Action |
|---|---|---|
| `@deepseek-ai/dsh-client-ui-renderer` | yes (`dsh.client`, `immediately`) | keep — provides `ctx.slots` |
| `@deepseek-ai/dsh-client-ui-session` | yes | keep — session standard kit (`useSessions`, `sessionId`) |
| `@deepseek-ai/dsh-client-ui-conversation` | yes | keep — declares `conversation.view` |
| `@deepseek-ai/dsh-client-ui-sidebar` | yes | keep — declares `sidebar.footer.action` |
| `@deepseek-ai/dsh-client-ui-layout` | yes | keep — provides `ctx.layout` |
| `@deepseek-ai/dsh-client-ui-primitives` | **no** (no `dsh.client`, no `lib/client.js`; it is a seed word) | **MOVE OUT** — it is a no-op entry (ignored), misleading; runtime resolution comes from the seed table |
| `@deepseek-ai/dsh-client-ui-sidebar-right` | **yes** (new) | **MOVE IN** — declares `rightbar.session` (`NEW/…/contract/slots.d.ts:14`), `sidebar.right.pane.tab` (`:26`, body dispatched by the type id), `sidebar.right.pane.tab.title` (`:40`), `sidebar.right.tab.guide` (`:51`), `sidebar.right.tab.menu.item` (`:66`); provides `ctx.sidebarRightTabs` + `ctx.sidebarRight` (`NEW/…/client/index.d.ts:40-46`) |
| `@deepseek-ai/dsh-api-session-controller` | yes | **ADD (recommended)** — provides `ctx.sessions`, which the client `inject` array already demands; today it is only reached transitively through ui-session/ui-conversation/ui-sidebar/ui-layout |
| `@deepseek-ai/dsh-client-ui-dockkit` | **no** (seed word) | never add here |
| `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots` | no (seed words) | never add here |

**Needed at runtime vs listed to match the reference contract.** The list is not
only "what our bundle requires". The shipped reference tab type
`@deepseek-ai/dsh-client-ui-sidebar-documentpreview` lists
`@deepseek-ai/dsh-client-ui-sidebar-right` in its `dsh.client.inject`
(`NEW/dsh-client-ui-sidebar-documentpreview/package.json` → `dsh.client.inject`
= `["@deepseek-ai/dsh-api-gateway", "@deepseek-ai/dsh-api-workspace-files",
"@deepseek-ai/dsh-client-ui-sidebar-right", "@deepseek-ai/dsh-client-ui-session",
"@deepseek-ai/dsh-api-remotes"]`), yet its factory-level requires are only
`react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives`,
`@deepseek-ai/dsh-client-store` — all seed words (`grep -o 'require("[^"]*")'`
over its `lib/client.js`; the single `require("url")` sits at offset 403216
inside a lazily reached Node-only PDF.js branch and never executes in the
browser). The entry exists so the sidebar-right **row** (its declared slots and
the `sidebarRight*` services) arrives before the consumer materializes — that is
the same reason this plugin must list it. Corollary: a **type-only** import emits
no `require`, so "we import its types" and "we need it in the graph" are
different claims; the graph entry is required because the new body binds slots
and/or services the row declares, not because of the import kind.

One more distinction that matters for the new work: a graph entry guarantees
**arrival**, not **activation**. Arrival registers the row's bundle factory
(`client.js:234-251`) and the row is then its own loader entry; if the
deployment's browser roster omits that row, the package never activates and its
services are never provided — which is exactly the boot-fatal case dissected in
R3(b).

### 5.4 `tsdown` `CLIENT_EXTERNALS` — exact deltas

The rule to preserve: `CLIENT_EXTERNALS` must be a **subset of the served id
set** (seed words ∪ arrived graph rows) and a **superset of every specifier the
built bundle requires**. Today's list (`tsdown.config.ts:22-31`) is 8 seed words,
all still served in 0.1.5-rc.2:

| Entry | Action |
|---|---|
| `react`, `react/jsx-runtime` | keep (required at runtime) |
| `react-dom`, `react-dom/client` | keep (served; not currently required) |
| `@deepseek-ai/cordis` | keep (served) |
| `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots` | keep (served; type-only today) |
| `@deepseek-ai/dsh-client-ui-primitives` | **keep** (required at runtime; still a seed word) |
| `@deepseek-ai/dsh-client-ui-dockkit` | **add only if** the migrated client code imports a *runtime value* from it (types are erased and need no entry). It is a seed word, so a require would be satisfiable. Prefer type-only imports (dockkit types are re-exported by `NEW/dsh-client-ui-sidebar-right/lib/types/client/index.d.ts:34`), in which case **no** entry is needed |
| any `@deepseek-ai/*/remote` | unchanged catch-all (`tsdown.config.ts:40`) |

**Reconcile instruction for `tsdown.config.ts` (do both).** (i) Fix the comment at
`:14-20` **regardless** of whether the list changes: it still names the
0.1.2-rc.1 seed table; write the 9-word 0.1.5-rc.2 table of §5.1. (ii) Add
`'@deepseek-ai/dsh-client-ui-dockkit'` to `CLIENT_EXTERNALS` **iff** the migrated
client code contains a runtime (value) import of it; a type-only import is erased
by the build and needs no entry (preferred — dockkit types are re-exported by
`NEW/dsh-client-ui-sidebar-right/lib/types/client/index.d.ts:34`) — in that case
the existing 8-entry list is already exactly right and only the comment changes.
After the build, re-run the externals audit: every `require("…")` in
`lib/client.js` must be a seed word (§5.1) or an arrived graph row
(`NEW/dsh-client-modules/lib/client.js:300-308`).

### 5.5 The two "inject" surfaces are different things (do not conflate)

| Surface | File | Meaning |
|---|---|---|
| `dsh.client.inject` | `package.json:16-23` | host-composed browser **graph arrival** for other `dsh.client` packages; wrong entries are ignored, missing ones cause a runtime activation wait |
| `export const inject` | `src/client/index.ts:23` | **cordis service** dependencies of the client plugin; a missing service silently blocks activation of the whole client half |
| `export const inject` | `src/index.ts:187` | cordis service dependencies of the host half (`sessions`, `subagents`, `webServer`, `sessionProjections`) — all unchanged |

For the rightbar target, the *service* names to consider are `sidebarRightTabs`
(stage-1 tab-type registry) and `sidebarRight` (navigation/presentation). Hard-
adding them to `src/client/index.ts:23` makes plugin activation **gated on the
rightbar being mounted in the deployment** — and, as R3(b) now proves from the
shipped shell, a pending entry is **boot-fatal** (the whole app fails to mount),
not merely degraded. Prefer the callback form
`ctx.inject(['sidebarRightTabs'], cb)` (`cordis/lib/types/registry.d.ts:103-116`)
or the non-requiring read `ctx.get('sidebarRightTabs')`
(`cordis/lib/types/reflect.d.ts:6-16`) for the new work, and keep the left-panel
registration unconditional. See R3.

---

## 6. Prioritized change list (target → `src/` file:line)

Severity: **P0** = required for the plugin to load/behave on 0.1.5-rc.2 ·
**P1** = required for the rightbar tab deliverable · **P2** = correctness/hygiene.

| # | Pri | Change | Target |
|---|---|---|---|
| 1 | P0 | Bump every pinned `@deepseek-ai/*` devDependency `0.1.2-rc.1 → 0.1.5-rc.2`; leave `@deepseek-ai/cordis` at `4.0.2` | `package.json:66-80` |
| 2 | P0 | Resolve the zod question (R1): either confirm a single installed zod (both the plugin's `^4.4.3` and the platform's `^4.4.3` dedupe), or raise the plugin's dependency to `^4.6.2` so plugin and platform share one zod — **DONE (0.1.5 follow-up pass)**: neither branch was needed once the bundle was measured to inline zod and import nothing from it at runtime; `zod` moved from `dependencies` to `devDependencies`, which removes the two-copy install shape entirely. See §7 R1 | `package.json` `devDependencies` |
| 3 | P0 | `dsh.client.inject`: remove `@deepseek-ai/dsh-client-ui-primitives`; add `@deepseek-ai/dsh-client-ui-sidebar-right`; add `@deepseek-ai/dsh-api-session-controller` (recommended) | `package.json:16-22` |
| 4 | P0 | Keep `@deepseek-ai/dsh-client-ui-primitives` and `@deepseek-ai/dsh-client-ui-slots` as devDependencies: `tree.tsx:29-33` resolves icons through them at build time, and **other** platform packages' `.d.ts` resolve `slots`/`store` from the plugin's install | `package.json:69,73` |
| 5 | P0 | Add devDependency `@deepseek-ai/dsh-client-ui-sidebar-right@0.1.5-rc.2` (types for the new registration) | `package.json:64-80` |
| 6 | P0 | **Reconcile `tsdown.config.ts`:** fix the `:14-20` comment regardless (it still names the 0.1.2-rc.1 table — write the 9-word 0.1.5-rc.2 table); keep every existing `CLIENT_EXTERNALS` entry; add `dockkit` only if a runtime value import exists | `tsdown.config.ts:14-20,22-31` |
| 7 | P0 | No source change needed for host-half drift: `src/index.ts:16-40,187,263-264,271-294,307-309,466-470,632-704,997,1019` all still bind. Verify with `pnpm install && pnpm typecheck && pnpm build` | `src/index.ts` (verify only) |
| 8 | P0 | No source change needed for the left panel — it stays the user-facing way in: `sidebar.footer.action` (list/root, owner `{wide}`) + `ctx.layout.toggleSidebar()` both still exist at 0.1.5-rc.2 | `src/client/index.ts:491-502` (registration), `src/client/index.ts:498` (`ctx.layout.toggleSidebar()`), `panel.tsx:214,218,384-398,423-502` (rail + bar/panel) |
| 9 | P1 | Register the rightbar tab type (stage 1) and its body (stage 2, keyed `sidebar.right.pane.tab` under the definition `id`) using **type-only** imports from `@deepseek-ai/dsh-client-ui-sidebar-right/client` | new code; near `src/client/index.ts:509` |
| 10 | P1 | Move the monitor content (the `SubagentsView` body and its tree/archived components) behind the new registration while keeping the left-panel parity surface; **no** runtime import from sidebar-right/dockkit, so `lib/client.js` keeps exactly its 3 requires | `src/client/subagents-tab.tsx:300-527`, `tree.tsx` |
| 11 | P1 | Provide the user-facing open path (a button/action calling `ctx.sidebarRight.openTab(kind)` or the guide entry) and handle the mounted-seat precondition (R3) | `src/client/index.ts:491-502` / new code |
| 12 | P1 | Acquire `sidebarRightTabs`/`sidebarRight` **without** adding them to `export const inject` — use the callback form `ctx.inject([deps], cb)` or `ctx.get(...)`. A pending entry is **boot-fatal** in 0.1.5-rc.2 (the whole SPA fails to mount, R3b), so this is not a style preference | `src/client/index.ts:23` |
| 13 | P2 | The `conversation.view` registration is unchanged and still valid; if the product decides the rightbar tab replaces it, remove it here — otherwise leave it (parity requirement) | `src/client/index.ts:509-524` |
| 14 | P2 | Comment hygiene: the "under DSH 0.1.2-rc.1" notes and the `dsh-session-projection/lib/index.js:259` reference are still *factually* correct (verified: `viewSchema.parse` is unguarded at `NEW/…/lib/index.js:259`) but name an old version | `src/client/index.ts:7-11`, `src/client/subagents-tab.tsx:21-23`, `src/index.ts:562-579` |
| 15 | P2 | `cordis.patch.yml` needs no change (`insert:`-without-`id` semantics byte-identical) | `cordis.patch.yml:1-7` |

---

## 7. Risks static reading cannot settle (HYPOTHESIS + settling experiment)

> Each item is a **HYPOTHESIS**. "Settling experiment" is the smallest run that
> turns it into a fact.

**R1 — zod type identity across two installs (highest risk; can break
`pnpm typecheck`).**
HYPOTHESIS: the plugin's `zod@4.4.3` (`package.json:45`, lock-pinned) and the
platform's `zod` (the runtime install has **4.6.2**;
`dsh-session-projection/package.json` declares `zod: ^4.4.3`) can end up as two
different copies after the version bump; a zod-4.4.3 `ZodObject` is **not**
assignable to a zod-4.6.2 `ZodType` (4.6.x added `validate`/`validateAsync`), so
`ctx.sessionProjections.register({stateSchema, wire.viewSchema})` at
`src/index.ts:272-293` fails to compile.
*Direct probe (already run, reproducible in §9.3): `ZodObject<{stopReason:…}>`
(4.4.3) → `ZodType<…>` (4.6.2) = **TS2739 missing validate, validateAsync**.*
Settling experiment: after the devDependency bump run `pnpm install`, then
`ls node_modules/.pnpm | grep -E '^zod@'` (expect exactly one version) and
`pnpm typecheck`. If two versions appear, set `zod` to the platform's version
(`^4.6.2`) and re-run.

> **RESOLVED (0.1.5 follow-up pass).** The hypothesis was correct as a *static*-install hazard and is
> now removed at the source rather than papered over. Measured: the repo installs exactly one zod
> (`node_modules/.pnpm/zod@4.4.3`), the platform ships 4.6.2, and the host bundle contains **no**
> runtime zod import — `lib/index.js` has exactly one external import
> (`{ SessionLogOffset } from "@deepseek-ai/dsh-session"`) and inlines zod, so no zod object ever
> crosses the plugin/platform boundary at runtime. `zod` therefore moved from `dependencies` to
> `devDependencies`: it is build-time-only, and the two-copy install shape that produced TS2739 can
> no longer arise from this package's manifest. `pnpm typecheck` exit 0 and the bundle hashes are
> unchanged by the move.

**R2 — pre-upgrade projection-cache rows are unusable as fold shortcuts.**
HYPOTHESIS: because `checkpointIdentity` gained `formatVersion` and the domain
moved `5 → 7` (`NEW/dsh-session-projection-cache/lib/index.js:91-96,361-371,379-381`),
every cold session's first `/api/subagent-view/tab` poll after the upgrade pays
one `coldSnapshot` refold (`src/index.ts:699-706`); a session whose log cannot be
read then reports no projection values (status falls back to `unknown`) instead
of its durable outcome.
Settling experiment: keep a pre-upgrade `$DSH_HOME/storages/session_projcache`
document, start the new runtime, and poll
`/api/subagent-view/tab?sessionId=<cold-seeded>` twice; first response should show
a refold (values present, `error` absent), second should hit the stamped row. Do
the same for the sidebar route `/api/subagent-view/snapshot`.

**R3 — rightbar activation/open preconditions.**
HYPOTHESIS (a): `@deepseek-ai/dsh-client-ui-sidebar-right`'s `openTab` throws
`sidebarRight: no session surface is mounted` whenever the rightbar seat is not
mounted (no session or before the seat registers), so a plugin-initiated open
must be guarded.

**R3(b) is no longer a hypothesis — hard-injecting `sidebarRightTabs` is
boot-fatal, not silent.** Chain, all verified in the installed artifacts:

1. `src/client/index.ts:23`'s `export const inject` *is* the plugin-level inject:
   the bundle's exports object is the cordis plugin, and
   `cordis/lib/index.js:1634` builds the fiber with
   `Inject.resolve(plugin.inject)`; an unresolved name parks the fiber in
   `FiberState.PENDING` (`cordis/lib/types/fiber.d.ts:60-66`).
2. The shell asserts every loader entry after `loader.await()`: `assertEntriesActive`
   (`FRONT:114`, offsets 555185-555733) pushes
   `` `${name}: pending (waiting for services: ${Object.keys(fiber.inject)
   .filter(h => ctx.get(h) === undefined).join(", ")})` `` and throws
   `web boot: N entries did not activate`; `run()` catches it into
   `page.fail(...)` (`FRONT:114`, offset 554275) → the SPA renders "Failed to
   load plugins" and **never mounts**.
3. `dsh.client.inject` cannot prevent this: it orders bundle *arrival* only
   (`client.js:265-268`) and does not force-activate a provider row.
4. Nuance in our favour: `sidebar-right` provides both services
   **unconditionally** in `apply` — `ctx.reflect.provide("sidebarRightTabs", tabs)`
   / `("sidebarRight", controller)` (`NEW/dsh-client-ui-sidebar-right/lib/client.js:3667-3668`)
   — so when the row is composed there is no session/seat precondition for the
   *service*; the fatal case is a roster that omits the row entirely.

Repair (and the reason change-list item 12 is P1 rather than cosmetic): keep
`export const inject = ['slots','sessions','layout']` and acquire the rightbar
registry through the callback form
`ctx.inject(['sidebarRightTabs'], cb)` — "Run a callback once the requested
services are available … the callback is unloaded and re-run whenever a required
service changes" (`cordis/lib/types/registry.d.ts:103-116`, declaration at
`:111`) — or read it defensively with
`ctx.get('sidebarRightTabs')` — "Read a service from the store without the inject
requirement … `undefined` when not (yet) provided"
(`cordis/lib/types/reflect.d.ts:6-16`).
Settling experiment (end-to-end, still worth running): (a) click the open control
with no session selected and with a session selected — record whether the console
shows the `no session surface is mounted` throw, then with the rightbar collapsed;
(b) start a profile whose browser roster omits the `ui-sidebar-right` row
(dsh-web-app does mount it: `NEW/dsh-web-app/cordis.patch.yml`, `- id:
ui-sidebar-right`) and confirm the boot failure disappears with the callback form.

**R4 — the runtime seed table equals the shipped bundle's table.**
HYPOTHESIS: `FRONT:114` is the exact runtime answer set (nothing patches
`staticModules` through `__DSH_TRANSPORT__`/seams; `retainClientModules` is
unchanged).
Settling experiment: on a live page, evaluate the module table by requiring each
id the built `lib/client.js` uses — e.g. `window.__DSH_BOOT__.entries.map(e=>e.id)`
plus the seed words — or simply watch the console for
`require("…") missed the module table` (`NEW/dsh-client-modules/lib/client.js:308`).
The existing harness `.verify/module-table.mjs` already does this statically for
`lib/client.js`; its seed-table regex must be re-run against 0.1.5-rc.2.

**R5 — the left `conversation.view` tab still renders as before.**
HYPOTHESIS: the plugin's tab still appears (label/order intact) in the
Conversation's view strip even though the layout's `conversation` single slot was
replaced by the keyed `main` slot (`main.conversation`).
Settling experiment: load the GUI, assert the "Subagents" tab exists, is
selectable, and that `order:30` places it as before; assert no duplicate-id
warning on `SlotCore.register` (a second registration at the same priority/id
throws).

**R6 — keyed `sidebar.right.pane.tab` registration contract.**
HYPOTHESIS: registering the tab body requires the keyed slot's declared `inject`
face (`{hooks:{tabInfo}}`, `NEW/dsh-client-ui-sidebar-right/lib/types/client/contract/slots.d.ts:26-31`)
and the slot `key` equal to the definition `id`; a body that ignores `tabInfo`
must still declare it to typecheck.
Settling experiment: add a minimal registration to the new client code and run
`pnpm typecheck` (fast), then render it and confirm the body receives
`tabInfo` for the tab it is showing.

**R7 — v0 logs cold-read correctly under the new session format.**
HYPOTHESIS: `sessionQuery.readSession()` still yields a complete log plus the
exact `inheritedEventCount` for a 0.1.2-rc.1-era session (`SESSION_FORMAT_VERSION`
0 → 3), so `purpose` (`src/index.ts:399-418`) and the cold refold keep working.
Settling experiment: open a session created by the old runtime and assert the
`/api/subagent-view/tab` row for a cold child carries `purpose`, `tokens`,
`settledMs` and a terminal `status` rather than `unknown`.

**R8 — plugin HTTP routes stay reachable behind the new `/api` ownership.**
HYPOTHESIS: exact webserver routes (`/api/subagent-view/*`) keep winning over the
API gateway's `/api` prefix (dispatch checks `exact` first,
`NEW/dsh-host-webserver/lib/index.js:323,326`), and no trust fence rejects them.
Settling experiment: `curl -s 'http://127.0.0.1:3080/api/subagent-view/snapshot?sessionId=<id>'`
against a live instance and check for `200` + JSON with `rows`.

**R9 — `dsh.client.external` is not needed for this plugin.**
HYPOTHESIS: `dsh.client.external` declares **graph edges** — the host feeds them
to `orderByModuleGraph` (`NEW/dsh-client-modules/lib/index.js:349-372`, which also
rejects self-edges and cycles), and the browser consumes each entry in
`arriveGraphRow` (`NEW/dsh-client-modules/lib/client.js:259-264`) before the
consumer row. `dsh.client.inject` adds edges too, but keyed to *packages* (slot
and service providers), while `external` names the specifiers the bundle requires
(seed words are skipped). With no non-seed runtime require, the plugin can omit
`dsh.client.external` entirely; if the migrated body ever requires a graph row
(e.g. `@deepseek-ai/dsh-client-ui-sidebar-right/client`), put that specifier in
`external` *and* keep the package in `inject` so arrival ordering is explicit in
both directions.
Settling experiment: build, grep the requires in `lib/client.js`; if the only
requires are the seed words of §5.2, no `external` entry is needed and the bundle
is provably self-sufficient.

---

## 8. Residual unknowns / out of scope

* Whether the *shipped frontend* is rebuilt per deployment: `FRONT` is the
  installed artifact; a different deployment could ship another shell revision
  (same package version). §5.1 is authoritative for this install.
* Whether the 0.1.2-rc.1 runtime deployment also installed `primitives`/`slots`
  as node packages cannot be re-checked (the old global install was replaced);
  what matters is proven: (i) they were never `dsh.client` graph rows
  (`OLD/dsh-client-ui-primitives/package.json` has no `dsh` field), and (ii) they
  are served as seed words in both shells.
* The product decision of whether the rightbar tab *replaces* or *supplements*
  the current left-sidebar panel and the `conversation.view` tab is t1's contract
  (this document only fixes the mechanism and the ids).

---

## 9. Experiments run in this session (reproducible)

### 9.1 Baseline (pinned 0.1.2-rc.1)

```
$ ./node_modules/.bin/tsc -p tsconfig.json --noEmit      # exit 0
```

### 9.2 Current `src/` against the 0.1.5-rc.2 packages

Sandbox `.scratch/t2-typecheck`: a pnpm-like layout (`node_modules/@deepseek-ai/*`
→ virtual-store paths, `preserveSymlinks: true`, all runtime packages linked,
`primitives`/`slots`/`store`/`dockkit` from the published 0.1.5-rc.2 tarballs):

```
$ tsc -p .scratch/t2-typecheck/tsconfig.json --noEmit     # exit 0
```

**Result: the entire current `src/` (host + browser halves) typechecks unchanged
against 0.1.5-rc.2.** This is the strongest single piece of evidence in this
document: every symbol in §3–§4 that the plugin binds is present and
source-compatible.

### 9.2b Is `@deepseek-ai/dsh-client-store` needed as a devDependency?

```
$ mv .scratch/t2-typecheck/node_modules/@deepseek-ai/dsh-client-store <aside>
$ tsc -p .scratch/t2-typecheck/tsconfig.json --noEmit      # exit 0
```

**No.** The plugin imports no store symbol and `skipLibCheck` absorbs the
unresolved type references inside other packages' `.d.ts`, so the manifest is
already correct in omitting `dsh-client-store` (`primitives` and `slots` are a
different case — §1.2's disposition table). The link was restored afterwards and
the sandbox re-verified (`exit 0`).

Caveat found while building the sandbox (worth knowing for t3): with a naive
symlink layout that makes `@deepseek-ai/dsh-session-projection` and
`@deepseek-ai/dsh-session-projection/types` resolve to *different file
identities*, the plugin's declaration merge at `src/index.ts:52-59` silently
stops applying and the `register()` call explodes with unrelated diagnostics.
This is an install/layout property, not platform drift; it resolves once the
plugin's own node_modules holds one coherent copy (as in §9.2 and in the real pnpm
install).

### 9.2c Pending-entry boot failure (shipped-shell assertion, static read)

```
$ python3 - <<'PY'   # over dsh-web-frontend/dist/assets/index-BKQ_L1z6.js
... find 'assertEntriesActive', 'did not activate', 'page.fail', 'waiting for services'
PY
assertEntriesActive @ line 114 offset 555185
  ... `${name}: pending (waiting for services: ${Object.keys(fiber.inject)
      .filter(h => ctx.get(h) === undefined).join(", ")})`
  throw new Error(`web boot: ${N} entries did not activate\n...`)
page.fail @ line 114 offset 554275   # run() catch → page.fail(message)
```

Every loader entry is asserted after `loader.await()`; a fiber still `PENDING`
(any name in `fiber.inject` with `ctx.get(name) === undefined`) fails the whole
boot. Cordis side of the same chain: the plugin object's `inject` becomes
`fiber.inject` at `cordis/lib/index.js:1634`, and PENDING is defined at
`cordis/lib/types/fiber.d.ts:60-66`. Drives R3(b).

### 9.3 Cross-version zod probe

```
$ tsc -p .scratch/zod-direct/tsconfig.json --noEmit
src/probe.ts(4,14): error TS2739: Type 'ZodObject<{ stopReason: ZodNullable<ZodString>; }, $strip>'
  is missing the following properties from type 'ZodType<{ stopReason: string | null; }, unknown,
  $ZodTypeInternals<{ stopReason: string | null; }, unknown>>': validate, validateAsync
```

Plugin zod 4.4.3 schema → platform zod 4.6.2 `ZodType` = **incompatible**. Drives
R1.

> **Post-resolution note (0.1.5 follow-up pass).** This probe remains a true statement about the
> *types* — and it is why the plugin's own build must typecheck against one zod — but it never
> reached runtime: the shipped host bundle has no zod import at all (only
> `@deepseek-ai/dsh-session`), so no zod schema object is ever handed to the platform's 4.6.2
> copy. The probe is retained as the reason `zod` is a **build-time** dependency rather than a
> runtime one; see R1's resolution above and `docs/INTEGRATION-RECORD.md` §3.

### 9.4 Module-table / require inventory

```
$ grep -o 'require("[^"]*")' lib/client.js | sort | uniq -c
   1 require("@deepseek-ai/dsh-client-ui-primitives")
   1 require("react")
   1 require("react/jsx-runtime")
```

Every id above is a seed word in both shells (§5.1), so the shipped bundle stays
loadable without any inject-list change; and the inject-list change in §5.3 is
needed only for the new rightbar services.

---

## 10. Raw evidence commands (appendix)

```sh
R=<repo>/node_modules/@deepseek-ai
N=/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai

# versions / topology
node -e "for (const p of ['cordis','dsh-session','dsh-subagent']) console.log(p, require(process.argv[1]+'/'+p+'/package.json').version)" "$N"
ls $N | grep -E 'dsh-client-ui-(primitives|slots|sidebar-right|dockkit)|dsh-client-store'   # absent except sidebar-right

# seed tables (shipped shells)
python3 -c "import re;s=open('$N/dsh-web-frontend/dist/assets/index-BKQ_L1z6.js',encoding='utf8').read();print(re.search(r'function \w+\(\)\{return\{(react:.*?)\}\}',s,re.S).group(2))"
python3 -c "import re;s=open('.scratch/platform-0.1.2-rc.1/frontend/package/dist/assets/index-Df-65__b.js',encoding='utf8').read();print(re.search(r'function \w+\(\)\{return\{(react:.*?)\}\}',s,re.S).group(2))"

# module-system contract
diff .scratch/platform-0.1.2-rc.1/client-modules/package/lib/client.js $N/dsh-client-modules/lib/client.js   # 0 lines
grep -n "arriveGraphRow\|makeRequire\|missed the module table" $N/dsh-client-modules/lib/client.js

# per-package diffs (selected)
diff -u $R/dsh-host-webserver/lib/types/index.d.ts            $N/dsh-host-webserver/lib/types/index.d.ts
diff -u $R/dsh-host-webserver/lib/index.js                    $N/dsh-host-webserver/lib/index.js
diff -u $R/dsh-client-ui-layout/lib/types/client/index.d.ts   $N/dsh-client-ui-layout/lib/types/client/index.d.ts
diff -u $R/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts \
            $N/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts
diff -u $R/dsh-session-projection/lib/index.js                $N/dsh-session-projection/lib/index.js
grep -n "formatVersion\|compatibleVersions\|identityOf\|identityMatches" $N/dsh-session-projection-cache/lib/index.js
diff -u $R/dsh-app-boot/lib/index.js                          $N/dsh-app-boot/lib/index.js   # applyEntryPatches byte-identical

# published 0.1.5-rc.2 seed-word packages
npm view @deepseek-ai/dsh-client-ui-dockkit@0.1.5-rc.2 version
npm pack @deepseek-ai/dsh-client-ui-primitives@0.1.5-rc.2 @deepseek-ai/dsh-client-ui-slots@0.1.5-rc.2 \
         @deepseek-ai/dsh-client-store@0.1.5-rc.2 @deepseek-ai/dsh-client-ui-dockkit@0.1.5-rc.2
```

---

## Related documents (appended by `t6`)

This block is the only part of this file added by the integration task `t6`; it carries links, no
inventory statements. The content **above** it is byte-identical to the revision the gate reports
judged: the first **57299** bytes of this file hash to
`a8586bdb21794b7f961b5226d72694ed05b1529b125b16adb8cb839d3a62f9ea`
(reproducible with `head -c 57299 docs/MIGRATION-0.1.5-rc.2.md | shasum -a 256`). Every change-list
item this document asked for landed in the shipped revision: the pins, the `dsh.client.inject` delta
(item 3), the optional-peer rule of §1.1, the `CLIENT_EXTERNALS` comment reconcile of §5.4 (item 6
with the "no dockkit entry" branch, since the rightbar import is type-only), the guarded service
acquisition of §5.5 (item 12) and the unchanged `cordis.patch.yml` of item 15. `src/index.ts` needed
no change (item 7), and its rebuilt host half is byte-identical to `HEAD`.

- [`../README.md`](../README.md) — user-facing overview and the `0.1.5-rc.2` platform requirement with
  its profile-install/rebuild implications.
- [`RIGHTBAR-INTEGRATION-SPEC.md`](./RIGHTBAR-INTEGRATION-SPEC.md) — the rightbar contract this
  inventory's §2 verdict table (C10/C11) and §5.3/§5.4 deltas feed.
- [`VERIFICATION-RIGHTBAR.md`](./VERIFICATION-RIGHTBAR.md) — independent verification, including the
  seed-table re-extraction that confirms §5.1.
- [`REVIEW-RIGHTBAR.md`](./REVIEW-RIGHTBAR.md) — the round-1 review of the migrated revision.
- [`DELIVERY-RECORD-0.1.5-rc.2.md`](./DELIVERY-RECORD-0.1.5-rc.2.md) — the post-`t3` corrections that
  produced the shipped `inject` list and optional peer.
- [`INTEGRATION-RECORD.md`](./INTEGRATION-RECORD.md) — final assembly record: delivered hashes, the
  recorded fresh-install reproduction, the packaging audit and the residual limitations.

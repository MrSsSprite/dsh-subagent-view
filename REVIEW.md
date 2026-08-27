# REVIEW — subagent-view

Final quality and spec-compliance review of the `subagent-view` DSH web plugin
(task t6, attempt 1, reviewer role). Reviewed commit: `ac4b66b` (working tree clean).
Reference for parity comparison: `@leetoners/dsh-ui-subagent-monitor` v0.2.0
(read-only install at `~/.dsh/profiles/web/node_modules/@leetoners/dsh-ui-subagent-monitor`).
All evidence was gathered by reading the actual files and re-running the checks
independently (not merely trusting t5's summary).

## Verdict: **PASSES overall**

All 8 checklist items pass. Zero blocking FAILs. One MINOR wording deviation noted
(item 5, "Open" button label) and two informational notes. The plugin is a genuine
English-language reimplementation, sidebar-docked per spec, with full reference
feature parity, clean build/typecheck, and verified live wiring.

---

## 1. Repo hygiene, build, typecheck — PASS

Files read: `package.json`, `tsconfig.json`, `tsdown.config.ts`, `cordis.patch.yml`,
`README.md`, `DEV-NOTES.md` (877 lines, the research doc), `src/index.ts` (266),
`src/client/index.ts` (188), `src/client/panel.tsx` (377), `lib/index.js`,
`lib/client.js`, `LICENSE`, `.gitignore`, `docs/`.

- `pnpm build` (run by the reviewer): exit 0. `lib/index.js` ESM 5.71 kB +
  `lib/client.js` CJS 19.75 kB with the exact `window.__ModuleLoader__.load({id:"subagent-view",
  factory})` wrapper; the only runtime `require()`s in the client bundle are the
  platform seeds `react` and `react/jsx-runtime` (loader purity).
- `pnpm typecheck` (run by the reviewer): exit 0 (`tsc -p tsconfig.json --noEmit`,
  `strict: true`).
- Git: 8 commits with sensible conventional messages
  (`277e5a3` scaffold → `b3bab21` host → `d0e5078` docs → `62c4e96` client →
  `53fac77` track bundle → `08b4bb9` pin devDeps → `ae98604` path placeholders →
  `ac4b66b` coexistence note). `git status` clean after the reviewer's rebuild.

## 2. English requirement — PASS

- CJK/Japanese/Korean grep over `src/`, `lib/`, `README.md`, `LICENSE`, configs,
  `docs/`: **zero matches**.
- All UI strings in `src/client/panel.tsx` and CSS comments in `src/client/index.ts`
  are English; code comments are English throughout.
- `DEV-NOTES.md:828` contains one Chinese string (`已结束`) — it is a quotation of the
  reference plugin's label in a research note explaining the English translation
  ("we render the English 'Ended'"). `DEV-NOTES.md` is a gitignored dev-research
  document, not shipped (`files` excludes it) and not user-facing. Acceptable.

## 3. Naming & non-collision (amended criteria: coexistence not required) — PASS

- Package name is exactly `"subagent-view"` (`package.json:2`); bundle patch inserts
  `{id: subagent-view, name: 'subagent-view'}` (`cordis.patch.yml`).
- Slot id: `subagent-view` (`src/client/index.ts:181`); route:
  `/api/subagent-view/snapshot` (`src/index.ts:249`). Both differ from the reference's
  `subagent-monitor` / `subagent-monitor-panel` ids, `ui-subagent-monitor` patch id and
  `/api/subagent-monitor/snapshot` route. No collision; CSS classes namespaced `sav-`.
- (a) No id/route collision with the reference — PASS (ids and routes are disjoint).
- (b) The profile disables the reference intentionally:
  `~/.dsh/profiles/web/cordis.patch.yml` contains `- id: ui-subagent-monitor` /
  `disabled: true` — verified by reading the file.
- (c) Standalone operation — PASS, verified live by the reviewer (see item 8): graph
  row served, bundle 200, snapshot endpoints 200 with the canonical payload shape.
  The reference's graph row is absent and its route answers 404, which is EXPECTED
  under the disable entry (per the captain's criteria change), not a failure.

## 4. Sidebar docked bar + panel (no floating overlay) — PASS

- **Slot usage per DEV-NOTES §1.4**: one registration into `sidebar.footer.action`
  (list/root, `id: 'subagent-view'`, `order: 100`) renders a column block — the
  persistent bar at the bottom and, when open, the panel directly above it, both
  inside the sidebar column (`src/client/panel.tsx:267-375`). Note: DEV-NOTES §1.2
  established that there is no additive sidebar-body slot in this DSH version
  (`sidebar.workspaces` is `single` and occupied), so the panel is rendered by the
  same footer entry — the t6 checklist's phrase "sidebar-body panel slot" is satisfied
  by the panel being *inside the sidebar body column*; the design follows the
  research doc exactly.
- **Bar text**: `` `${running} running · ${done} done · ${failed} failed` ``
  (`panel.tsx:265`), counts over visible rows only, `failed` = error|aborted|
  max-tokens|refusal (`panel.tsx:230-235`) — matches DEV-NOTES §6.3.
- **Expand/collapse**: bar click toggles `open` in the shared page-local store
  (`commit({ open: !state.open })`, `panel.tsx:370`); panel header has a collapse
  button (▴) and a close button (✕), both `commit({ open: false })` — the bar
  persists (`panel.tsx:288-298`).
- **Open state persistence**: `open` and `hidden` live in the module-level page store
  (`panel.tsx:51-64`) and survive renders, polling ticks and session switches within
  the page — the reference's exact pattern (DEV-NOTES §6.2 explicitly prescribes
  page-local, no localStorage). `sessionsSvc` binding likewise survives.
- **Defaults**: desktop auto-expands on first mount, mobile `(max-width: 768px)`
  defaults collapsed (`panel.tsx:214-218`, `MOBILE_QUERY` `panel.tsx:168`); rail mode
  (`wide === false`) forces `open = false` and renders a compact icon button whose
  click calls `toggleSidebar()` then opens (`panel.tsx:221-223, 249-263`).
- **No floating-panel remnants**: grep over `src/` and `lib/*.js` for
  `position: fixed`, `localStorage`, `shell.overlay`, `dsh-smn`, `grip`, resize
  handling: **zero matches**. No drag/resize grips, no fixed positioning, no
  position/height persistence keys. The only absolute positioning is the rail
  badge inside its relative button (not a floating panel).

## 5. Feature parity vs the reference — PASS (1 MINOR note)

Host half (`src/index.ts`), all verified against the reference's `src/index.ts`:
- global `subagent/start` | `subagent/end` listeners with `{ global: true }` ✓
  (`:160-161`)
- parent-chain root attribution via `ctx.sessions.get(...).header.parentSession`,
  32-hop cap ✓ (`:98-108`)
- per-root 200-row prune evicting oldest non-running ✓ (`:80-82`, `:116-133`)
- snapshot route shape: `{now, rows:[]}` when the param is absent (key omitted),
  `{sessionId, now, rows}` when supplied, empty `?sessionId=` echoed ✓ (`:254-257`);
  `cache-control: no-store`, 200 JSON ✓
- enrich merge: `listDescendants` try/catch ✓; catalog supplies label (child+label),
  mode (child), depth, parentId; observed rows override; catalog-only rows get
  `local: true`, `sortKey: -(len-index)`, `running`/`unknown` status ✓; event-only
  rows kept at `depth 0` ✓; newest-first by `startedAt ?? sortKey ?? -Infinity` ✓
  (`:172-244`)

Client half (`src/client/panel.tsx` + `index.ts`):
- 1s polling always mounted from the bar component ✓ (`:199-210`); stale-response
  guard `data.sessionId !== state.sessionId` ✓ (`:72`); fetch try/catch ✓
- status visuals: pixel-chase running dot (same 3×3 cell matrix, same stepped
  keyframes, same negative-delay stagger) + 10% halo / 6/10 core terminal dots ✓
  (`:113-145`, CSS `index.ts:109-132`)
- label mapping: Running / Done / Failed / Interrupted / Token limit / Refused,
  unknown → "Ended" gray ✓ (`:97-106`)
- meta line `provider · mode · shortId` ✓ (`:315-318`); duration `h:mm:ss`/`mm:ss`
  ✓ (`:147-157`); tree indent `max(0, depth-1)*14` ✓ (`:313-314`); card rows ✓
- Open conversation via `sessionsSvc.openSubagent({parentSessionId, childSessionId,
  mode})` ✓ (`:237-245`)
- "← Main session" button when `currentAddress.parentSessionId` exists ✓ (`:274-285`)
- Clear finished (hides all non-running) + Show hidden (n) ✓ (`:346-365`)
- hook-order discipline: all hooks run before the rail-mode early return; no hooks
  after it ✓

MINOR (non-blocking): the row button that opens a subagent conversation is labeled
**"Open"** (`panel.tsx:327`) while the spec/reference feature is quoted as
**"Open conversation"**. Functionally identical; recommend renaming for exact parity
if the captain wants the literal label. No other parity gaps found.

## 6. Code quality — PASS

- TypeScript `strict: true`; no `any` anywhere in `src/` (grep: zero matches); the
  sessions service is captured through the narrow `MonitorSessionsService` interface
  via one `as unknown as` cast — the sanctioned loose typing.
- Error handling: fetch try/catch with retry-on-next-tick ✓; `listDescendants`
  try/catch → `[]` ✓; no localStorage code exists at all (by design — the only
  localStorage user in the reference was the floating layout, dropped here).
- Cleanup: style tag removed on dispose ✓ (`index.ts:173`); polling interval cleared
  with the `polling` flag reset ✓ (`panel.tsx:206-209`); slot registration lives in
  `ctx.slots.inject` (order-independent) ✓.
- Wire safety: rows are constructed with conditional spreads so `undefined` never
  reaches the wire (`src/index.ts:206-236`); `JSON.stringify` drops nothing (verified
  live: payloads contain only scalars).
- Comments are informative and in English; the tsdown config documents its one
  deviation from the monorepo preset (`entryFileNames: 'index.js'` pin).

## 7. License & from-ground-up originality — PASS

- `LICENSE`: MIT, "Copyright (c) 2025 subagent-view contributors" ✓.
- Attribution present: `README.md:152-153` — "MIT — see LICENSE. Based on the
  feature set of `@leetoners/dsh-ui-subagent-monitor` (MIT)." ✓
- Originality analysis (line-level comparison against the reference sources):
  the implementation is restructured and rewritten — different identifiers
  (`asString` vs `str`, `MAX_ROWS_PER_ROOT` vs `MAX_PER_ROOT`, `sav-*` vs `smn-*`
  CSS), merged Trigger/Panel into one `SubagentViewBarPanel`, dropped the entire
  floating-panel machinery, translated all UI strings, paraphrased all comments.
  Longest consecutive verbatim non-empty runs: 12 lines (host `PanelRow` interface)
  and 14 lines (client `MonitorRow` interface) — both are the shared wire contract,
  which must be identical by design; plus 5-line CSS fragments and the StateDot
  constants (chase cells, keyframe steps, halo insets, stagger formula). These fall
  squarely under "same behaviors / fine-grained CSS effects are OK" and the wire
  contract; no long verbatim prose stretches, no copied Chinese UI, no un-attributed
  creative code.

## 8. Integration evidence (independent cross-check of t5) — PASS

All claims re-verified live by the reviewer at 127.0.0.1:3080:
- `~/.dsh/profiles/web/package.json`: `dependencies."subagent-view" =
  "link:<repo>"` (a live symlink to this repository) and `"subagent-view"`
  in `dsh.profile.bundles` (after the reference entry, which remains listed as a
  dependency) ✓; backups `package.json.bak-sv` + `lock.bak-sv` exist ✓; profile
  `node_modules/subagent-view` symlinks to the workspace ✓.
- `GET /` — graph row `{"id":"subagent-view","url":"/plugins/subagent-view/client.js?rev=09f0919c7830","inject":["@deepseek-ai/dsh-client-runtime"]}` ✓;
  reference graph row count 0 (disabled by design) ✓.
- `GET /api/subagent-view/snapshot` → 200 `{"now":…,"rows":[]}` (sessionId key
  omitted) ✓; `?sessionId=test-abc` → `{"sessionId":"test-abc","now":…,"rows":[]}`
  ✓; `?sessionId=` → `{"sessionId":"",…}` (empty string echoed, canonical) ✓.
- `GET /api/subagent-monitor/snapshot?sessionId=test-abc` → 404 (reference fiber
  disabled — expected, not a failure) ✓.
- `GET /plugins/subagent-view/client.js` → 200 `text/javascript`, body starts with
  the `window.__ModuleLoader__.load` wrapper ✓.

---

## Findings summary

| # | Severity | Item | Detail |
|---|----------|------|--------|
| 1 | MINOR | 5 | Row button label is "Open" (`src/client/panel.tsx:327`); spec quotes the reference feature as "Open conversation". Suggest renaming for literal parity. |
| 2 | INFO | 1 | `.gitignore` lists `lib/` yet `lib/index.js` and `lib/client.js` are intentionally force-tracked (commits `b3bab21`, `53fac77`) so the profile's `link:` install serves committed builds. |
| 3 | INFO | 2 | `DEV-NOTES.md` (gitignored dev-research doc) quotes one Chinese label from the reference as translation evidence; not shipped, not user-facing. |

No typos requiring fixes were found; no project files were modified by this review
other than adding this `REVIEW.md`.

*Reviewer: reviewer (team subagent-view-dev) · Review date: 2025-08-27 · Commit reviewed: ac4b66b*

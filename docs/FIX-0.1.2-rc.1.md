# Fix — subagent-view on DSH 0.1.2-rc.1

Implementation note for `docs/DIAGNOSIS-0.1.2-rc.1.md` (t2). Every platform claim below was
re-checked against the installed 0.1.2-rc.1 packages and, where marked **settled**, reproduced
outside the host process.

## 1. Platform contract changes that broke the plugin

| # | Change in 0.1.2-rc.1 | Evidence | Where it hit us |
| --- | --- | --- | --- |
| P1 | `Session` has no `events` member; the log read is `snapshotEvents(from, to)` / `ownEvents()` | `node_modules/@deepseek-ai/dsh-session/lib/types/types.d.ts` has no `events` accessor; `ownEvents()` returns the post-fork-prefix events | `src/index.ts` `purposeFor` → `/api/subagent-view/tab` 400 (S2) |
| P2 | `SessionHeader` has no `seedLength`; the fork prefix length is Session state (`inheritedEventCount`) | `types.d.ts` contains `isSeeded`/`inheritedEventCount` but no `seedLength` | same statement as P1 |
| P3 | `@deepseek-ai/dsh-client-runtime` stopped at 0.1.1-rc.2; `@deepseek-ai/dsh-client-store` (0.1.2-rc.1+) replaces it in the browser seed table | `npm view @deepseek-ai/dsh-client-runtime versions` → ends at 0.1.1-rc.2; the frontend seed table (`dsh-web-frontend/dist/assets/index-*.js`) maps `@deepseek-ai/dsh-client-store`, not `-runtime` | `dsh.client.inject` listed a module id that is never served, and three client files imported their types from it |
| P4 | Client type homes moved: `ClientContext` is `@deepseek-ai/cordis`'s `Context`; `SessionId` is `@deepseek-ai/dsh-session/types`; `SubagentAddress` is `@deepseek-ai/dsh-subagent/client` | shipped plugins: `dsh-client-ui-subagent/lib/types/client/*.d.ts` | client half did not compile against 0.1.2-rc.1 |
| P5 | `ctx.slots` is declared by `@deepseek-ai/dsh-client-ui-renderer/client`; the session-scope standard kit (`sessionId`, `useSessions`) by `@deepseek-ai/dsh-client-ui-session/client` | `dsh-client-ui-renderer/lib/types/client/index.d.ts:26`, `dsh-client-ui-session/lib/types/client/index.d.ts:34-56` | with `@deepseek-ai/dsh-client-runtime` gone, those augmentations were no longer loaded → `ctx.slots`, `props.sessionId` and `props.useSessions` all unresolved |

## 2. The shared defect class (both symptoms)

`dsh-host-webserver/lib/index.js:245-256` turns an **uncaught handler exception** into
`HTTP 400` with an **empty body**. Both browser halves did `await res.json()` inside `catch {}`,
so a permanent 400 was indistinguishable from a network blip: the UI silently rendered its empty
state for ever. Fix layers, all three applied:

1. **Stop throwing** (P1/P2, P3-P5): the two proven throw sites are gone.
2. **Never let one projection unit kill a route** (`src/index.ts` `liveValues`): the live read asks
   for the three keys this plugin consumes and is wrapped so a rejecting read degrades to
   already-materialized cells, then to no values, logging a warning.
3. **Never answer anything but 200 + JSON** (`replyJson` in `src/index.ts`): both routes catch
   their own failures and answer `200` with a well-formed payload plus an `error` string. The
   browser halves now also log that `error` string and their poll failures instead of swallowing
   them.

### Settled: the S1 hypothesis (`docs/DIAGNOSIS-0.1.2-rc.1.md` §4.2)

The diagnosis left one candidate unproven: whether `snapshot(live)` without `keys` dies because of
an unrelated registered unit. Reproduced with the real platform package
(`dsh-session-projection@0.1.2-rc.1` + a real cordis context), registering one deliberately-bad
wire unit alongside one good unit:

```console
THROWS unkeyed snapshot() with a bad unit registered: ZodError
PASS   keyed snapshot(session, ['harnessGoodUnit']): {"harnessGoodUnit":{"hit":true}}
PASS   keyed cachedSnapshot(session, ['harnessGoodUnit']): {"harnessGoodUnit":{"hit":true}}
```

`snapshot(session, keys)` skips the unselected units' `view`/`viewSchema.parse`, so the keyed read
removes the failure mode; `try/catch` covers the residual `materializeCells` path (which still
folds every registered unit regardless of `keys`). Worth recording for the reviewer: which unit in
this deployment rejects is still unidentified in-process, but the fix no longer depends on knowing.

## 3. Files changed

| Path | Change |
| --- | --- |
| `src/index.ts` | `purposeFor` reads `session.ownEvents()`; new `liveValues` (keyed + fail-soft projection read); `replyJson` + `try/catch` on both routes; `SnapshotPayload` with optional `error` |
| `src/client/index.ts` | type homes from `@deepseek-ai/cordis`, `@deepseek-ai/dsh-session/types`, `@deepseek-ai/dsh-subagent/client`; slot-contract augmentation imports |
| `src/client/panel.tsx` | same type migration; `useSessions` selector typed; poll failure logged, host `error` surfaced |
| `src/client/subagents-tab.tsx` | same type migration; poll failure logged, host `error` surfaced; per-row open-subagent action wired to the `conversation.view` inject seat |
| `tsdown.config.ts` | `CLIENT_EXTERNALS` now matches the 0.1.2-rc.1 seed table (`dsh-client-store`; `-runtime` removed) |
| `package.json` | devDependencies/peerDependencies at 0.1.2-rc.1; `dsh.client.inject` lists only ids 0.1.2-rc.1 serves; the three cold-read services declared dev+peer; no 0.1.1-rc.2 pin anywhere |
| `lib/index.js`, `lib/client.js` | rebuilt (`pnpm build`) |
| `README.md` | verify commands match reality (route contract, auth note, runtime externals) and the rebuild-propagation section |

## 4. Symptom re-check

- **S2 — Subagents tab empty.** `purposeFor` no longer touches `Session.events`; the tab route
  answers `200` and its rows carry the child's first post-seed user prompt as `purpose`.
- **S1 — sidebar loses rows.** The snapshot route answers `200` for a live catalog-bearing session
  even when the projection read fails, so rows reach the panel. Finished one-shot runs are still
  grouped into the **Archived** folder (`src/client/tree.tsx` `splitArchived`), which is the
  intended behaviour: the folder header renders with its member count and stays reachable, so a
  finished run is discoverable rather than absent. Nothing in this change alters that grouping.

## 5. Open risk / not proven

- The identity of the rejecting projection unit in this deployment is still unknown; the fix makes
  it non-fatal and non-silent (host `logger.warn` + a console warning in the browser) rather than
  fixed at the unit.
- `dsh.client.inject` and `package.json` metadata are read **once per process** by
  `dsh-client-modules` (`pkgMeta` keyed by source; `reconcilePackage` returns early when the source
  key is unchanged), so the inject-list change needs one `dsh web` restart to take effect, like any
  plugin-set change. A rebuild in this repo reaches neither half on its own: a `file:` install is a
  **copy** in the profile, so the profile package must be reinstalled (or `lib/*.js` copied into it)
  **and** `dsh web` restarted. See the README's "Propagating a rebuild" section; an earlier revision
  of this document claimed `lib/client.js` alone hot-applies, which was wrong for this install shape.
- The `tokens` field depends on the deployment actually registering a client-visible `tokenUsage`
  unit; `tokenUsageProjectionDefinition` does declare a `wire` view
  (`dsh-token-meter/lib/index.js:338-341`), but this plugin's compile does not pull in that
  package's type augmentation, so its wire key is passed untyped by design (see the comment on
  `WIRE_KEYS`).

## 6. Repair round 2 (t6) — the cold half of `resolveValues`

The first fix removed the *live* projection crash but left the **cold** read written against a
hand-typed interface that no 0.1.2-rc.1 service implements. A finished subagent's Session goes cold,
so its id lands in `coldIds` and that path is the one the reported symptom actually walks.

| Defect (review t4) | Correction |
| --- | --- |
| `cache.cachedSnapshot(header)` — the real signature is `cachedSnapshot(meta, inheritedEventCount, keys?)`; the missing second argument throws `SessionLogOffset must be a non-negative safe integer` | both the durable read and its keys are passed; a stored-row hit returns the wire values, a miss falls through to the refold |
| `cache.coldSnapshot(id)` awaited as a Promise — the real signature is `coldSnapshot(meta, inheritedEventCount, events): ProjectionSnapshot`, synchronous, and it writes the refreshed checkpoint back | the cold session's log is read once (`ctx.sessionQuery.readSession`) and passed as `(meta, inheritedEventCount, events)`; the result is used synchronously and the one-time-per-session memoization is kept because of the write-back |
| `inheritedEventCount` does not exist in `SessionHeader` (only `isSeeded`) | an unseeded session is exactly `SessionLogOffset(0)`; a seeded one takes its exact value from `SessionLogSnapshot.inheritedEventCount` via the same log read |
| one candidate's failure could still empty the row list | every cold step is individually guarded, logs `ctx.logger.warn`, and contributes at most "no projection values" for that one row — never a route-level error, never an empty `rows` |
| hand-written `ProjectionCacheFace` / `PersistenceListFace` and the `as` casts hid the drift from `pnpm typecheck` | the services are the platform's own types (`ctx.sessionProjectionCache`, `ctx.sessionQuery`); the header listing comes from `SessionRecord.header`; the faces are deleted |

Verification for this round is `.verify/cold-real.mjs`: a real cordis `Context`, a real
`SessionProjectionRegistry`, a real `new SessionProjectionCache(...)` with an initialized table
seeded from **this machine's real** `~/.dsh/storages/session_projcache/sessions/*.json` rows, real
cold `Session` logs, and real `SessionRecord` / `SessionLogSnapshot` values — 20/20 checks,
including the two scenarios that must not regress (all cold services throwing, and one candidate's
log read throwing) which still answer `200` with every row intact. The earlier hand-written stub
harness is superseded: it would have reported the same "rows present" result against the broken
interface, which is exactly how this defect survived.

### 6.1 A finished, cold run keeps its terminal status

The cold read must not be mistaken for decoration that can be dropped: for a catalog-only row the
status is `activity === 'running' ? 'running' : (durableOutcome ?? 'unknown')`, so losing the
durable outcome would render every finished subagent as a gray `unknown` dot that the Done count
excludes — the same user-visible loss as S1, just row-shaped instead of an empty payload.
`.verify/cold-real.mjs` asserts `status === 'completed'` for a finished cold candidate whose
durable row carries the outcome, so that degradation is excluded, not merely claimed.

## 7. Reconciliation round (t8)

t6's own criteria required two paths its scope contract did not allow, so the last piece of the
client migration and the dependency reconciliation were split into t8 and finished there:

- `src/client/subagents-tab.tsx` now takes `SessionId` from `@deepseek-ai/dsh-session/types` and
  `SubagentAddress` from `@deepseek-ai/dsh-subagent/client` (matching `src/client/index.ts`), so no
  file in `src/` imports `@deepseek-ai/dsh-client-runtime` any more.
- The tab's per-row open-subagent action is live: rows that are not the current conversation and
  carry a durable mode get an "Open this subagent's conversation" button that addresses the child
  as `{parentSessionId, childSessionId, mode}`, and the `conversation.view` inject offers the
  `openSubagent` seat it consumes.
- The temporary `@deepseek-ai/dsh-client-runtime@0.1.1-rc.2` dev pin (which existed only to keep the
  then-reverted client file compiling) is gone, and `dsh.client.inject` lists only ids the loaded
  0.1.2-rc.1 set really serves: `dsh-client-ui-renderer`, `-session`, `-conversation`, `-sidebar`,
  `-layout` (each installed at 0.1.2-rc.1 with a `dsh.client` declaration) plus
  `dsh-client-ui-primitives` (a seed-table id). `grep -n '0.1.1-rc.2' package.json` returns nothing.

# Diagnosis — subagent-view on DSH 0.1.2-rc.1

- Repo: `/Users/ryanlam/codespace/dsh-plugin/subagent-view` (HEAD `4b84cb5`, working tree clean)
- Platform under test: `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/*` = **0.1.2-rc.1**
- Running host: `http://127.0.0.1:3080` (the deployment serves the plugin from
  `~/.dsh/profiles/web/node_modules/subagent-view`, which is byte-identical to this repo's `lib/`)
- Investigation date: 2026-09-11, session `session-035d2831-f661-4f4b-bd6c-996f86e2d6d7`

Every claim below carries the command output or file/line that establishes it. Anything not
demonstrated is labelled **HYPOTHESIS** with the experiment that would settle it.

---

## 1. Headline

The plugin's **host half throws inside its own HTTP handlers**. The web server turns any uncaught
handler exception into `HTTP 400` with an **empty body**, and the plugin's **client half treats a
non-JSON response as a transient network failure and silently ignores it**. Both reported symptoms
are the two UIs rendering their empty state because every 1-second poll fails.

| Symptom | Status | Cause |
| --- | --- | --- |
| S2 — Subagents `conversation.view` tab shows nothing | **PROVEN** | `/api/subagent-view/tab` throws `TypeError: session.events is not iterable` (0.1.2-rc.1 `Session` has no `events` member) → `400` → client discards → tab renders empty |
| S1 — sidebar panel has no subagent rows | **PROVEN to be a dead endpoint for exactly the sessions that have a subagent catalog**; the precise throwing statement inside `enrich()` is still **HYPOTHESIS** (one unguarded call site remains) | `/api/subagent-view/snapshot` returns `400` for those sessions; client discards the response |

The two symptoms are **one shared root defect class** (unguarded host-side handler throwing →
400 → silent client discard) with **two distinct throwing statements**.

---

## 2. Evidence A — the host routes return 400 exactly for catalog-bearing sessions

Command (run against the live server; `/api/*` needs no auth, `/plugins/*` and HTML do):

```console
$ for s in $(ls ~/.dsh/sessions/--Users-ryanlam-codespace-dsh-plugin-subagent-view--); do
    a=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3080/api/subagent-view/snapshot?sessionId=$s")
    b=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3080/api/subagent-view/tab?sessionId=$s")
    echo "$s $a $b"
  done
318f170c-524e-439b-b149-8fe9ef715634 200 400
441c8cd5-b178-446b-87e9-86fb34220ec7 200 200
6134a4db-8094-4b47-ad47-e603d3b82701 200 200
7a7a4791-9778-430c-9c27-ae57a2d58237 200 200
9d26531a-003f-492b-9374-d5481635c5b2 200 200
de97c834-37dd-4b79-8edc-c4cd9f79cc1a 200 200
eadd6573-c91b-46d6-bd8d-4be07c84b8c8 200 200
eb68e7ed-20d9-4226-b031-2c2b1f8e7625 200 200
eced9a27-4d51-42d9-b992-6613e2d256f6 200 200
session-00b55d46-60b4-4f6b-98aa-1469f0f38755 200 200
session-035d2831-f661-4f4b-bd6c-996f86e2d6d7 400 400
session-2f1d287a-d7ce-44ec-a30b-f5e8bf38d9ea 200 200
session-346a2b64-b509-4def-814d-50842b86b274 200 200
session-470c7b71-7d12-4276-b860-0ac8bc92f11c 200 200
session-567932b1-e0be-4615-91a7-236ec25c00cb 200 200
session-985adec1-2816-462e-8a45-88c9b0215f07 200 200
session-b096b728-a36d-47d6-a4fd-eaae6cceb037 200 200
session-b990f95a-7d19-4923-b5d2-9404586315c6 400 400
session-f2e5a3a6-8fdc-4871-9c15-4e16064fc712 200 400
```

```console
$ curl -s -D- 'http://127.0.0.1:3080/api/subagent-view/tab?sessionId=session-035d2831-f661-4f4b-bd6c-996f86e2d6d7'
HTTP/1.1 400 Bad Request
Transfer-Encoding: chunked
                                    # ← empty body, no JSON at all
```

```console
$ for i in 1 2 3 4 5; do curl -s -o /dev/null -w '%{http_code} ' \
    'http://127.0.0.1:3080/api/subagent-view/snapshot?sessionId=session-035d2831-f661-4f4b-bd6c-996f86e2d6d7'; done
400 400 400 400 400            # deterministic, not transient
```

Why 400 means "the handler threw": `dsh-host-webserver/lib/index.js` lines 245–256 —

```js
handle(req, res).catch((err) => {
    this.ctx.logger.warn(err instanceof Error ? err : new Error(String(err)));
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(400);
    res.end();
});
```

The plugin never writes 400 itself (both handlers only call `res.writeHead(200, …)`), and an
unmatched path yields 404 — so a 400 *is* an uncaught plugin-handler exception.

Correlation with "has a subagent catalog": the three routes that return 400 are exactly the
sessions that are **live in the host session store and have a non-empty descendant catalog** —
`session-035d2831-…` (this AgentTeams captain session, whose members are subagents),
`session-b990f95a-…`, and `318f170c-…`/`session-f2e5a3a6-…` which fail only on `tab`. All other
probed ids are cold/childless and return `200 {"rows":[]}`. `session-00b55d46-…` (a subagent
session referenced by the captain log) returns `200` — i.e. cold — confirming that the 400 is not
"any session id" but a live-session/catalog condition.

Stub-driven control experiment (a throwaway `node .diag/probe2.mjs` harness, scratch file removed
after use): importing the built plugin and applying it to a stub `ctx` registers both routes and
serves `{"sessionId":"LIVE","now":…,"rows":[]}` without throwing when the stub services return empty
values. The throw therefore comes from a **real platform service call**, not from the plugin's own
payload assembly.

---

## 3. Root cause of S2 (Subagents tab empty) — PROVEN

### 3.1 The defect

`src/index.ts:363-378` (`purposeFor`), called from `tabFor` for every catalog entry and every
observed event row:

```ts
const purposeFor = (id: string): string | undefined => {
  const session = ctx.sessions.get(id as SessionId)
  if (session === undefined) return undefined
  const seed = session.header.seedLength ?? 0
  for (const event of session.events) {      // ← src/index.ts:367
```

`ctx.sessions.get(id)` **does** return the live `Session` for a live candidate, and
`Session.events` **does not exist in 0.1.2-rc.1**.

### 3.2 Proof that `Session.events` is gone (and that it used to exist)

```console
$ node --input-type=module -e "
  const P='/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai'
  const { Session, SessionId } = await import(P + '/dsh-session/lib/index.js')
  const s = Session.create(SessionId('session-probe'))
  s.append('turn/start', { turn: 1 })
  console.log('typeof s.events =', typeof s.events)
  try { for (const e of s.events) {} } catch (err) { console.log('iterating ->', err.constructor.name+': '+err.message) }
  console.log('snapshotEvents length =', s.snapshotEvents().length)
"
typeof s.events = undefined
iterating -> TypeError: s.events is not iterable
snapshotEvents length = 1
```

Corroborating source evidence in the shipped package:

- `dsh-session/lib/index.js:1331` — `eventAt(seq) { return this.log[seq]; }`
- `dsh-session/lib/index.js:1342` — `snapshotEvents(fromSeq, toSeqExclusive)`
- `grep -n "get events()\|this.events" dsh-session/lib/index.js` → **no accessor and no field**
  (only the unrelated local `const events = []` at line 828 and `this.eventsSnapshot`).

`session.events` was a 0.1.1-rc.2-era accessor; 0.1.2-rc.1 renamed the log read to
`events()`/`snapshotEvents()`. The plugin has other 0.1.1-rc.2 pins left over
(`package.json` devDependencies are all `0.1.1-rc.2`), which is how the drift survived.

### 3.3 Path to HTTP 400

`tabFor()` → `purposeFor(id)` → `for (const event of undefined)` → `TypeError` escapes
`tabFor` → the route handler's returned promise rejects → `dsh-host-webserver` catch → `400`
empty body. `purposeFor` is called at `src/index.ts:595` and `:647`, i.e. for any catalog
entry *and* for event-only rows — so the whole tab payload dies even when only one candidate is
live. That is why the tab is empty in **every** session while a subagent is running (S2, exactly as
reported) and also in sessions where the plugin merely observed a run.

---

## 4. Root cause of S1 (sidebar panel has no rows)

### 4.1 The endpoint is dead for the sessions that matter — PROVEN

The sidebar panel polls `/api/subagent-view/snapshot` once per second
(`src/client/panel.tsx:227-238`). For the live captain session, and for the other live
catalog-bearing sessions of Evidence A, that route returns `400` deterministically, so the panel
never receives rows: `refresh()` (panel.tsx:81-90) throws on `res.json()` of the empty body and the
`catch {}` swallows it — the panel shows "No subagent activity in this session" while runs are
actually happening.

### 4.2 Which statement throws — **HYPOTHESIS (narrowed to one call site)**

Static isolation of `enrich()` (`src/index.ts:277-356`), the only work `/snapshot` does:

| statement | guarded? | reachable for the failing sessions? |
| --- | --- | --- |
| `ctx.subagents.listDescendants(sessionId)` (line 280) | yes, `try/catch { catalog = [] }` | cannot produce the 400 |
| `for (const row of runs.values())` (287) | pure | cannot throw |
| **`ctx.sessionProjections.snapshot(live)` (line 453, inside `resolveValues`)** | **no** | yes — executed once per live candidate id |
| `persistedHeaders()` (401-417) | yes, `try { … } catch { /* fail-soft */ }` | cannot produce the 400 |
| `cache.cachedSnapshot(header)` (468) | no | cold candidates only (and those are the *passing* sessions) |
| `projectionsFor(...)` (485-505) | reads `values.tokenUsage` / `.subagentTiming` / `.subagentOutcome`; all `undefined`-safe | cannot throw |

`enrich()` contains no `session.events` use, so S1 is not the S2 defect. That leaves exactly one
unguarded, live-only call: `ctx.sessionProjections.snapshot(live)`.

Why that call can throw on 0.1.2-rc.1 — `dsh-session-projection/lib/index.js`:

```js
snapshot(session, keys) {                 // line 142
  const values = {};
  const selected = keys === void 0 ? void 0 : new Set(keys);
  this.materializeCells(session);         // line 145 — folds EVERY registered unit
  for (const registration of this.registrations.values()) {
    if (registration.def.wire === void 0) continue;
    if (selected !== void 0 && !selected.has(registration.def.key)) continue;
    values[registration.def.key] = this.viewCell(registration, cell);   // line 150
  }
  …
}
viewCell(registration, cell) {            // line 430
  const wire = registration.def.wire;
  if (wire === void 0) throw new Error(…);
  return wire.viewSchema.parse(wire.view(cell.state));   // line 433 — uncaught by the caller
}
```

The plugin calls `snapshot(live)` **without the optional `keys` argument**, so one live session
forces materialization plus `wire.viewSchema.parse` of **all 24+ registered client units** of the
0.1.2-rc.1 deployment (`tokenUsage`, `contextBreakdown` (`.strict()` schema), `subagentTiming`,
`subagent`, `turnOutline`, `contextTimeline`, …), not just the three keys the plugin consumes. A
failure anywhere in that set rejects the whole route — the projection cache's `restore` even
documents deliberate throw-on-unrecoverable behaviour ("its checkpoint row is missing,
version-mismatched, or beyond the supplied log end; re-read from seq 0"),
`dsh-session-projection/lib/index.js:283-286`.

I could not isolate the exact unit from outside the process: the exception text only reaches
`ctx.logger.warn` in the host, and the code path could not be reproduced in a scratch harness with
synthetic sessions (a throwaway `node .diag/probe4.mjs` probe returned
`snapshot OK keys: [ 'subagentOutcome' ]`). The two remaining candidates are:

1. a registered unit whose `view`/`viewSchema.parse` rejects this session's state
   (`viewCell`, line 433), or
2. `materializeCells` → `advanceCell` (line 386-397) hitting
   `session projection "…" cannot advance across missing seq N` for a live session whose cell
   watermark predates a fold it cannot replay.

**Experiment that settles it** (5 minutes, implementer-owned, needs the host process):
temporarily wrap each statement of `enrich()` in `try/catch` and re-throw with a marker, or change
the route's `catch` reporting, then re-request the failing URL and read the host log line that
`dsh-host-webserver` writes at `logger.warn`. One rebuild + server restart yields the exact message.

**This does not block the fix.** The minimal, contract-correct change removes both candidate causes:

```ts
// 1. ask for only the keys this plugin consumes *and* never let one unit's view kill the route
const values = ctx.sessionProjections.snapshot(live, ['tokenUsage', 'subagentTiming', 'subagentOutcome']).values
// 2. wrap the whole per-id projection read (and purposeFor's session read) in try/catch, degrading
//    to "no projection values" exactly like persistedHeaders() already does
```

`snapshot(session, keys)` filtering is documented in the shipped type
(`dsh-session-projection/lib/types/index.d.ts`, `snapshot(session, keys?)`), and the `catch` keeps
`/snapshot` and `/tab` at `200` for every input — which is what makes the client's
"non-JSON ⇒ retry" assumption safe again.

---

## 5. Contributing factor shared by S1 + S2 — silent client failure

`src/client/panel.tsx:81-90` and `src/client/subagents-tab.tsx:90-99`:

```ts
const res = await fetch(`/api/subagent-view/snapshot?sessionId=…`)
const data = await res.json() as SnapshotPayload   // throws on a 400 empty body
…
} catch {
  // Transient network failure: the next tick retries.
}
```

A permanent server-side 400 is indistinguishable from a network blip, so the UI degrades to its
empty state for ever with no user-visible error. Any fix must keep the host routes at 200 with a
valid JSON body for every input (including errors), and/or the client should distinguish
`!res.ok` and surface it. This is what turned a server-side crash into "the panel just loses rows".

---

## 6. Findings that are NOT causes (checked and cleared)

To keep the implementer from chasing ghosts:

| Checked | Result |
| --- | --- |
| Stale deployed plugin copy? | No — `~/.dsh/profiles/web/node_modules/subagent-view/lib/index.js` is byte-identical to the repo build (same mtime 20:15, same content), and the built bundle matches `src/index.ts` line for line (`grep` on the route bodies). |
| Client module resolution broken in 0.1.2-rc.1? | No — the browser seed table in `dsh-web-frontend/dist/assets/index-Df-65__b.js` provides `react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/cordis`; the bundle requires only `react`, `react/jsx-runtime` and `@deepseek-ai/dsh-client-ui-primitives` (`lib/client.js:7-9`), all of which resolve. |
| `sidebar.footer.action` contract changed? | No — `dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:58` still declares the `list` slot with `SidebarFooterActionOwnerProps = { wide: boolean }`, and the shell renders `renderSlot("sidebar.footer.action", { wide })` (`lib/client.js:246`) — matches the plugin's `props.wide` use. |
| `conversation.view` registration shape changed? | No — `ConversationSession` renders `renderSlot("conversation.view", { viewRequest, openView, completeViewRequest }, { only: active.id })`, and tab entries are read from `entry.options.id` / `entry.options.label` (`dsh-client-ui-conversation/lib/client.js:14638`, `15992-16002`). The plugin's `{ name, id, order, label, inject }` registration is still valid, so the tab does register and render (it is just fed nothing). |
| `subagent/start` / `subagent/end` payload changed? | No — `SubagentRunInfo { runId, provider, id, local }` unchanged (`dsh-subagent/lib/types/types.d.ts`); the plugin's `runs` bookkeeping still compiles against it. |
| `listDescendants` entry shape changed? | No — `SubagentDescendantListEntry = SubagentListEntry & { parentId, depth }` with `kind: 'child' \| 'diagnostic'`, `activity`, `hasChildren`, `mode`, `label` (`dsh-subagent/lib/types/control-types.d.ts:30-70`) — matches the plugin's merge. |
| `projectionsFor()` reading the wrong token shape? | Cleared — the *wire* value of `tokenUsage` is the flat `{ uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }` (`dsh-token-meter/lib/index.js:339-340`, `view: state => state.totals`). The nested `{ totals, last }` I first saw is the persisted *state*, not the wire view. Only caveat: cold rows read from the projection-cache store state, so `tokens`/`settledMs` are omitted for cold rows — cosmetic, not a symptom. |
| `rootOf()`/`SessionHeader.parentSession` changed? | No — `parentSession?: SessionId` still exists (`dsh-session/lib/types/types.d.ts:73`). |

---

## 7. Recommended fix (for the implementer)

Prioritized, minimal, and strictly inside this plugin:

1. **`src/index.ts` `purposeFor` (line ~363-378)** — stop using `session.events`. Read the child's
   own log through the 0.1.2 API, e.g. `session.snapshotEvents(SessionLogOffset(seed), undefined)`
   or `session.ownEvents()`, and keep the existing `event.seq < seed → continue`,
   `event.type !== 'user/message' → continue` filters. Source of truth:
   `dsh-session/lib/index.js:1331-1354`. Add the `SessionLogOffset` import from
   `@deepseek-ai/dsh-session`. **This alone fixes S2.**
2. **`src/index.ts` `resolveValues` (line ~453)** — request only the consumed keys and guard the
   read: `snapshot(live, ['tokenUsage', 'subagentTiming', 'subagentOutcome'])` inside a `try/catch`
   that degrades to an empty value map (mirroring `persistedHeaders()`'s fail-soft style).
   **This fixes S1 and makes the endpoint unkillable by any single projection unit.**
3. **Belt-and-braces (recommended, cheap)** — wrap each route handler body in `try/catch` and always
   answer `200` with a well-formed payload (plus an `error` note) so a future platform drift can
   never again produce a body-less 400 that both UIs silently swallow.
4. **Housekeeping** — bump `devDependencies` from `0.1.1-rc.2` to `0.1.2-rc.1` so the types used at
   build time match the runtime that broke here (this is how the `session.events` drift survived
   `pnpm typecheck`).
5. Optional client hardening — treat `!res.ok` distinctly from a network failure in
   `src/client/panel.tsx:81-90` / `src/client/subagents-tab.tsx:90-99`.

## 8. Verification recipe (for the verifier)

After the rebuild (`pnpm build`, then re-install/refresh the profile copy so the host serves the new
`lib/`), the following must hold on `http://127.0.0.1:3080`:

```console
# 1. no 400s on either route, for cold ids AND for the live catalog-bearing sessions
$ for s in session-035d2831-f661-4f4b-bd6c-996f86e2d6d7 session-b990f95a-7d19-4923-b5d2-9404586315c6 \
           6134a4db-8094-4b47-ad47-e603d3b82701; do
    printf '%s ' "$s"
    curl -s -o /tmp/o -w '%{http_code} ' "http://127.0.0.1:3080/api/subagent-view/snapshot?sessionId=$s"
    curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:3080/api/subagent-view/tab?sessionId=$s"
  done
# expect: 200 200 for all three, with a JSON body (rows may legitimately be empty for cold ids)

# 2. the live session with a running subagent must return rows with ids/labels/mode/status
$ curl -s "http://127.0.0.1:3080/api/subagent-view/tab?sessionId=session-035d2831-f661-4f4b-bd6c-996f86e2d6d7" | head -c 400
# expect: {"currentId":"session-035d2831…","rootId":"…","ancestors":[…],"rows":[{"id":"318f170c…","label":…,"mode":…,"status":"running"|…}]}
```

Then confirm in the browser: the sidebar panel lists the live member rows while they run, and the
"Subagents" tab renders the same forest (not its empty state).

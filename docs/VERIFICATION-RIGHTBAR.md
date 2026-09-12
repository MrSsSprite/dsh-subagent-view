# Independent verification — rightbar integration and 0.1.5-rc.2 migration (t4)

Verifier: `verifier` (independent of the implementer). Task `t4`, attempt 1.
No file outside `.verify/` and this document was modified by me. I did not edit
`src/`, `package.json` or `tsdown.config.ts`.

## 0. Revision under verification (hash-pinned)

Per the captain's rule, the spec was hashed **on disk** at verification start and
audited against what it actually is, not against any hash quoted in a message.

| artifact | lines | sha256 | note |
|---|---|---|---|
| `docs/RIGHTBAR-INTEGRATION-SPEC.md` | 836 | `81054f1188603611102ef42db534ec97d88bddbfeec7caada0d473beb9838beb` | post-repair revision (lineage: `790/16384a5e…` → `827/76668c53…` → this) |
| `docs/MIGRATION-0.1.5-rc.2.md` | 796 | `a8586bdb21794b7f961b5226d72694ed05b1529b125b16adb8cb839d3a62f9ea` | t1/t2 completion blurbs say 734 / 598 lines — stale (finding F3) |
| `lib/index.js` | — | `2f7bcda74ae0b8cc0e09e92ab0f1a93f1df67670faadeb945da3a09c4b71c0d3` | **byte-identical to `HEAD`** |
| `lib/client.js` | — | `0672957995592d4ba7420bb688a40d95b59bd9aee10a0c502be115bf44b6dbeb` | see F2: this changed *during* verification |
| `lib/client.js` (earlier, pre-fix) | — | `dd6c0f90ec04ea83b49973de7790d53154421dfe272078ae754a7347062838c6` | the revision t3 was completed against |

`HEAD` = `f67aa112b4ddae502bfed2ac18c040d11d6f02db`. The pre-change baseline used
for parity is frozen in `.verify/baseline-HEAD/` from `git show HEAD:…`.

## 1. Reproduction (acceptance 1) — PASSED

All commands run by me from the repo root, Node v26.8.2 / pnpm 12.4.1.

| command | exit | output |
|---|---|---|
| `pnpm install` | **0** | `Already up to date` / `Done in 2ms` |
| `pnpm build` | **0** | tsdown v0.22.14 / rolldown v1.2.5; `lib/client.js 69.11 kB`, `lib/index.js 142.63 kB`; both entries `Build complete` |
| `pnpm typecheck` | **0** | `$ tsc -p tsconfig.json --noEmit` — no diagnostics |

**Determinism / "host half unchanged" claim — independently confirmed.**
Hashes before and after `pnpm build` are identical for both artifacts, and
`git diff --stat HEAD -- lib/` shows only `lib/client.js` changed
(`1 file changed, 339 insertions(+), 175 deletions(-)`), with `lib/index.js`
untouched. `git diff --stat HEAD -- src/index.ts` is empty. So the host half is
genuinely a byte-identical rebuild, exactly as `MIGRATION-0.1.5-rc.2.md` P0 #7 claims.

## 2. Built artifacts inspected directly (acceptance 2) — PASSED

### 2.1 Rightbar tab type and body, from the shipped bundle

Extracted from the built `lib/client.js` (verified revision `06729579…`):

```
1729:  ctx.inject(["sidebarRightTabs"], (scoped) => {
1730:      scoped.effect(() => scoped.sidebarRightTabs.register(subagentTabDefinition()), "subagent-view: rightbar tab type");
1731:      scoped.effect(() => scoped.slots.inject("sidebar.right.pane.tab", () => scoped.slots.register({
1732:          name: "sidebar.right.pane.tab",
1733:          key: SUBAGENT_VIEW_ID
1734:      }, SubagentRightbarTab)), "subagent-view: rightbar tab body");
1735:  });
```

`lib/client.js:1231-1235` — the exported inject array:

```js
const inject = [
    "slots",
    "sessions",
    "layout"
];
```

with `exports.apply = apply; exports.inject = inject;` (`:1738-1739`). The guide
entry is present: `guide: [{ … order: 20, … "Live subagent runs for the selected session" }]`.

Verified by execution (see §5 for the deciding experiment): stage-one definition
`id = kind = 'subagent-view'`, own keys exactly `[id, kind, title, guide]`; stage-two
body registered into the keyed seat `sidebar.right.pane.tab` under the definition id
`subagent-view`; full props own keys `{name, key}` only.

### 2.2 Host routes, from the built `lib/index.js`

```
4317:  ctx.webServer.register({ kind: "exact", path: "/api/subagent-view/snapshot", handler: … })
4350:  ctx.webServer.register({ kind: "exact", path: "/api/subagent-view/tab",      handler: … })
```

Both routes share `replyJson` (`:4309-4315`), which always writes HTTP 200 with
`content-type: application/json`, and both wrap their payload build in `try/catch`
so a degraded internal failure yields `rows: []` plus an `error` string rather than
an uncaught throw (`:4330-4344`, `:4364-4376`).

### 2.3 Runtime externals vs the shipped seed table

The built client bundle `require()`s exactly three specifiers — `react`,
`react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives` — all three served by the
seed table. The real 0.1.5-rc.2 seed table, read from
`dsh-web-frontend/dist/assets/index-BKQ_L1z6.js` (line 114), is exactly 9 words:

```js
function by(){return{react:ec,"react/jsx-runtime":ic,"react-dom":cc,"react-dom/client":fc,
  "@deepseek-ai/cordis":Ha,"@deepseek-ai/dsh-client-store":Hc,"@deepseek-ai/dsh-client-ui-slots":Ac,
  "@deepseek-ai/dsh-client-ui-primitives":Zg,"@deepseek-ai/dsh-client-ui-dockkit":Ey}}
```

This matches `tsdown.config.ts:12-31` word for word. `dsh.client.inject` lists the 7
graph rows and contains none of the forbidden ids
(`dockkit`, `dsh-client-store`, `dsh-client-ui-slots`, `dsh-client-ui-primitives`).

## 3. Host routes on a running instance (acceptance 3) — PASSED

The engineer's `route-inputs.mjs` calls the registered handlers with hand-made
`req`/`res` objects, so I built my own: **`.verify/route-http.mjs`** mounts the built
`lib/index.js` on a real `node:http` server and issues real HTTP requests. It supplies
a real descendant catalog for one session via `ctx.subagents.listDescendants`.

```
registered routes: /api/subagent-view/snapshot, /api/subagent-view/tab
PASS  (a) session WITH a subagent catalog   status=200 json=true rows=2  keys=sessionId,now,rows
PASS  (b) unknown session id                status=200 json=true rows=0  keys=sessionId,now,rows
PASS  (c) no sessionId parameter            status=200 json=true rows=0  keys=now,rows
PASS  (a) tab route, session WITH catalog   status=200 json=true rows=2  keys=currentId,rootId,now,ancestors,rows
PASS  (b) tab route, unknown session id     status=200 json=true rows=0  keys=currentId,rootId,now,ancestors,rows
PASS  (c) tab route, no sessionId           status=200 json=true rows=0  keys=currentId,now,ancestors,rows
PASS  (a) rows carry the catalog ids — ["sa-1","sa-2"]
PASS  (a) every row carries string id + status
RESULT: PASS — every route answers 200 + parseable JSON over real HTTP
```

A never-observed catalog row has no `startedAt`; it carries
`{"id":"sa-1","depth":1,"parentId":"live-root","label":"scout","mode":"task",
"local":true,"sortKey":-2,"status":"unknown"}`. That is **pre-change behaviour** —
`lib/index.js` is byte-identical to `HEAD` — so my first, stricter well-formedness
assertion was my own test bug, which I corrected rather than reporting as a defect.

## 4. Panel parity, item by item (acceptance 4) — PASSED

Baseline: `.verify/baseline-HEAD/src_client_panel.tsx` (503 lines, `git show
HEAD:src/client/panel.tsx`) and `.verify/baseline-HEAD/src_client_tree.tsx`.
New: `src/client/monitor.tsx` (537), `src/client/panel.tsx` (107), `src/client/rightbar.tsx` (72).

| # | parity item | verdict | evidence |
|---|---|---|---|
| P1 | status dots + legend | same | `StatusDot` moved verbatim (`monitor.tsx:204`); running/done/failed colour + animation mapping unchanged; `CountSegment` unchanged |
| P2 | running/done/failed counts | same | `monitorCounts()` (`monitor.tsx:266-276`) uses the identical predicates as baseline (`running`, `completed`, and `error`/`aborted`/`max-tokens`/`refusal`) |
| P3 | Archived folder for completed one-shot rows | same | `monitor.tsx:29` imports and `:432` calls `splitArchived` / `ArchivedFolder` / `SubagentTree` from `./tree`; **`src/client/tree.tsx` is byte-identical to `HEAD`** (`git diff --stat HEAD -- src/client/tree.tsx` empty) |
| P4 | disclosure-tree collapse defaults + guide-line geometry | same | collapse comment logic identical (`baseline:285-286` ≡ `monitor.tsx:370-371`: every branch starts collapsed); rail/guide geometry lives in the unchanged `tree.tsx` |
| P5 | Open-conversation action | same | `sessionsSvc.openSubagent(...)` path preserved in the shared panel |
| P6 | Back-to-main action | same | `monitor.tsx` header `← Main session` button preserved, incl. `event.stopPropagation()` |
| P7 | Clear finished | same | `monitor.tsx` footer action preserved |
| P8 | 1-second polling | **changed as required** | baseline `if (polling) return` (a second host's unmount killed the timer) → refcounted `pollConsumers` (`monitor.tsx:129-152`). Sanctioned by the captain; strictly better, no single-host behaviour change |
| P9 | empty state | same | `No session selected` / `No subagent activity in this session` preserved |

Two further checks that protect left-panel parity:

- `rightbar.tsx` deliberately does **not** call `claimAutoOpen()`, so the left panel's
  desktop auto-open is still claimed by the left host alone (baseline
  `autoOpened` semantics preserved). If the rightbar body had claimed it, left-panel
  auto-open would have been lost — it does not.
- `rightbar.tsx` imports the rightbar package **type-only** (`:23`), so the bundle gains
  no runtime `require` on it and no second copy of the tab system is loaded.

## 5. The deciding experiment: the inject guard on a REAL cordis context

The engineer's `rightbar-register.mjs` runs the bundle against a hand-written ctx stub
and calls `mod.apply(ctx)` directly, so cordis service acquisition never happens and a
pending fiber is **unobservable by construction**. I wrote
**`.verify/rightbar-inject-guard.mjs`**, which loads the shipped bundle unchanged but
hands its `apply`/`inject` pair to a real `@deepseek-ai/cordis` 4.0.2 `Context`.

```
1. COUNTERFACTUAL: sidebarRightTabs hard-listed, service absent
   plugin inject = ["slots","sessions","layout","sidebarRightTabs"]
   fiber.state = 0 (pending);  unresolved ctx.get(h) = ["sidebarRightTabs"]
   registered = []
   shell audit would report: "subagent-view: pending (waiting for service: sidebarRightTabs)"
2. SHIPPED: deployment WITHOUT ui-sidebar-right
   plugin inject = ["slots","sessions","layout"]
   fiber.state = 2 (active);  unresolved = []
   registered = ["sidebar.footer.action","conversation.view"]
3. SHIPPED: deployment WITH ui-sidebar-right
   fiber.state = 2 (active)
   registered = ["sidebar.footer.action","conversation.view","sidebarRightTabs","sidebar.right.pane.tab"]
RESULT: PASS — guard works as specified
```

Scenario 1 reproduces the boot-fatal condition that motivates the repaired R11.1, using
the shipped bundle's own body: a hard-listed service that never arrives leaves the fiber
`pending` with **nothing registered**. Scenario 2 proves the R11.6 fallback contract:
without `ui-sidebar-right` the fiber is active, nothing is left pending, and the left bar
+ `conversation.view` tab still register. Scenario 3 proves the tab type and keyed body
register when the service is present.

## 6. Implementation-task acceptance criteria (acceptance 5)

| t3 criterion | verdict | evidence |
|---|---|---|
| 1. `pnpm install`/`build`/`typecheck` exit 0; both artifacts regenerated | **passed** | §1 |
| 2. dev/peer deps at 0.1.5-rc.2; `dsh.client.inject` = exactly the needed ids | **passed** | `package.json:67-87` all `0.1.5-rc.2`; peers `>=0.1.5-rc.2`; inject 7 ids, forbidden ids absent (§2.3) |
| 3. stage-1 + stage-2 both present under the same id | **passed** | §2.1, §5 scenario 3 |
| 4. rightbar body renders the same monitor, reusing `SubagentTree`/`splitArchived`/`ArchivedFolder`, 1 s poll, etc. | **passed** | §4 — one shared `SubagentMonitorPanel`; `tree.tsx` byte-identical |
| 5. left `sidebar.footer.action` entry + `conversation.view` tab keep working | **passed** | `lib/client.js:1712-1728`; §5 scenarios 2/3 register both |
| 6. both host routes 200 + parseable JSON for every input, incl. degraded failures | **passed** | §3 (6 real-HTTP cases) + `lib/index.js:4330-4344`, `:4364-4376` |
| 7. every relied-on platform claim honoured; **any deviation stated with its reason** | **passed** | The captain's REQUIRED optional-peer handling was initially absent (that is finding F1, since fixed) and is now implemented — `package.json` `peerDependenciesMeta` marks `@deepseek-ai/dsh-client-ui-sidebar-right` `optional: true` (verified at 01:41:39). F2 still means t3's stated DEV-1 no longer describes the shipped artifact, but the shipped artifact itself satisfies this criterion |

## 7. Platform spot-checks (acceptance 6) — PASSED

Re-measured against the installed 0.1.5-rc.2 packages (my own `awk`/`sed`
measurements, not quoted ranges):

- `dsh-client-ui-sidebar-right/lib/types/client/contract/slots.d.ts:19-25` — the doc
  comment for the keyed seat ("A tab type registers here under its definition's `id`"),
  and `:26-31` — `'sidebar.right.pane.tab': { kind: 'keyed'; scope: 'session'; … }`. ✔
- `…/tab-registry.d.ts:43` — `SidebarRightTabPriority`; `:68-78` — `SidebarRightTabDefinition`.
  Both match the spec's citations. ✔
- `…/service.d.ts:8-10` — the "fails loudly rather than writing into a surface nobody is
  drawing" sentence; `:214-222` — `openTabIn`'s "nothing happens for a session whose
  store was never adopted"; `:247-251` — `isExpanded`. ✔
- `dsh-host-webserver/lib/types/index.d.ts:90` — `register(route: WebRoute)`; ✔
  `dsh-session-query/lib/types/index.d.ts:67` — `listSessions(signal?)`. ✔
- The shipped reference tab type `dsh-client-ui-sidebar-documentpreview` registers via
  `ctx.sidebarRightTabs.register(...)` + the same keyed seat, confirming the spec's
  "the guide registers through those stages unmodified" claim. ✔

No unsupported platform claim was found in either document.

**Documented limitation.** The old-tree (0.1.2-rc.1) half of
`MIGRATION-0.1.5-rc.2.md`'s citations could not be re-checked against
`node_modules`, because running the required `pnpm install` replaced that tree in place
with 0.1.5-rc.2. It is **not** unrecoverable, though: `.pnpm-store/v11/links/@deepseek-ai/<name>/0.1.2-rc.1/<hash>/node_modules/…`
still holds the real files (verified for `dsh-subagent`), so a future audit can diff both
trees from there. Symbol-name spot-checks I attempted (`ownEvents`, `isSeeded`) do not
appear in `dsh-subagent/lib/types/index.d.ts` in either tree, so those two citations
refer to a different file than I guessed — I did not treat that as a defect, since I did
not establish which file the doc means.

## 8. Findings

### F1 — `peerDependenciesMeta` missing: the sidebar-right peer is not optional (HIGH) — **RESOLVED during verification**

**Status: fixed at `01:41:39` and re-verified.** Initially, `package.json:56` declared
`@deepseek-ai/dsh-client-ui-sidebar-right` as a **hard** peer with **no
`peerDependenciesMeta` key at all** (`grep -n "peerDependenciesMeta" package.json` →
ABSENT). That contradicted the captain's explicit REQUIRED instruction — *"if you add
@deepseek-ai/dsh-client-ui-sidebar-right to peerDependencies, it must be an OPTIONAL peer
— add `"peerDependenciesMeta": { "@deepseek-ai/dsh-client-ui-sidebar-right": { "optional": true } }` …
a hard peer entry would contradict that contract at install time"* — and the fallback
contract that the guarded design exists to provide (verified working at runtime in §5
scenario 2), plus repaired R11.6. t3's output (§DEV-5) mentioned only "dev + peer
dependency", so the requirement was neither implemented nor stated.

The artifact was repaired while this report was being written. Re-verified at report time:

```
$ python3 -c "import json; print(json.load(open('package.json'))['peerDependenciesMeta'])"
{ "@deepseek-ai/dsh-client-ui-sidebar-right": { "optional": true } }
```

which is exactly the required shape, and `pnpm install` still exits 0 with it. No blocking
product defect remains. The finding is retained because it was real at verification start
and because it is part of the F2 timeline.

### F2 — The artifacts changed during verification; t3's output describes a superseded revision (MEDIUM)

At verification start the built artifact was `lib/client.js` sha256 `dd6c0f90…`, and its
exported inject array was `["slots","sessions","layout","sidebarRightTabs"]` with a direct
`ctx.effect(() => ctx.sidebarRightTabs.register(...))` at `:1730` — i.e. the shape t3's
output describes as **DEV-1** ("cordis inject kept hard"). While I was verifying, at
`01:39:26`/`01:39:41`/`01:39:46`, `src/client/index.ts`, `.verify/rightbar-register.mjs`
and `lib/*` were rewritten, the artifact became `06729579…` with the guarded
`ctx.inject(['sidebarRightTabs'], …)` form, and at `01:41:39` `package.json` gained the
optional-peer metadata (F1). So **four artifacts** moved under the verification.

Consequences: t3 remains marked completed with an output whose DEV-1 no longer matches
any shipped file; and the task's stated verification target moved mid-flight. The captain
asked that such a discrepancy be treated as a finding — this is it. The *fix* is correct
and I verified it, but **t5 and t6 must verify against `06729579…` (or later), not against
t3's narrative**, and t3's DEV-1 should be corrected in the record.

### F3 — Completion blurbs disagree with the on-disk documents (LOW)

`docs/RIGHTBAR-INTEGRATION-SPEC.md` is 836 lines on disk; t1's completion output says 734.
`docs/MIGRATION-0.1.5-rc.2.md` is 796 lines; t2's output says 598. Both are additions-only
amendments after completion. Not a defect in the documents themselves; recorded so the
integrator pins revisions rather than line counts.

### F4 — Harness churn and one uncovered path (LOW)

`.verify/rightbar-register.mjs` was itself edited at `01:39:41`; an earlier revision
asserted the hard inject list as correct (it would now fail), so its PASS is only
meaningful against its current revision. `.verify/client-render.mjs` exits 0 but prints
`SKIP — stale fixture absent`, i.e. it provides **no** coverage (disclosed as DEV-7).
Neither is a product defect; both limit what the engineer's suite proves.

### Informational

`.verify/rightbar-inject-guard.mjs` and `.verify/route-http.mjs` are mine and are the
harnesses the acceptance evidence above rests on. An earlier draft of the first
(`.verify/inject-pending.mjs`) asserted the pre-fix state and was deleted once the repair
landed, so the suite has no harness that fails by design. Two assertions I initially wrote
were wrong and are corrected in place rather than reported as defects: the
row-well-formedness check (§3), and an initial `sed '19-25p'` range form that macOS sed
rejects.

## 9. Verdict

**All seven acceptance criteria of this verification task pass, and all seven acceptance
criteria of the implementation task pass** — criterion 7 only after the optional-peer fix
(F1) landed at `01:41:39`.

The migration and the rightbar integration are substantively correct and independently
verified at the pinned revision below: they build, typecheck, register the tab type and
body under the documented id and kind inside the guarded `ctx.inject` scope, open through
the platform's throw-free guide path, serve both host routes over real HTTP for every
input, and preserve the left panel's behaviour item by item while adding the rightbar tab
as a second host over one shared monitor.

**Revision this verification is against** (re-confirmed after the last artifact change,
with a full `pnpm install`/`build`/`typecheck` re-run at exit 0 and both verifier harnesses
re-run at exit 0):

| artifact | sha256 |
|---|---|
| `lib/client.js` | `0672957995592d4ba7420bb688a40d95b59bd9aee10a0c502be115bf44b6dbeb` |
| `lib/index.js` | `2f7bcda74ae0b8cc0e09e92ab0f1a93f1df67670faadeb945da3a09c4b71c0d3` (≡ `HEAD`) |
| `docs/RIGHTBAR-INTEGRATION-SPEC.md` | `81054f1188603611102ef42db534ec97d88bddbfeec7caada0d473beb9838beb` (836 lines) |

**Carry-forward for t5 and t6 (F2).** Four artifacts changed *during* this verification and
t3's completion narrative still describes the superseded `dd6c0f90…` revision (its DEV-1
"cordis inject kept hard" is no longer true of any shipped file). Review and integration
must therefore verify against the hashes above — or later — and not against t3's prose. If
any hash above changes again, the affected sections of this report must be re-run; the
fastest re-run is `node .verify/rightbar-inject-guard.mjs && node .verify/route-http.mjs`
plus the three `pnpm` commands in §1.

---

## Related documents (appended by `t6`)

This block is the only part of this file added by the integration task `t6`; it carries links, no
verdict statements. The content **above** it is byte-identical to the revision the review judged
(the review recorded this file's informational delta before the append): the first **20466** bytes
of this file hash to
`938ec4503e17c7e3e0a899ec97a614fbe9669845b9bdc123f1a78f484ebc6477`
(reproducible with `head -c 20466 docs/VERIFICATION-RIGHTBAR.md | shasum -a 256`).

Integration re-check (t6): the whole harness suite listed in `REVIEW-RIGHTBAR.md` §5.1 was re-run
against the delivered tree and every harness that can run exits 0 — including
`.verify/rightbar-inject-guard.mjs` (real cordis fiber) and `.verify/route-http.mjs` (real HTTP).
The one stale script this report's §8 records as deleted, `.verify/inject-pending.mjs` (review
finding `F-1`), is indeed absent from the delivered tree, so no harness fails by design.

- [`../README.md`](../README.md) — user-facing overview: the three monitor surfaces, the steps to open
  the right-sidebar **Subagents** tab, install/rebuild steps and the `0.1.5-rc.2` requirement.
- [`RIGHTBAR-INTEGRATION-SPEC.md`](./RIGHTBAR-INTEGRATION-SPEC.md) — the frozen contract (R1–R12,
  P1–P22, D-1…D-5) this report verifies.
- [`MIGRATION-0.1.5-rc.2.md`](./MIGRATION-0.1.5-rc.2.md) — the drift inventory behind the pins and
  module ids checked in §2.3.
- [`REVIEW-RIGHTBAR.md`](./REVIEW-RIGHTBAR.md) — the round-1 review that consumed this report.
- [`DELIVERY-RECORD-0.1.5-rc.2.md`](./DELIVERY-RECORD-0.1.5-rc.2.md) — the post-`t3` corrections this
  report's F1/F2 timeline records.
- [`INTEGRATION-RECORD.md`](./INTEGRATION-RECORD.md) — final assembly record: delivered hashes, the
  recorded fresh-install reproduction, the packaging audit and the residual limitations.

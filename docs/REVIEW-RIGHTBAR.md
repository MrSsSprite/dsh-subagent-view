# Review round 1 — rightbar integration and 0.1.5-rc.2 migration (`subagent-view`)

**Task:** `t5` (review of `t3`). **Reviewer verdict: `pass`** — no blocker and no high finding is open;
two low findings are recorded below (§7).

**Judged revision** (the working tree as it stood at `2026-09-13T01:44:17+0800`, after the captain-authorized
repair; see §1):

| Artifact | sha256 |
|---|---|
| `src/index.ts` | `110dff3579ec3e37c3d33953797430b273551bbc010ca658bba6e378f832c93b` |
| `src/client/index.ts` | `fdb6a53b182e1e46749f4a820581908d3d42dd6e4b00bfebbde3955afe0b4fd4` |
| `src/client/panel.tsx` | `47328b6661693ea844e38303cd5412ee0d4832130d819dade71aa39b1e50ef00` |
| `src/client/monitor.tsx` | `8702fa7bdfe68affb050f2f9eb8aba0aa9f356c896574fa5de3394943a670bd1` |
| `src/client/rightbar.tsx` | `d161e7e4d042a3d4998efddee1bdbe942d971b54756bf44f0aa2f72bb4b6ee17` |
| `src/client/tree.tsx` | `ffb4e0fdd8681f1c39e1570d349e7a3f05f1fc8b273436d6193807612f0dfd61` (untouched vs. HEAD) |
| `src/client/subagents-tab.tsx` | `dce8cf9d6ecc4822a6b90ed58b7550d8677ca9a43ccaf364327641f136c73fe6` (untouched vs. HEAD) |
| `package.json` | `89256ab9af087f49b8999eadcd438f11c6d1f334ae9a987ccac0e2c58c75253a` |
| `tsdown.config.ts` | `139db1eded5a943aefc7a65b693cb6d387476fece5bf9cc66a9b7032e6714923` |
| `lib/client.js` | `0672957995592d4ba7420bb688a40d95b59bd9aee10a0c502be115bf44b6dbeb` |
| `lib/index.js` | `2f7bcda74ae0b8cc0e09e92ab0f1a93f1df67670faadeb945da3a09c4b71c0d3` (byte-identical to HEAD) |
| `docs/RIGHTBAR-INTEGRATION-SPEC.md` | judged revision `81054f1188603611102ef42db534ec97d88bddbfeec7caada0d473beb9838beb` (836 lines) — still byte-verifiable as the **first 61392 bytes** of the current file (`head -c 61392 docs/RIGHTBAR-INTEGRATION-SPEC.md \| shasum -a 256`); whole file now `53e3e3144f21cb4d83c85d81bc454438dfb9957182e0b874e8c2242747a46f63` (860 lines) after `t6`'s links-only `## Related documents` block at `:840` (R1–R12, incl. R11.1 `:567` and R11.6 `:611`, sit inside the judged prefix) |
| `docs/MIGRATION-0.1.5-rc.2.md` | judged revision `a8586bdb21794b7f961b5226d72694ed05b1529b125b16adb8cb839d3a62f9ea` — still byte-verifiable as the **first 57299 bytes** (`head -c 57299 docs/MIGRATION-0.1.5-rc.2.md \| shasum -a 256`); whole file now `77029ceba77c2db292e9b1aff5c4de4fb77d55ed78236afafc11a1bb5081ad4f` (823 lines) after `t6`'s appended links-only block |

If any of these hashes changes, this review is **void** and must be re-run (the artifact moved twice during the
review; §1).

**Post-verdict pin movement (`package.json` only, recorded by `t8`).** `t6` made a packaging-only edit to
`package.json` at `2026-09-13 01:48:59` (inside its own in-scope paths): the `description` now mentions the
right-sidebar tab, `files[]` gained `lib/index.js.map` and `lib/client.js.map`, and `keywords` gained
`right-sidebar`. The header pin above is the post-edit value. Every package.json-dependent acceptance check was
re-run against those bytes and is unchanged — `dsh.client.inject` is the identical seven-id list,
`peerDependenciesMeta` still marks `@deepseek-ai/dsh-client-ui-sidebar-right` optional, all 16 peer floors remain
`>=0.1.5-rc.2` with sidebar-right present, every `@deepseek-ai/*` dev pin remains `0.1.5-rc.2`, and
`main`/`exports`/`dsh.bundle`/`scripts`/`dependencies` are untouched — so the `pass` verdict stands and the
"void" clause above is satisfied for this artifact. This paragraph and the pin value are the only body changes
made by `t8`; no verdict, finding or acceptance result was edited. `t8`'s bytes were covered by a re-stamp of the
trailer at the foot of this file (`t6`: `15ae66e2…` over 24414 bytes — a superseded figure, kept only as
history); that figure was itself retired when `t10` replaced the trailer's numeric self-hash with the append-only
declaration now in force.

**Freeze-time re-pin (refinement applied after `t6` completed, `2026-09-13 01:54:03`; re-hashed at `01:54:52`).**
With every writer stopped, the tree was re-hashed and the header table repaired. The **judged artifact pins are
unchanged** — `src/index.ts` `110dff35…`, `src/client/index.ts` `fdb6a53b…`, `monitor.tsx` `8702fa7b…`,
`rightbar.tsx` `d161e7e4…`, `panel.tsx` `47328b66…`, `tree.tsx` `ffb4e0fd…`, `subagents-tab.tsx` `dce8cf9d…`,
`tsdown.config.ts` `139db1ed…`, `lib/client.js` `06729579…`, `lib/index.js` `2f7bcda7…` (≡ `HEAD`) — so every
verdict, parity item and acceptance result below still covers the delivered bytes. `package.json` moved only in
packaging metadata (`89256ab9…`, paragraph above). The two requirement documents grew `t6`'s links-only trailers,
so their rows now name the judged revision as a reproducible byte-prefix *next to* the current whole-file pin
rather than replacing it. §8 was rewritten to state the rule: the artifact pins are the invariant, packaging and
documentation hashes are re-pinned explicitly at freeze time.

**Method.** Everything below was measured, not taken from the task summaries: the full `git diff HEAD`, the new
sources read in full, the built bundles inspected and executed, the harnesses re-run, and every platform claim
checked against the installed `0.1.5-rc.2` artifacts (`/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`,
abbreviated `RB` = `dsh-client-ui-sidebar-right`, `DOC` = `dsh-client-ui-sidebar-documentpreview`,
`FILES` = `dsh-client-ui-sidebar-files`, `FRONTEND` = `dsh-web-frontend/dist/assets/index-BKQ_L1z6.js`,
`MODULES` = `dsh-client-modules`). The workspace copy of `RB`
(`node_modules/@deepseek-ai/dsh-client-ui-sidebar-right`, `0.1.5-rc.2`) is byte-identical to the installed one
(`diff -r lib/types` = 0 lines; `lib/client.js` sha256 equal), so citations to either are the same artifact.

I did **not** run `pnpm install` / `pnpm build` in place: `lib/` and `pnpm-lock.yaml` are outside this task's
in-scope paths. Build evidence was produced without touching them (§5.3).

---

## 1. Mid-flight artifact change (must be recorded)

`t3` first completed against a revision whose `src/client/index.ts` hard-listed `'sidebarRightTabs'` in the
exported `inject` array. While this review was in progress the artifact changed (captain-authorized repair):
`src/client/index.ts` mtime `01:39:26`, `package.json` `01:41:39`, `lib/` rebuilds at `01:40:16`/`01:41:15`/`01:43:40`.

* The current revision has `export const inject = ['slots', 'sessions', 'layout']` (`src/client/index.ts:32`) with
  both rightbar registrations inside `ctx.inject(['sidebarRightTabs'], (scoped) => { … })` (`:558-575`), each in a
  `scoped.effect(...)`, with the left-bar and `conversation.view` registrations left unconditional outside the scope.
* `package.json` gained `peerDependenciesMeta["@deepseek-ai/dsh-client-ui-sidebar-right"].optional = true`.
* Consequences: any finding tied to the removed hard list is **superseded** — notably `t3`'s own `DEV-1`, whose
  rationale cited `R11.1` backwards. `DEV-1` is resolved by the code as it now stands (§7, F-2 covers the stale
  *record*, not the code).
* Stability was confirmed before judging: repeated hashing over two intervals showed no further content change, and
  two rebuilds produced byte-identical `lib/client.js`.

## 2. `t3` acceptance criteria — item-by-item

| # | Criterion (abridged) | Verdict | Evidence |
|---|---|---|---|
| 1 | `pnpm install` / `build` / `typecheck` exit 0; `lib/index.js` + `lib/client.js` regenerated from the new source | **PASS** | `tsc -p tsconfig.json --noEmit` → exit 0. A build of `src/` + `tsdown.config.ts` + `package.json` with the same toolchain (temp dir, same `node_modules`) exits 0 and reproduces `lib/client.js` **byte-identically** (`067295799…`) and `lib/index.js` identically except `//#region` comments that embed the build root's relative path. Independently: the sourcemap `sourcesContent` of the shipped `lib/client.js` equals the on-disk `src/client/*` files, 6/6 MATCH — the shipped browser bundle **is** the build of the current source. |
| 2 | dev/peer deps reference 0.1.5-rc.2; `dsh.client.inject` lists the ids per the migration inventory | **PASS** | All 16 pinned `@deepseek-ai/*` devDeps resolve to `0.1.5-rc.2` in `node_modules`; peers raised to `>=0.1.5-rc.2`; `cordis` stays `4.0.2`. `dsh.client.inject` = renderer, session, conversation, sidebar, **sidebar-right**, layout, **api-session-controller** — exactly the `MIGRATION §5.3` verdict (primitives moved out as an inert seed word; sidebar-right moved in; api-session-controller added). |
| 3 | Stage-1 + stage-2 present, same `id`, through the documented seats | **PASS** | `.verify/rightbar-register.mjs` against the shipped bundle: definition own keys exactly `[id,kind,title,guide]`; `id === kind === 'subagent-view'`; exactly one `sidebarRightTabs.register`; one body registered into `sidebar.right.pane.tab` with `key === 'subagent-view'` and options `{name,key}` only. Platform side: the seat dispatches bodies by `definition.id` (`RB/lib/client.js:737`), so keying on the id is correct. |
| 4 | Tab body renders the same monitor content/behaviour as the left panel; reuses `SubagentTree`/`splitArchived`/`ArchivedFolder`, no fork | **PASS** | One `SubagentMonitorPanel` (`src/client/monitor.tsx:358`) is rendered by both hosts (`panel.tsx:88`, `rightbar.tsx:71`); `tree.tsx` is untouched; the injected stylesheet lost **zero** rules and gained only the D-2/D-3 modifiers; every string literal of the old `panel.tsx` is preserved (the only two apparent absences, `sav-panel` / `sav-panel-header`, are produced by the template literal at `monitor.tsx:470,472`). Full parity table in §4. |
| 5 | Left `sidebar.footer.action` entry and `conversation.view` tab keep working, not removed | **PASS** | Both registrations remain, unconditional, with unchanged `id`/`order`/`label` (`src/client/index.ts`, verified in the built bundle and by the harness's R12 checks, including on a rightbar-less deployment). `src/client/panel.tsx` keeps the rail button, the docked bar, the desktop auto-open and the click-to-collapse header. |
| 6 | Both routes answer 200 + parseable JSON for every input, including degraded failures | **PASS** | `src/index.ts` is byte-identical to HEAD; `.verify/route-inputs.mjs` (6 degenerate inputs, including empty `sessionId`, `%00bad`, unknown id, and no param) → 200 + JSON for both routes. `replyJson` is the single answer path (`src/index.ts:988-994`). |
| 7 | Every relied-on platform claim honoured; deviations stated explicitly | **PASS** | §3/§5 below. All 8 recorded deviations are accurate; `DEV-1` is obsolete against this revision (F-2). |

## 3. Spec requirements (`docs/RIGHTBAR-INTEGRATION-SPEC.md` @ `81054f11`)

| Req. | Verdict | Evidence / note |
|---|---|---|
| R1.1–R1.3 identity, values, pure factory | **PASS** | `rightbar.tsx:27,30,41`; definition captured from a stub registry and asserted field-by-field by the harness. No shipped type uses `id`/`kind` `subagent-view` (`RB` guide, `DOC` text, `FILES` files; live profile adds `dsh-context`) — no collision throw. |
| R2.1–R2.7 stage one inside the conditional scope | **PASS** | `src/client/index.ts:558` + `rightbar.tsx:41-54`: `patterns`/`canOpen`/`priority` omitted, no `icon`, `order: 20` after `FILES` `order: 10` (verified in `FILES/lib/client.js`). |
| R3.1–R3.6 stage two | **PASS** | `src/client/index.ts:566-575`; `key` = definition id, no `scope`, body typed `PropsRuntime<'sidebar.right.pane.tab'>` (`rightbar.tsx:66-68`). Only seat names in the bundle: `conversation.view`, `sidebar.footer.action`, `sidebar.right.pane.tab` — no `rightbar`, `rightbar.session`, guide or menu registration. |
| R4.1–R4.3 session source | **PASS** | Body takes the session-scope `sessionId` prop (`rightbar.tsx:69`) and reads `useSessions` only for the Back-to-main fact; the seat mounts per session, so `sessionId === current` holds while a body is mounted. Hooks verified in `@deepseek-ai/dsh-client-ui-session` (`SessionStandardProps.sessionId`, `GlobalStandardProps.useSessions`) composed by `PropsRuntime` (`slots/lib/types/index.d.ts:199`). |
| R5.1–R5.3 one store, one poller | **PASS** | Single module store/poller in `monitor.tsx:70-92,154-175`; ref-counted interval (not a boolean), so a second host joins and only the last unmount clears it; no host-local fetch. |
| R6.1–R6.4 polling contract | **PASS** | `monitor.tsx:101-116` is the old `refresh` verbatim (URL, `sessionId` guard, `console.warn('subagent-view: snapshot degraded:', …)`, wire shape). |
| R7 P1–P22 parity | **PASS** | §4. |
| R8 D-1…D-5 container/chrome deviations | **PASS** | D-1: tab body renders no `.sav-bar`/rail; D-2: `.sav-panel-tab`; D-3: `monitor.tsx:467,471-473`; D-4: auto-open + `matchMedia` remain left-only (`panel.tsx:51-54`); D-5 accepted (see O-3). |
| R9.1–R9.6 | **PASS** | No show/hide/rail/collapse logic and no viewport subscription in the body; `visible` tolerated (nothing reads it — the body renders normally); float-safe (no expansion dependency); call-shape grep for `sidebarRight.<cmd>(` returns nothing in `src/client` **and** in `lib/client.js`; `signal` ignored (`rightbar.tsx:64`); R9.6 not used. |
| R10.1–R10.3 teardown | **PASS** | Both stages in `scoped.effect`; harness disposes and asserts the type disappears while the shipped style tag keeps its existing `ctx.effect` cleanup (`src/client/index.ts:30-33` region unchanged). |
| R11.1 `exports.inject` stays 3 entries | **PASS** | Built bundle exports `["slots","sessions","layout"]`; runtime check `Array.from(mod.inject)` re-run by the reviewer. |
| R11.2 bare sidebar-right name added | **PASS** | `package.json` → `dsh.client.inject` (bare name, as `DOC`/`FILES` do). |
| R11.3 type-only rightbar import, no new `require` | **PASS** | `grep -o 'require("…")'` on `lib/client.js` = `react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives` — identical to HEAD's bundle; `.verify/module-table.mjs` resolves all three to the 0.1.5-rc.2 seed table (extracted independently from `FRONTEND` fn `by()`: react, react/jsx-runtime, react-dom, react-dom/client, cordis, client-store, ui-slots, ui-primitives, **dockkit**). |
| R11.4 bare names only | **PASS** | All 7 entries bare; `MODULES/lib/client.js:265-268` skips rows that do not exist. |
| R11.5 devDependency (+ peer convention) | **PASS** | Present at `0.1.5-rc.2`; also a peer marked `optional` (`peerDependenciesMeta`), which expresses the fallback contract at install time. |
| R11.6 fallback contract | **PASS** | The service is acquired with cordis's inject-scoped form (`cordis@4.0.2` `registry.d.ts:111`), so the callback never runs without a provider and no fiber is left pending. `.verify/rightbar-inject-guard.mjs` runs the shipped bundle against a **real** cordis `Context`: with the service absent the fiber is `active` and only `sidebar.footer.action` + `conversation.view` register; with it present, all four register. This is the property that matters: the 0.1.5-rc.2 shell's `assertEntriesActive` (`FRONTEND`) throws `web boot: N entries did not activate … pending (waiting for services: …)` and `run()` routes that to `page.fail`, i.e. a pending client entry fails the whole app. |
| R12.1–R12.4 existing surfaces intact | **PASS** | Both legacy registrations unchanged (id/order/label) and now proven to register even without the rightbar service; host routes untouched (AC6). |

## 4. Behavioural parity with the pre-change left panel (P1–P22)

Reference: `git show HEAD:src/client/panel.tsx` (HEAD `f67aa11`), which is also the mtime-frozen pre-change tree.

| P | Verdict | Evidence (new code) |
|---|---|---|
| P1 1 s polling of the snapshot route | PASS | `monitor.tsx:157-175`, called by both hosts |
| P2 status legend (`Running/Done/Failed/Interrupted/Token limit/Refused`, unknown → `Ended`) | PASS | `monitor.tsx:184-193`, identical strings |
| P3 running dot = 3×3 pixel chase, 8 cells, negative phase delays | PASS | `monitor.tsx:200-228` |
| P4 terminal dot = 10% halo + core | PASS | `monitor.tsx:230-231` + unchanged CSS |
| P5 counts over **visible** rows; failed = error+aborted+max-tokens+refusal | PASS | `monitor.tsx:269-280`, single implementation shared by bar and panel |
| P6 stats line: non-zero segments, `·`, `None` | PASS | `monitor.tsx:287-307` |
| P7 duration format, `00:00`, `—` | PASS | `monitor.tsx:309-319` |
| P8 label fallback `label → [provider] subagent → subagent <8>` | PASS | `monitor.tsx:324-328` |
| P9 meta line `provider · mode · shortId` | PASS | `monitor.tsx:439-442` |
| P10 footer time order (`elapsed · label` while running) | PASS | `monitor.tsx:459-461` |
| P11 hidden-subtree pruning | PASS | `monitor.tsx:255-266` |
| P12 collapse default (every parent collapsed unless expanded) | PASS | `monitor.tsx:373-390` |
| P13 disclosure geometry (chevron column, guide lines, ticks, bridge) | PASS | `tree.tsx` untouched, `cls="sav"`; stylesheet diff has **no removed rule** |
| P14 Archived folder (one-shots + subtrees, count, collapsed default, hidden while empty) | PASS | `monitor.tsx:432,509-518` reuses `splitArchived`/`ArchivedFolder` unchanged |
| P15 `Open` row action (`openSubagent`) | PASS | `monitor.tsx:392-400,449-455` (same service/mode guard) |
| P16 `← Main session` (`sessions.open(parent)`) | PASS | `monitor.tsx:476-490` |
| P17 `Clear finished` (whole branches only) | PASS | `monitor.tsx:407-428,531-533` |
| P18 `Show hidden (n)` | PASS | `monitor.tsx:524-530` |
| P19 empty state (`No subagent activity in this session`) | PASS | `monitor.tsx:494-499` |
| P20 header: title, optional Back, right-aligned `n running` | PASS | `monitor.tsx:471-493`; the tab variant drops the click-to-collapse affordance only (D-3) |
| P21 `sav-panel` card visuals | PASS | no rule removed; `.sav-panel-tab` overrides geometry only |
| P22 one injected style tag `data-plugin='subagent-view'` | PASS | `src/client/index.ts` style effect unchanged; no second tag |

Narrow/collapsed presentation: the left host keeps rail-vs-wide behaviour verbatim (`panel.tsx:67-82`); the tab
body deliberately renders neither bar nor rail (D-1). Parity of the *left* surface is therefore exact, and the two
sanctioned divergences (fill the pane, no collapse affordance) are the only differences.

## 5. Platform checks performed (selected evidence)

1. **Seat / slot names.** `RB/lib/types/client/contract/slots.d.ts:26-31` declares `sidebar.right.pane.tab`
   `kind: 'keyed'`, `scope: 'session'`; the registration passes neither, by design. Body dispatch key is
   `definition?.id ?? tab.kind` (`RB/lib/client.js:737`).
2. **Registry acceptance of a page type.** `RB/lib/client.js:3355-3384`: `patterns ?? []` makes a page type legal;
   `DEFAULT_BAND = 'extension'` (`:3290`) is what an omitted `priority` means; guide entries are flattened and
   sorted by `order` (`:3505-3510`); `defaultSeed` (`:229-237`) returns the guide when the entry count ≠ 1.
3. **User path.** `RB/lib/client.js:181` — the guide capsule calls `tab.actions.openTab(entry.kind, { replaceTab: true })`;
   the store's open path expands the column. So the documented user path (add control → guide → capsule) is real,
   and the plugin never has to touch the throwing `ctx.sidebarRight.*` face (`RB/lib/client.js:1414-1417`).
4. **Seed table.** Independently extracted from `FRONTEND` (`function by()`): the 9 seed words; `CLIENT_EXTERNALS`
   in `tsdown.config.ts` holds 8 (no dockkit) which satisfies R11.3's superset-of-requires / subset-of-served
   invariant — the bundle requires only 3 of them.
5. **Reproducible build.** Temp-dir build (same `node_modules`, `tsdown` 0.22) exit 0; `lib/client.js` sha256 equal
   to the shipped file; `lib/index.js` equal apart from `//#region` comments carrying the build root's relative path.
6. **Host half untouched.** `git diff HEAD -- lib/index.js` empty, and `src/index.ts` byte-identical to HEAD.
7. **Live deployment.** `~/.dsh/profiles/web` links this repo (`file:…/subagent-view`) and composes
   `@deepseek-ai/dsh-web-app@0.1.5-rc.2`, whose `cordis.patch.yml:224-231` mounts `ui-sidebar-right` and
   `ui-sidebar-documentpreview`; only `dsh-context` (third party) and this plugin register rightbar tab types there,
   under distinct ids (`dsh-context` vs `subagent-view`).

### 5.1 Harnesses re-run by the reviewer (from the repo root)

| Command | Result |
|---|---|
| `node .verify/rightbar-register.mjs` | exit 0, RESULT: PASS (both cases: service provided / absent) |
| `node .verify/rightbar-inject-guard.mjs` | exit 0, PASS (real cordis fiber; fallback + shipped) |
| `node .verify/module-table.mjs` | exit 0, PASS (every `require` served by the 0.1.5-rc.2 table) |
| `node .verify/route-inputs.mjs` | exit 0, PASS (6/6 inputs → 200 + JSON) |
| `node .verify/harness.mjs lib/index.js {live-throwing,live-clean,cold}` | exit 0 ×3 |
| `node .verify/{archive-fix,cold-services,real-projection,real-rows,cold-real}.mjs` | exit 0 ×5 |
| `node .verify/client-render.mjs` | exit 0 (SKIP: stale `/tmp` fixtures) |
| `node .verify/inject-pending.mjs` | **exit 1** — stale expectations, see F-1 |
| `./node_modules/.bin/tsc -p tsconfig.json --noEmit` | exit 0 |

## 6. Findings

### F-1 — `low` — `.verify/inject-pending.mjs` now exits 1 and reports a false red

*File:* `.verify/inject-pending.mjs:136-138` (output block `:146-153`).

*Problem:* The script was written as a bug demonstration and asserts that scenario A (no `sidebarRightTabs`
provider) leaves the fiber **pending** with nothing registered. Against the repaired revision the opposite is
correct and observed: `fiber.state = active`, only `sidebar.footer.action` + `conversation.view` register — i.e.
exactly R11.6. The script therefore exits 1 (three FAIL lines) and would make any "verify suite exit 0" claim red
for a reason that is not a defect. The file belongs to `t4`, which is still running.

*RequiredFix:* Invert scenario A's assertions to the R11.6 contract (`state === 'active'`, `missing` empty,
registrations = the two legacy entries) and reword the RESULT text, or retire the script as a one-off experiment
and keep scenario B as the positive control. Do not "fix" it by re-introducing a hard inject.

### F-2 — `low` — the `t3` record still describes the superseded hard-inject revision

*File:* team state, `t3.output` + finding `DEV-1` (`.agent-teams/rightbar-subagent-panel/team.json`).

*Problem:* The recorded output states that the hard `inject = [..., 'sidebarRightTabs']` was kept and `DEV-1`
justifies it from `R11.1`/`R9.6` "MUST" — a misreading of the frozen `R11.1` (`:567-577` must stay
`['slots','sessions','layout']`) and unrelated to `R9.6` (the future-open guard). The on-disk artifact
(`src/client/index.ts:32,558`) follows the spec. Downstream packaging notes (`t6`) could cite the superseded design.

*RequiredFix:* Amend the `t3` record (or the captain's assembly notes) to mark `DEV-1` resolved-obsolete by the
repair, so the delivered revision is documented as the conditional-acquisition one. No code change.

## 7. Observations (no action required)

* **O-1 — dockkit types resolve to `any`.** `@deepseek-ai/dsh-client-ui-dockkit` is installed neither in the
  workspace nor in the platform's `node_modules` (it ships only inside the web shell's seed table). `RB`'s
  `lib/types/client/index.d.ts:34` re-exports `FloatRect/PaneId/TabId/TabRecord` from it, so
  `tsc --traceResolution` records `Module name '@deepseek-ai/dsh-client-ui-dockkit' was not resolved` (176 hits),
  hidden by the repo's `skipLibCheck: true`. This is a repo-wide convention, not a defect of this change:
  `tsc --skipLibCheck false` emits dozens of `TS2307`s for platform packages (`dsh-client-store`, `lexical`,
  `mdast`, `katex`, …) and fails for unrelated reasons. It is latent only because nothing here touches
  dockkit-typed API; a later round that uses `useTabInfo()`/`TabId` should add the published
  `@deepseek-ai/dsh-client-ui-dockkit@0.1.5-rc.2` as a devDependency first.
* **O-2 — the D-2 "fills the pane" contract is static-only in this review.** Dockkit's inner pane wrapper is not on
  disk, so the fill chain is confirmed to the platform boundary only: `.P3OORG_panel{display:flex;flex-direction:column}`
  → `.P3OORG_panelBody{flex:auto;min-height:0;display:flex}` (`RB/lib/client.js:608`), inside which the shipped
  guide body itself relies on `min-height:100%`. `.sav-panel-tab{flex:1 1 auto;height:100%;min-height:0;max-height:none;margin-bottom:0}`
  is consistent with that chain and overrides the base `.sav-panel` clamp (later rule, same specificity). Ask `t6`
  to confirm visually in the expanded column, in fullscreen, and floated.
* **O-3 — live-profile guide entries.** `~/.dsh/profiles/web` also mounts `dsh-context@0.49.4`, which registers a
  rightbar tab type with a guide entry at `order 20` — the same order as ours (ids differ, so no collision, and
  `order` need not be unique). Consequences: (a) `defaultSeed` already returned the guide in this profile before
  this change, so `DEV-8`/D-5 is a *stock-platform* consequence, not something this plugin caused here; (b) the two
  `order 20` capsules tie and their relative order follows registration order (`dsh-context` first in the profile's
  bundle list). Neither is a defect.
* **O-4 — parity is by construction, and the construction is verified.** Because both hosts render the same
  component and the stylesheet diff removed nothing, P1–P22 cannot drift independently; the literal/CSS diffs in §2/§4
  are the mechanical proof, not a reading of intent.

## 8. What would invalidate this review

The **invariant** is the judged artifact set: any change to `src/index.ts`, `src/client/*`, `tsdown.config.ts`,
`lib/index.js` or `lib/client.js` invalidates this review, because those are the bytes the verdict, the parity
results and the acceptance checks were measured against. An environment where
`@deepseek-ai/dsh-client-ui-sidebar-right` is absent does **not** invalidate it: the fallback path is itself
verified, so AC-1…AC-7 still hold there.

Packaging and documentation hashes are **not** part of that invariant. `package.json` and the two requirement
documents may legitimately move after a verdict — a packaging tweak, or a links-only trailer appended by a later
task — and this round is the worked example: `package.json` moved once and the specification document once after
the review was written, without touching a single property or requirement the review judged. The rule is therefore
an explicit **freeze-time re-pin**, not a tripwire: at the moment every writer stops, re-hash the tree and repair
these rows as the table above now does — keeping the judged revision visible beside the current one, and for
documents recording the judged revision as a **byte-prefix with its reproducible `head -c` command** rather than
replacing it, so a reader can always name the exact bytes that were judged. Anything else is a race with the
writers, and this review lost that race twice. The root cause is mechanical: **a body edit re-stales a trailer
self-hash**, so any document that declares one invites another write cycle — which is why this review's trailer
now carries an append-only declaration instead of a figure.

---

## Related documents (appended by `t6`)

This block is the only part of this file added by the integration task `t6`. It carries links only: no
contract statements and no review statements. Appending it changed no byte above it, so the verdict body, the
two findings, the parity tables and the `t8` pin-refresh / freeze-time re-pin blocks are exactly as their
authors left them.

**No numeric self-hash is recorded here, by design.** Earlier revisions carried one — the `pass` revision,
then a re-stamp after `t8` — and every later body edit invalidated the figure it declared; that is the churn
this file went through twice, and it is the root cause §8 now names. A file cannot usefully hash itself, so
the byte-prefix recipes for each revision are recorded in the owning tasks' outputs (`t5`, `t8`, `t10`)
rather than in this block.

Post-review changes made by `t6` (all outside this review's judged artifact set, and none of them a
behaviour change): `package.json` gained a new `description`/`keywords` and two `files[]` entries
(`lib/index.js.map`, `lib/client.js.map`); `README.md` was rewritten for the right-sidebar
integration; `docs/INTEGRATION-RECORD.md` was added; and each of the four gate documents gained the
append-only "Related documents" trailer you are reading. The header `package.json` pin was then
refreshed to the shipped bytes by `t8` (`89256ab9…`), whose block above records that every
`package.json`-dependent acceptance check is unchanged; the reviewed properties (`dependencies`,
`devDependencies` pins, `peerDependencies` floors, `peerDependenciesMeta`, `dsh.client` and
`dsh.bundle`) are untouched and are re-audited in [`INTEGRATION-RECORD.md`](./INTEGRATION-RECORD.md) §3.
Finding `F-1` is also closed on disk: `.verify/inject-pending.mjs` is absent from the delivered tree,
and the rest of §5.1's suite was re-run at exit 0 by `t6`. `F-2` was closed by
[`DELIVERY-RECORD-0.1.5-rc.2.md`](./DELIVERY-RECORD-0.1.5-rc.2.md), authored by `t7`.

- [`../README.md`](../README.md) — user-facing overview: the three monitor surfaces, the steps to open
  the right-sidebar **Subagents** tab, install/rebuild steps and the `0.1.5-rc.2` requirement.
- [`RIGHTBAR-INTEGRATION-SPEC.md`](./RIGHTBAR-INTEGRATION-SPEC.md) — the frozen contract (R1–R12,
  P1–P22, D-1…D-5) this round reviewed.
- [`MIGRATION-0.1.5-rc.2.md`](./MIGRATION-0.1.5-rc.2.md) — the drift inventory behind the pins and
  module ids.
- [`VERIFICATION-RIGHTBAR.md`](./VERIFICATION-RIGHTBAR.md) — the independent verification this review
  judged.
- [`DELIVERY-RECORD-0.1.5-rc.2.md`](./DELIVERY-RECORD-0.1.5-rc.2.md) — the record that closes `F-2`.
- [`INTEGRATION-RECORD.md`](./INTEGRATION-RECORD.md) — final assembly record: delivered hashes, the
  recorded fresh-install reproduction, the packaging audit and the residual limitations.

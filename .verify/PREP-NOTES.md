# Verifier prep notes — frozen evidence gathered before t3 started

Owner: verifier (t4). Nothing here modifies src/, package.json or tsdown.config.ts.

## 1. Frozen pre-change baseline

`git rev-parse HEAD` at freeze time: `f67aa112b4ddae502bfed2ac18c040d11d6f02db`
(copied to `.verify/baseline-HEAD/HEAD.sha`)

Pre-change sources copied verbatim out of git (so a later commit or working-tree edit
cannot move my parity baseline):

| baseline file | source | lines |
|---|---|---|
| `.verify/baseline-HEAD/src_client_panel.tsx` | `git show HEAD:src/client/panel.tsx` | 503 |
| `.verify/baseline-HEAD/src_client_tree.tsx` | `git show HEAD:src/client/tree.tsx` | 259 |
| `.verify/baseline-HEAD/src_client_index.ts` | `git show HEAD:src/client/index.ts` | 525 |
| `.verify/baseline-HEAD/src_client_subagents-tab.tsx` | `git show HEAD:src/client/subagents-tab.tsx` | 527 |
| `.verify/baseline-HEAD/src_index.ts` | `git show HEAD:src/index.ts` | 1045 |
| `.verify/baseline-HEAD/package.json` | `git show HEAD:package.json` | 94 |
| `.verify/baseline-HEAD/tsdown.config.ts` | `git show HEAD:tsdown.config.ts` | 88 |

`git show HEAD:<path>` is the source of truth for "current left-sidebar panel"
parity; the working tree is expected to differ after t3.

## 2. Installed platform = 0.1.5-rc.2 (immutable during this task)

Root: `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`
Verified versions include `dsh-client-ui-sidebar-right@0.1.5-rc.2`,
`dsh-client-ui-layout@0.1.5-rc.2`, `dsh-client-ui-sidebar-documentpreview@0.1.5-rc.2`,
`dsh-client-ui-session@0.1.5-rc.2`, `dsh-web-frontend@0.1.5-rc.2`.

## 3. Rightbar contract, read directly from installed .d.ts

`dsh-client-ui-sidebar-right/lib/types/client/tab-registry.d.ts`

- L68-109 `SidebarRightTabDefinition`: `id` (unique, and **the key the body registers
  under**), `kind` (type discriminator, what `openTab` names), `patterns?`
  (omit => a *page* type opened by kind), `priority?: 'extension'|'builtin'|'fallback'`
  (default `extension`), `canOpen?(address)`, `title(address) => string` (chip text
  captured at open time), `guide?: readonly SidebarRightGuideEntry[]`.
- L45-62 `SidebarRightGuideEntry`: `order`, `title()`, `description?()`, `icon?`.
- L153 `register(definition): () => void` — idempotent disposer, throws on a taken `id`
  or a non-coexisting kind.
- L43 `SidebarRightTabPriority` bands; `extension` outranks every shipped viewer.

`dsh-client-ui-sidebar-right/lib/types/client/contract/slots.d.ts`

- L26-31 stage 2: keyed slot `'sidebar.right.pane.tab'`, scope `session`,
  dispatched with **the `id` of the type in force for `tab.kind`**;
  `inject: SidebarRightTabInjected` (`{ hooks: { tabInfo } }`).
- L40-45 optional `'sidebar.right.pane.tab.title'` keyed title seat.
- L51-60 `'sidebar.right.tab.guide'` chain seat (guide replacement).
- L66-70 `'sidebar.right.tab.menu.item'` list seat for extra tab-menu items.
- L117-139 `SidebarRightTabInfo`: `sidebar.expanded`, `sidebar.fullscreen`,
  `panel.id`, `tab` (TabRecord + `visible`, `navigation{address,params,revision}`,
  `signal`, `actions{openResource,openTab,close}`).

`dsh-client-ui-sidebar-right/lib/types/client/index.d.ts`

- L39 `inject` is a runtime `string[]`; L44-45 `ctx.sidebarRightTabs` (stage-1
  registry) and `ctx.sidebarRight` (navigation/presentation controller) are declared
  on the cordis `Context`.

`dsh-client-ui-sidebar-right/lib/types/client/service.d.ts`

- L105-168 `ISidebarRight`; L125 `openTab<K>(kind, options?)`;
  L118 `openResource(address, options?)` (address must be `dsh-resource://…`).
- L80-91 `SidebarRightPlacement`; L100-103 `SidebarRightOpenTabOptions`.

## 4. Runtime behaviour established from the shipped bundle (not just types)

`dsh-client-ui-sidebar-right/lib/client.js`

- Rightbar package's own client `inject` = `["slots","layout","locale","resources"]`.
- **`openTab` (and `openResource`, `close`, `toggleExpanded`, `focus`, `split`,
  `float`, `dock`) call the controller's private `require()`, which throws
  `Error("sidebarRight: no session surface is mounted")` when no rightbar seat is
  mounted.** `isExpanded()` returns `false` instead of throwing (it goes through
  `mounted()?.…`).
- Consequence to check in t3: any *plugin-initiated* open path (a host route call,
  a left-sidebar button, or a `ctx.sidebarRight.openTab(...)` fired before the
  rightbar seat mounts) can throw unless the seat is mounted. The
  registry/guide path opens through the seat itself and does not have this hazard.

Reference shipped tab type `dsh-client-ui-sidebar-documentpreview/lib/client.js`:

- `inject = ["slots","locale","sidebarRightTabs","remote","remote.workspaceFiles"]`
- stage 1: `ctx.effect(() => ctx.sidebarRightTabs.register(textDefinition()), "ui-sidebar-documentpreview: text type")`
- stage 2: body registered under `sidebar.right.pane.tab` (title under
  `sidebar.right.pane.tab.title`).

## 5. What t4 will do the moment t3 lands

1. Re-run `pnpm install`, `pnpm build`, `pnpm typecheck` myself; record exit codes.
2. Diff the built `lib/client.js` registration + slot table against §3/§4 above.
3. Exercise both host routes on a real instance of the built host half.
4. Item-by-item parity diff against `.verify/baseline-HEAD/src_client_panel.tsx`
   and `src_client_tree.tsx` (see the parity checklist in the t4 acceptance).
5. Spot-check every platform claim in the t1/t2 docs against the installed .d.ts.

## 6. Citation audit (analyst-rightbar correction + my own re-check)

analyst-rightbar corrected a citation of mine; I re-ran every line reference directly.
**Correction accepted: my earlier "service.d.ts:13-17" for the fails-loudly sentence was
wrong** — :13-17 is the `tabActions` paragraph. The sentence is at :8-10. Line :192 is
`bind(...)`, unrelated to the throw.

Verified-exact in `.../dsh-client-ui-sidebar-right/lib/types/client/service.d.ts`:

| ref | line content |
|---|---|
| :8-10 | "…a command arriving with no seat mounted has no session to act on and fails loudly rather than writing into a surface nobody is drawing." |
| :192 | `bind(binding: SidebarRightBinding): () => void;` |
| :198 / :204 | `openResource(…)` / `openTab<K>(…)` |
| :241 / :253 / :258 / :264 / :270 / :275 | `close` / `toggleExpanded` / `focus` / `split` / `float` / `dock` |
| :246 (doc 243-246) | `active(): TabRecord \| undefined;` |
| :251 (doc 247-251) | `isExpanded(): boolean;` |
| :297 | `private require;` |

Runtime in `.../dsh-client-ui-sidebar-right/lib/client.js` (two off-by-one ranges worth
quoting precisely; the substantive claim is correct):

| ref | line content |
|---|---|
| :1414-1417 (throw at :1415) | `require() { if (this.binding === void 0) throw new Error("sidebarRight: no session surface is mounted"); … }` — analyst said :1413-1416 |
| :1314-1319 | `active()` via `mounted()?.layout`, returns `undefined` with no seat — exact |
| :1324-1326 | `isExpanded()` → `mounted()?.layout.expanded ?? false` — exact |
| :1255-1258 | `openTabIn(sessionId, kind, options)` — exact |
| :1135-1140 | `tab.actions.openTab` wired to `navigator.openTabIn(sessionId, …)` — exact |
| :174-185, call at :181 | `GuideBody` → `onPick: (entry) => { tab.actions.openTab(entry.kind, { replaceTab: true }); }` — analyst said :174-186 |

### The spec's central safety claim is CONFIRMED

`openTabIn` (:1256) resolves actions through `actionsFor(sessionId)` →
`this.adopted.get(sessionId)?.store.actions` (**:1411-1413**; my earlier ":1311-1313"
was the doc comment above `active()` — my second citation error, corrected after
analyst-rightbar caught it) and then guards
`if (actions !== void 0)` (:1257). An `awk` scan of :1250-1262 shows **no `require()`
call anywhere in `openTabIn`**. So the guide-entry path (`GuideBody` :181 → tab action
:1135-1140 → `openTabIn` :1255-1258) cannot raise "no session surface is mounted".

One precision to carry into t4's report: this path is not merely throw-free, it is a
**silent no-op** when the session's store was never adopted (the `actions !== void 0`
guard) — the open simply does not happen. "Safe" therefore means "cannot throw", not
"always opens".

Consequence for t3, to check in the built bundle: `inject` must list `sidebarRightTabs`
and there must be **no `ctx.sidebarRight.<method>(…)` invocation**. Static grep for
`sidebarRight.` hits must be registry/service names only (`sidebarRightTabs.*` is the
registry and is expected; a `sidebarRight.openTab(` / `.openResource(` / `.close(` etc.
call is the defect). Note the substring `sidebarRight.` alone is ambiguous because
`ctx.sidebarRight` may legitimately appear as an inject string, so the check is for a
method invocation, not the substring.

### Why the silent no-op is unreachable on the guide path (analyst-rightbar's amendment, verified)

Re-verified by explicit re-measurement (`awk 'NR>=… && NR<=…'`), all citations now exact.
**Discipline adopted after my third and fourth citation errors: no line number enters this
log without an explicit `awk`/`sed` re-measurement first.** Reading context windows and then
quoting from them is what produced every error of mine (`:13-17`, `:192`, `:1311-1313`,
`:3665`, `:3689-3692`).

- `client.js:3664` — `const { controller, adopt } = createSidebarRightController(tabs, (address, signal) => {`
- `client.js:3665` — `ctx.resources.pin(address, signal);` (this is what my earlier ":3665"
  wrongly cited as a `provide` call)
- `client.js:3667` — `const disposeRegistry = ctx.reflect.provide("sidebarRightTabs", tabs);`
- `client.js:3668` — `const disposeService = ctx.reflect.provide("sidebarRight", controller);`
- `client.js:3669-3673` — the `ctx.effect` that disposes the Tab domain and both faces
- `client.js:3681-3688` — the store wrapper (my earlier ":3677-3688" was wrong at the start:
  :3678-3680 are the effect opening, `createSidebarRightStore` and `const adoptions = []`):
  `const store = { ...handle, create: (scopeKey) => { const instance = handle.create(scopeKey); if (scopeKey !== void 0) adoptions.push(adopt(scopeKey, instance)); return instance; } }`

So a session store minted inside the mounted seat is always registered with the controller,
`actionsFor(sessionId)` therefore resolves, and `openTabIn`'s `actions !== void 0` guard
passes. The silent no-op is a real behaviour but is not reachable from the guide.

Also noted for t1's "who shows the right sidebar" question: `client.js:3691-3694` —
`syncPresentation({shown, track, fullscreen}) { if (shown) layout.openRightbar(track, fullscreen); else layout.closeRightbar(); }`
(`:3689` is `const layout = ctx.layout;`, `:3690` is `const injected = {`; my earlier
":3689-3692" was off by two, the analyst's ":3691-3693" was right). i.e. the seat, not the
consumer plugin, drives `ctx.layout.openRightbar`. This package's own client `inject` is at
`client.js:3648-3653` = `["slots","layout","locale","resources"]`.

### Corrected exact call shape for the t3 bundle check

`grep -rnE 'sidebarRight\.(openResource|openTab|close|toggleExpanded|focus|split|float|dock|active|isExpanded)\s*\(' src/client`
must return no matches in source, and the built `lib/client.js` must contain no such
invocation; the inject list must contain `sidebarRightTabs` and not `sidebarRight`.

**Refinement that makes the inject assertion sound:** `"sidebarRight"` is also the package's
LOCALE namespace — `client.js:3646` `const NS = "sidebarRight";`, used at `:3674`
`ctx.locale.register(NS, …)`, and mirrored in the type declaration
(`contract/slots.d.ts:8-11` `LocaleNamespaceMap { sidebarRight: SidebarRightKey }`). So a
substring search of the bundle for `sidebarRight` or `"sidebarRight"` **false-positives
regardless of correctness**. The assertion must inspect the inject ARRAY itself, not bundle
text. Likewise the injected property name is `sidebarRightTabs`/`sidebarRight` on `Context`,
so name presence is not evidence of a call.

### Revision lineage of the t1 spec (hash-first)

| revision | lines | sha256 | status |
|---|---|---|---|
| r3 + 4 amendment rounds | 790 | `16384a5ea21bc83a139921c5268abc88d8af92978b64418bf1b4552694f6732a` | SUPERSEDED by authorized R11.1 repair |
| r4 (repaired) | 827 | `76668c531c600975b4e1be089b24288dfe787690d0b580a211b762d1c41d1f21` | **current; verified by me against the on-disk file** |

- The 827 revision carries the captain-authorized R11.1 scoped repair (inject stays
  `['slots','sessions','layout']` + conditional `ctx.inject(['sidebarRightTabs'], (scoped) => …)`,
  each registration inside `scoped.effect`), touching R11.1, R2.1/R3.1, §4, §6 s6, plus new
  R11.6 fallback contract and three consistency sentences (§2.2, §2.5.4, R9.6).
- t1's completion output says "734 lines" — an immutable snapshot from completion time. The
  file on disk is authoritative; t5 must review the on-disk file.
- Any further change of hash invalidates the citation audit above and must be re-run.
- Analyst-rightbar has ONE pending non-normative correction (§2.6/R11.2 "host drops subpaths"
  rationale wording); I verified their measurement is right — see §8. It changes no assertion.

### Corrected citation: cordis `ctx.inject` (my sixth citation error, caught by analyst-rightbar)

`cordis/lib/types/registry.d.ts`, re-measured:
- `:101-110` the doc block ("Run a callback once the requested services are available…")
- `:111` `inject(deps: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>;`
  (the `Context` augmentation inside `declare module './context.ts'`)
- `:185` the second declaration, on the `RegistryService` class

My earlier ":103-116" and the captain's identical range both **overshoot into the next member**
(`:112+` is `plugin()`). The analyst's `:102-111` is the correct range. This is the sixth
citation error of mine and it came from propagating a range out of a message instead of
measuring it — the exact discipline failure §6 says I would stop making. Rule restated: a
citation is only usable after my own `awk`/`sed` measurement, whoever proposed it.

## 7. SUPERSEDING DECISION: the inject array (captain ruled; rationale independently verified by me)

The captain ruled: **do NOT hard-list `sidebarRightTabs`.** `exports.inject` stays
`['slots','sessions','layout']`; the two rightbar registrations move inside
`ctx.inject(['sidebarRightTabs'], (scoped) => { … })`, each still inside `ctx.effect`.
`package.json dsh.client.inject` still gains `@deepseek-ai/dsh-client-ui-sidebar-right`
(order-only). analyst-rightbar is applying this as a scoped repair to
R11.1/R2.1/R3.1/§4/§6, so **the 790-line hash above is superseded — re-hash before t4.**

I verified the platform rationale myself, end to end, rather than accepting it from the
analyst's message. The complete fatal chain:

1. A plugin whose cordis `inject` names a service that is never provided stays `pending`
   (cordis `inject` is a wait-for-services mechanism).
2. `dsh-web-frontend/dist/assets/index-BKQ_L1z6.js` — `runPluginBoot(...)` ends with
   `await i.await(), this.assertEntriesActive(t)`.
3. `cordis-plugin-loader/lib/index.js` `Loader.await()` throws ONLY for *rejected* entry
   awaits (import/apply failures); with none it calls `this.ctx.reflect.notify(["loader"])`
   and **returns**. So it does not block on a pending entry and does not throw for one.
   (Corroborating: the platform's own post-`await` audit only makes sense if `await()`
   resolves while entries can still be pending.)
4. `assertEntriesActive(t)` then walks `t.loader.entries()`; for a non-active fiber it
   pushes `` `${s}: pending (waiting for service${…}: ${c.join(", ")||"unknown"})` `` where
   `c = Object.keys(i.fiber.inject).filter(h => t.get(h) === void 0)`, and finally
   `if (r.length>0) throw new Error(\`web boot: ${String(r.length)} entr… did not activate…\`)`.
5. `async run()` wraps all of this in `try { … await this.runPluginBoot(a,s); await this.mountApp(a) } catch(t){ console.error(t), this.page.fail(…) }` — so the throw is caught,
   `mountApp` is **never reached**, and the whole client app fails to mount.

Supporting API facts verified in cordis **4.0.2**:
- `ctx.inject(deps, callback)` — `cordis/lib/types/registry.d.ts:103-116`: "Run a callback
  once the requested services are available… the callback is unloaded and re-run whenever a
  required service changes".
- `ctx.get(name)` — `cordis/lib/types/reflect.d.ts:14`: returns `undefined` when not (yet)
  provided. Non-throwing, usable outside the scope.
- `dsh-client-modules/lib/client.js:265-268`: `for (const packageName of row.inject) { const dependency = this.graphRows.get(packageName); if (dependency !== void 0) await this.arriveGraphRow(...) }` — a `dsh.client.inject` name with **no row is skipped**, not force-loaded. So the
  hard cordis inject can be unsatisfiable while our own row is composed.

### Consequence for t4's assertions (post-repair)

- `exports.inject` must NOT contain `sidebarRightTabs`, and must NOT contain `sidebarRight`
  — asserted on the ARRAY, via the `__ModuleLoader__` shim, never by text search (§6).
- Source must contain `ctx.inject(['sidebarRightTabs'], …)` wrapping both registrations.
- `package.json`: `dsh.client.inject` gains `@deepseek-ai/dsh-client-ui-sidebar-right`;
  if that package is a peer it must be an **optional** peer via `peerDependenciesMeta`.
- Fallback claim to test: with no `ui-sidebar-right` row composed, the left bar + panel and
  the `conversation.view` Subagents tab must still work and nothing may be left pending.
- Call-shape grep (§6) is unaffected and still applies.

## 8. `dsh.client.inject` subpath claim — analyst-rightbar's non-normative correction, verified

Their pending correction says the host does NOT "drop subpaths" from `dsh.client.inject`.
I measured it; they are right:

- `dsh-client-modules/lib/index.js:145` — `const inject = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);` The declaration parse only validates that it is a string
  array (`:141-152`). There is no subpath normalization or stripping anywhere in it.
- `dsh-client-modules/lib/index.js:682` — `const expectedPackageName = pathLike ? void 0 : exactPackageSpecifier(loaderName);` inside `locatePkgJson(loaderName, baseUrl)` (`:679-683`).
  `exactPackageSpecifier` is used to derive the expected package name of a **Loader entry
  name**, not to normalize `dsh.client.inject` members.
- Combined with `client.js:265-268` (§7), an unknown or subpath-bearing name in
  `dsh.client.inject` is simply **inert**: `graphRows.get(...)` misses and the loop skips it.

Assessment: this is a doc-precision issue only. No normative instruction, acceptance
criterion, or t4 assertion depends on it. If the captain authorizes the two-sentence repair
I re-hash and re-audit; if not, 827/76668c53… is the revision I verify against and the wording
is a minor finding for t5.

## 9. BINDING t4 PROCEDURE (captain's rules, recorded verbatim in substance)

The captain authorized the §2.6/R11.2 precision repair on top of the 827 revision, which
SUPERSEDES `827/76668c53…`. Lineage to extend when the new hash lands:

    790 / 16384a5e…  ->  827 / 76668c53…  ->  <repaired revision, hash pending>

Two rules stated by the captain for t4, recorded here so a message cannot mislead me:

1. **Hash the file ON DISK at t4 start and audit against whatever it actually is — never
   against a hash quoted in a message, including the captain's.** If the on-disk file is not
   the revision the engineer says they built against, **that discrepancy is itself a finding.**
   Concretely, at t4 start I will run
   `shasum -a 256 docs/RIGHTBAR-INTEGRATION-SPEC.md` and `wc -l`, record both, and compare
   against (a) the hash the engineer claims to have built against and (b) the current lineage
   entry above. Any mismatch with the engineer's claimed revision is reported as a finding,
   not smoothed over.
2. **The unconditional citation rule applies to the captain's messages too** — every line
   number is re-measured with `awk`/`sed` before it enters `docs/VERIFICATION-RIGHTBAR.md`,
   regardless of who supplied it. The captain accepted that `:102-111` is the correct
   `ctx.inject` range and that the `:103-116` they repeated originated from me.

Confirmed independently by the captain as well (measurement, not assertion): the subpath
reading — `index.js:141-152` array-only validation, the single `:682` call site inside
`locatePkgJson`, `client.js:265-268` inert arrival.

### t4 scope confirmed by the captain

Claim `t4` when `t3` completes, then run: build/typecheck reproduction; direct inspection of
`lib/client.js` and `lib/index.js`; host-route contract checks on a running instance;
item-by-item parity against `.verify/baseline-HEAD/`; **structural** inject assertions via the
`__ModuleLoader__` shim (`!includes('sidebarRightTabs')`, `!includes('sidebarRight')`); the
`ctx.inject(['sidebarRightTabs'], …)` presence check; the optional-peer check
(`peerDependenciesMeta`); the call-shape regex; and the no-`ui-sidebar-right` fallback
(left bar + `conversation.view` tab still work, nothing left pending).

## 10. Post-verification: the last outstanding spec claim, spot-checked

`docs/RIGHTBAR-INTEGRATION-SPEC.md` is **836 lines / sha256 `81054f1188603611102ef42db534ec97d88bddbfeec7caada0d473beb9838beb`**
(re-confirmed after t4 completed; this is the revision `docs/VERIFICATION-RIGHTBAR.md`
pins). analyst-rightbar reports the lineage as
`790/16384a5e… → 825/efac9eb2… → 827/76668c53… → 836/81054f11…` — note the interim
`825/efac9eb2…` I never observed, only the two endpoints are hash-verified by me.

The 836 revision added one platform claim I had not spot-checked, so I checked it rather
than leave my report's "no unsupported platform claim was found" resting on an unchecked
sentence. Spec line 286 says `dsh.client.inject` creates no host row ordering:

> `orderByModuleGraph` (`MODULES/lib/index.js:349-372`) reads only …

**Substantively CORRECT.** `dsh-client-modules/lib/index.js:349-371` — the only dependency
source in the function is `entry.external ?? []` at `:360`; `entry.inject` is never read
anywhere in it, so an inject name cannot create a row-ordering edge. (Ordering does consult
`external` and `stripClientSuffix` at `:361`.)

**Range nit (LOW, doc precision only):** the function is `:349-371`; line `:372` is the
start of the next comment block (`/** Bootstrap package whose ordinary client bundle … */`).
The doc's `:349-372` overshoots by one line — the same off-by-one class the analyst and I
have been correcting in each other's citations.

I deliberately did **not** edit `docs/VERIFICATION-RIGHTBAR.md` for this: t5 was `in_progress`
against it, the report's statement is true as written, and changing a deliverable under
review would invalidate the hash I reported (it currently pins `2b2e34d6…`). The
confirmation and the nit are recorded here and were sent to the analyst (doc owner) and the
captain instead.

### Further spot-check: the `exactPackageSpecifier` claim

Spec line 281 cites `exactPackageSpecifier` (`MODULES/lib/index.js:131-138`) with its single
use at `:682`. Re-measured: the function is declared at `:132`
(`function exactPackageSpecifier(specifier) {`) with its doc comment at `:131`, so the
`:131-138` range is accurate; and `grep -n` over the whole file returns **exactly two**
hits — the declaration `:132` and the single call site `:682`
(`const expectedPackageName = pathLike ? void 0 : exactPackageSpecifier(loaderName);` inside
`locatePkgJson`). Spec line 592 repeats "its single use at :682". Both correct. ✔

### Status of my `:349-372` range nit — NOT obsolete

analyst-rightbar's later message reads as if my doc-precision note were superseded by the
836 revision, conflating it with the *subpath wording* nit (that one **was** fixed in 836).
They are different notes. The `:349-372` range is **inside** 836 and is still wrong: spec
line 286 still reads `` `orderByModuleGraph` (`MODULES/lib/index.js:349-372`) `` while the
function ends at `:371`. Verified once more at the final hash. Severity stays LOW — no
normative line and no t4 assertion depends on it; it is a doc-precision item for t5.

Revision status re-checked at the end of this exchange: `docs/RIGHTBAR-INTEGRATION-SPEC.md`
is still **836 lines / sha256 `81054f11…`**, i.e. exactly the revision t4 pinned, so the
"you recorded one step behind" reading is a crossed-message artefact, not a gap.

---

**Errata (0.1.5 follow-up pass).** §10 and the closing paragraph call `docs/RIGHTBAR-INTEGRATION-SPEC.md` "836 lines / `81054f11…`": the judged 61392-byte prefix `81054f11…` still verifies, and the file is now 860 lines with whole-file hash `53e3e314…` after `t6`'s appended links-only trailer. See [`docs/ERRATA-0.1.5.md`](./ERRATA-0.1.5.md). Appended, not inserted: every byte above this line is unchanged, so the prefixes this record pins still verify.

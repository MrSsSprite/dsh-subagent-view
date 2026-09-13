# subagent-view

A DeepSeek Harness (DSH) web extension that monitors subagent runs live in the DSH web UI.
One monitor, two hosts — the left-sidebar status bar and the right-sidebar tab share one store,
and the conversation view reads the same host data:

| # | Surface | Registration | How you reach it |
| --- | --- | --- | --- |
| 1 | **Left sidebar status bar** (display only) | slot `sidebar.footer.action`, `id: subagent-view`, `order: 100` | nothing to do — the counts line sits at the bottom of the left sidebar; it is **not clickable** and there is nothing to expand |
| 2 | **Conversation · Subagents view** | slot `conversation.view`, `id: subagent-view`, `order: 30` | the conversation's *Subagents* view selector |
| 3 | **Right sidebar · Subagents tab** | rightbar tab type, `id`/`kind: subagent-view` + body in the keyed seat `sidebar.right.pane.tab` | the right sidebar's guide page — see [Opening the Subagents tab](#opening-the-subagents-tab-from-the-right-sidebar) |

**The full monitor lives in the right sidebar and the conversation view.** The left sidebar used to
host an expandable panel of its own; that panel was retired once the right-sidebar tab existed,
because both rendered the same card (`SubagentMonitorPanel`) over one module-level store and one
reference-counted 1-second poller and could not drift apart. Surface 1 is now a read-only counts
row, and the right tab is the only docked place a monitor opens. Surface 2 is the earlier,
self-contained implementation: it reads the same host data through the `/api/subagent-view/tab`
route, polls on its own interval and reuses the same tree/archived components, so it lists the same
subagents with its own presentation defaults (it opens fully expanded, the right tab opens
collapsed).

The bar shows the counts at a glance as colored dots — `n ● · m ● · k ●` (blue = running,
green = done, red = failed) — hiding zero-count types and showing `None` when all are zero;
picking the tab (surface 3) reveals the full tree: every subagent
of the tracked session, with status, duration, disclosure branches and an **Archived** folder
for completed one-shot runs.

The plugin is a from-scratch, English-language reimplementation of the MIT-licensed
[`@leetoners/dsh-ui-subagent-monitor`](https://github.com/Mombrane/dsh-subagent-monitor). It keeps
the reference feature set but renders inside DSH's own sidebar surfaces instead of a floating
overlay window, so nothing ever covers the conversation.

### A note on upgrade behaviour

Retiring the left panel removed the plugin's only call to `ctx.layout` (the collapsed-rail button
that expanded the sidebar and opened the panel). The client `inject` array is therefore
`['slots', 'sessions']` — no `layout` — and `@deepseek-ai/dsh-client-ui-layout` is no longer a
declared peer or a `dsh.client.inject` graph row. That is a **manifest** change, so it reaches an
installed profile only after `dsh plugin add` *and* a `dsh web` restart (see
[Propagating a rebuild](#propagating-a-rebuild-the-install-is-a-copy)).

## Opening the Subagents tab from the right sidebar

The plugin does **not** draw a button anywhere for this, and it never calls the right sidebar's
controller (`ctx.sidebarRight.*`), because every controller command throws
`sidebarRight: no session surface is mounted` whenever the right column's seat is not mounted.
The supported, throw-free path is the tab type's own **guide entry**, opened by the platform
itself:

1. **Select a session** (the right sidebar belongs to the conversation; it is not drawn while a
   global panel is selected).
2. **Show the right sidebar.** If it is collapsed, use the conversation header's expand button —
   the right-sidebar package's own control, marked `data-sidebar-right-expand` in the header
   corner. If it is already shown, skip this: opening a tab expands the column automatically.
3. **Reach the guide.**
   * A pane that expands **empty for the first time** is seeded by the platform with its guide
     page (with more than one guide entry registered the platform seeds the guide instead of the
     shipped Files page — see [Platform notes](#platform-notes)).
   * If the pane already holds a page, click the pane strip's **add** control (the kit's add-tab
     button), which opens the guide as a tab.
4. **Pick the `Subagents` capsule.** The guide lists `Files` (`order: 10`, shipped by the
   platform) and `Subagents` (`order: 20`, from this plugin), each with its description. Clicking
   `Subagents` calls the guide tab's own `openTab('subagent-view', { replaceTab: true })`, which
   replaces the guide in that pane with a tab whose chip reads **Subagents**.
5. **Use the monitor.** The tab body is the monitor panel card, for the
   session that pane belongs to: status dots, `n running`, counts legend, disclosure tree,
   **Archived**, `Open` on each addressable row, `← Main session` on a subagent session,
   `Clear finished`, `Show hidden (n)` and the empty state. It fills the pane and scrolls its row
   list; closing it is the kit's normal tab close control. Reopening it from the guide restores
   the same rows — the state belongs to the shared store, not to the tab.

If another plugin also contributes a rightbar tab type (for example a third-party plugin with its
own guide entry), its capsule appears in the same guide list; the entries are ordered by `order`
and ties follow registration order.

## Features

- **Left sidebar status bar (display only).** One persistent read-only row at the bottom of the
  left sidebar: a dot count `n ● · m ● · k ●` (blue = running, green = done, red = failed), with
  zero-count types omitted and `None` shown when all counts are zero. It has no click target and no
  hover state; the counts come from the same store and the same subtree-aware pruning as the tab,
  so the two can never disagree.
- **Right sidebar tab.** A page tab type with the chip title `Subagents`, offering one guide
  entry (`order: 20`, description *Live subagent runs for the selected session*). Its body is the
  monitor card, filling the pane, with no click-to-collapse affordance (there is nothing to
  collapse inside a tab).
- **Conversation Subagents view.** The `conversation.view` tab, unchanged: its own poll of the
  host's `/api/subagent-view/tab` route, rendering the same `SubagentTree`/`ArchivedFolder`
  components as the other surfaces.
- **Live statuses.** Each row shows a status dot and duration: running (animated blue),
  completed (green), error (red), interrupted/token-limit/refused (amber), and history-only
  rows (gray).
- **Archived folder.** Completed one-shot subagents are grouped into a collapsible
  **Archived** folder at the bottom of the list (collapsed by default in every surface). Their
  status, dot color, and Done count are unchanged —
  only their placement changes; each archived subagent's subtree moves with it so the tree
  never orphans a child.
- **Canonical disclosure tree.** Rows with children get a chevron-right `>` on their left
  that rotates downward when pressed to expand the branch, with gray `L`-shape guide lines
  marking parent-child relationships — the same visual the built-in subagent catalog uses.
  The right sidebar tab starts with every branch collapsed; the
  conversation Subagents view starts fully expanded. Each keeps its expansion state across the 1s
  polls.
- **Open conversation.** A button on each row opens that subagent's conversation in the main view,
  in every surface (rows without a durable mode, and the row for the conversation you are already
  in, have no address and no button).
- **Back to main session.** One click returns from a subagent conversation to the root session.
- **Clear finished.** Hides every fully-finished subtree (any branch that still contains a
  running subagent stays visible) from the list and the bar counts until the next change.
- **One shared 1-second poll.** A single reference-counted poller serves the status bar and the
  right tab — the two hosts of the shared store: the interval runs while at least one of them is
  mounted and stops with the last unmount, so mounting the tab never doubles the request rate. The
  unchanged conversation view keeps its own poll, as it always has.
- **Refresh recovery.** All state is re-served by the host on the next poll, so a page refresh
  recovers the full picture without any model interaction.
- **Mobile friendly.** On viewports ≤ 768px the left sidebar collapses to its rail, where the same
  counts row renders with its text ellipsized. The right-sidebar tab deliberately leaves
  presentation to the platform and renders identically docked, fullscreen or floated.

## Platform notes

- **The right sidebar is the platform's.** Its column, its seats, its expand button, its pane
  strip and its tab chrome all come from `@deepseek-ai/dsh-client-ui-sidebar-right`. This plugin
  contributes exactly two registrations (the tab type and its body) plus the guide entry; it
  never shows, expands, floats or closes the column.
- **Guide seeding.** A pane that expands empty is seeded by the platform with the guide page when
  more than one guide entry is registered; this plugin's entry is one of them. On a stock
  platform that means first expansion shows the guide (Files + Subagents) instead of the Files
  page. Profiles that already run another tab type with a guide entry behaved that way before this
  plugin was added.
- **The left bar is display-only.** Surface 1 is a read-only counts row: no rail button, no desktop
  auto-open, no click-to-collapse header, no pointer cursor. It stayed because the counts are useful
  at a glance; the monitor it used to open is now the right-sidebar tab. That makes the right tab the
  only docked monitor, and surface 2 keeps its full expansion default. The retirement (and the
  requirements it supersedes) is recorded in `docs/ERRATA-0.1.5.md` §E-8.
- **No plugin-initiated open.** There is no left-bar button, host route or command that opens the
  right tab, because the rightbar controller throws while no seat is mounted (`isExpanded()` and
  `active()` cannot be used as guards either: both report "collapsed"/`undefined` for "no seat").
  The guide capsule is the documented path; a future entry point would have to be called from
  inside the right-sidebar seat or treat that throw as "no column".

## Install

> Replace `<repo>` with the absolute path to this repository and `<profile-dir>` with your DSH
> profile directory (e.g. `~/.dsh/profiles/web`).

**Platform requirement: DSH `0.1.5-rc.2`** — the `@deepseek-ai/*` package set, including the
right-sidebar packages this integration uses. (The launcher CLI identifies itself as
`@deepseek-ai/dsh@0.1.5-rc.1`; the platform *packages* it boots are `0.1.5-rc.2`, which is the version
this package pins and the one that matters here.) `@deepseek-ai/dsh-client-ui-sidebar-right` is
declared as an **optional** peer, so a deployment that does not compose it still installs and
still gets surfaces 1 and 2; it simply has no right sidebar to register into. The client
`dsh.client.inject` list names the right-sidebar package so its browser row arrives before this
plugin's bundle materializes.

Build once from a clean tree (all three must pass):

```bash
cd <repo>
pnpm install --frozen-lockfile && pnpm build && pnpm typecheck
```

Then install into the `web` profile (adjust the path for other machines):

```bash
dsh plugin --profile web add "file:<repo>"
```

`dsh plugin add` appends `subagent-view` to the profile's `dsh.profile.bundles` automatically
because the package declares `dsh.bundle`, and the bundle's `cordis.patch.yml` inserts the host
entry. Restart `dsh web` once so the new plugin set is picked up:

```bash
# stop the process serving 127.0.0.1:3080, then:
dsh web --host 127.0.0.1 --port 3080
```

Manual equivalent (no CLI): add
`"subagent-view": "file:<repo>"` to `dependencies`
in `<profile-dir>/package.json`, append `"subagent-view"` to
`dsh.profile.bundles`, then run `pnpm install` inside the profile directory. Back up the
profile manifest first:

```bash
cd <profile-dir>
cp package.json package.json.bak-sv && cp pnpm-lock.yaml lock.bak-sv
```

Profile files live outside this repo and require an unsandboxed shell (sandboxed agents see the
profile mounted read-only).

> **These install steps mutate your live profile.** They were documented, not executed, by the
> integration task that assembled this revision: no profile at `~/.dsh/profiles/web` was touched and
> no running `dsh web` server was restarted. Run them yourself when you are ready — see
> [docs/INTEGRATION-RECORD.md](./docs/INTEGRATION-RECORD.md) §5 for the exact set of files a reinstall
> rewrites.

### Propagating a rebuild (the install is a copy)

A `file:` profile install is a **copy** of this package, not a symlink: after the first install the
profile holds its own `lib/index.js` and `lib/client.js`, so a rebuild in this repo never reaches
the running server on its own. Every change needs both of these:

```bash
# 1. put the rebuilt halves where the server actually reads them
dsh plugin --profile web add "file:<repo>"     # reinstall the profile package
# ...or, for a client-only tweak on an already-correct package.json:
#   cp lib/client.js lib/client.js.map <profile-dir>/node_modules/subagent-view/lib/

# 2. restart the web server (required for the HOST half)
#    stop the process serving 127.0.0.1:3080, then:
dsh web --host 127.0.0.1 --port 3080
```

The restart is not optional for the host half: the plugin's node module is imported once at boot,
and `dsh-client-modules` additionally caches each package's `dsh.client` metadata per process
(`reconcilePackage` returns early while the package source is unchanged), so a changed
`dsh.client.inject` list — e.g. the right-sidebar row added by this revision — is only re-read at
boot. Until the profile copy is refreshed **and** the server restarted, the running server keeps
serving the previous `lib/` — a rebuilt repo alone changes nothing on the wire.

### Verify (no browser needed)

On an auth-protected deployment the three request classes answer differently, so read the codes
literally:

| Request | Unauthenticated answer | Meaning |
| --- | --- | --- |
| `/` | `401` | the HTML shell is auth-gated |
| `/plugins/<id>/client.js` | `404` | the bundle route is auth-gated as well, and it answers **404** rather than 401 when the request is not authorized — a 404 here is not proof that a bundle is missing |
| `/api/subagent-view/*` | `200` | the plugin routes are genuinely unauthenticated |

To exercise the two gated checks, either send a session cookie (`curl -b cookies.txt …`) or point
them at an auth-disabled deployment.

```bash
# graph row present (also proves the boot protocol); add -b cookies.txt on an
# auth-protected deployment, where this otherwise answers 401:
curl -s http://127.0.0.1:3080/ | grep -o '{"id":"subagent-view"[^}]*}'

# client bundle served with the module-loader wrapper; 404 here means
# "not authorized" on an auth-protected deployment, not "missing bundle":
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://127.0.0.1:3080/plugins/subagent-view/client.js
curl -s 'http://127.0.0.1:3080/plugins/subagent-view/client.js?rev=0' | head -c 120

# snapshot endpoint, canonical wire contract (always 200 with a JSON body):
curl -s 'http://127.0.0.1:3080/api/subagent-view/snapshot?sessionId=test-abc'
# → {"sessionId":"test-abc","now":<ms>,"rows":[...]}
curl -s 'http://127.0.0.1:3080/api/subagent-view/snapshot'
# → {"now":<ms>,"rows":[]}   (sessionId key omitted when the param is absent)

# tab endpoint, same contract:
curl -s 'http://127.0.0.1:3080/api/subagent-view/tab?sessionId=<session-id>'
# → {"currentId":"<session-id>","rootId":"...","now":<ms>,"ancestors":[...],"rows":[...]}

# both routes against a session that has a live subagent must answer 200, not 400
for s in <session-id-with-running-subagents>; do
  printf 'snapshot=%s tab=%s\n' \
    "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3080/api/subagent-view/snapshot?sessionId=$s")" \
    "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3080/api/subagent-view/tab?sessionId=$s")"
done
```

Neither route is allowed to answer anything but `200` with a JSON body: a non-JSON answer used to
mean "an uncaught handler error" (the web server maps those to an empty-body `400`), which the
browser halves could not tell apart from a network blip. When the host degrades, it still answers
`200` and adds an `error` string to the payload.

The right-sidebar tab needs no new route: it draws the same `/api/subagent-view/snapshot` payload
the left status bar draws. In the browser, check that the guide lists `Files` + `Subagents` and that
a tab chip named `Subagents` opens the monitor.

### Coexistence with the reference plugin

The plugin is self-contained: it registers its own routes under `/api/subagent-view/*` and its own
slot entries, and it never imports, disables or depends on any other subagent UI. If a deployment
also runs the reference `@leetoners/dsh-ui-subagent-monitor`, both surfaces render independently;
check that plugin's own README for its route and bundle ids. Whether the two appear together in a
given profile is that profile's composition, not something this package decides or documents.

## Platform surfaces this plugin deliberately does not use

`0.1.5-rc.2` ships more subagent machinery than this plugin consumes. These are **dispositions, not
defects**: each is an unexplored opportunity or a deliberate non-adoption, recorded so the next
reader does not have to re-derive it. Nothing here is known to be broken.

| surface | what it is | disposition |
| --- | --- | --- |
| `subagentCatalog` | a `sessionProjections` projection registered by `dsh-subagent` (`lib/types/catalog.js:68`, `lib/types/index.js:129`): local child creation appends a `subagent/catalog` fact to the **parent** session, folded durably per parent with `inheritedEventCount` excluded from the count, exposed as `projections.values.subagentCatalog` | **Not used.** It is the one plausible *alternative data source* for this plugin's row list. The plugin keeps its own `subagentOutcome` projection instead (a different key — no registration collision) and derives rows from live `subagents.listDescendants()` plus `sessionQuery`/`sessionProjectionCache` replay for cold sessions. Adopting the catalog could remove the `sessionQuery` cold-path read and/or make cold rows exact, since it records the parent's own view of child creation rather than relying on observed descriptor/lifecycle facts. That is a follow-up feature, not a migration requirement |
| `@deepseek-ai/dsh-client-ui-subagent` | the roster-composed core subagent UI (`dsh-web-app/cordis.patch.yml:297-298`), a graph row alongside this plugin | **Already accounted for.** It registers `conversation.composer` and `conversation.session.header.lineage` — **not** `conversation.view`, so the Subagents tab does not contend for this plugin's seat. It is the source of the row styling this plugin matches on purpose (see `src/client/index.ts:221`, `src/client/tree.tsx:5`) |
| `sidebar.right.pane.tab.guide`, `…tab.menu.item`, `sidebar.panel-list`, `usePanelInfo` | rightbar/dockkit extension points that exist but are unused here | **Not adopted.** The guide capsule the platform already renders is the supported open path; adding our own guide or menu entry would duplicate it. `usePanelInfo` becomes relevant only if the plugin starts reading tab geometry (see the dockkit note in `docs/INTEGRATION-RECORD.md` §6 L4) |

## Status legend

| Dot | Meaning | Counted as |
| --- | --- | --- |
| Blue (animated) | `running` — the subagent is working | running |
| Green | `completed` — finished successfully | done |
| Red | `error` — model or transport failure | failed |
| Amber | `aborted`, `max-tokens` or `refusal` — interrupted, hit the token limit, or declined | failed |
| Gray | `unknown` — a durable history row this page never observed live | not counted |

Counts (the bar's dot count and the tab's stats line) only include rows currently visible in the
list (rows hidden via *Clear finished* are excluded).

Completed one-shot subagents keep the green `completed` dot and Done count, but they are
listed inside the **Archived** folder at the bottom of the list rather than in the main tree.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build       # lib/index.js (host, ESM) + lib/client.js (browser module-loader bundle)
pnpm typecheck   # tsc --noEmit against the DSH platform types
```

The build replicates the DSH monorepo client-bundle preset: the browser half is a classic script
that registers a factory with `window.__ModuleLoader__.load({ id, factory })`; the only runtime
externals are the ids the browser seed table answers (`react`, `react/jsx-runtime`,
`@deepseek-ai/dsh-client-ui-primitives` are the three it actually requires). Everything else is
bundled, so no `require` can resolve to nothing. `dsh.client.inject` lists the graph rows that must
arrive before this one; an id that is not part of the loaded graph is ignored, which is why the
plugin also imports (type-only) the packages that carry the slot-contract augmentations it relies
on.

**Reproducible build.** From a pristine copy of this tree (no `node_modules`),
`pnpm install --frozen-lockfile && pnpm build && pnpm typecheck` exits 0 and reproduces the
delivered artifacts byte-for-byte:

| artifact | sha256 as delivered |
| --- | --- |
| `lib/index.js` | `2f7bcda74ae0b8cc0e09e92ab0f1a93f1df67670faadeb945da3a09c4b71c0d3` (host half; byte-identical to the previous release) |
| `lib/client.js` | `febd441de6791b255cfa908179afbe6b570ac87dcd8b7978cff4b97966847460` (browser half; carries the rightbar tab and the read-only left bar — the left panel was retired, so this hash moved from `06729579…`) |

The recorded check and its exact commands are in
[docs/INTEGRATION-RECORD.md](./docs/INTEGRATION-RECORD.md).

**Platform pin.** The build is verified against the DSH `0.1.5-rc.2` web shell — the artifact the
browser actually loads. It is pinned here by name *and* hash so a later platform change cannot
silently invalidate the claims in `docs/` (`shasum -a 256` the installed file to re-check):

| installed platform artifact | value |
| --- | --- |
| `@deepseek-ai/dsh-web-frontend` | `0.1.5-rc.2` |
| `dist/assets/index-BKQ_L1z6.js` | 555,959 bytes — sha256 `ae6b5df63da1ac26890eeb1847272005ab3860048d8fb46de1d08732861703c3` |
| `dist/index.html` | sha256 `08feea36f5f7a805fe3b2b8cb70c286f54f3536eb036f5cc266d2981c4d57cc4` |
| `dist/assets/vendor-CCJJTK99.js` | sha256 `38f95ea3ff85b49dc4d8f237db208bbaedd2cb8c31611215c246dde41786ff21` (byte-identical to the `0.1.2-rc.1` shell) |

The shell's module table is the 9-word seed list documented in `tsdown.config.ts`: `react`,
`react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`,
`@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`,
`@deepseek-ai/dsh-client-ui-primitives` and `@deepseek-ai/dsh-client-ui-dockkit` — one word more than
`0.1.2-rc.1`, where `dockkit` did not exist and the right sidebar was not built over it.

## Documentation

| Document | What it answers |
| --- | --- |
| [docs/RIGHTBAR-INTEGRATION-SPEC.md](./docs/RIGHTBAR-INTEGRATION-SPEC.md) | The rightbar integration contract: platform facts, requirements R1–R12, the P1–P22 left-panel parity table, the sanctioned deviations, and the user-facing path, every claim cited to the installed `0.1.5-rc.2` files. |
| [docs/MIGRATION-0.1.5-rc.2.md](./docs/MIGRATION-0.1.5-rc.2.md) | The `0.1.2-rc.1` → `0.1.5-rc.2` drift inventory: every platform symbol, slot, service and module id the plugin binds, with the exact `dsh.client.inject` / `CLIENT_EXTERNALS` deltas and the prioritized change list. |
| [docs/VERIFICATION-RIGHTBAR.md](./docs/VERIFICATION-RIGHTBAR.md) | Independent verification (t4): revision hashes, fresh build/typecheck, real-HTTP route checks, parity re-check, and the real-cordis `inject`-guard experiment. |
| [docs/REVIEW-RIGHTBAR.md](./docs/REVIEW-RIGHTBAR.md) | Contract and parity review (t5): the judged revision by hash, acceptance/requirement/parity tables, and the two low findings. |
| [docs/DELIVERY-RECORD-0.1.5-rc.2.md](./docs/DELIVERY-RECORD-0.1.5-rc.2.md) | Audit record (t7) of the two captain-authorized corrections that produced the shipped revision: the guarded `ctx.inject(['sidebarRightTabs'], …)` form and the optional `sidebar-right` peer. |
| [docs/INTEGRATION-RECORD.md](./docs/INTEGRATION-RECORD.md) | Final assembly (t6): delivered revisions, the recorded fresh-install reproduction, the packaging-metadata audit, the deployment steps that await explicit user confirmation, and residual limitations. |
| [docs/ERRATA-0.1.5.md](./docs/ERRATA-0.1.5.md) | Corrections to claims in the `0.1.5` records that no longer match the tree or the installed platform — gathered by the read-only `0.1.5` migration audit. Read this before acting on any hash or deployment statement in the records above. |
| [docs/DIAGNOSIS-0.1.2-rc.1.md](./docs/DIAGNOSIS-0.1.2-rc.1.md), [docs/FIX-0.1.2-rc.1.md](./docs/FIX-0.1.2-rc.1.md) | The previous round: why the plugin needed the `0.1.2-rc.1` migration and what was changed. |

## FAQ

**Where is the panel?** Three surfaces, one monitor. The left sidebar has the read-only counts bar;
the conversation has its *Subagents* view; the right sidebar hosts the *Subagents* tab
(open it from the guide capsule — see
[Opening the Subagents tab](#opening-the-subagents-tab-from-the-right-sidebar)). They all list the
same subagents: the bar and the right tab share one store, and the conversation view renders the
same shared tree components. The left sidebar's own expandable panel was retired — that is why the
bar no longer reacts to a click.

**How do I get the Subagents tab into the right sidebar?** Click the right sidebar's add control
or expand the column once so the guide page appears, then click the `Subagents` capsule. The plugin
cannot do it for you from the left bar: the right sidebar's controller throws while no seat is
mounted, so the guide capsule is the supported path.

**Why does the tab fill the pane, and why has its header no collapse control?** The card is the
platform's tab content now, so it fills the pane (the row list scrolls inside the tab rather than
inside a floating card) and its header drops the collapse affordance a docked card used to have (a
tab has no collapsed state; the kit's close control closes it). Everything else — dots, counts,
tree, Archived, actions, empty state — is the shared monitor component.

**Why is the tab empty?** Rows are served per root session; start (or wait for) a subagent run in
the session that pane belongs to and the 1-second poll will pick it up.

**What happened to the left panel?** It was retired: the right-sidebar tab renders the same card,
so keeping a second docked copy was duplication. The bar stayed as a read-only status line. On
viewports ≤ 768px the collapsed sidebar rail renders the same row, with the counts ellipsized. The
right-sidebar tab leaves presentation to the platform.

**Why does a rebuild need a reinstall *and* a `dsh web` restart?** A `file:` install copies the
package into the profile, so a rebuild in this repo does not reach the profile's own `lib/`; and
the client module system caches per-package metadata (including `dsh.client.inject`) per process,
and the host half is imported once at boot. See [Propagating a rebuild](#propagating-a-rebuild-the-install-is-a-copy).

**Does it keep history forever?** No — the host keeps at most 200 observed rows per root session
(`MAX_ROWS_PER_ROOT`, `src/index.ts:183`), evicting the oldest finished rows first
(`prune()`, `src/index.ts:213-236`). The cap is deliberately soft for live work: running rows are
never evicted, so a burst of more than 200 concurrent subagents under one root can exceed it until
those runs finish and become evictable.

## License

MIT — see [LICENSE](./LICENSE). Based on the feature set of
`@leetoners/dsh-ui-subagent-monitor` (MIT).

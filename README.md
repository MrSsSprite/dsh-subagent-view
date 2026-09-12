# subagent-view

A DeepSeek Harness (DSH) web extension that monitors subagent runs live in the DSH web UI.
One monitor, three surfaces — the left panel and the right-sidebar tab share one state, and the
conversation view reads the same host data:

| # | Surface | Registration | How you reach it |
| --- | --- | --- | --- |
| 1 | **Left sidebar bar + panel** | slot `sidebar.footer.action`, `id: subagent-view`, `order: 100` | click the docked status bar at the bottom of the left sidebar |
| 2 | **Conversation · Subagents view** | slot `conversation.view`, `id: subagent-view`, `order: 30` | the conversation's *Subagents* view selector |
| 3 | **Right sidebar · Subagents tab** (new) | rightbar tab type, `id`/`kind: subagent-view` + body in the keyed seat `sidebar.right.pane.tab` | the right sidebar's guide page — see [Opening the Subagents tab](#opening-the-subagents-tab-from-the-right-sidebar) |

Surfaces 1 and 2 are unchanged from the previous release; surface 3 is the right-sidebar
(rightbar) integration added in this revision. Surfaces 1 and 3 render the *same* component
(`SubagentMonitorPanel`) over one module-level store and one reference-counted 1-second poller, so
they cannot drift apart. Surface 2 is the earlier, self-contained implementation: it reads the same
host data through the `/api/subagent-view/tab` route, polls on its own interval and reuses the same
tree/archived components, so it lists the same subagents with its own presentation defaults (it opens
fully expanded, the panel and the right tab open collapsed).

The bar shows the counts at a glance as colored dots — `n ● · m ● · k ●` (blue = running,
green = done, red = failed) — hiding zero-count types and showing `None` when all are zero;
expanding it (surface 1) or picking the tab (surface 3) reveals the full tree: every subagent
of the tracked session, with status, duration, disclosure branches and an **Archived** folder
for completed one-shot runs.

The plugin is a from-scratch, English-language reimplementation of the MIT-licensed
[`@leetoners/dsh-ui-subagent-monitor`](https://github.com/Mombrane/dsh-subagent-monitor). It keeps
the reference feature set but renders inside DSH's own sidebar surfaces instead of a floating
overlay window, so nothing ever covers the conversation.

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
5. **Use the monitor.** The tab body is the same panel card as the left sidebar's, for the
   session that pane belongs to: status dots, `n running`, counts legend, disclosure tree,
   **Archived**, `Open` on each addressable row, `← Main session` on a subagent session,
   `Clear finished`, `Show hidden (n)` and the empty state. It fills the pane and scrolls its row
   list; closing it is the kit's normal tab close control. Reopening it from the guide restores
   the same rows — the state belongs to the shared store, not to the tab.

If another plugin also contributes a rightbar tab type (for example a third-party plugin with its
own guide entry), its capsule appears in the same guide list; the entries are ordered by `order`
and ties follow registration order.

## Features

- **Docked bar + expandable panel (left sidebar).** One persistent entry at the bottom of the
  left sidebar: a dot count `n ● · m ● · k ●` (blue = running, green = done, red = failed), with
  zero-count types omitted and `None` shown when all counts are zero. Click to expand the full
  panel above the bar; the workspace browser above simply shrinks — no overlay, no portal.
- **Right sidebar tab (new).** A page tab type with the chip title `Subagents`, offering one guide
  entry (`order: 20`, description *Live subagent runs for the selected session*). Its body is a
  second host of the same monitor: identical content and behavior, filling the pane, without the
  left bar's click-to-collapse affordance (there is nothing to collapse inside a tab).
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
  The left sidebar panel and the right sidebar tab start with every branch collapsed; the
  conversation Subagents view starts fully expanded. Each keeps its expansion state across the 1s
  polls.
- **Open conversation.** A button on each row opens that subagent's conversation in the main view,
  in every surface (rows without a durable mode, and the row for the conversation you are already
  in, have no address and no button).
- **Back to main session.** One click returns from a subagent conversation to the root session.
- **Clear finished.** Hides every fully-finished subtree (any branch that still contains a
  running subagent stays visible) from the list and the bar counts until the next change.
- **One shared 1-second poll.** A single reference-counted poller serves the left panel and the
  right tab — the two hosts of the shared store: the interval runs while at least one of them is
  mounted and stops with the last unmount, so mounting the tab never doubles the request rate. The
  unchanged conversation view keeps its own poll, as it always has.
- **Refresh recovery.** All state is re-served by the host on the next poll, so a page refresh
  recovers the full picture without any model interaction.
- **Mobile friendly (left sidebar).** On viewports ≤ 768px the left panel starts collapsed (the
  bar stays visible). In the collapsed sidebar rail the entry renders as a compact icon button.
  The right-sidebar tab deliberately leaves presentation to the platform and renders identically
  docked, fullscreen or floated.

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
- **The left sidebar does not go away.** Surface 1 keeps its bar, rail button, desktop auto-open,
  click-to-collapse header and mobile collapse default; surface 2 keeps its full expansion
  default. The right tab is an additional host, not a replacement.
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
the left panel draws. In the browser, check that the guide lists `Files` + `Subagents` and that a
tab chip named `Subagents` opens the monitor.

### Coexistence with the reference plugin

The plugin is self-contained: it registers its own routes under `/api/subagent-view/*` and its own
slot entries, and it never imports, disables or depends on any other subagent UI. If a deployment
also runs the reference `@leetoners/dsh-ui-subagent-monitor`, both surfaces render independently;
check that plugin's own README for its route and bundle ids. Whether the two appear together in a
given profile is that profile's composition, not something this package decides or documents.

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
| `lib/client.js` | `0672957995592d4ba7420bb688a40d95b59bd9aee10a0c502be115bf44b6dbeb` (browser half; carries the rightbar tab) |

The recorded check and its exact commands are in
[docs/INTEGRATION-RECORD.md](./docs/INTEGRATION-RECORD.md).

## Documentation

| Document | What it answers |
| --- | --- |
| [docs/RIGHTBAR-INTEGRATION-SPEC.md](./docs/RIGHTBAR-INTEGRATION-SPEC.md) | The rightbar integration contract: platform facts, requirements R1–R12, the P1–P22 left-panel parity table, the sanctioned deviations, and the user-facing path, every claim cited to the installed `0.1.5-rc.2` files. |
| [docs/MIGRATION-0.1.5-rc.2.md](./docs/MIGRATION-0.1.5-rc.2.md) | The `0.1.2-rc.1` → `0.1.5-rc.2` drift inventory: every platform symbol, slot, service and module id the plugin binds, with the exact `dsh.client.inject` / `CLIENT_EXTERNALS` deltas and the prioritized change list. |
| [docs/VERIFICATION-RIGHTBAR.md](./docs/VERIFICATION-RIGHTBAR.md) | Independent verification (t4): revision hashes, fresh build/typecheck, real-HTTP route checks, parity re-check, and the real-cordis `inject`-guard experiment. |
| [docs/REVIEW-RIGHTBAR.md](./docs/REVIEW-RIGHTBAR.md) | Contract and parity review (t5): the judged revision by hash, acceptance/requirement/parity tables, and the two low findings. |
| [docs/DELIVERY-RECORD-0.1.5-rc.2.md](./docs/DELIVERY-RECORD-0.1.5-rc.2.md) | Audit record (t7) of the two captain-authorized corrections that produced the shipped revision: the guarded `ctx.inject(['sidebarRightTabs'], …)` form and the optional `sidebar-right` peer. |
| [docs/INTEGRATION-RECORD.md](./docs/INTEGRATION-RECORD.md) | Final assembly (t6): delivered revisions, the recorded fresh-install reproduction, the packaging-metadata audit, the deployment steps that await explicit user confirmation, and residual limitations. |
| [docs/DIAGNOSIS-0.1.2-rc.1.md](./docs/DIAGNOSIS-0.1.2-rc.1.md), [docs/FIX-0.1.2-rc.1.md](./docs/FIX-0.1.2-rc.1.md) | The previous round: why the plugin needed the `0.1.2-rc.1` migration and what was changed. |

## FAQ

**Where is the panel?** There are three surfaces now. The left sidebar has the bar + expandable
panel; the conversation has its *Subagents* view; the right sidebar hosts the new *Subagents* tab
(open it from the guide capsule — see
[Opening the Subagents tab](#opening-the-subagents-tab-from-the-right-sidebar)). They all list the
same subagents: the panel and the right tab share one store, and the conversation view renders the
same shared tree components.

**How do I get the Subagents tab into the right sidebar?** Click the right sidebar's add control
or expand the column once so the guide page appears, then click the `Subagents` capsule. The plugin
cannot do it for you from the left bar: the right sidebar's controller throws while no seat is
mounted, so the guide capsule is the supported path.

**Why does the right tab look slightly different from the left panel?** Two sanctioned differences
only: it fills the pane (so the row list scrolls inside the tab rather than inside a floating card)
and its header has no collapse affordance (a tab has no collapsed state; the kit's close control
closes it). Everything else — dots, counts, tree, Archived, actions, empty state — is the same
component, so the two cannot drift apart.

**Why is the tab empty?** Rows are served per root session; start (or wait for) a subagent run in
the session that pane belongs to and the 1-second poll will pick it up.

**Why is the panel collapsed on my phone?** By design: on viewports ≤ 768px the *left* panel
defaults to collapsed so the conversation keeps its space. The bar remains visible and clickable.
The right-sidebar tab leaves presentation to the platform.

**Why does a rebuild need a reinstall *and* a `dsh web` restart?** A `file:` install copies the
package into the profile, so a rebuild in this repo does not reach the profile's own `lib/`; and
the client module system caches per-package metadata (including `dsh.client.inject`) per process,
and the host half is imported once at boot. See [Propagating a rebuild](#propagating-a-rebuild-the-install-is-a-copy).

**Does it keep history forever?** The host keeps at most 200 rows per root session, evicting
the oldest finished rows first.

## License

MIT — see [LICENSE](./LICENSE). Based on the feature set of
`@leetoners/dsh-ui-subagent-monitor` (MIT).

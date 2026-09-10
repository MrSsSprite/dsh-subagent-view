# subagent-view

A DeepSeek Harness (DSH) web extension that monitors subagent runs **inside the left sidebar**.
A persistent status bar docked at the bottom of the sidebar shows the counts at a glance as
colored dots — `n ● · m ● · k ●` (blue = running, green = done, red = failed), hiding
zero-count types and showing `None` when all are zero; clicking it expands a full panel —
still inside the sidebar column — listing every subagent of the current session as a live tree.

The plugin is a from-scratch, English-language reimplementation of the MIT-licensed
[`@leetoners/dsh-ui-subagent-monitor`](https://github.com/Mombrane/dsh-subagent-monitor). It keeps
the reference feature set but replaces the floating overlay window with a sidebar-docked bar +
panel, so nothing ever covers the conversation.

## Features

- **Docked bar + expandable panel.** One persistent entry at the bottom of the left sidebar:
  a dot count `n ● · m ● · k ●` (blue = running, green = done, red = failed), with zero-count
  types omitted and `None` shown when all counts are zero. Click to expand the full panel above
  the bar; the workspace browser above simply shrinks — no overlay, no portal.
- **Live statuses.** Each row shows a status dot and duration: running (animated blue),
  completed (green), error (red), interrupted/token-limit/refused (amber), and history-only
  rows (gray).
- **Archived folder.** Completed one-shot subagents are grouped into a collapsible
  **Archived** folder at the bottom of the list (collapsed by default in both the sidebar
  panel and the Subagents tab). Their status, dot color, and Done count are unchanged —
  only their placement changes; each archived subagent's subtree moves with it so the tree
  never orphans a child.
- **Canonical disclosure tree.** Rows with children get a chevron-right `>` on their left
  that rotates downward when pressed to expand the branch, with gray `L`-shape guide lines
  marking parent-child relationships — the same visual the built-in subagent catalog uses.
  The sidebar panel starts with every branch collapsed; the conversation Subagents tab starts
  fully expanded. Both keep their expansion state across the 1s polls.
- **Open conversation.** A button on each row opens that subagent's conversation in the main view,
  in both the sidebar panel and the Subagents tab (rows without a durable mode, and the row for the
  conversation you are already in, have no address and no button).
- **Back to main session.** One click returns from a subagent conversation to the root session.
- **Clear finished.** Hides every fully-finished subtree (any branch that still contains a
  running subagent stays visible) from the list and the bar counts until the next change.
- **1-second polling.** The panel polls the host snapshot endpoint once per second while the
  sidebar exists.
- **Refresh recovery.** All state is re-served by the host on the next poll, so a page refresh
  recovers the full picture without any model interaction.
- **Mobile friendly.** On viewports ≤ 768px the panel starts collapsed (the bar stays visible).
  In the collapsed sidebar rail the entry renders as a compact icon button.

## Install

> Replace `<repo>` with the absolute path to this repository and `<profile-dir>` with your DSH
> profile directory (e.g. `~/.dsh/profiles/web`).

Build once from a clean tree (all three must pass):

```bash
cd <repo>
pnpm install && pnpm build && pnpm typecheck
```

Then install into the `web` profile (adjust the path for other machines):

```bash
dsh plugin --profile web add "file:<repo>"
```

`dsh plugin add` appends `subagent-view` to the profile's `dsh.profile.bundles` automatically
because the package declares `dsh.bundle`. Restart `dsh web` once so the new plugin set is
picked up:

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
`dsh.client.inject` list is only re-read at boot. Until the profile copy is refreshed **and** the
server restarted, the running server keeps serving the previous `lib/` — a rebuilt repo alone
changes nothing on the wire.

### Verify (no browser needed)

On an auth-protected deployment the three surfaces answer differently, so read the codes literally:

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

Bar counts only include rows currently visible in the panel (rows hidden via *Clear finished*
are excluded).

Completed one-shot subagents keep the green `completed` dot and Done count, but they are
listed inside the **Archived** folder at the bottom of the list rather than in the main tree.

## Development

```bash
pnpm install
pnpm build       # lib/index.js (host, ESM) + lib/client.js (browser module-loader bundle)
pnpm typecheck   # tsc --noEmit against the DSH platform types
```

The build replicates the DSH monorepo client-bundle preset: the browser half is a classic script
that registers a factory with `window.__ModuleLoader__.load({ id, factory })`; the only runtime
externals are the ids the loaded plugin set provides plus the ids the browser seed table answers
(`react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives`). Everything else is
bundled, so no `require` can resolve to nothing. `dsh.client.inject` lists the ids whose module
rows must be loaded before this one; an id that is not part of the loaded graph is ignored, which
is why the plugin also imports (type-only) the packages that carry the slot-contract augmentations
it relies on.

## FAQ

**Where is the panel?** At the bottom of the left sidebar. Click the status bar to expand the
panel, click the bar (or the collapse button) again to close it.

**Why is the bar empty?** Rows are served per root session; start (or wait for) a subagent run
in the current session and the 1-second poll will pick it up.

**Why is the panel collapsed on my phone?** By design: on viewports ≤ 768px the panel defaults
to collapsed so the conversation keeps its space. The bar remains visible and clickable.

**Why does a rebuild need a reinstall *and* a `dsh web` restart?** A `file:` install copies the
package into the profile, so a rebuild in this repo does not reach the profile's own `lib/`; and
the client module system caches per-package metadata (including `dsh.client.inject`) per process,
and the host half is imported once at boot. See [Propagating a rebuild](#propagating-a-rebuild-the-install-is-a-copy).

**Does it keep history forever?** The host keeps at most 200 rows per root session, evicting
the oldest finished rows first.

## License

MIT — see [LICENSE](./LICENSE). Based on the feature set of
`@leetoners/dsh-ui-subagent-monitor` (MIT).

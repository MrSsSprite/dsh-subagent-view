# subagent-view

A DeepSeek Harness (DSH) web extension that monitors subagent runs **inside the left sidebar**.
A persistent status bar docked at the bottom of the sidebar shows
`n running · m done · k failed` at a glance; clicking it expands a full panel — still inside the
sidebar column — listing every subagent of the current session as a live tree.

The plugin is a from-scratch, English-language reimplementation of the MIT-licensed
[`@leetoners/dsh-ui-subagent-monitor`](https://github.com/Mombrane/dsh-subagent-monitor). It keeps
the reference feature set but replaces the floating overlay window with a sidebar-docked bar +
panel, so nothing ever covers the conversation.

## Features

- **Docked bar + expandable panel.** One persistent entry at the bottom of the left sidebar:
  `n running · m done · k failed`. Click to expand the full panel above the bar; the workspace
  browser above simply shrinks — no overlay, no portal.
- **Live statuses.** Each row shows a status dot and duration: running (animated blue),
  completed (green), error (red), interrupted/token-limit/refused (amber), and history-only
  rows (gray).
- **Tree indent.** Rows are indented by their subagent depth, so parent/child runs stay readable.
- **Open conversation.** A button on each row opens that subagent's conversation in the main view.
- **Back to main session.** One click returns from a subagent conversation to the root session.
- **Clear finished.** Hides terminal rows from the list and the bar counts until the next change.
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

After the first install, client-side rebuilds hot-apply: run `pnpm build` in this repo and the
open page updates within about a second (no restart). Host-side changes require one `dsh web`
restart.

### Verify (no browser needed)

```bash
# graph row present (also proves the boot protocol):
curl -s http://127.0.0.1:3080/ | grep -o '{"id":"subagent-view"[^}]*}'

# the reference plugin still coexists:
curl -s http://127.0.0.1:3080/ | grep -o '{"id":"@leetoners/dsh-ui-subagent-monitor"[^}]*}'

# client bundle served with the module-loader wrapper:
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://127.0.0.1:3080/plugins/subagent-view/client.js
curl -s 'http://127.0.0.1:3080/plugins/subagent-view/client.js?rev=0' | head -c 120

# snapshot endpoint, canonical wire contract:
curl -s 'http://127.0.0.1:3080/api/subagent-view/snapshot?sessionId=test-abc'
# → {"sessionId":"test-abc","now":<ms>,"rows":[...]}
curl -s 'http://127.0.0.1:3080/api/subagent-view/snapshot'
# → {"now":<ms>,"rows":[]}   (sessionId key omitted when the param is absent)

# the reference route still answers (coexistence):
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3080/api/subagent-monitor/snapshot?sessionId=test-abc'
# → 200
```

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

## Development

```bash
pnpm install
pnpm build       # lib/index.js (host, ESM) + lib/client.js (browser module-loader bundle)
pnpm typecheck   # tsc --noEmit against the DSH platform types
```

The build replicates the DSH monorepo client-bundle preset: the browser half is a classic script
that registers a factory with `window.__ModuleLoader__.load({ id, factory })`; the only runtime
externals are platform seed words (`react`, `react/jsx-runtime`).

## FAQ

**Where is the panel?** At the bottom of the left sidebar. Click the status bar to expand the
panel, click the bar (or the collapse button) again to close it.

**Why is the bar empty?** Rows are served per root session; start (or wait for) a subagent run
in the current session and the 1-second poll will pick it up.

**Why is the panel collapsed on my phone?** By design: on viewports ≤ 768px the panel defaults
to collapsed so the conversation keeps its space. The bar remains visible and clickable.

**Why does the plugin need a `dsh web` restart after install?** The client module system caches
per-package metadata at boot; a plugin-set change only takes effect on restart. Later
client-only rebuilds hot-reload without a restart.

**Does it keep history forever?** The host keeps at most 200 rows per root session, evicting
the oldest finished rows first.

## License

MIT — see [LICENSE](./LICENSE). Based on the feature set of
`@leetoners/dsh-ui-subagent-monitor` (MIT).

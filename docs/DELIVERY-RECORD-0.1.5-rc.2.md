# Delivery record — `subagent-view` on DSH `0.1.5-rc.2`

- Author: `engineer`, task `t7` (attempt `e811bc2f-342a-4710-b5b4-6ec1d2aee52b`), evidentiary only.
- Scope of this task: this file and nothing else. No build was run, and no file under `src/`, `lib/`,
  `package.json`, `tsdown.config.ts`, `.verify/` or any other `docs/` document was touched.
- Purpose: close finding **F-2** — after `t3` completed, two captain-authorized corrections changed the
  shipped artifact, and `t3`'s recorded output (which is terminal and cannot be amended) still describes
  the superseded revision. This record replaces that narrative for audit purposes.

---

## 1. What is superseded

`t3`'s recorded output contains this finding and hash, both of which no longer describe any shipped file:

| superseded item | value recorded by `t3` |
|---|---|
| DEV-1 | "cordis inject kept hard (`sidebarRightTabs`) per t1 R11.1/R9.6, against MIGRATION §5.5's softer preference" |
| browser bundle | `lib/client.js` sha256 `dd6c0f90ec04ea83b49973de7790d53154421dfe272078ae754a7347062838c6` |

**Both are SUPERSEDED.** The `dd6c0f90…` bundle was produced by a revision whose exported `inject` array
hard-listed `'sidebarRightTabs'`. That design was rejected by the captain: a hard-listed cordis service
whose provider never arrives leaves the plugin's fiber `pending`, and the `0.1.5-rc.2` shell turns exactly
that into a fatal boot error (`assertEntriesActive` → `web boot: N entries did not activate …`), so a
third-party plugin could break the whole client boot on a profile that does not compose `ui-sidebar-right`.
It is also the opposite of the frozen contract: `docs/RIGHTBAR-INTEGRATION-SPEC.md`
(content pin `81054f11…` over the first 61392 bytes / 836 lines — the contract both gates judged; whole file now `53e3e314…`, 860 lines, after `t6`'s appended links-only trailer. Re-pinned by `t9`, 2026-09-13) R11.1 requires the three-entry inject plus conditional acquisition, and R11.6
requires the fallback behaviour; `docs/MIGRATION-0.1.5-rc.2.md` §5.5 / change-list item 12 agrees.

## 2. Replacement design (what ships)

**Correction A — guarded conditional rightbar registration**, authorized by the captain after `t3`
completed, in `src/client/index.ts`:

- line 32: `export const inject = ['slots', 'sessions', 'layout']` — `'sidebarRightTabs'` is **not**
  hard-listed (the service is not a module id).
- line 558: `ctx.inject(['sidebarRightTabs'], (scoped) => { … })` wraps **both** rightbar registrations, so
  they exist only while the registry service is actually composed:
  - `scoped.effect(() => scoped.sidebarRightTabs.register(subagentTabDefinition()), 'subagent-view: rightbar tab type')`
  - `scoped.effect(() => scoped.slots.inject('sidebar.right.pane.tab', () => scoped.slots.register({ name: 'sidebar.right.pane.tab', key: SUBAGENT_VIEW_ID }, SubagentRightbarTab)), 'subagent-view: rightbar tab body')`
- The left `sidebar.footer.action` entry (id `subagent-view`, order 100) and the `conversation.view`
  Subagents tab (id `subagent-view`, order 30, label `Subagents`) stay unconditional and outside the scope.
- The plugin makes no `ctx.sidebarRight.*` call; the guide capsule is the only user-facing open path.
- **Fallback (R11.6), no `ui-sidebar-right` composed:** the plugin loads normally, the scope never runs, no
  tab type/body/guide entry is contributed, no scope effects are created, and the fiber stays active rather
  than pending — so boot cannot fail on this plugin and the left bar/panel plus the conversation tab work
  exactly as before.

**Correction B — optional peer marking**, authorized by the captain after `t3` completed, in
`package.json` (lines 66–70):

```json
"peerDependenciesMeta": {
  "@deepseek-ai/dsh-client-ui-sidebar-right": {
    "optional": true
  }
}
```

`@deepseek-ai/dsh-client-ui-sidebar-right` remains a declared peer (`">=0.1.5-rc.2"`, the accepted peer
floor), but as an **optional** peer, so a profile that legitimately does not compose that row neither warns
nor fails at install time — consistent with the guarded `ctx.inject` contract above. `dsh.client.inject`
still lists the bare package name `@deepseek-ai/dsh-client-ui-sidebar-right`; that list only orders graph
rows and skips names with no row, so it does not force-load anything.

## 3. Frozen artifact (measured in this task, before and after writing this file — identical)

| artifact | sha256 | anchors / notes |
|---|---|---|
| `src/client/index.ts` | `fdb6a53b182e1e46749f4a820581908d3d42dd6e4b00bfebbde3955afe0b4fd4` | `:32` inject; guarded scope `:558` (`scoped.effect` at `:565`, `:573`) |
| `package.json` | `89256ab9af087f49b8999eadcd438f11c6d1f334ae9a987ccac0e2c58c75253a` | `peerDependenciesMeta` at `:68`–`:72` — re-pinned by `t9`, 2026-09-13; as filed this row read `9934c2b2…` at `:66`–`:70`, moved by `t6`'s packaging-only edit |
| `lib/client.js` | `0672957995592d4ba7420bb688a40d95b59bd9aee10a0c502be115bf44b6dbeb` | bundle: `const inject = [ "slots", "sessions", "layout" ]` + the scoped acquisition |
| `lib/index.js` | `2f7bcda74ae0b8cc0e09e92ab0f1a93f1df67670faadeb945da3a09c4b71c0d3` | byte-identical to `HEAD` (`f67aa112b4ddae502bfed2ac18c040d11d6f02db`) |
| `docs/RIGHTBAR-INTEGRATION-SPEC.md` | content pin `81054f1188603611102ef42db534ec97d88bddbfeec7caada0d473beb9838beb` over the first 61392 bytes (836 lines) — the contract both gates judged; whole file now `53e3e3144f21cb4d83c85d81bc454438dfb9957182e0b874e8c2242747a46f63`, 860 lines — re-pinned by `t9`, 2026-09-13; reproducible with `head -c 61392 docs/RIGHTBAR-INTEGRATION-SPEC.md \| shasum -a 256` |

Historical hashes quoted in earlier task narratives (for example `dd6c0f90…` for the browser bundle, and
the spec lineage `790/16384a5e…` → `825/efac9eb2…` → `827/76668c53…` → `836/81054f11…`) are audit-trail
entries for superseded states, not files that exist on disk.

## 4. Verification chain this record relies on

- **`t3`** (implementation) is `completed` and **terminal**; its attempt cannot be amended, which is why this
  separate record exists for the two post-`t3` corrections.
- **`t4`** (independent verification) verified the **post-repair** revision: `lib/client.js`
  `0672957…`, `lib/index.js` `2f7bcda7…` (≡ `HEAD`), spec `81054f11…` (836 lines). Per the captain's
  `t7` brief, its verdict was filed against `docs/VERIFICATION-RIGHTBAR.md` content `2b2e34d6…` and the
  file has since moved by a one-sentence informational delta; the file on disk then hashed
  `938ec4503e17c7e3e0a899ec97a614fbe9669845b9bdc123f1a78f484ebc6477` (measured in this task). That
  value is the **first 20466 bytes** of the file — the same figure `§4` above and
  `docs/INTEGRATION-RECORD.md` §4 record as the verified prefix — not the whole-file hash, which is
  `d0c5a9f433685fbc57c51c16a3e4422143ea0d91ad7674926e408c5a33b4f8d6` (see the errata addendum at the
  end of this file). I inspected
  that current file read-only: its appended "Revision this verification is against" note re-states the same
  three artifact pins and the F2 carry-forward, and adds no new finding.
- **`t5`** (review) returned **`pass`** on the same revision; its report,
  `docs/REVIEW-RIGHTBAR.md`, hashed `b5a71982d4d880f9719e528c37138770cbac094f7cf1315b93f7a6bed899a79c`
  when this record was written (superseded: that revision's header pin was refreshed by `t8` and the
  file now hashes `ffd76322a790c8b5aaace5d47c79f2f713641155a994adf13489be74b3ab84d0` — see
  `docs/INTEGRATION-RECORD.md` §1.3/§4), and states that `DEV-1` is obsolete against this revision and
  that the recorded deviations are accurate.
- The frozen artifact hashes above are therefore the ones both gates judged, and the two corrections that
  produced them are the ones this record files.

## 5. Commands run for this task (and their exit codes)

| command | exit | observed result |
|---|---|---|
| `shasum -a 256 src/client/index.ts package.json lib/client.js lib/index.js` | 0 | `fdb6a53b…`, `89256ab9…`, `0672957…`, `2f7bcda7…` — identical before and after writing this file. As first filed this row read `9934c2b2…` for `package.json`: that was the **pre-`t6`** value, superseded by `t6`'s packaging-only edit and contradicted by §3 of this same record; corrected here (see the errata addendum) |
| `shasum -a 256 docs/RIGHTBAR-INTEGRATION-SPEC.md` | 0 | `81054f11…` (836 lines) |
| `git status --short` | 0 | see §6: this task adds only `docs/DELIVERY-RECORD-0.1.5-rc.2.md`; every other entry pre-dates it |
| `git diff --stat` (informational) | 0 | pre-existing migration changes only; no artifact was modified by this task |

No build, install or typecheck was run by this task — the integrator (`t6`) owns builds.

## 6. Scope discipline

- Paths written by this task: `docs/DELIVERY-RECORD-0.1.5-rc.2.md` **only**.
- Not written: `src/`, `lib/`, `package.json`, `tsdown.config.ts`, `.verify/`, `README.md`,
  `docs/RIGHTBAR-INTEGRATION-SPEC.md`, `docs/MIGRATION-0.1.5-rc.2.md`, `docs/VERIFICATION-RIGHTBAR.md`,
  `docs/REVIEW-RIGHTBAR.md`.
- Because the frozen `lib/` was not rebuilt or touched here, the hash pins in §3 remain the ones `t4` and
  `t5` verified; any future change to them invalidates both verdicts and must go through a new task.

## 7. Known deployment state (informational, not part of the verdicts)

The profile-installed copy at `~/.dsh/profiles/web/node_modules/subagent-view` is a copy (not a symlink)
from 2026-09-12 01:05 and predates this migration: its manifest still lists
`@deepseek-ai/dsh-client-ui-primitives` in `dsh.client.inject`, has no `sidebar-right` peer and no
`peerDependenciesMeta`. Refreshing that profile is the integrator's (`t6`) step; it does not affect the
repository hashes in §3.

---

**Errata (0.1.5 follow-up pass).** This record mislabelled `938ec450…` as the whole-file hash of `docs/VERIFICATION-RIGHTBAR.md` (it is that file's 20466-byte judged prefix; the whole file is `d0c5a9f4…`) and reported `package.json` as `9934c2b2…` (the pre-`t6` value; the shipped file is `89256ab9…`). Both were corrected in place above. See [`docs/ERRATA-0.1.5.md`](./ERRATA-0.1.5.md). Appended, not inserted: every byte above this line is unchanged, so the prefixes this record pins still verify.

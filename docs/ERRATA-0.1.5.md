# Errata — `subagent-view` records on DSH `0.1.5`

- Scope: corrections to claims in this repository's own `0.1.5` documents that no longer match the
  measured state of the tree or the installed platform. Found by the read-only migration audit
  (team `dsh-015-migration-audit`, track C/t3, spot-checked by track E/t5) and applied here.
- Why a separate file: the judged documents are **self-verifying**. `DELIVERY-RECORD`,
  `INTEGRATION-RECORD`, `VERIFICATION-RIGHTBAR` and `PREP-NOTES` pin themselves and each other by
  whole-file sha256 *and* by byte-prefix, and `INTEGRATION-RECORD` §4 says explicitly that the
  prefixes were appended "without touching a single byte above them". Rewriting judged text in place
  would destroy exactly the property those records exist to provide. Corrections are therefore
  recorded here, and each affected document carries a **one-line appended pointer** to this file —
  appended, never inserted, so every recorded prefix still verifies byte-for-byte.
- What is *not* here: the document hashes churned by those pointer lines. `INTEGRATION-RECORD` §1.3
  and `DELIVERY-RECORD` §3/§4 were refreshed to the new values in the same pass, so the two documents
  still pin each other correctly.

---

## E-1 · `docs/DELIVERY-RECORD-0.1.5-rc.2.md`

| # | claim as filed | measured truth | status |
|---|---|---|---|
| 1 | §4: `docs/VERIFICATION-RIGHTBAR.md` "currently hashes `938ec4503e17c7e3e0a899ec97a614fbe9669845b9bdc123f1a78f484ebc6477`" | `938ec450…` is the **first 20466 bytes** of that file — the same prefix §4's own table records. The whole-file hash is `d0c5a9f4…` | **CORRECTED in place** (the sentence now names both the prefix and the whole-file value). §4's own table always had it right, and `INTEGRATION-RECORD` §4:145 agrees |
| 2 | §5: `shasum` row reports `package.json` as `9934c2b2…` | the shipped file is `89256ab9…`, as §3 of the same record says. `9934c2b2…` was the **pre-`t6`** value | **CORRECTED in place** (the row now reads `89256ab9…` and records what the stale value was) |

Both were transcription errors inside the record, not measurement failures: the correct value was
already present in the same file or its sibling. §7's deployment paragraph is superseded — see E-3.

## E-2 · `docs/INTEGRATION-RECORD.md`

| # | claim as filed | measured truth | status |
|---|---|---|---|
| 3 | §1: "The delivery is the **working tree**, not a git commit: `HEAD` remains `f67aa112b4ddae502bfed2ac18c040d11d6f02db` and every change listed above is uncommitted" | `HEAD` is `2d6de7d4f0bc457a4daa251341493129c49b385d` — `f67aa112`'s own commit message is the *pre-migration* revision; the delivered content was committed as `2d6de7d` and all pinned hashes still match the tree | **SUPERSEDED** — recorded as a §9 addendum in that file, body left as the historical record of the assembly moment. The same correction applies to §6 L8 ("uncommitted tree") |

## E-3 · Deployment state (affects `DELIVERY-RECORD` §7, `INTEGRATION-RECORD` §5, `REVIEW-RIGHTBAR` §167)

| # | claim as filed | measured truth |
|---|---|---|
| 4 | `DELIVERY-RECORD` §7 / `INTEGRATION-RECORD` §5: the profile copy "is a copy from **2026-09-12 01:05** that predates this migration — its manifest still lists `@deepseek-ai/dsh-client-ui-primitives` in `dsh.client.inject` and has neither the `sidebar-right` peer nor `peerDependenciesMeta` … **the right-sidebar Subagents tab does not exist in the running app yet**" | The profile copy was refreshed at **02:13** and is byte-identical to the migrated build: `package.json` `89256ab9`, `lib/client.js` `06729579…`, `lib/index.js` `2f7bcda7…`, `cordis.patch.yml` `6ae0334d`. The live process (PID 88556 on `127.0.0.1:3080`) serves it — its `/plugins/events` graph frame carries the `subagent-view` row with the migrated 7-id inject list at boot-allocated rev `d18e6f7bf345504f-50`, and `/api/subagent-view/snapshot` and `/tab` both answer `200`. The rightbar tab **is** in the running app; a browser reload is the only remaining user step |
| 5 | `REVIEW-RIGHTBAR.md:167`: "`~/.dsh/profiles/web` **links this repo**" | Accurate as to the `file:` specifier, false as to "links": the profile holds an **install-time copy** (package-root inode 45986995 vs repo 44912121; `lib/client.js` inode 45987000 vs repo 45848943, `nlink 1`). There is no `subagent-view` entry at all in the shared `~/.dsh/profiles/node_modules`, so no symlink can shadow it. The copy carries the repo's build mtime `01:50:04` while its package directory is stamped `02:13` — the pnpm injected-copy fingerprint |

**Consequence for the dev loop**, which the two records state correctly elsewhere: `file:` installs
are copies, so a rebuild does **not** reach the profile until it is reinstalled
(`dsh plugin --profile web add "file:<repo>"`, or the documented `cp`), and a host-half or manifest
change then needs a `dsh web` restart — a **client-only** change does not, because `dsh-client-hmr`
stat-polls the profile copy and rebroadcasts it.

## E-4 · `.verify/PREP-NOTES.md` (gitignored working material)

| # | claim as filed | measured truth |
|---|---|---|
| 6 | §10 and its closing paragraph call `docs/RIGHTBAR-INTEGRATION-SPEC.md` "**836 lines / `81054f11…`**" | the file is **860 lines**; `81054f11…` is its **61392-byte judged prefix**, which still verifies. The whole file hashed `53e3e314…` after `t6`'s appended links-only trailer. `PREP-NOTES`' own `:349-372` nit is unaffected — it is inside the preserved prefix |
| 7 | the note that `orderByModuleGraph` `:349-372` "is a doc-precision item **for t5**" | t5 ran and passed; the nit is still open in the gitignored PREP-NOTES only. It is cosmetic (the function ends at `:371`) and no normative line depends on it |

## E-5 · Historical records that are correct but scoped to an older platform

| # | document | why it reads as stale | disposition |
|---|---|---|---|
| 8 | `docs/DIAGNOSIS-0.1.2-rc.1.md:4` — "Platform under test: … = **0.1.2-rc.1**" | the path it names is `0.1.5-rc.2` today | **Correct as history.** The file is titled and dated for the `0.1.2-rc.1` round (2026-09-11) and its `index-Df-65__b.js` mocks are deliberately the `0.1.2` shell. A dated scope header is appended in place of editing the claim |
| 9 | `REVIEW.md` (repository root) — "Verdict: **PASSES overall**", reviewed commit `ac4b66b` | it judges a pre-`0.1.5` commit | **Correct as history, mis-scoped as current.** A scope header is appended so the verdict is not read as applying to the shipped revision; the current review of record is `docs/REVIEW-RIGHTBAR.md` |

## E-6 · `README.md` (live user-facing document — corrected in place, not errata'd)

| # | claim as filed | measured truth |
|---|---|---|
| 10 | FAQ: "keeps at most 200 rows per root session, evicting the oldest finished rows first" | reads as a hard cap. `MAX_ROWS_PER_ROOT` (`src/index.ts:183`) is enforced by `prune()` (`:213-236`), which **never evicts running rows**, so a burst of more than 200 concurrent subagents under one root overshoots the cap until those runs settle. The README sentence and the source comment both say so |
| 11 | the shipped shell was pinned by **name only** (no hash anywhere in `docs/`) | closed by adding a **Platform pin** table to the README's Development section: `index-BKQ_L1z6.js` = 555,959 B, sha256 `ae6b5df6…03c3`, with `index.html` and the (byte-identical to `0.1.2`) vendor bundle |

---

## Fingerprints of this pass

The audit that produced this errata was read-only; this document and the pointer lines are the write.
Measured at the time of writing:

| artifact | value |
|---|---|
| `HEAD` before this pass | `2d6de7d4f0bc457a4daa251341493129c49b385d`, tree clean |
| `lib/index.js` / `lib/client.js` | `2f7bcda7…` / `06729579…` — unchanged by the audit and by every fix in this pass |
| installed web shell | `@deepseek-ai/dsh-web-frontend@0.1.5-rc.2`, `index-BKQ_L1z6.js` `ae6b5df6…03c3` |
| platform version split | CLI `@deepseek-ai/dsh@0.1.5-rc.1`; 230 bundled packages and the shell at `0.1.5-rc.2`; `cordis` 4.0.2 |
| served platform symlinks | 244 under `~/.dsh/profiles/node_modules/@deepseek-ai/` (an earlier track reported 246; 244 is the measured value) |

Whole-file hashes of the documents this pass touched, **before** the pass (stable reference points;
see the note below on why no "after" column is given):

| document | before this pass |
|---|---|
| `README.md` | `7afe415744e5cf43678475d56f56115f1b5f1fc987dd2536dcfad596db4038f8` |
| `docs/DELIVERY-RECORD-0.1.5-rc.2.md` | `4f679c873b845629cf2ef04983e8432cc963f8ca62ef2b90e4f53952fc6b791d` |
| `docs/REVIEW-RIGHTBAR.md` | `44650948edf88dbaba8dab0d8fc4149803dc6bf83884ea47db83789a4270aded` |
| `docs/VERIFICATION-RIGHTBAR.md` | `d0c5a9f433685fbc57c51c16a3e4422143ea0d91ad7674926e408c5a33b4f8d6` |
| `docs/MIGRATION-0.1.5-rc.2.md` | `77029ceba77c2db292e9b1aff5c4de4fb77d55ed78236afafc11a1bb5081ad4f` |
| `docs/INTEGRATION-RECORD.md` | `ebdeb691f5dc58f7b25655a88ea1c192ce6499c88f7c79f4342935995fc6930d` |
| `.verify/PREP-NOTES.md`, `docs/DIAGNOSIS-0.1.2-rc.1.md`, `REVIEW.md` | pointer appends only (gitignored / historical) |

**No "after" column, deliberately.** These documents cross-pin each other, and this file is itself
edited after them, so any "current" whole-file table here would be invalidated by the very next edit —
which is precisely the failure mode this errata exists to clean up. Current values live where the
repository already keeps them: `docs/INTEGRATION-RECORD.md` §1.3/§4 for the records, and `git log -p`
for everything. The pinned values that *are* durable are the prefixes below.

**The prefix property is what to trust.** Every byte-prefix recorded in `INTEGRATION-RECORD` §4 still
verifies (`head -c <bytes> <file> | shasum -a 256`), including `81054f11…` over 61392 bytes,
`938ec450…` over 20466 bytes and `a8586bdb…` over 57299 bytes, because all corrections here were
**appended**.

## E-7 · A prefix this pass broke and then restored (recorded as a lesson)

The first attempt at the zod resolution (commit `97c56c3`) and the first attempt at the surface
dispositions (commit `1346d59`) edited **mid-file** rows in `docs/MIGRATION-0.1.5-rc.2.md` — §6's
change-list row 2, §7's R1 hypothesis and §9.3's probe note, plus §2's H12 verdict row. That file is
append-only by contract: each insert shifted every later byte, so its documented
`57299`-byte prefix `a8586bdb…` **stopped verifying**, even though the inserted text was correct.

Both are corrected in this pass: those edits were reverted, the file is byte-identical to
`2d6de7d`'s revision (whole-file `77029ceb…`), and the same content now lives in an appended §11 block
— so `head -c 57299 docs/MIGRATION-0.1.5-rc.2.md | shasum -a 256` returns `a8586bdb…` again.

The rule this establishes for anyone editing these records: **an append-only document may only grow at
its end.** A correction that must be visible next to the claim it corrects has to go in this errata
file, not in the body — which is why this file exists rather than a set of in-place rewrites.

Line/byte figures quoted above were produced with `wc -l`, `wc -c`, `head -c <bytes> | shasum -a 256`
and `shasum -a 256` against the files as they stand in this commit.

## E-8 · The left-sidebar panel is retired (user decision, supersedes spec D-1/R12.1)

- Scope: the left sidebar's **expandable panel** is removed; the docked `sidebar.footer.action` entry
  survives as a **read-only counts bar** (no click, no chevron, no rail button, no desktop auto-open).
  The right-sidebar *Subagents* tab becomes the only host of the panel card.
- Why a retirement was needed at all: two hosts rendered the same card over one store, and the right
  tab made the left panel redundant — the user asked for the concise pre-expansion bar to stay and
  the expansion to go.
- Why this is an **errata** entry and not a body edit: the requirements it contradicts are inside
  byte-pinned documents. Every prefix named below still verifies, because this pass appended instead
  of rewriting. **Do not "fix" the spec or the review to match the tree.**

| # | claim as filed | measured truth after this pass |
|---|---|---|
| 12 | `docs/RIGHTBAR-INTEGRATION-SPEC.md` §1 **D-1**: "**KEEP** the existing left-sidebar docked bar + expandable panel unchanged … rail mode and all" | **Superseded by the user's decision.** Surface 1 is now a read-only bar: `src/client/bar.tsx` renders `label + counts` and nothing else. The reason D-1 gave still constrains the *bar* — the rejected "open the right tab from the left bar" alternative stays rejected, so the bar was made non-interactive rather than repurposed |
| 13 | same file **R12.1**: "`sidebar.footer.action` (`id: 'subagent-view'`, `order: 100`, `inject` = `toggleSidebar`) keeps its registration and its current behaviour … including the bar + panel + rail mode" | **Partly superseded.** The registration and its `id`/`order` are unchanged; the `inject` = `toggleSidebar` factory and the rail mode are gone with the button that was their only reader. `.verify/rightbar-register.mjs` and `.verify/left-bar-contract.mjs` assert the registration carries **no** `inject` factory |
| 14 | `docs/REVIEW-RIGHTBAR.md` §3 row 5: "`src/client/panel.tsx` keeps the rail button, the docked bar, the desktop auto-open and the click-to-collapse header" | **Superseded.** `panel.tsx` is deleted; the file is `src/client/bar.tsx` and keeps only the bar. The review remains correct *as the review of the revision it judged* |
| 15 | `README.md` said surface 1 was unchanged and surface 3 was "new"; `DSH.md` §1 listed a "docked bar + expandable panel" and `panel.tsx`, and its §8 branch note said "no commit implements" the retirement | **Corrected in place** (both are live documents): the surface tables, the Features and Platform-notes sections, the FAQ entries, the `panel.tsx` references and the branch note now describe the retired state. The `docs/` bodies were left frozen |

**What else moved with it (behaviour, not just files):**

| # | item | detail |
|---|---|---|
| 16 | exported `inject` array | `['slots','sessions','layout']` → **`['slots','sessions']`**. `ctx.layout` had exactly one reader — `ctx.layout.toggleSidebar()` on the rail button (`src/client/index.ts:519` before the change) — so the service became dead the moment the button went. A declared-and-required service nothing reads is the same defect as an unguarded read, from the other side (§7 trap 1 / §11 rule 4). `.verify/rightbar-inject-guard.mjs` now asserts the fiber activates with `layout` **unprovided** |
| 17 | `package.json` | `@deepseek-ai/dsh-client-ui-layout` removed from **`dsh.client.inject`** (7 → 6 ids), from `peerDependencies` and from `devDependencies`; `pnpm-lock.yaml` refreshed (173 entries, down one). `@deepseek-ai/dsh-client-ui-sidebar` is **kept** — the bar still occupies its `sidebar.footer.action` seat, and its type-only import still declares the owner props |
| 18 | `docs/MIGRATION-0.1.5-rc.2.md` | Its `layout` rows (§7 change-list row 8 and the `package.json` reference) now describe a declaration this revision removed. The **body stays frozen**; this entry is the correction. Its C2 row (`SidebarFooterActionOwnerProps` unchanged at 0.1.5-rc.2) and R1's consumer counts are still accurate — the owner share still exists and is simply unread |
| 19 | the harness suite (`.verify/`, gitignored, this machine only) | New `.verify/left-bar-contract.mjs`: executes the shipped bundle with a recording React and asserts (a) `inject === ['slots','sessions']`, (b) the footer entry has no `inject` factory, (c) the bar's element tree has **no** button/`onClick`/`href`/`role`/`tabIndex`, (d) the stylesheet has no `sav-rail*`/`sav-bar-chevron*`/`sav-panel-tab`/`sav-panel-header-tab` selector, (e) the bundle has no `toggleSidebar`/`ctx.layout`/`dsh-client-ui-layout` string. `rightbar-register.mjs` (R11.1/R12) and `rightbar-inject-guard.mjs` were updated to the new inject array and the layout-free context. Full suite re-run green |

**Two consequences that are *not* verified, stated rather than implied:**

1. **Mobile seeding is unobserved.** The retired left host also carried the `≤768px` guard that kept a
   rightbar page from being auto-opened (the spec's `R8 D-4` deviation achieved "no mobile auto-open"
   by leaving the panel closed, not by a platform switch). With that guard gone, a phone may now open
   the seeded page where the rail button used to be the entry point. This is a layout/UX observation
   that needs the live app (DSH.md §10 L10).
2. **The bar's geometry in the 56px rail is unverified visually.** `wide` is still delivered to the
   entry by the platform and is deliberately unread; the counts line ellipsizes in the narrow column.
   `left-bar-contract.mjs` is structural only — it does not lay anything out (DSH.md §10 L9).

**Deployment note.** Item 17 changes the **manifest**, so the running server (PID 36530, serving the
profile copy) cannot pick it up by HMR: the profile needs `dsh plugin --profile web add "file:<repo>"`
and then a `dsh web` restart. Until then the profile keeps serving the *previous* client half and the
previous inject list, and the app shows the old expandable bar.

## Fingerprints of this pass (E-8)

Measured while writing this entry, with the retirement staged but **not committed**:

| artifact | value |
|---|---|
| `HEAD` (unchanged by this pass) | `be10be3b1f33f9eb56258fbc6964fadbd0bb8730`, branch `retire-left-sidebar` (= `main`/`origin/main`) |
| `lib/index.js` | `2f7bcda74ae0b8cc0e09e92ab0f1a93f1df67670faadeb945da3a09c4b71c0d3` — **unchanged**, as a client-only change requires |
| `lib/client.js` | `febd441de6791b255cfa908179afbe6b570ac87dcd8b7978cff4b97966847460` (was `06729579…`) |
| `package.json` | `1cd511a4ae461ab58522f47e96175be003d75f115e08b1bdbfea7fdcf4dc5551` (was `9aa13d2e…`) |
| profile copy at `~/.dsh/profiles/web/node_modules/subagent-view` | `lib/index.js` `2f7bcda7…`, `lib/client.js` `06729579…`, `package.json` `89256ab9…` — **one revision behind**, and still carrying the 7-id inject list, until the reinstall above |
| live server | PID 36530 on `127.0.0.1:3080`, still serving that stale copy |
| build/typecheck | `pnpm install --lockfile-only && pnpm typecheck && pnpm build` all exit 0; `module-table.mjs` confirms the bundle still requires only the three seed words |

Whole-file hashes of the two **live** documents this pass corrected in place (per E-6, those files
are corrected rather than errata'd, so their current content is the record):

| document | what changed | how to read it |
|---|---|---|
| `README.md` | surface table, Features, Platform notes, FAQ, the delivered-hash table | `git show cce5cb5 -- README.md`. **No pre-edit hash is recorded here on purpose** — this pass did not capture one, and inventing one would be exactly the error E-1 exists to correct |
| `DSH.md` | §1/§2/§3/§5/§6/§8/§9/§10 and the measured-state header | it is **gitignored** (`.gitignore:16`, added by `114f215`), so there is no git history to diff — the working tree is the only copy |
| `.gitignore` | gains `DSH.md`, so the agent-orientation file stays out of the repository | commit `114f215`, which is *not* part of E-8 and landed between `be10be3` and E-8's own commit |

**The prefix property still holds.** `head -c 61392 docs/RIGHTBAR-INTEGRATION-SPEC.md | shasum -a 256`
= `81054f11…`, `head -c 57299 docs/MIGRATION-0.1.5-rc.2.md | shasum -a 256` = `a8586bdb…` and
`head -c 20466 docs/VERIFICATION-RIGHTBAR.md | shasum -a 256` = `938ec450…`, all re-verified after
this append. Every correction in this entry is at the end of this file; no byte above it moved.

## E-9 · E-8's work landed: commit `cce5cb5`

E-8 was written against a staged working tree, so its fingerprint table records `HEAD` as
`be10be3…` and calls the retirement uncommitted. The retirement is now a commit; only `HEAD` moved,
and every artifact hash in E-8's table is unchanged, so the table stays true of the artifacts and
stale only about the commit. Measured after the commit:

| item | value |
|---|---|
| E-8 commit | `cce5cb5` — `feat!: retire the left-sidebar panel and keep the bar display-only`, 11 files, +285/−425 |
| its parent chain | `cce5cb5` → `114f215` (`.gitignore`: ignore `DSH.md`) → `be10be3`; verified against the remote, not just the local ref |
| branch state | `main` and `origin/main` are both at `114f215` (`git ls-remote origin refs/heads/main` confirms), so `cce5cb5` is a local commit one ahead of `main`, **merged nowhere and pushed nowhere** |
| `lib/index.js` / `lib/client.js` / `package.json` | `2f7bcda7…` / `febd441d…` / `1cd511a4…` — identical to E-8's table, re-checked after the commit |
| working tree | clean. `DSH.md` does **not** appear in `git status` (ignored), and `lib/index.js` shows no modification — the host half is untouched, as a client-only change requires |

The deployment note above is **unaffected by committing**: the profile copy is still the pre-change
revision (`lib/client.js` `06729579…`, 7-id inject list) and the live process still serves it, so
seeing the new bar in the app still requires the `dsh plugin add` + `dsh web` restart. Committing
changed nothing about that — a `file:` install is a copy (§E-3).

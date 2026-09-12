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

Whole-file hashes of the documents this pass touched, as of the commit that carries this file:

| document | before this pass | at this commit |
|---|---|---|
| `README.md` | `7afe4157…` | `3bed7772a2cf88ec84e24a470710db86d22a0395842144e2340d5acc7c73eaff` |
| `docs/DELIVERY-RECORD-0.1.5-rc.2.md` | `4f679c87…` | `6ddcf0d052b037dbb73f2a68955f629949fcb9fa80f4fac0660a556514f956c3` |
| `docs/REVIEW-RIGHTBAR.md` | `44650948…` | `ffd76322a790c8b5aaace5d47c79f2f713641155a994adf13489be74b3ab84d0` |
| `docs/VERIFICATION-RIGHTBAR.md` | `d0c5a9f4…` | `fc0bd387e8fa6332a8aaa3623ed8d54f1b52c215f092fadaca25eed4bade35e5` |
| `docs/INTEGRATION-RECORD.md` | `1c0dc8d5…` | `615179f3ca329d025d0fd7fba1a3f0632812808ffcf735a375cca0cc1c6a7892` |
| `docs/MIGRATION-0.1.5-rc.2.md` | `77029ceb…` | changed by the zod-resolution commit (see git history) |
| `.verify/PREP-NOTES.md`, `docs/DIAGNOSIS-0.1.2-rc.1.md`, `REVIEW.md` | error-pointer appends only (gitignored / historical) | — |

**The prefix property is what to trust.** Every byte-prefix recorded in `INTEGRATION-RECORD` §4 still
verifies (`head -c <bytes> <file> | shasum -a 256`), including `81054f11…` over 61392 bytes and
`938ec450…` over 20466 bytes, because all corrections here were **appended**. The whole-file values
above are simply today's; the next edit to any of these files invalidates them, which is exactly why the
judged content is preserved as prefixes rather than as whole-file hashes.

Line/byte figures quoted above were produced with `wc -l`, `wc -c`, `head -c <bytes> | shasum -a 256`
and `shasum -a 256` against the files as they stand in this commit.

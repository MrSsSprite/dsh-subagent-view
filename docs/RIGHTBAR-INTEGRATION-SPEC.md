# Right-sidebar (rightbar) integration spec — `subagent-view` on DSH `0.1.5-rc.2`

- Owner: `analyst-rightbar` (task `t1`), requirements round 1.
- Deliverable: this file. Consumers: `engineer` (t3), `verifier` (t4), `reviewer` (t5), `integrator` (t6).
- Platform under inspection: the **installed** DSH `0.1.5-rc.2`
  (`/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`, abbreviated `P/` below).
- Repository under change: `/Users/ryanlam/codespace/dsh-plugin/subagent-view` (abbreviated `REPO/`).

Everything in §2 is a platform claim read directly from the installed artifacts; §3 turns those claims into
requirements the implementation must satisfy and a later verifier can test. Anything I could not settle by
reading is labelled **HYPOTHESIS** in §7 with the experiment that would settle it.

Keywords: **MUST** / **MUST NOT** are contract; **SHOULD** is strong advice; **MAY** is permitted.

---

## 0. Citation map and reading rules

Every `PATH:LINE` citation below resolves against `P/`:

| shorthand | absolute path |
|---|---|
| `RB` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right` |
| `DOC` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-documentpreview` |
| `FILES` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-files` |
| `LAYOUT` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout` |
| `SESSION` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-session` |
| `CTRL` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-api-session-controller` |
| `MODULES` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-modules` |
| `FRONTEND` | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend` |
| `REPO` | `/Users/ryanlam/codespace/dsh-plugin/subagent-view` |

Resolution check (all four must print the `0.1.5-rc.2` version line):

```bash
for p in dsh-client-ui-sidebar-right dsh-client-ui-sidebar-documentpreview \
         dsh-client-ui-sidebar-files dsh-web-frontend; do
  node -p "require('/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/$p/package.json').version + '  $p'"
done
```

A citation written `SHORTHAND:relative/path:LINE` means the file at
`<the absolute path for SHORTHAND in the table above>/relative/path`, at that 1-based line (or range). A
verifier can resolve any citation mechanically, e.g.:

```bash
P=/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai
sed -n '140,153p' "$P/dsh-client-ui-sidebar-right/lib/types/client/tab-registry.d.ts"
```

`.d.ts` citations are the contract face; `lib/client.js` citations are the shipped implementation of that
contract — used only where the `.d.ts` alone does not settle runtime behaviour (e.g. what the guide's click
actually calls). `lib/client.js` is bundled and minified-but-readable: the cited lines are the real,
stable line numbers of the installed file.

The left-sidebar implementation that parity is defined against is frozen in `REPO/.verify/baseline-HEAD/`
(`git rev-parse HEAD` = `f67aa112b4ddae502bfed2ac18c040d11d6f02db`); this document cites the working-tree
paths (`REPO/src/client/...`) which are identical to that baseline as of writing.

---

## 1. Product decision this plan assumes

Acceptance criterion 7 of `t1` asks for the decision to be named explicitly. It is:

| # | Decision | Basis |
|---|---|---|
| **D-1** | **KEEP** the existing left-sidebar docked bar + expandable panel unchanged: slot `sidebar.footer.action`, `id: 'subagent-view'`, `order: 100`, rail mode and all. | `t3` acceptance: "The existing left-sidebar entry (slot `sidebar.footer.action`, id `subagent-view`) and the conversation Subagents tab keep their current behavior and are not removed." |
| **D-2** | **KEEP** the conversation `Subagents` view (`conversation.view`, `id: 'subagent-view'`, `order: 30`) unchanged. | same `t3` acceptance criterion. |
| **D-3** | **ADD** a right-sidebar tab *type* whose body is a second host of the same monitor state. No third copy of the row/tree logic. | team goal; `t3` acceptance "reusing `SubagentTree`/`splitArchived`/`ArchivedFolder` instead of a fork". |
| **D-4** | The **required, documented user path** to open the tab is the platform's own **guide page**, reached from the right sidebar's pane strip **add control** (or automatically as the seeded default page). The plugin itself does **not** call `ctx.sidebarRight.openTab`; §2.5.4 states exactly how the chosen path avoids the controller's no-seat throw, and R9.6 is the guard rule for any later entry point. | §2.5 + §2.3; the alternative (a plugin-initiated open from the left bar) has a real failure mode (`RB/lib/client.js:1414-1417`, §2.5.4). |
| **D-5** | Accepted platform-wide consequence: registering a guide entry makes the registry hold **two** guide entries, and the platform's `defaultSeed` then seeds the **guide** page instead of the **Files** page into a pane that expands empty. This is a visible behaviour change of the shipped app caused by this plugin, and it is *desired* here — it puts the Subagents capsule in front of the user on first expansion. | `RB/lib/client.js:229-237` + the only shipped entry contributor `FILES/lib/client.js:29-42` (§2.3). |

Rejected alternative, recorded so later rounds do not relitigate it: dropping the guide entry and adding an
"open in right sidebar" button to the left bar. It fails the no-seat guard (§2.5.4: `openTab` throws
`sidebarRight: no session surface is mounted` whenever the right column's seat is not mounted, e.g. while a
global panel is selected) and it would change the left bar's current behaviour, which D-1 forbids.

---

## 2. Platform contract facts

### 2.1 The right column and the seats the platform already owns

- The frame declares a root-scope `rightbar` seat and hands its occupant resolved geometry ("Resolved normal
  panel width in px…", "Current frame width in px…", "Whether a normal right panel can retain 300px beside a
  400px center"): `LAYOUT/lib/types/client/index.d.ts:65-68` (slot), `:94-107` (`RightbarOwnerProps`).
- The right-sidebar package occupies it with `RightbarRoot` and declares the child seat `rightbar.session`
  (`single`, `scope: 'session'`): `RB/lib/client.js:3705-3713`. `RightbarRoot` renders nothing unless the
  **Conversation** is the selected main panel, and wraps the seat in the platform's `SessionProvider`
  (`RB/lib/client.js:1007-1018`; doc `RB/lib/types/client/shell/RightbarRoot.d.ts:1-8`).
- The shown/hidden/track/fullscreen facts of the column are reported **by the occupant** through
  `ctx.layout`: `syncPresentation({shown, track, fullscreen}) → ctx.layout.openRightbar(track, fullscreen)` /
  `ctx.layout.closeRightbar()` (`RB/lib/client.js:3691-3693`; face `LAYOUT/lib/types/client/service.d.ts:45-47`
  and `:68-70`). `index.d.ts` of the same package states it plainly: "The frame is a base package and never
  injects this one… it arrives through its own `ctx.layout` action face" (`RB/lib/types/client/index.d.ts:14-17`).
  This is the occupant's own business, not a consumer's: the right-sidebar package's client `inject` is
  `["slots","layout","locale","resources"]` (`RB/lib/client.js:3648-3653`).
- `ctx.layout.toggleSidebar()` toggles the **left** panel only (`LAYOUT/lib/types/client/service.d.ts:36`;
  the left bar's rail button uses it: `REPO/src/client/index.ts:498`).
- While the column is collapsed, the only way back in is a button the right-sidebar package registers into
  the conversation header's corner seat (`conversation.session.header.corner`), which sets
  `actions.setExpanded(sessionId, true)`: `RB/lib/client.js:204-227` (button, `data-sidebar-right-expand`)
  and `:3740-3744` (registration); doc `RB/lib/types/client/shell/ExpandButton.d.ts:1-14`.

### 2.2 Stage one — what a tab *type* is

- The registry service is `ctx.sidebarRightTabs` (`RB/lib/types/client/index.d.ts:40-47`) and the navigation
  face is `ctx.sidebarRight` (`:43`). Both are provided by the right-sidebar package inside its `apply`:
  `ctx.reflect.provide("sidebarRightTabs", tabs)` at `RB/lib/client.js:3667` and
  `provide("sidebarRight", controller)` at `:3668`, disposed together at `:3669-3673`. A consumer therefore
  acquires the registry by that exact service name, conditionally (R11.1); nothing else may register a tab
  type.
- A registration is purely static (`RB/lib/types/client/tab-registry.d.ts:1-26`):

| field | contract | citation |
|---|---|---|
| `id` | unique across **every** registration; "it is the key its body and title register under in the `sidebar.right.pane.tab` and `sidebar.right.pane.tab.title` seats" | `RB/lib/types/client/tab-registry.d.ts:68-76` |
| `kind` | "Type discriminator: what the tabs of this type are, and what `openTab` names" | `:77-78` |
| `patterns?` | "omit for a page type, which is opened by kind and recognizes no address" | `:79-89` |
| `priority?` | `'extension' \| 'builtin' \| 'fallback'`; "Defaults to `extension`: a type that says nothing is one from outside the product" | `:43`, `:90-91` |
| `canOpen?` | synchronous veto for matched addresses only | `:92-100` |
| `title(address)` | "The tab chip's initial text, captured into the layout record at open time" | `:101-106` |
| `guide?` | entry boxes for the guide page; "Omit to stay off it" | `:107-108` |

- `register(definition): () => void` is idempotent-disposable and **throws** on a taken `id` or a kind
  collision that cannot coexist: `RB/lib/types/client/tab-registry.d.ts:140-153`; implementation
  `RB/lib/client.js:3353-3360` (`sidebarRight: tab type id "…" is already registered`,
  `sidebarRight: tab kind "…" is already registered (…)`). One `builtin` and one `extension` may share a kind;
  the extension wins while it lives (`tab-registry.d.ts:18-22`).
- Registration order and the registry's observable snapshots: `entries()` / `guide()` / `get(kind)` /
  `candidates(address)` / `claim(address, kind?)` (`tab-registry.d.ts:154-205`).

### 2.3 Stage one — guide entries and the default page

- `SidebarRightGuideEntry` = `{ order, title(): string, description?(): string, icon? }` and the box the
  registry hands the guide adds `kind` to it: `RB/lib/types/client/tab-registry.d.ts:44-66`.
  Thunked copy is re-read on every use, so a language change needs no re-registration (`:23-25`).
- The shipped guide body lists every entry sorted by `order` and picking one calls
  `tab.actions.openTab(entry.kind, { replaceTab: true })`
  (`RB/lib/client.js:174-185`; contract `RB/lib/types/client/tabs/guide/GuideBody.d.ts:11-19,24-34`).
  Descriptions are drawn only while the guide lists few enough entries (`GuideBody.d.ts:12-16`).
- The pane strip's **add control** opens the guide itself: `intentsFor.addTab(paneId) →
  openTab(GUIDE_KIND, { paneId, revealIfOpened: false })` (`RB/lib/client.js:667-684`); the injected
  `openTab` is documented as "the strip's add control: a new tab is the guide opened by kind"
  (`RB/lib/types/client/shell/SidebarRight.d.ts:50-54`). `GUIDE_KIND = 'guide'`
  (`RB/lib/types/client/contract/seed.d.ts:26`).
- Page addresses are `sidebar://<kind>` and callers never compose them
  (`RB/lib/types/client/contract/seed.d.ts:30-34`; `RB/lib/client.js:248-250`).
- `defaultSeed(tabs)`: "the sole entry, or the guide when there are zero or multiple entries"
  (`RB/lib/types/client/contract/seed.d.ts:14-24`; implementation `RB/lib/client.js:229-237`). The store reads
  it as a thunk at each pane mint (`RB/lib/types/client/stores.d.ts:110-119`; `RB/lib/client.js:3679`).
- **Current shipped entry set at 0.1.5-rc.2: exactly one guide entry**, contributed by the Files page type at
  `order: 10` (`FILES/lib/client.js:29-42`). A repository-wide grep over every installed client bundle for
  `guide: [` returns that one file only. ⇒ today `defaultSeed` returns `files`; with this plugin's entry it
  returns `guide` (D-5).

### 2.4 Stage two — the keyed body seat and the props a body receives

- Slot map declaration (`RB/lib/types/client/contract/slots.d.ts:12-71`):

| slot | kind | scope | dispatched with | injected |
|---|---|---|---|---|
| `rightbar.session` | single | session | — | `RightbarOwnerProps` |
| `sidebar.right.pane.tab` | **keyed** | **session** | **the `id` of the type in force for `tab.kind`** | `SidebarRightTabInjected` (`{hooks: {tabInfo}}`) |
| `sidebar.right.pane.tab.title` | keyed | session | same key + hook | same |
| `sidebar.right.tab.guide` | chain | session | — | `UseSidebarRightTabInfo` |
| `sidebar.right.tab.menu.item` | list | session | — | `SidebarRightTabMenuOwnerProps` |

- "A tab type registers here under its definition's `id`" (`RB/lib/types/client/contract/slots.d.ts:19-25`) —
  **not** under `kind`. The seat (the platform's own registration) supplies the `tabInfo` hook factory:
  `RB/lib/client.js:3714-3731` (`"sidebar.right.pane.tab": { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: tabInfoFactory } } }`).
- A body's props type is `PropsRuntime<'sidebar.right.pane.tab'>`; the live tab information arrives through the
  slot-owned zero-argument hook `useTabInfo()` (`RB/lib/types/client/contract/slots.d.ts:116-145`;
  `RB/lib/types/client/tab-info.d.ts:15-28`; reference body `DOC/lib/types/client/TextPreview.d.ts:16,22` and
  its implementation `DOC/lib/client.js:1409-1411` `const { tab } = useTabInfo()`).
- `SidebarRightTabInfo` gives the body: `sidebar.expanded`, `sidebar.fullscreen`, `panel.id`, and
  `tab` = the `TabRecord` plus `visible`, `navigation {address, params, revision}`, `signal` (aborted only
  when the record disappears or the package unloads), and `actions {openResource, openTab, close}`
  (`RB/lib/types/client/contract/slots.d.ts:117-139`). Docked bodies need an expanded column **and** an active
  tab; "expanded titles include inactive tabs. Floats stay visible" (`:126-133`).
- Session-scope standard props are declared by the session package: `SessionStandardProps` includes
  `sessionId: SessionId` and `useSession`, and `GlobalStandardProps` includes
  `useSessions: SnapshotSelectorHook<SessionListState>` (`SESSION/lib/types/client/index.d.ts:34-57`,
  `:6-7`). The same scope mechanism hands `sessionId` to the platform's own session-scope seat
  (`RB/lib/types/client/shell/SidebarRight.d.ts:64-65,97`).
- The registration call shape a body uses is the one the two shipped tab types use:

  ```js
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: ID, locale?, store?, children?, inject? },
    BodyComponent,
  ))
  ```

  `DOC/lib/client.js:26946-26959` (reference body, with `key: TEXTPREVIEW_ID`), `FILES/lib/client.js:702-712`,
  and the platform's own guide body `RB/lib/client.js:3749-3760`. `inject`, `locale`, `store` and `children`
  are optional: the title registration of the reference passes only `{name, key}`
  (`DOC/lib/client.js:26961-26964`).

### 2.5 Navigation — who shows, expands and opens

| step | owner | evidence |
|---|---|---|
| column shown / track / fullscreen | the right-sidebar **seat** reports it to `ctx.layout` | `RB/lib/client.js:3691-3693` |
| user expands a collapsed column | the conversation-header corner button → `actions.setExpanded(sessionId, true)` | `RB/lib/client.js:204-227`, `:3740-3744` |
| user reaches the guide | the pane strip's add control → `openTab('guide', …)` | `RB/lib/client.js:667-684` |
| user picks a guide capsule | `tab.actions.openTab(entry.kind, { replaceTab: true })` on the **guide tab's own actions** | `RB/lib/client.js:174-185` |
| the column expands on any open | the store's `openContent` starts its op list with `planSetExpanded(state, true)` | `RB/lib/client.js:498-501`; contract comment `RB/lib/types/client/service.d.ts:118-125` ("The column expands in the same step, because content the user cannot see is not opened.") |
| page tabs dedupe per pane | opening a page kind the pane already holds focuses that tab instead of adding a twin | `RB/lib/types/client/stores.d.ts:22-27`; `RB/lib/client.js:507-515` |
| a page tab's chip text | `definition.title(pageAddress(kind))`, captured at open time | `RB/lib/client.js:1276-1285`; `service.d.ts:121-125` |
| plugin-initiated open | `ctx.sidebarRight.openTab(kind, options?)` | `RB/lib/types/client/service.d.ts:104-125` |

**2.5.4 — the no-seat hazard (why D-4 matters).** Every controller command that needs the mounted seat goes
through the private `require()`, which throws `Error("sidebarRight: no session surface is mounted")` when no
rightbar seat is mounted — `openResource` (`RB/lib/types/client/service.d.ts:198`), `openTab` (`:204`),
`close` (`:241`), `toggleExpanded` (`:253`), `focus` (`:258`), `split` (`:264`), `float` (`:270`), `dock`
(`:275`), all funnelling into `require()` (`:297`); runtime proof `RB/lib/client.js:1414-1417`. The contract
states the intent: "a command arriving with no seat mounted has no session to act on and fails loudly rather
than writing into a surface nobody is drawing" (`service.d.ts:8-10`). Two commands degrade instead of throwing
— `active()` returns `undefined` (`:243-246`, implementation `RB/lib/client.js:1314-1319`) and `isExpanded()`
returns `false` (`:247-251`, implementation `:1324-1326`) — so from outside the seat "collapsed" and "no seat"
cannot be told apart. Combined with §2.1 (`RightbarRoot` renders nothing while a global panel is selected), a
plugin calling `openTab` from a surface that is mounted outside the right column can throw at any time.

**How this integration avoids the throw (t1 acceptance item 3).** The chosen entry is the type's own guide
entry, and its open is issued by the **guide tab's own actions** after the user picks the capsule:
`tab.actions.openTab(entry.kind, { replaceTab: true })` (`RB/lib/client.js:174-185`). That action is the Tab
domain's path, not the public controller's: it resolves through the acting session's adopted store via
`openTabIn(sessionId, …)` (`RB/lib/types/client/service.d.ts:214-222`, implementation
`RB/lib/client.js:1255-1258`, wired per tab at `:1135-1140`) and never touches `require()`; and the seat is
mounted by construction at that moment, because the guide is drawn inside it. Consequently this plugin makes
**no** controller call at all — its bundle `inject` lists only `slots`/`sessions`/`layout` and the registry is
acquired conditionally (R11.1), and R9.4 is the enforcement rule; the throw cannot occur on any path the
implementation takes. The tripwire for a later round that wants an extra entry point is R9.6.

*Exact wording of the guarantee:* the guide path is **throw-free, not guaranteed-to-open**. `openTabIn` guards
with `if (actions !== void 0)` (`RB/lib/client.js:1255-1258`, resolution through `actionsFor` at
`:1411-1413`), so for a session whose store was never adopted, or whose adoption was released, it is a
**silent no-op** rather than an error (`RB/lib/types/client/service.d.ts:214-222`: "nothing happens for a
session whose store was never adopted or whose adoption was released"). That state is unreachable on the guide
path: the guide is drawn inside the mounted seat, and the seat's store instance is minted through the wrapper
that adopts each session scope (`RB/lib/client.js:3681-3688`). "Safe" here therefore means "cannot throw"; it
must not be read as "always opens".

**Answer to "who shows, expands and opens" for this integration:** *nobody in this plugin*. The column's
presentation is reported to the frame by the right-sidebar seat (`ctx.layout.openRightbar`/`closeRightbar`,
§2.1); expansion happens when the user presses the kit's/header's chrome or, automatically, inside the store's
`openContent` (§2.5 table); the tab is opened by the guide tab's own actions after the user picks the capsule.
The plugin contributes exactly two registrations (R2, R3) and never navigates.

### 2.6 Module ids and injection

**Seed table (platform singletons resolvable by any bundle without a boot-graph row).** Extracted from the
installed shell (`FRONTEND/dist/assets/index-BKQ_L1z6.js`, the `by()` function passed as
`staticModules` to `createClientModuleSystem`) with the repo's own extraction idiom
(`REPO/.verify/module-table.mjs:20-25`):

```bash
node -e '
const fs=require("fs"),d="/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets";
const s=fs.readdirSync(d).filter(f=>f.endsWith(".js")).map(f=>fs.readFileSync(d+"/"+f,"utf8")).join("\n");
const m=s.match(/return\{react:[^}]*?\}\}/); console.log(m[0]);'
```

```text
return{react:…,"react/jsx-runtime":…,"react-dom":…,"react-dom/client":…,"@deepseek-ai/cordis":…,
"@deepseek-ai/dsh-client-store":…,"@deepseek-ai/dsh-client-ui-slots":…,
"@deepseek-ai/dsh-client-ui-primitives":…,"@deepseek-ai/dsh-client-ui-dockkit":…}}
```

Nine ids. The repo's own note on the 0.1.2-rc.1 table lists eight ids, without
`@deepseek-ai/dsh-client-ui-dockkit` (`REPO/tsdown.config.ts:12-21`), so the current `CLIENT_EXTERNALS`
list is one id short — confirm and act on that in `t2`, not here.

**Boot-graph rows.** Everything else must arrive as a package row registered as
`window.__ModuleLoader__.load({id: "<package name>", factory})`; the resolution order is
"seed word → shell instance; memoized record → exports; graph row → …; registered factory → materialize;
anything else → throw" (`MODULES/lib/types/client/manifest.d.ts:17-24`). The host composes rows from each
package's `dsh.client` declaration. `dsh.client.inject` is validated only as a string array
(`MODULES/lib/index.js:141-152`); `exactPackageSpecifier` (`:131-138`) is used exactly once, at `:682` inside
`locatePkgJson`, to resolve a Loader **entry name** to its `package.json` — never to validate inject entries.
A `<pkg>/client` or unknown inject name is therefore silently **inert** at arrival
(`MODULES/lib/client.js:265-268`, `graphRows.get(packageName)`), not rejected and not a throw; that is why
bare package names are the convention, not because anything filters them. `inject` also does not participate
in host row ordering: `orderByModuleGraph` (`MODULES/lib/index.js:349-372`) reads only
`dsh.client.external`, and `inject` is consumed at arrival/materialization time — "injected package rows
whose factories arrive before this row materializes"
(`MODULES/lib/types/client/manifest.d.ts:43-59`, `:86-100`).

**Facts about the two shipped tab types (the pattern to copy):**

- `DOC/package.json:28-38` — `dsh.client.inject` = `["@deepseek-ai/dsh-api-gateway",
  "@deepseek-ai/dsh-api-workspace-files", "@deepseek-ai/dsh-client-ui-sidebar-right",
  "@deepseek-ai/dsh-client-ui-session", "@deepseek-ai/dsh-api-remotes"]`; its bundle's `exports.inject` =
  `["slots","locale","sidebarRightTabs","remote","remote.workspaceFiles"]` (`DOC/lib/client.js:26920-26926`).
- `FILES/package.json:30-36` — the same package listed for a page type that only type-imports it.
- Their bundles `require()` **only** seed-table ids (`react`, `react/jsx-runtime`,
  `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-store`) plus `@deepseek-ai/dsh-client-ui-dockkit`
  for the rightbar package itself; every cross-plugin import is type-only, which is stated as the rule:
  "Every import from another client plugin is a type" (`DOC/lib/types/client/index.d.ts:8-12`). Verify with
  `grep -o 'require("[^"]*")' <bundle> | sort -u`.

### 2.7 The reference tab type end to end (`DOC`)

| step | code | citation |
|---|---|---|
| type constants | `TEXTPREVIEW_KIND='text'`, `TEXTPREVIEW_ID='@deepseek-ai/dsh-client-ui-sidebar-documentpreview'` | `DOC/lib/types/client/definition.d.ts:12-15`; `DOC/lib/client.js:1740-1742` |
| definition | `{id, kind, patterns:['dsh-resource://file/**'], priority:'fallback', canOpen, title}` — **no** `guide` | `DOC/lib/client.js:1766-1775`; `DOC/lib/types/client/definition.d.ts:26-31` |
| stage 1 | `ctx.effect(() => ctx.sidebarRightTabs.register(textDefinition()), '…: text type')` | `DOC/lib/client.js:26935` |
| stage 2 body | `ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({name, key: ID, locale, store, children, inject}, TextPreview))` | `DOC/lib/client.js:26946-26959` |
| stage 2 title | `{name: 'sidebar.right.pane.tab.title', key: ID}` (no inject) | `DOC/lib/client.js:26961-26964` |
| bundle services | `inject = ['slots','locale','sidebarRightTabs','remote','remote.workspaceFiles']` | `DOC/lib/client.js:26920-26926` |

---

## 3. Requirements

Each requirement is stated so a verifier can mark it passed/failed without reading my reasoning.

### R1 — Identity and naming

**R1.1** The implementation MUST define two named constants: `SUBAGENT_VIEW_ID` (the implementation identity,
used as the definition's `id` **and** as the key of the body registration) and `SUBAGENT_VIEW_KIND` (the tab
kind).
**R1.2** Their values MUST be `'subagent-view'` for both. There is no other registration with that `id` or
`kind` in 0.1.5-rc.2 (the only three registered kinds are `guide` `RB/lib/client.js:3584-3593`, `text`
`DOC/lib/client.js:1740-1775`, `files` `FILES/lib/client.js:13,29-42`).
**R1.3** The definition object MUST be produced by a pure factory (`subagentTabDefinition()` or equivalent)
so t4 can capture it from a stub registry and assert its fields.

*Basis:* `RB/lib/types/client/tab-registry.d.ts:68-78`; collision throw `RB/lib/client.js:3353-3360`.
*Verify:* build, then a client harness (or a grep of the built bundle) asserts `id === kind === 'subagent-view'`
and that exactly one `sidebarRightTabs.register(` call exists.

### R2 — Stage-one registration (exact object)

**R2.1** In the client `apply(ctx)`, inside the conditional acquisition scope of R11.1
(`ctx.inject(['sidebarRightTabs'], (scoped) => { … })`), and wrapped in `scoped.effect(...)` exactly as the
reference wraps its type, the plugin MUST call `scoped.sidebarRightTabs.register(definition)`. The registry
service MUST NOT be hard-listed in the bundle's `inject` array (R11.1).
**R2.2** The definition MUST be:

```ts
{
  id: SUBAGENT_VIEW_ID,            // 'subagent-view'
  kind: SUBAGENT_VIEW_KIND,        // 'subagent-view'
  title: () => 'Subagents',        // captured as the chip text at open time
  guide: [
    {
      order: 20,                   // ascending; Files ships order 10
      title: () => 'Subagents',
      description: () => 'Live subagent runs for the selected session',
    },
  ],
}
```

**R2.3** `patterns` MUST be omitted (page type: it recognizes no resource address and is opened by kind).
**R2.4** `canOpen` MUST be omitted (there is no address to veto).
**R2.5** `priority` MUST be omitted (default `'extension'` — a type from outside the product). Note this band
has no effect on routing for a pattern-less type; it only decides who is in force if another registration
claims the same kind.
**R2.6** The guide entry MUST NOT set `icon` (the guide draws its documented cube placeholder). If the
implementer wants an icon, it MUST be an exported glyph of `@deepseek-ai/dsh-client-ui-primitives`
(type-checked) and the choice recorded as a deviation; nothing else requires it.
**R2.7** `order: 20` MUST be used so the capsule sorts after Files (`order: 10`).

*Basis:* `RB/lib/types/client/tab-registry.d.ts:43,44-66,68-108,140-153` (the cube placeholder is documented at
`:60-61`); guide sort `RB/lib/client.js:3506-3511`; `FILES/lib/client.js:35-42`; default band
`RB/lib/client.js:3290,3357`.
*Verify:* harness captures the definition and asserts deep equality of `{id, kind, title(), guide[0].order,
guide[0].title(), guide[0].description()}`; built bundle contains no `patterns`/`canOpen`/`priority`/`icon`
in that object literal.

### R3 — Stage-two body registration

**R3.1** Inside the same conditional acquisition scope of R11.1 (the `scoped` context), the plugin MUST
register the body through the keyed seat, wrapped in `scoped.effect(...)`:

```ts
scoped.effect(
  () => scoped.slots.inject('sidebar.right.pane.tab', () => scoped.slots.register(
    { name: 'sidebar.right.pane.tab', key: SUBAGENT_VIEW_ID },
    SubagentRightbarTab,
  )),
  'subagent-view: rightbar tab body',
)
```

**R3.2** The `key` MUST be `SUBAGENT_VIEW_ID` — the *definition's `id`*, not the `kind`
(`RB/lib/types/client/contract/slots.d.ts:19-25`).
**R3.3** The registration MUST NOT pass `scope` (the platform's own seat declares
`sidebar.right.pane.tab` as `keyed`/`session`: `RB/lib/client.js:3714-3731`) and MUST NOT pass `inject`,
`locale`, `store` or `children` unless the body actually needs them.
**R3.4** The component MUST be typed and implemented as
`(props: PropsRuntime<'sidebar.right.pane.tab'>) => ReactElement` (`DOC/lib/types/client/TextPreview.d.ts:16,22`).
**R3.5** A live chip title (`sidebar.right.pane.tab.title` under the same `key`) is **optional**. If
registered, its shape is `{name: 'sidebar.right.pane.tab.title', key: SUBAGENT_VIEW_ID}` and it must render
the same text the registry's `title()` returns ("Subagents"); if not registered, the chip shows that captured
text anyway (`RB/lib/types/client/contract/slots.d.ts:32-45`).
**R3.6** The plugin MUST NOT register into `rightbar`, `rightbar.session`, `sidebar.right.tab.guide`,
`sidebar.right.tab.menu.item`, or any `sidebar.right.pane.tab` key other than its own. It MUST NOT replace the
guide (`RB/lib/types/client/contract/slots.d.ts:46-70`).

*Basis:* §2.4; reference `DOC/lib/client.js:26946-26964`.
*Verify:* the built `lib/client.js` contains exactly one `"sidebar.right.pane.tab"` registration object whose
`key` is `"subagent-view"` and no other `sidebar.right.*` registration; the mock-ctx harness asserts the
registered component identity and slot name.

### R4 — Session source of the body

**R4.1** The monitored session MUST come from the body's session-scope standard prop `sessionId`, not from a
private re-derivation of `useSessions().current`.
**R4.2** The body MUST keep reading `useSessions` for the Back-to-main fact
(`currentAddress?.parentSessionId`), because that is where the platform keeps it
(`CTRL/lib/types/client/sessions/service.d.ts:61-79`).
**R4.3** While a body is mounted, `sessionId === useSessions(s => s.current)` MUST hold: the seat only renders
for the selected Conversation (`RB/lib/client.js:1007-1018`) and the store keeps one surface per session
(`RB/lib/types/client/stores.d.ts:39-48`). A runtime observation that they diverge is a finding.

*Basis:* `SESSION/lib/types/client/index.d.ts:34-57`; `RB/lib/types/client/shell/SidebarRight.d.ts:64-65,97`.
If `sessionId` turns out not to be injected for this keyed seat, the fallback is
`useSessions(s => s.current)` and the deviation MUST be recorded — see H2 in §7.
*Verify:* `pnpm typecheck` (the prop is part of the declared props type) plus a runtime check that the first
snapshot request carries the selected session's id.

### R5 — Shared monitor state, one poller

**R5.1** The left bar and the rightbar tab MUST render from the **same** monitor source (the module-local
store in `REPO/src/client/panel.tsx:63-86` and the single `refresh()` at `:88-103`), so both hosts always show
identical rows for the same session.
**R5.2** Exactly **one** 1-second interval MUST exist while at least one consumer is mounted, and it MUST
survive the unmount of either consumer while the other is still mounted. The current implementation's
`if (polling) return` guard (`REPO/src/client/panel.tsx:240-251`) does not satisfy the second half: the second
consumer gets no cleanup, and the first consumer's unmount clears the interval out from under the survivor.
The interval's lifetime MUST be converted to a consumer refcount (or moved to the module).
**R5.3** The body MUST NOT fetch by itself outside that shared path; two hosts MUST NOT produce two requests
per second.

*Verify:* a harness that stubs `window.setInterval`/`clearInterval`, mounts both hosts, unmounts them in both
orders, and asserts the live-interval count is 1 → 1 → 0; or a running-app check of the request rate in the
network log with both hosts mounted (1 request/second, not 2).

### R6 — Polling contract (unchanged from today)

**R6.1** `GET /api/subagent-view/snapshot?sessionId=<encodeURIComponent(sessionId)>` (`REPO/src/client/panel.tsx:90`),
once per second while at least one host is mounted (`:243-246`).
**R6.2** A response whose `sessionId` differs from the currently tracked session MUST be dropped
(`:92`) — this is what keeps the shared store honest across a session switch.
**R6.3** `data.error` MUST be logged via `console.warn('subagent-view: snapshot degraded:', …)` and the rows
kept (`:93`); a transport rejection MUST be logged via `console.warn('subagent-view: snapshot poll failed', …)`
and retried on the next tick (`:95-102`). No poll failure may throw out of the interval.
**R6.4** The wire shape stays `{sessionId?, now?, rows?, error?}` with `rows` of
`{id, label?, mode?, depth?, parentId?, runId?, provider?, local?, startedAt?, endedAt?, status, sortKey?}`
(`:26-47`). The host half keeps its 200-with-JSON contract; this task does not change it.

*Verify:* network observation in the running app plus extraction of the fetch URL from `lib/client.js`.

### R7 — Parity with the current left panel, item by item

"Identical to the current left-sidebar subagent panel" is defined as this table. Every row is a MUST unless
marked otherwise; each names the left implementation's line(s), the behaviour to preserve, and what the
rightbar body must reuse.

| # | behaviour | left source (`REPO/src/client/`) | rightbar body requirement |
|---|---|---|---|
| P1 | 1s polling of the snapshot route for the tracked session | `panel.tsx:88-103`, `:220-236`, `:240-251` | same, via the shared poller (R5) |
| P2 | status legend: `running→Running`, `completed→Done`, `error→Failed`, `aborted→Interrupted`, `max-tokens→Token limit`, `refusal→Refused`, unknown→`Ended` | `panel.tsx:118-132` | same map, same strings |
| P3 | running dot = 3×3 pixel chase, 8 cells, 2px, 1s, negative phase delays | `panel.tsx:134-171` | same markup + same `.sav-dot*` classes |
| P4 | terminal dot = 10% halo + solid core (`::before`/`::after`) | `panel.tsx:143-171`; CSS `index.ts:143-158` | same |
| P5 | counts `running` / `completed` / `failed` where failed = error+aborted+max-tokens+refusal, computed over **visible** rows only | `panel.tsx:279-283` | same computation |
| P6 | stats line: non-zero segments only, `·` separator, `None` when all zero | `panel.tsx:173-186`, `:400-421` | same DOM (`sav-stats`, `sav-count-seg`, `sav-count-sep`, `sav-count-num`) |
| P7 | duration `mm:ss` / `h:mm:ss`, `00:00` when negative, `—` without `startedAt` | `panel.tsx:188-198` | same |
| P8 | row label fallback `label → [provider] subagent → subagent <8-char id>` | `panel.tsx:200-207` | same |
| P9 | meta line `provider · mode · shortId`, `mode` rendered `continuable`/`one-shot` | `panel.tsx:354-357` | same |
| P10 | footer time order: running → `elapsed · label`, else `label · elapsed` | `panel.tsx:374-376` | same |
| P11 | hidden-subtree pruning: a hidden ancestor hides its whole subtree | `panel.tsx:270-278` | same |
| P12 | branch collapse default: every parent collapsed unless explicitly expanded, including later arrivals | `panel.tsx:286-305` | same |
| P13 | canonical disclosure tree geometry: chevron at x=18px, children block `margin-left:18px; padding-left:4px`, vertical guide through the parent's chevron column, horizontal tick at `top:16px`, 17px last-sibling segment, open-branch bridge | `tree.tsx:1-27`, `:71-144` (esp. `:96-131`); CSS `index.ts:198-252` | reuse `SubagentTree` and the same `cls='sav'` prefix — no re-implementation |
| P14 | Archived folder = completed **one-shot** rows plus their whole subtrees, count = members only, collapsed by default, header = chevron + folder glyph + "Archived" + count, renders nothing while empty | `tree.tsx:146-259` (`:171`, `:223-243`, `:241`); usage `panel.tsx:347`, `:467-476`; default `panel.tsx:71` | reuse `splitArchived`/`ArchivedFolder` unchanged |
| P15 | `Open` action on rows that carry `mode`: `sessions.openSubagent({parentSessionId: tracked, childSessionId: row.id, mode})` | `panel.tsx:307-315`, `:364-370` | same; button hidden when no service or no mode |
| P16 | `← Main session` in the panel header, shown exactly when the tracked session has `currentAddress.parentSessionId`: `sessions.open(parent)` | `panel.tsx:221-223`, `:434-448` | same condition, same action, same label |
| P17 | `Clear finished`: hides every subtree with no running row, whole branches only, never single rows | `panel.tsx:317-343`, `:489-491` | same |
| P18 | `Show hidden (n)` button appears only when rows are hidden and restores them | `panel.tsx:482-488` | same |
| P19 | empty state: `No subagent activity in this session` when the session has no rows (the `No session selected` branch is unreachable in a tab, R4.1) | `panel.tsx:452-457` | same string for the reachable case |
| P20 | panel header: title `Subagents`, optional Back button, right-aligned `n running`, spacer layout | `panel.tsx:429-451` | same content, **not** click-to-collapse (deviation D-3) |
| P21 | `sav-panel` card visuals: background/border/radius/shadow/overflow tokens | `panel.tsx:87-100`; tokens `index.ts:87-100` | same classes + tokens; height adapted (deviation D-2) |
| P22 | styles are one injected tag `data-plugin='subagent-view'` | `index.ts:30-34`, `:487-489` | the same tag stays; no second copy of the same CSS |

*Verify:* t4 diffs the rightbar body against `.verify/baseline-HEAD/src_client_panel.tsx` and
`src_client_tree.tsx` row by row, and (where possible) renders both hosts with the same fixture rows and
compares normalized DOM.

### R8 — Container and chrome adaptation (explicit deviations)

These are the **only** permitted behavioural differences from the left panel. Each MUST be implemented as
described and reported in the implementation output.

- **D-1** The rightbar body MUST NOT render the collapsed bar (`.sav-bar`) or the rail button
  (`REPO/src/client/panel.tsx:384-398`, `:496-500`). The tab chip and the platform's strip chrome are the bar's
  equivalent: the chip carries the title, the kit's close control removes the tab, and the conversation-header
  expand button (`data-sidebar-right-expand`, `RB/lib/client.js:204-227`) is the way back into a collapsed
  column. The left host keeps its bar unchanged (D-1 of §1).
- **D-2** The panel root MUST fill the tab body (`height: 100%`, `min-height: 0`; the
  `max-height: min(60vh, 480px)` clamp and the `margin-bottom` of `REPO/src/client/panel.tsx:93-94` are
  dropped) so the row list scrolls inside the pane instead of inside a floating card. The visual tokens
  (background, border, radius, shadow, overflow) stay. Implement as the same `sav-panel` class plus a modifier
  (e.g. `sav-panel-tab`) so the left host's geometry is untouched.
- **D-3** The panel header MUST NOT toggle a panel-open flag: "Collapse panel" / `onClick={() =>
  commit({open:false})}` (`REPO/src/client/panel.tsx:428-432`) has no meaning inside a tab, and
  leaving it would empty the tab. Header content (P20) stays; the click affordance goes.
- **D-4** The mobile auto-open (`REPO/src/client/panel.tsx:209`, `:255-259`) and the
  force-closed-when-narrow effect (`:261-264`) MUST NOT apply to the tab body; presentation (normal vs
  fullscreen) is the platform's decision, surfaced to the body as `tabInfo.sidebar.fullscreen`
  (`RB/lib/types/client/contract/slots.d.ts:117-123`). The body MUST render correctly in both.
- **D-5** (platform-level, caused by R2.2) The pane that expands empty now seeds the **guide** page instead of
  the Files page. Accepted per §1 D-5.

### R9 — Visibility, floats, and what the body must not do

**R9.1** The body MUST NOT implement its own show/hide, rail, or collapse logic, and MUST NOT subscribe to
viewport width to decide presentation.
**R9.2** The body MUST tolerate `tabInfo.tab.visible === false` (docked + collapsed column, or a background
tab) by rendering normally; the platform decides whether it is drawn
(`RB/lib/types/client/contract/slots.d.ts:126-133`).
**R9.3** The body MUST render correctly when its tab is floated: floats stay visible regardless of the
column's expansion, and the body fills the floating panel (same `height: 100%` contract as D-2).
**R9.4** The plugin MUST NOT call `ctx.layout.openRightbar`, `closeRightbar`, or `selectPanel`; it MUST NOT
call `ctx.sidebarRight.*` at all (D-4 of §1). `ctx.layout.toggleSidebar()` stays exclusive to the existing
left rail button (`REPO/src/client/index.ts:498`).
**R9.5** The body MUST NOT use `tabInfo.tab.signal` to stop polling (the shared poller is host-independent);
it MAY ignore `signal` entirely. The signal aborts only when the record disappears or the plugin unloads
(`RB/lib/types/client/contract/slots.d.ts:130-131`).
**R9.6 (guard rule for any future plugin-initiated open — not used this round)** A later round that adds an
entry point outside the seat (a left-bar control, a host route, a command) MUST NOT call
`ctx.sidebarRight.openTab`/`openResource`/`close`/`focus`/`split`/`float`/`dock` from there: each goes through
the controller's `require()` and throws `sidebarRight: no session surface is mounted` whenever no seat is
mounted (`RB/lib/types/client/service.d.ts:198,204,241,253,258,264,270,275,297`; runtime
`RB/lib/client.js:1414-1417`). `isExpanded()` is NOT a usable guard — it returns `false` both when collapsed
and when no seat is mounted (`service.d.ts:247-251`) — and `active()` returns `undefined` in both cases too
(`:243-246`). The only safe forms are (a) a call from a component rendered inside the rightbar seat, or (b) a
call wrapped so the no-seat throw is treated as "no column", which MUST be recorded as a deviation. Neither
form is required or authorized by this round's contract. The Tab-domain forms an in-seat caller would use
(`openTabIn`/`openResourceIn`/`closeIn`, `service.d.ts:213-230`) are throw-free but degrade to the same silent
no-op described in §2.5.4 when the acting session's store was never adopted, so a caller MUST NOT read their
return as success.
*Verify:* assert the **call shape**, not the substring. Authoritative, source-level:
`grep -rnE 'sidebarRight\.(openResource|openTab|close|toggleExpanded|focus|split|float|dock|active|isExpanded)\s*\(' src/client`
returns nothing. In the built bundle the same call shape must be absent. A bare `grep sidebarRight` is
ambiguous, because `'sidebarRight'` is also the rightbar package's locale-namespace literal and the Context
property name; the exported `inject` **array** must be read as data and must not contain `'sidebarRight'`
(R11.1).

### R10 — Teardown

**R10.1** Both registrations MUST be disposed with the plugin: stage 1 through `ctx.effect` around
`register(...)` (reference `DOC/lib/client.js:26935`; registry disposer
`RB/lib/types/client/tab-registry.d.ts:140-153`), stage 2 through `ctx.effect` around `slots.inject(...)`.
**R10.2** After plugin unload: `ctx.sidebarRightTabs.get('subagent-view')` is `undefined`, an existing
`sidebar://subagent-view` tab shows the owner's "nothing can view this" notice rather than crashing
(`RB/lib/types/client/contract/slots.d.ts:19-25`), and no poller remains.
**R10.3** The style tag MUST be removed on unload (existing behaviour, `REPO/src/client/index.ts:487-489`).

### R11 — Module ids, inject lists, build externals

**R11.1** The client bundle's `exports.inject` MUST stay `['slots', 'sessions', 'layout']`
(`REPO/src/client/index.ts:23`); `'sidebarRightTabs'` MUST NOT be hard-listed there. The registry is a
**service**, not a module id (`RB/lib/types/client/index.d.ts:40-47`), and it MUST be acquired conditionally
with cordis's inject-scoped plugin form:

```ts
ctx.inject(['sidebarRightTabs'], (scoped) => {
  scoped.effect(() => scoped.sidebarRightTabs.register(subagentTabDefinition()), '…: tab type')
  scoped.effect(() => scoped.slots.inject('sidebar.right.pane.tab', () => scoped.slots.register(…)), '…: tab body')
})
```

Cordis documents this form as "Run a callback once the requested services are available… the callback is
unloaded and re-run whenever a required service changes" (`cordis/lib/types/registry.d.ts:102-111`; the
method is mixed onto every `ctx` at `cordis/lib/types/context.d.ts:30`). Rationale: a hard-listed service
whose provider never arrives leaves this plugin's cordis fiber `pending` forever, and the 0.1.5-rc.2 shell
turns exactly that into a fatal boot error — `assertEntriesActive` throws
`web boot: N entries did not activate … pending (waiting for services: …)`, caught by `run()` into
`page.fail(...)` (`FRONTEND/dist/assets/index-BKQ_L1z6.js:114`, `run`/`assertEntriesActive`). The platform
itself uses the defensive pair (`MODULES/lib/index.js:487`, `ctx.get("webServer") === void 0` →
`ctx.inject([...])`), and `dsh.client.inject` does not force-load the row (`MODULES/lib/client.js:265-268`).
**R11.2** `package.json` → `dsh.client.inject` MUST gain the bare package name
`"@deepseek-ai/dsh-client-ui-sidebar-right"`, alongside today's ids (`REPO/package.json:14-25`), mirroring the
two shipped tab types (`DOC/package.json:28-38`, `FILES/package.json:30-36`). Write the bare name because a
`/client` suffix or any unknown name is silently **inert**, not rejected: inject entries are validated only as
strings (`MODULES/lib/index.js:141-152`), `exactPackageSpecifier` is not applied to them (its single use at
`:682` resolves a Loader entry name), and arrival skips a name with no graph row
(`MODULES/lib/client.js:265-268`).
**R11.3** The new code MUST import **only types** from `@deepseek-ai/dsh-client-ui-sidebar-right/client`
(`SidebarRightTabDefinition`, and `PropsRuntime` from ui-slots). It MUST NOT value-import any platform client
package except the nine seed ids of §2.6; the built `lib/client.js` MUST therefore contain no new
`require("@deepseek-ai/…")` beyond the seed-table ids this plugin already requires. Rationale: the current
tsdown predicate (`REPO/tsdown.config.ts:39-41`) does **not** mark other `@deepseek-ai/*` client packages
external, so a value import of the rightbar package would be *bundled* — a second copy of the tab system.
**R11.4** `dsh.client.inject` entries MUST be bare package names. Names with no graph row are silently skipped
by the module system (`MODULES/lib/client.js:265-268`, `if (dependency !== void 0)`), so today's
`@deepseek-ai/dsh-client-ui-primitives` entry — a seed-table singleton, not a row (`REPO/package.json:22`) —
is inert: it MUST NOT be treated as the reason a seed-table id resolves, and it is NOT a model for how
`@deepseek-ai/dsh-client-ui-sidebar-right` gets loaded (that one IS a row and is the reason to list it).
Seed-table words resolve through the shell instance branch of the resolution order regardless
(`MODULES/lib/types/client/manifest.d.ts:17-24`).
**R11.5** `@deepseek-ai/dsh-client-ui-sidebar-right` (version pinned by `t2`'s migration to `0.1.5-rc.2`) MUST
be a devDependency so `pnpm typecheck` resolves the module augmentation and the definition type. Whether it is
also a peerDependency follows `t2`'s convention; nothing in this integration requires it at runtime.
**R11.6 (fallback contract)** On a deployment where no `@deepseek-ai/dsh-client-ui-sidebar-right` is composed,
the plugin MUST still load with the left-sidebar entry (`sidebar.footer.action`) and the `conversation.view`
Subagents tab working unchanged, registering no rightbar tab type and leaving nothing pending — the
`ctx.inject(['sidebarRightTabs'], …)` scope simply never runs.

*Verify:* module-table harness (seed table + boot-graph rows vs. every `require()` in built `lib/client.js`),
`node -p "require('./package.json').dsh.client.inject"`, `grep -o 'require("[^"]*")' lib/client.js | sort -u`,
and (R11.6) a mock-ctx harness with no `sidebarRightTabs` service: `apply` resolves, the legacy registrations
appear, no rightbar registration does, and the module's `exports.inject` array does not contain
`'sidebarRightTabs'`.

### R12 — Existing surfaces stay intact

**R12.1** `sidebar.footer.action` (`id: 'subagent-view'`, `order: 100`, `inject` = `toggleSidebar`) keeps its
registration and its current behaviour (`REPO/src/client/index.ts:491-502`), including the bar + panel + rail
mode and the shared store (R5.1).
**R12.2** `conversation.view` (`id: 'subagent-view'`, `order: 30`, `label: 'Subagents'`) stays
(`REPO/src/client/index.ts:509-524`).
**R12.3** The rightbar body MUST NOT register into those two slots (no third host of the bar).
**R12.4** The host half's routes are unchanged by this integration; the body's only host interface is R6.

*Verify:* built `lib/client.js` still contains both legacy registrations with their ids/orders, plus exactly
one rightbar body registration.

---

## 4. Minimal type-consistent registration (reference implementation shape)

`REPO/src/client/rightbar.tsx` (new file; `src/client/index.ts` stays the tsdown entry and imports it):

```tsx
/**
 * subagent-view, browser half: the rightbar tab type (stage 1) and its body
 * (stage 2). The type is a page: it claims no resource address.
 */
import type { ReactElement } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

/** This implementation's identity in the tab system, and the key its body registers under. */
export const SUBAGENT_VIEW_ID = 'subagent-view'
/** The tab kind `openTab` names; page types are opened by kind only. */
export const SUBAGENT_VIEW_KIND = 'subagent-view'

/** Stage one: what the type IS. Patterns/canOpen/priority are deliberately absent. */
export function subagentTabDefinition(): SidebarRightTabDefinition {
  return {
    id: SUBAGENT_VIEW_ID,
    kind: SUBAGENT_VIEW_KIND,
    title: () => 'Subagents',
    guide: [{
      order: 20,
      title: () => 'Subagents',
      description: () => 'Live subagent runs for the selected session',
    }],
  }
}

/** Stage two: the body. It is a session-scope component, so `sessionId` arrives as a prop. */
export function SubagentRightbarTab({ sessionId, useSessions }: PropsRuntime<'sidebar.right.pane.tab'>): ReactElement {
  // The panel-content component shared with the left host. It MUST NOT render
  // the collapsed bar or the rail button (deviation D-1) and MUST NOT toggle a
  // panel-open flag (D-3); it MUST fill the tab body (D-2).
  return <SubagentMonitorPanel sessionId={sessionId} useSessions={useSessions} />
}
```

`REPO/src/client/index.ts` wiring (inside `apply`, alongside the existing two registrations):

```ts
import { SubagentRightbarTab, subagentTabDefinition, SUBAGENT_VIEW_ID } from './rightbar'

export const inject = ['slots', 'sessions', 'layout']   // R11.1: no 'sidebarRightTabs'

// … inside apply(ctx): the registry arrives conditionally, so a deployment without
// the rightbar package keeps the left bar and the conversation tab and leaves nothing pending (R11.6).

ctx.inject(['sidebarRightTabs'], (scoped) => {
  scoped.effect(
    () => scoped.sidebarRightTabs.register(subagentTabDefinition()),
    'subagent-view: rightbar tab type',
  )

  scoped.effect(
    () => scoped.slots.inject('sidebar.right.pane.tab', () => scoped.slots.register(
      { name: 'sidebar.right.pane.tab', key: SUBAGENT_VIEW_ID },
      SubagentRightbarTab,
    )),
    'subagent-view: rightbar tab body',
  )
})
```

Type-only imports of `@deepseek-ai/dsh-client-ui-sidebar-right/client` and
`@deepseek-ai/dsh-client-ui-slots` are erased by tsdown, so no runtime coupling to the rightbar bundle is
introduced (R11.3). If the implementer instead registers a live title, the second registration is
`{ name: 'sidebar.right.pane.tab.title', key: SUBAGENT_VIEW_ID }` with the component rendering
`'Subagents'`.

---

## 5. User-facing path, exactly as a user experiences it

1. A session is selected; the right column may be collapsed. The user clicks the conversation-header button
   with `data-sidebar-right-expand` → `actions.setExpanded(sessionId, true)`
   (`RB/lib/client.js:204-227`).
2. The pane expands empty for the first time, so the store seeds `defaultSeed(tabs)`. With this plugin loaded
   there are two guide entries, so the seeded page is the **guide** (`RB/lib/client.js:229-237`; D-5). If the
   pane already holds the Files page, the user instead clicks the strip's **add control** (`dock.addTab`),
   which opens the guide as a tab (`RB/lib/client.js:667-684`).
3. The guide lists two capsules in `order`: **Files** (10) then **Subagents** (20)
   (`RB/lib/client.js:3506-3511`). Each shows its description while the list is short
   (`RB/lib/types/client/tabs/guide/GuideBody.d.ts:12-16`).
4. Clicking **Subagents** calls `tab.actions.openTab('subagent-view', { replaceTab: true })` on the guide tab
   (`RB/lib/client.js:174-185`). The guide's pane is replaced by a tab whose chip reads **Subagents** and whose
   body is the live monitor. The guide can be reopened from the add control at any time.
5. Opening it again in the same pane focuses the existing tab; a second pane can hold its own
   (`RB/lib/types/client/stores.d.ts:22-27`).

Testable assertions: after installing the plugin, the guide page shows exactly `Files` + `Subagents`; the
new tab's `contentId` is `sidebar://subagent-view` and its `kind` is `subagent-view`; the chip text is
`Subagents`.

This is the only entry point the contract requires. There is deliberately **no plugin-initiated route** (no
left-bar control, no host route, no command calling `ctx.sidebarRight.openTab`) because every controller
command throws when no rightbar seat is mounted (§2.5.4); if one is added later it must satisfy R9.6.

---

## 6. Test plan (what t4/t5 can run)

**S — static assertions on the built bundle** (no browser):
`s1` `grep -c '__ModuleLoader__.load({' lib/client.js` → 1, id `subagent-view`.
`s2` exactly one `"sidebar.right.pane.tab"` registration object; its `key` is `"subagent-view"`.
`s3` exactly one `sidebarRightTabs.register(` call; the captured definition's own keys are exactly
`{id, kind, title, guide}` (the `H` harness is authoritative here — a bare `grep` for an absent word is only
supporting evidence).
`s4` `grep -o 'require("[^"]*")' lib/client.js | sort -u` ⊆ seed-table ids of §2.6.
`s5` `node -p "require('./package.json').dsh.client.inject"` contains
`"@deepseek-ai/dsh-client-ui-sidebar-right"`, and every entry is a bare package name (R11.2/R11.4).
`s6` conditional acquisition and no controller call — **structural, never a substring search**:
(a) load the built bundle through the `window.__ModuleLoader__` shim and read `exports.inject` as an **array**:
assert `!includes('sidebarRightTabs')` (the repaired contract, R11.1) and `!includes('sidebarRight')`;
(b) `grep -rnE 'sidebarRight\.(openResource|openTab|close|toggleExpanded|focus|split|float|dock|active|isExpanded)\s*\(' src/client`
returns nothing, and the same regex — the literal `(` is required — returns nothing in the built bundle;
`sidebarRightTabs.register(` legitimately cannot match it;
(c) the source contains `ctx.inject(['sidebarRightTabs'], …)`.
The literal `'sidebarRight'` is also the rightbar package's locale namespace (R9.6/R11.1), so a text search for
it proves nothing in either direction.

**H — mock-context harness** (Node, like `REPO/.verify/harness.mjs`): define
`global.window.__ModuleLoader__ = {load: ({id, factory}) => { exports = factory(requireShim) }}`, stub
`document`, then call `apply(ctx)` with a stub ctx recording `slots.inject/register` and
`sidebarRightTabs.register`. Assertions: the captured definition object (R2), the captured body registration
`{name, key}` and component identity (R3), effect-wrapped disposal (R10), one `sidebar.footer.action` +
`conversation.view` + one rightbar body (R12), the exported `inject` array as data (R11.1), and that the stub
`sidebarRight`/controller face was never handed to the plugin at all (the plugin's inject must not request it —
R9.6/s6). Run it twice: with a `sidebarRightTabs` service provided through the `ctx.inject` stub, and with none
(R11.6: the legacy registrations still appear, no rightbar registration does, nothing stays pending).

**T — typecheck/build**: `pnpm install`, `pnpm build`, `pnpm typecheck` all exit 0 (`t3`'s verify list). The
typecheck is the evidence for R4.1's prop typing and for the definition object literal.

**A — running app** (the strongest parity evidence; requires a profile install, which is t6's documented,
confirmation-gated step):
`a1` guide shows both capsules; picking Subagents opens the tab (R2.2, §5).
`a2` with both hosts mounted, exactly one `GET /api/subagent-view/snapshot` per second (R5.2, R6.1).
`a3` throwaway comparison: the same fixture session rendered in the left panel and in the tab produces the
same row list, ordering, labels, dots, counts and footer actions (R7); the tab additionally fills its pane
(R8 D-2) and has no collapse-on-header-click (D-3).
`a4` `Open` → the child conversation opens; `← Main session` appears only on a subagent session and returns;
`Clear finished` hides finished subtrees; `Show hidden (n)` restores them (P15–P18).
`a5` close the tab, reopen from the add control → the tab returns with the same rows (state is shared, not
tab-owned).
`a6` unload the plugin (profile restart without it) → no rightbar registration remains, no poller remains.

---

## 7. HYPOTHESES (not settled by reading installed packages) and their experiments

**H1 (HYPOTHESIS) — Mounted-ness of a hidden docked tab body.** `RB/lib/types/client/contract/slots.d.ts:126-133` says a
docked body is visible only with an expanded column and an active tab, but not whether the component *stays
mounted* (and thus keeps any per-body work alive) while hidden. Our design is insensitive to the answer
because polling is shared and host-independent (R5), but a verifier should record it.
*Experiment:* with both hosts mounted, switch the pane to another tab and count snapshot requests for 5s; if
requests continue, the body stays mounted.

**H2 (HYPOTHESIS) — Exact standard-props set injected into a keyed session-scope body.** `SessionStandardProps` declares
`sessionId` (`SESSION/lib/types/client/index.d.ts:41-48`) and the slot map declares
`scope: 'session'` for `sidebar.right.pane.tab` (`RB/lib/types/client/contract/slots.d.ts:26-31`), but
`@deepseek-ai/dsh-client-ui-slots` is not installed as a readable package — it ships only as a shell
singleton (seed table, §2.6) — so the scope→standard-props binding cannot be read from a `.d.ts` here.
*Settled by:* `pnpm typecheck` of the typed body (`PropsRuntime<'sidebar.right.pane.tab'>`) and a runtime
observation that the body reads the selected session. *Fallback if it fails:* use
`useSessions(s => s.current)` and record the deviation.

**H3 (HYPOTHESIS) — Which page a fresh pane actually seeds after this registration.** The code path is fully readable
(`RB/lib/client.js:229-237` + the single shipped entry `FILES/lib/client.js:29-42`), but the end-to-end
consequence (guide instead of Files on first expansion, and guide-with-two-capsules rather than the Files
page) has not been observed in a running app in this task.
*Experiment:* clean profile with only the shipped platform + this plugin; new session; expand the right
column; record the seeded page and the capsule list.

**H4 (HYPOTHESIS) — Retention of the tab across a global-panel round trip.** `RightbarRoot` returns `null` while
`activePanelId !== null` (`RB/lib/client.js:1012-1013`), so the seat unmounts; the per-session surface is
expected to survive because it lives in that session's store (`RB/lib/types/client/stores.d.ts:39-48`).
*Experiment:* open the Subagents tab, select a global panel, return to the Conversation, confirm the tab is
still there with its rows.

**N1 (settled by reading — not a hypothesis) — locale-awareness is not required.** The plugin's copy is hard-coded English today
(`REPO/src/client/panel.tsx:433,455,489,497`). Guide copy is thunked and re-read per use
(`RB/lib/types/client/tab-registry.d.ts:23-25`), so adding a locale namespace later is possible without
re-registration, and nothing in the platform requires one (`RB/lib/client.js:3749-3760` registers the guide
body without a `locale`). Stated so no one "fixes" it in this round.

---

## 8. Deferred to other tasks (not decided here)

- Version pins for `@deepseek-ai/*` devDependencies/peerDependencies, `CLIENT_EXTERNALS`, and the
  `dsh.client.inject` id set beyond R11 (`t2`: `docs/MIGRATION-0.1.5-rc.2.md`).
- Host-half changes, if any, needed for 0.1.5-rc.2 (`t2`/`t3`); this spec leaves the host contract at R6.4.
- Whether an icon is added to the guide capsule, and whether a live title component is registered (both
  optional, R2.6/R3.5).
- Whether the left bar later becomes a button into the rightbar tab — explicitly out of bounds for this
  round (D-1).

---

## Related documents (appended by `t6`)

This block is the only part of this file added by the integration task `t6`; it carries links, no
contract statements. The content **above** it is byte-identical to the revision that `t4`
(verification) and `t5` (review) judged: the first **61392** bytes of this file hash to
`81054f1188603611102ef42db534ec97d88bddbfeec7caada0d473beb9838beb`
(reproducible with `head -c 61392 docs/RIGHTBAR-INTEGRATION-SPEC.md | shasum -a 256`), so the
pinned revision and every `§`/line citation in the gate reports still resolve.

- [`../README.md`](../README.md) — user-facing overview: the three monitor surfaces, the exact steps to
  open the right-sidebar **Subagents** tab, install/rebuild steps and the `0.1.5-rc.2` requirement.
- [`MIGRATION-0.1.5-rc.2.md`](./MIGRATION-0.1.5-rc.2.md) — the platform drift inventory behind the
  version pins, `dsh.client.inject` set and `CLIENT_EXTERNALS` this spec's R11 defers to (§8).
- [`VERIFICATION-RIGHTBAR.md`](./VERIFICATION-RIGHTBAR.md) — independent verification of R1–R12 and the
  R11.6 fallback on a real cordis context.
- [`REVIEW-RIGHTBAR.md`](./REVIEW-RIGHTBAR.md) — the round-1 review: this spec's R1–R12 and P1–P22 all
  PASS, with D-2/D-3 as the only sanctioned divergences.
- [`DELIVERY-RECORD-0.1.5-rc.2.md`](./DELIVERY-RECORD-0.1.5-rc.2.md) — why the shipped revision uses the
  guarded `ctx.inject(['sidebarRightTabs'], …)` form of R11.1.
- [`INTEGRATION-RECORD.md`](./INTEGRATION-RECORD.md) — final assembly record: delivered hashes, the
  recorded fresh-install reproduction, the packaging audit and the residual limitations.

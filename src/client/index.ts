/**
 * subagent-view, browser half entry: the plugin body only (no JSX — tsdown
 * pins the client bundle entry to src/client/index.ts). Two hosts of one
 * monitor:
 *  - the read-only status bar in the left sidebar (`./bar.tsx`, seat
 *    `sidebar.footer.action`) — counts only, no panel and nothing to open, and
 *  - a right-sidebar tab type (`./rightbar.tsx`: stage one into
 *    `ctx.sidebarRightTabs`, stage two into the keyed `sidebar.right.pane.tab`
 *    seat), which is now the only host of the panel card.
 * Both share one store and one poller (`./monitor.tsx`). The conversation's
 * Subagents view (`./subagents-tab.tsx`) is unchanged.
 *
 * The left sidebar's expandable panel was retired in this revision; the
 * retirement and what it supersedes are recorded in docs/ERRATA-0.1.5.md §E-8.
 */
// The browser half's type homes under DSH 0.1.5-rc.2: the client context is
// `@deepseek-ai/cordis`, while `SessionId` and `SubagentAddress` are reached
// through the session/subagent packages the client controllers re-export them
// from. (`@deepseek-ai/dsh-client-runtime` is not published beyond 0.1.1-rc.2,
// so a require of it would resolve to nothing in the module table.)
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client'
// Slot-contract merges: `ui-renderer` declares `ctx.slots`; `ui-session` adds
// the standard session kit (`sessionId`, `useSessions`) that every
// session-scope slot component receives; `ui-sidebar-right` declares the
// `sidebar.right.pane.tab` seat and provides `ctx.sidebarRightTabs`. All are
// type-only.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { SubagentViewBar } from './bar'
import { setSessionsService, type MonitorSessionsService } from './monitor'
import { SubagentsView } from './subagents-tab'
import { SubagentRightbarTab, subagentTabDefinition, SUBAGENT_VIEW_ID } from './rightbar'

// `layout` left this list with the left panel's rail button: it was read in
// exactly one place (`ctx.layout.toggleSidebar()`) and nothing reads it now.
// Every listed service is a hard requirement of this fiber (§11 rule 4).
export const inject = ['slots', 'sessions']

export function apply(ctx: ClientContext): void {
  // Loose capture of the sessions service: the panel only needs open() and
  // openSubagent(), so keep the narrow local face.
  setSessionsService(ctx.sessions as unknown as MonitorSessionsService | undefined)

  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'subagent-view'
    tag.textContent = `
.sav-root {
  display: flex; flex-direction: column; gap: 0;
  width: 100%; min-width: 0;
  font-family: var(--dsw-font-family, inherit);
  font-size: 12px;
  color: var(--dsw-alias-label-primary, inherit);
}
/* The docked left-sidebar status bar. Display only — the monitor lives in the
   right-sidebar tab — so it carries no hover, pointer or disclosure affordance. */
.sav-bar {
  flex: none; width: 100%;
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border: none; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit; font-size: 12px; line-height: 18px;
}
.sav-bar-label {
  flex: none; font-weight: 500;
  color: var(--dsw-alias-label-primary, inherit);
}
.sav-bar-stats {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums;
  display: flex; align-items: center;
}
.sav-stats { display: inline-flex; align-items: center; gap: 6px; }
.sav-stats-none { color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sav-count-seg { display: inline-flex; align-items: center; gap: 3px; }
.sav-count-sep { color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sav-count-num { font-variant-numeric: tabular-nums; }
/* The monitor card. Its single host is the right-sidebar tab body, so the box
   fills the pane (the row list scrolls inside the tab) and the visual tokens
   (background, border, radius, shadow, overflow) come from the same block. */
.sav-panel {
  flex: 1 1 auto; width: 100%; min-width: 0; height: 100%; min-height: 0;
  display: flex; flex-direction: column;
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base, #ffffff));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  box-shadow: var(--dsw-shadow-lv1, 0 2px 4px rgba(15, 23, 42, 0.04));
  overflow: hidden;
}
/* No click-to-collapse: a tab has no collapsed state, so the header must not
   advertise one (no pointer cursor, no hover fill). */
.sav-panel-header {
  flex: none; display: flex; align-items: center; gap: 6px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06));
  user-select: none;
}
.sav-panel-title { flex: none; font-weight: 600; font-size: 13px; line-height: 18px; }
.sav-panel-running {
  flex: none; color: var(--dsw-alias-brand-primary, #2563eb); font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.sav-panel-spacer { flex: 1; }
.sav-rows {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(15, 23, 42, 0.15));
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(15, 23, 42, 0.25));
}
.sav-empty { flex: 1; padding: 24px 12px; text-align: center; color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sav-row {
  flex: none; position: relative;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
  /* 11px left pad + 14px disclosure box puts the chevron center at x=18px,
     the column the tree guide lines run through. */
  padding: 7px 8px 7px 11px;
}
.sav-row-main { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sav-dot { width: 10px; height: 10px; flex: none; }
/* Running: pixel-art chase around the 3x3 outer ring. */
.sav-dot-running { color: var(--dsw-static-deepseek-450, rgb(86, 134, 254)); }
.sav-dot-cell { fill: currentColor; opacity: 0.15; animation: sav-dot-chase 1s infinite; }
@keyframes sav-dot-chase {
  0%, 12.4% { opacity: 1; }
  12.5%, 24.9% { opacity: 0.6; }
  25%, 37.4% { opacity: 0.35; }
  37.5%, 100% { opacity: 0.15; }
}
/* Terminal states: 10% same-color halo around a 6/10 solid core. */
.sav-dot-ok, .sav-dot-error, .sav-dot-warn, .sav-dot-off {
  position: relative; display: inline-block;
}
.sav-dot-ok::before, .sav-dot-error::before, .sav-dot-warn::before, .sav-dot-off::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: currentColor; opacity: 0.1;
}
.sav-dot-ok::after, .sav-dot-error::after, .sav-dot-warn::after, .sav-dot-off::after {
  content: ''; position: absolute; inset: 20%; border-radius: 50%;
  background: currentColor;
}
.sav-dot-ok { color: var(--dsw-alias-state-success-primary, rgb(34, 197, 94)); }
.sav-dot-error { color: var(--dsw-alias-state-error-primary, rgb(236, 19, 19)); }
.sav-dot-warn { color: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11)); }
.sav-dot-off { color: var(--dsw-alias-label-tertiary, #cbd5e1); }
.sav-row-label {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; line-height: 18px;
}
.sav-row-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 2px; padding-left: 22px;
}
.sav-row-time {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
}
.sav-row-meta {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, #a3aec2); font-size: 11px; line-height: 16px;
}
.sav-row-open { flex: none; }
.sav-panel-footer {
  flex: none; display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06));
}
.sav-panel-stats {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8); font-size: 11px;
  font-variant-numeric: tabular-nums;
  display: flex; align-items: center;
}
.sav-btn {
  flex: none;
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.12));
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  border-radius: 6px; padding: 1px 8px; font-size: 11px; line-height: 16px;
  cursor: pointer; font-family: inherit;
}
.sav-btn:hover {
  border-color: var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.3));
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sav-back { color: var(--dsw-alias-brand-primary, #2563eb); border-color: var(--dsw-alias-brand-primary, #2563eb); }
/* ---- canonical disclosure tree (shared by the sidebar panel "sav" and the
   Subagents tab "sat") — faithful port of the authority visual from
   @deepseek-ai/dsh-client-ui-subagent: a chevron-right ">" to the left of
   rows that have children (it rotates 90° to point downward when the branch
   expands) plus gray "L"-shape guide lines marking parent-child links. ----
   Geometry: row cards are padded 11px left, so the 14px chevron's center
   sits at x=18px; each child level is offset 22px (18px margin + 4px
   padding) and its rows carry the guide lines through the parent's chevron
   column (x=-4px relative to the node) with a 14px horizontal tick reaching
   each child's chevron (top:16px = its vertical center). */
.sav-disclosure, .sat-disclosure {
  flex: none; align-self: flex-start;
  width: 14px; height: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; padding: 0; background: transparent;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  cursor: pointer;
  transition: transform 120ms var(--ds-ease-in-out, ease-in-out);
}
.sav-disclosure:hover, .sat-disclosure:hover { color: var(--dsw-alias-label-primary, inherit); }
.sav-disclosure-open, .sat-disclosure-open { transform: rotate(90deg); }
.sav-disclosure-space, .sat-disclosure-space {
  flex: none; align-self: flex-start;
  width: 14px; height: 18px;
}
.sav-node, .sat-node {
  position: relative; min-width: 0;
  display: flex; flex-direction: column;
}
.sav-children, .sat-children {
  position: relative;
  margin-left: 18px; padding-left: 4px;
  display: flex; flex-direction: column; gap: 6px;
}
/* Vertical guide line through the parent's chevron column: one per child,
   spanning its whole subtree. The 6px downward overhang bridges the inter-row
   gap so the line stays continuous; the last sibling stops at its tick. */
.sav-children > .sav-node::before, .sat-children > .sat-node::before {
  content: ''; position: absolute; top: 0; bottom: -6px; left: -4px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
}
.sav-children > .sav-node:last-child::before, .sat-children > .sat-node:last-child::before {
  height: 17px; bottom: auto;
}
/* Horizontal tick from the parent's line into each child row's chevron. */
.sav-children > .sav-node > .sav-row::before, .sat-children > .sat-node > .sat-row::before {
  content: ''; position: absolute; top: 16px; left: -4px; width: 14px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
}
/* Vertical bridge from an expanded parent's chevron down to its children:
   spans the rest of the row card, so rows of any height stay connected. */
.sav-node > .sav-row.sav-row-branch-open::after, .sat-node > .sat-row.sat-row-branch-open::after {
  content: ''; position: absolute; top: 24px; bottom: -1px; left: 18px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
}
/* ---- Archived folder (shared by the sidebar panel "sav" and the Subagents
   tab "sat") ---- a disclosure-style header whose chevron sits on the same
   x=18px column as row chevrons, with the folder body indented like a
   children block and a guide-line bridge from the open header down to it. */
.sav-folder, .sat-folder {
  flex: none; display: flex; flex-direction: column;
}
.sav-folder-header, .sat-folder-header {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  width: 100%;
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  /* 11px left pad + 14px chevron box puts the chevron center at x=18px. */
  padding: 7px 8px 7px 11px;
  font-family: inherit; font-size: 12px; line-height: 18px;
  color: var(--dsw-alias-label-primary, inherit);
  cursor: pointer; text-align: left;
}
.sav-folder-header:hover, .sat-folder-header:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sav-folder-chevron, .sat-folder-chevron {
  flex: none; width: 14px; height: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  transition: transform 120ms var(--ds-ease-in-out, ease-in-out);
}
.sav-folder-chevron-open, .sat-folder-chevron-open { transform: rotate(90deg); }
.sav-folder-icon, .sat-folder-icon {
  flex: none; width: 14px; height: 14px;
  color: var(--dsw-alias-label-secondary, #64748b);
}
.sav-folder-label, .sat-folder-label { flex: none; font-weight: 600; }
.sav-folder-count, .sat-folder-count {
  flex: none; min-width: 16px; text-align: center;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
}
.sav-folder-body, .sat-folder-body {
  display: flex; flex-direction: column; gap: 6px;
  margin-left: 18px; padding-left: 4px;
}
/* Guide-line bridge from the open folder header's chevron down to the body. */
.sav-folder-open::after, .sat-folder-open::after {
  content: ''; position: absolute; top: 24px; bottom: -1px; left: 18px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
}
/* ---- Subagents tab (conversation.view) ---- */
.sat-root {
  display: flex; flex-direction: column; gap: 8px;
  width: 100%; min-width: 0; height: 100%; min-height: 0;
  font-family: var(--dsw-font-family, inherit);
  font-size: 12px;
  color: var(--dsw-alias-label-primary, inherit);
}
.sat-crumbs {
  flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
}
.sat-crumb { font-size: 12px; line-height: 18px; }
.sat-crumb-link {
  border: none; background: transparent; padding: 0; cursor: pointer;
  color: var(--dsw-alias-brand-primary, #2563eb);
  font-family: inherit; font-size: 12px; line-height: 18px;
}
.sat-crumb-link:hover { text-decoration: underline; }
.sat-crumb-current {
  color: var(--dsw-alias-label-primary, inherit);
  font-weight: 600;
}
.sat-crumb-sep { color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sat-summary {
  flex: none; display: flex; flex-direction: column; gap: 6px;
  padding: 8px 10px;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
}
.sat-sum-cells { display: flex; align-items: center; gap: 20px; }
.sat-sum-cell { display: inline-flex; align-items: center; gap: 6px; }
.sat-sum-num {
  font-size: 24px; line-height: 28px; font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, inherit);
}
.sat-sum-caption {
  font-size: 11px; line-height: 16px;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
}
.sat-sum-bar { display: flex; align-items: center; gap: 10px; }
.sat-proportion {
  flex: 1; min-width: 0; height: 6px; border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1, rgba(15, 23, 42, 0.06));
  display: flex; overflow: hidden;
}
.sat-prop-seg { height: 100%; }
.sat-prop-running { background: var(--dsw-static-deepseek-450, rgb(86, 134, 254)); }
.sat-prop-done { background: var(--dsw-alias-state-success-primary, rgb(34, 197, 94)); }
.sat-prop-failed { background: var(--dsw-alias-state-error-primary, rgb(236, 19, 19)); }
.sat-sum-total {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
}
.sat-sum-totals {
  color: var(--dsw-alias-label-secondary, #64748b);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
}
.sat-metrics {
  flex: none; display: flex; flex-direction: column; align-items: flex-end;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
  white-space: nowrap;
}
.sat-metric-token { color: var(--dsw-alias-label-secondary, #64748b); }
.sat-metric-duration { color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sat-tree {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  padding: 4px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(15, 23, 42, 0.15));
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(15, 23, 42, 0.25));
}
.sat-empty { flex: 1; padding: 24px 12px; text-align: center; color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sat-row {
  position: relative; flex: none;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
  /* 11px left pad + 14px disclosure box puts the chevron center at x=18px,
     the column the tree guide lines run through. */
  padding: 7px 8px 7px 11px;
}
.sat-row-current {
  /* Inset accent instead of a thicker border: keeps the content box (and the
     chevron guide column) aligned with every other row. */
  box-shadow: inset 3px 0 0 var(--dsw-alias-brand-primary, #2563eb);
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sat-row-main { display: flex; align-items: center; gap: 6px; }
.sat-label {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 600; font-size: 12px; line-height: 18px;
}
.sat-provider-chip {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-size: 11px; line-height: 16px; white-space: nowrap;
}
.sat-mode-chip {
  flex: none; font-size: 10px; line-height: 16px; padding: 0 6px;
  border-radius: 999px; border: 1px solid; white-space: nowrap;
}
.sat-mode-chip-brand {
  color: var(--dsw-alias-brand-primary, #2563eb);
  border-color: var(--dsw-alias-brand-primary, #2563eb);
}
.sat-mode-chip-neutral {
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  border-color: var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.12));
}
.sat-duration {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
  white-space: nowrap;
}
.sat-row-actions { flex: none; display: inline-flex; gap: 2px; }
.sat-row-btn {
  flex: none; width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.12));
  background: transparent; color: var(--dsw-alias-label-tertiary, #94a3b8);
  border-radius: 6px; font-size: 12px; line-height: 1; cursor: pointer;
  font-family: inherit;
}
.sat-row-btn:hover {
  border-color: var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.3));
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sat-purpose {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-size: 11px; line-height: 16px;
  margin-top: 2px; padding-left: 22px;
}
/* ---- context bar (conversation Subagents view) ----
   One segment per type of context occupying the row's context window plus the
   free remainder, all drawn on one scale. The tints mirror the platform's
   composer ContextMeter so the app speaks a single color language; every one
   carries a fallback, as the rest of this sheet does. */
.sat-context {
  margin-top: 4px; padding-left: 22px;
  font-size: 11px; line-height: 16px;
}
.sat-context-bar {
  display: flex; gap: 1px; height: 6px; overflow: hidden;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sat-context-seg { flex: 0 0 auto; min-width: 2px; height: 100%; border-radius: 1px; }
/* The three usage types are BRIGHT and hue-separated (amber ~38deg, green
   ~142deg, blue ~215deg) so each reads as its own kind of context at a glance.
   System is deliberately NOT a neutral any more: as a bluish-gray it read as a
   second gray beside the free remainder, which is the confusing part. */
.sat-context-system { background: var(--dsw-static-amber-500, #f59e0b); }
.sat-context-tools { background: var(--dsw-static-green-400, #4ed17e); }
.sat-context-messages { background: var(--dsw-static-blue-450, #4d93f8); }
/* Free is the window's remainder, so IT is the neutral gray the three usage
   types are distinguished against — and an OPAQUE one: the hairline alias this
   first used (border-l3) is ~12% alpha, which rendered the remainder as
   barely-visible background rather than as a gray segment. */
.sat-context-free { background: var(--dsw-static-neutral-400, #a2a4a6); }
.sat-context-legend {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px;
  margin-top: 3px;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums;
}
.sat-context-legend-item { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.sat-context-swatch { width: 8px; height: 8px; flex: none; border-radius: 2px; }
.sat-popover {
  position: absolute; right: 8px; top: 100%; z-index: 20;
  margin-top: 4px; min-width: 240px; max-width: 320px;
  background: var(--dsw-alias-bg-base, #ffffff);
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.08));
  border-radius: 8px;
  box-shadow: var(--dsw-shadow-lv2, 0 8px 24px rgba(15, 23, 42, 0.12));
  padding: 6px 8px;
}
.sat-pop-div {
  margin: 4px 0;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06));
}
.sat-pop-row { display: flex; gap: 8px; }
.sat-pop-key {
  flex: none; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px; line-height: 18px;
  color: var(--dsw-alias-label-primary, inherit);
}
.sat-pop-value {
  flex: 1; min-width: 0; word-break: break-all;
  font-size: 11px; line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
}
/* Status dots: pixel-chase running + terminal-core states (sat prefix). */
.sat-dot { width: 10px; height: 10px; flex: none; }
.sat-dot-running { color: var(--dsw-static-deepseek-450, rgb(86, 134, 254)); }
.sat-dot-cell { fill: currentColor; opacity: 0.15; animation: sat-dot-chase 1s infinite; }
@keyframes sat-dot-chase {
  0%, 12.4% { opacity: 1; }
  12.5%, 24.9% { opacity: 0.6; }
  25%, 37.4% { opacity: 0.35; }
  37.5%, 100% { opacity: 0.15; }
}
.sat-dot-ok, .sat-dot-error, .sat-dot-warn, .sat-dot-off {
  position: relative; display: inline-block;
}
.sat-dot-ok::before, .sat-dot-error::before, .sat-dot-warn::before, .sat-dot-off::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: currentColor; opacity: 0.1;
}
.sat-dot-ok::after, .sat-dot-error::after, .sat-dot-warn::after, .sat-dot-off::after {
  content: ''; position: absolute; inset: 20%; border-radius: 50%;
  background: currentColor;
}
.sat-dot-ok { color: var(--dsw-alias-state-success-primary, rgb(34, 197, 94)); }
.sat-dot-error { color: var(--dsw-alias-state-error-primary, rgb(236, 19, 19)); }
.sat-dot-warn { color: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11)); }
.sat-dot-off { color: var(--dsw-alias-label-tertiary, #cbd5e1); }
`
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'subagent-view: styles')

  // The docked left-sidebar status bar: counts only, no injected business face
  // (the rail button that needed `ctx.layout.toggleSidebar()` is gone) and no
  // click affordance — the monitor itself is the right-sidebar tab below.
  ctx.slots.inject(
    'sidebar.footer.action',
    () => ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'subagent-view',
        order: 100,
      },
      SubagentViewBar,
    ),
  )

  // The client sessions service is typed as the host-side `SessionStore` here;
  // cast to the narrow face the tab consumes: the breadcrumb's `open` plus the
  // row action's `openSubagent`.
  const sessions = ctx.sessions as unknown as MonitorSessionsService
  ctx.slots.inject(
    'conversation.view',
    () => ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'subagent-view',
        order: 30,
        label: 'Subagents',
        inject: (_sessionId: SessionId) => ({
          open: (id: SessionId) => sessions.open(id),
          openSubagent: (address: SubagentAddress) => sessions.openSubagent(address),
        }),
      },
      SubagentsView,
    ),
  )

  // Right-sidebar tab type: registered only while the rightbar's registry
  // service is actually composed (R11.1/R11.6 of docs/RIGHTBAR-INTEGRATION-SPEC.md).
  // `ctx.inject` is cordis's inject-scoped plugin form: the callback is unloaded
  // and re-run whenever a required service changes, and on a deployment without
  // `@deepseek-ai/dsh-client-ui-sidebar-right` it simply never runs — the left
  // status bar and the conversation Subagents view above stay unconditional, and
  // no fiber is left pending (a pending entry is a fatal boot error in the
  // 0.1.5-rc.2 shell: `assertEntriesActive` reports
  // "web boot: N entries did not activate … (waiting for services: …)").
  // The service must NOT go into the exported `inject` array: a service whose
  // provider never arrives would leave this plugin's fiber pending forever.
  ctx.inject(['sidebarRightTabs'], (scoped) => {
    // Stage one: what the type IS. Purely static (addresses it recognizes, chip
    // text, guide entries); no runtime hook lives here. A page type, so it names
    // a kind and offers a guide capsule — the platform's own, throw-free way for
    // a user to open it from the pane strip's add control. The plugin never
    // calls `ctx.sidebarRight.*`: every controller command throws while no
    // rightbar seat is mounted.
    scoped.effect(
      () => scoped.sidebarRightTabs.register(subagentTabDefinition()),
      'subagent-view: rightbar tab type',
    )

    // Stage two: its body, into the keyed seat under the definition's `id` (not
    // the kind). The seat owns scope/store/hooks; the body receives `sessionId`
    // and `useSessions` as standard props.
    scoped.effect(
      () => scoped.slots.inject('sidebar.right.pane.tab', () => scoped.slots.register(
        {
          name: 'sidebar.right.pane.tab',
          key: SUBAGENT_VIEW_ID,
        },
        SubagentRightbarTab,
      )),
      'subagent-view: rightbar tab body',
    )
  })
}

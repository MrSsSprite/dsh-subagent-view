/**
 * subagent-view, browser half entry: the plugin body only (no JSX — tsdown
 * pins the client bundle entry to src/client/index.ts). The docked bar and
 * panel live in ./panel.tsx, registered into the `sidebar.footer.action`
 * seat at the bottom of the left sidebar.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { SubagentViewBarPanel, setSessionsService, type MonitorSessionsService } from './panel'

export const inject = ['slots', 'sessions', 'layout']

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
.sav-bar {
  flex: none; width: 100%;
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border: none; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit; font-size: 12px; line-height: 18px;
  cursor: pointer; text-align: left;
}
.sav-bar:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.05)); }
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
.sav-bar-chevron {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-size: 10px; transition: transform var(--ds-transition-duration-slow, 160ms) var(--ds-ease-in-out, ease-in-out);
}
.sav-bar-chevron-open { transform: rotate(180deg); }
.sav-rail-btn {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: none; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  cursor: pointer;
}
.sav-rail-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.05)); }
.sav-rail-icon { fill: currentColor; opacity: 0.8; }
.sav-rail-badge {
  position: absolute; top: -2px; right: -4px;
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  background: var(--dsw-alias-brand-primary, #2563eb); color: #ffffff;
  font-size: 10px; line-height: 16px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.sav-panel {
  flex: none; width: 100%; min-width: 0;
  display: flex; flex-direction: column;
  height: min(60vh, 480px); min-height: 240px;
  margin-bottom: 4px;
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base, #ffffff));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  box-shadow: var(--dsw-shadow-lv1, 0 2px 4px rgba(15, 23, 42, 0.04));
  overflow: hidden;
}
.sav-panel-header {
  flex: none; display: flex; align-items: center; gap: 6px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06));
  user-select: none;
  cursor: pointer;
}
.sav-panel-header:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04)); }
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
  flex: none;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
  padding: 6px 8px;
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
  margin-top: 2px; padding-left: 18px;
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
`
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'subagent-view: styles')

  ctx.slots.inject(
    'sidebar.footer.action',
    () => ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'subagent-view',
        order: 100,
        inject: () => ({ toggleSidebar: () => ctx.layout.toggleSidebar() }),
      },
      SubagentViewBarPanel,
    ),
  )
}

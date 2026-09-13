/**
 * subagent-view, browser half: the LEFT-sidebar docked status bar — one line,
 * display only. It is the single entry in `sidebar.footer.action`: the compact
 * "Subagents  n ● · m ● · k ●" counts row that stays mounted whenever the
 * sidebar column exists, so the shared poller keeps the rows fresh.
 *
 * The monitor itself — store, poller, panel card, row rendering, status dots,
 * stats line — lives in `monitor.tsx`. After the left panel was retired, that
 * card has exactly one host, the right-sidebar Subagents tab (`rightbar.tsx`);
 * this file renders no card at all.
 *
 * The bar has NO affordance because it has nothing to open: the full monitor is
 * the right-sidebar tab, reached through the platform's own guide capsule (see
 * README, "Opening the Subagents tab from the right sidebar"). A plugin-initiated
 * open from here was explicitly rejected in
 * docs/RIGHTBAR-INTEGRATION-SPEC.md §1 — `ctx.sidebarRight.openTab` is a no-op or
 * throws while no rightbar seat is mounted — so the bar reports, and never acts.
 */
import { type ReactElement } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Session-scope standard kit for slot components: adds `useSessions` to the
// global seat this entry reads its current session from (type-only).
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Declares the `sidebar.footer.action` seat and its `{wide}` owner props
// (type-only). `wide` is deliberately unread: the rail renders the same bar,
// whose stats line ellipsizes inside the narrow column.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import {
  MonitorStats, useMonitor, useMonitorPolling, useMonitorSession, visibleMonitorRows,
} from './monitor'

export type { MonitorSessionsService } from './monitor'
export { setSessionsService } from './monitor'

export function SubagentViewBar(props: PropsRuntime<'sidebar.footer.action'>): ReactElement {
  // Only the session kit is consumed; the owner share (`wide`) no longer
  // changes what this entry renders.
  const { useSessions } = props
  const monitor = useMonitor()
  const current = useSessions((select: SessionListState) => select.current)

  // Track the current session and poll while this host is mounted. The store
  // and the poller are shared with the rightbar tab body, so the bar and the
  // tab always show identical rows for the same session, and only one interval
  // runs while both are mounted.
  useMonitorSession(current as string | undefined)
  useMonitorPolling()

  // The bar's stats read the same shared store and the same subtree-aware
  // pruning as the tab's card, so the two can never disagree.
  const visible = visibleMonitorRows(monitor.rows, monitor.hidden)

  return (
    <div className="sav-root">
      <div className="sav-bar">
        <span className="sav-bar-label">Subagents</span>
        <span className="sav-bar-stats"><MonitorStats rows={visible} /></span>
      </div>
    </div>
  )
}

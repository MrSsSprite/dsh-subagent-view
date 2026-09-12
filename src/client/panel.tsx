/**
 * subagent-view, browser half: the LEFT-sidebar docked bar and expandable
 * panel. One entry in `sidebar.footer.action` renders a column block — the
 * compact bottom bar ("n running · m done · k failed") and, when open, the
 * monitor panel above it, both inside the sidebar column.
 *
 * The monitor itself — store, poller, panel card, row rendering, status dots,
 * stats line — lives in `monitor.tsx` and is shared with the right-sidebar tab
 * body (`rightbar.tsx`). This file owns only the left host's chrome: the docked
 * panel's open flag, the collapsed-rail button, the mobile auto-open and the
 * click-to-collapse header. The bar stays mounted whenever the sidebar shell
 * exists, so the shared poller keeps history fresh even with the panel closed.
 */
import { useEffect, type ReactElement } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Session-scope standard kit for slot components: adds `useSessions` to the
// global seat this entry reads its current session from (type-only).
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import {
  claimAutoOpen, commit, MonitorStats, SubagentMonitorPanel, useMonitor, useMonitorPolling,
  useMonitorSession, visibleMonitorRows,
} from './monitor'

export type { MonitorSessionsService } from './monitor'
export { setSessionsService } from './monitor'

const MOBILE_QUERY = '(max-width: 768px)'

// ---- the docked bar + panel ----

type BarPanelProps = PropsRuntime<'sidebar.footer.action'> & {
  toggleSidebar(): void
}

export function SubagentViewBarPanel(props: BarPanelProps): ReactElement {
  const { wide, toggleSidebar, useSessions } = props
  const monitor = useMonitor()
  const current = useSessions((select: SessionListState) => select.current)

  // Track the current session and poll while this host is mounted. The store
  // and the poller are shared with the rightbar tab body, so both hosts always
  // show identical rows for the same session and only one interval runs.
  useMonitorSession(current as string | undefined)
  useMonitorPolling()

  // First mount: mobile viewports default to collapsed; the bar stays for
  // explicit open. Desktop defaults to the expanded panel.
  useEffect(() => {
    if (!claimAutoOpen()) return
    if (!window.matchMedia(MOBILE_QUERY).matches) commit({ open: true })
  }, [])

  // The rail has no room for the panel: force it closed while collapsed.
  useEffect(() => {
    if (!wide) commit({ open: false })
  }, [wide])

  // The bar's stats read the same shared store and the same subtree-aware
  // pruning as the open panel, so the two can never disagree.
  const barVisible = visibleMonitorRows(monitor.rows, monitor.hidden)

  // Rail mode: a compact icon button with a running-count badge. Clicking it
  // expands the sidebar column first, then opens the panel.
  if (!wide) {
    const railRunning = barVisible.filter(row => row.status === 'running').length
    return (
      <button
        className="sav-rail-btn"
        type="button"
        title="Subagent runs"
        onClick={() => { toggleSidebar(); commit({ open: true }) }}
      >
        <svg className="sav-rail-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 2h4v4H3zM9 2h4v4H9zM3 10h4v4H3zM9 10h4v4H9z" />
        </svg>
        {railRunning > 0 ? <span className="sav-rail-badge">{railRunning}</span> : null}
      </button>
    )
  }

  return (
    <div className="sav-root">
      {monitor.open
        ? (
          <SubagentMonitorPanel
            variant="left"
            useSessions={useSessions}
            onCollapse={() => commit({ open: false })}
          />
          )
        : null}
      <button
        className="sav-bar"
        type="button"
        title="Subagent runs"
        onClick={() => commit({ open: !monitor.open })}
      >
        <span className="sav-bar-label">Subagents</span>
        <span className="sav-bar-stats"><MonitorStats rows={barVisible} /></span>
        <span className={`sav-bar-chevron${monitor.open ? ' sav-bar-chevron-open' : ''}`} aria-hidden="true">▾</span>
      </button>
    </div>
  )
}

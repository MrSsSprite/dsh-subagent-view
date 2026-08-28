/**
 * subagent-view, browser half: the sidebar-docked bar and expandable panel.
 * One entry in `sidebar.footer.action` renders a column block — the compact
 * bottom bar ("n running · m done · k failed") and, when open, the full panel
 * above it, both inside the sidebar column. The panel polls the host half's
 * snapshot route once per second while mounted, so a page refresh recovers
 * everything without any model interaction.
 */
import {
  useEffect, useSyncExternalStore,
  type ReactElement,
} from 'react'
import type { SessionId, SubagentAddress } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

// ---- wire shape shared with the node half ----

interface MonitorRow {
  id: string
  label?: string
  mode?: string
  depth?: number
  parentId?: string
  runId?: string
  provider?: string
  local?: boolean
  startedAt?: number
  endedAt?: number
  status: string
  sortKey?: number
}

interface SnapshotPayload {
  sessionId?: string
  now?: number
  rows?: MonitorRow[]
}

// ---- page-local store (one instance per page) ----

interface MonitorState {
  sessionId: string | undefined
  now: number
  rows: MonitorRow[]
  open: boolean
  hidden: string[]
}

const listeners = new Set<() => void>()
let state: MonitorState = { sessionId: undefined, now: Date.now(), rows: [], open: false, hidden: [] }
let autoOpened = false
let polling = false

const commit = (patch: Partial<MonitorState>): void => {
  state = { ...state, ...patch }
  for (const listener of [...listeners]) listener()
}
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getSnapshot = (): MonitorState => state

const useMonitor = (): MonitorState => useSyncExternalStore(subscribe, getSnapshot)

async function refresh(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`/api/subagent-view/snapshot?sessionId=${encodeURIComponent(sessionId)}`)
    const data = await res.json() as SnapshotPayload
    if (data.sessionId !== state.sessionId) return
    commit({ rows: data.rows ?? [], now: data.now ?? Date.now() })
  } catch {
    // Transient network failure: the next tick retries.
  }
}

export interface MonitorSessionsService {
  open(id: SessionId): void
  openSubagent(address: SubagentAddress): void
}

let sessionsSvc: MonitorSessionsService | undefined

export function setSessionsService(service: MonitorSessionsService | undefined): void {
  sessionsSvc = service
}

// ---- helpers ----

interface StatusMeta {
  cls: string
  label: string
}

const UNKNOWN: StatusMeta = { cls: 'sav-dot-off', label: 'Ended' }

const STATUS: Record<string, StatusMeta> = {
  running: { cls: 'sav-dot-running', label: 'Running' },
  completed: { cls: 'sav-dot-ok', label: 'Done' },
  error: { cls: 'sav-dot-error', label: 'Failed' },
  aborted: { cls: 'sav-dot-warn', label: 'Interrupted' },
  'max-tokens': { cls: 'sav-dot-warn', label: 'Token limit' },
  refusal: { cls: 'sav-dot-warn', label: 'Refused' },
}

// ---- status marker: DSH-native StateDot spec ----
// ongoing = pixel-art chase around the 3x3 outer ring; terminal states =
// solid core + 10% same-color halo.

/** Outer 3x3 matrix cells (2px pixels on a 10px grid), clockwise from top-left. */
const CHASE_CELLS: readonly (readonly [number, number])[] = [
  [0, 0], [4, 0], [8, 0], [8, 4], [8, 8], [4, 8], [0, 8], [0, 4],
]

function StatusDot({ status }: { status: string }): ReactElement {
  if (status === 'running') {
    return (
      <svg
        className="sav-dot sav-dot-running"
        width={10}
        height={10}
        viewBox="0 0 10 10"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {CHASE_CELLS.map(([x, y], index) => (
          <rect
            key={`${x}-${y}`}
            className="sav-dot-cell"
            x={x}
            y={y}
            width="2"
            height="2"
            /* Negative delay phases the chase so every cell animates from mount. */
            style={{ animationDelay: `${(index - CHASE_CELLS.length) * 125}ms` }}
          />
        ))}
      </svg>
    )
  }
  const meta = STATUS[status] ?? UNKNOWN
  return <span className={`sav-dot ${meta.cls}`} aria-hidden="true" />
}

/** One "n ●" count segment in the stats line; non-first segments lead with a separator. */
function CountSegment({ count, status, first }: {
  count: number
  status: 'running' | 'completed' | 'error'
  first: boolean
}): ReactElement {
  return (
    <span className="sav-count-seg">
      {first ? null : <span className="sav-count-sep" aria-hidden="true">·</span>}
      <span className="sav-count-num">{count}</span>
      <StatusDot status={status} />
    </span>
  )
}

function fmtDuration(start: number | undefined, end: number | undefined): string {
  if (start === undefined) return '—'
  const ms = (end ?? Date.now()) - start
  if (ms < 0) return '00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

const shortId = (id: string | undefined): string =>
  id === undefined || id.length <= 8 ? id ?? '—' : id.slice(0, 8)

function rowLabel(row: MonitorRow): string {
  if (typeof row.label === 'string' && row.label !== '') return row.label
  if (typeof row.provider === 'string' && row.provider !== '') return `[${row.provider}] subagent`
  return `subagent ${shortId(row.id)}`
}

const MOBILE_QUERY = '(max-width: 768px)'

// ---- the docked bar + panel ----

type BarPanelProps = PropsRuntime<'sidebar.footer.action'> & {
  toggleSidebar(): void
}

export function SubagentViewBarPanel(props: BarPanelProps): ReactElement {
  const { wide, toggleSidebar } = props
  const monitor = useMonitor()
  const current = props.useSessions(select => select.current)
  const subagentParent = props.useSessions(select => (
    select.currentAddress === undefined ? undefined : select.currentAddress.parentSessionId
  ))

  // Track the current session; the first poll of a new session pulls the
  // durable catalog + event history, which is what makes refresh recovery work.
  useEffect(() => {
    if (current === undefined) {
      if (state.sessionId !== undefined) commit({ sessionId: undefined, rows: [] })
      return
    }
    if (current !== state.sessionId) {
      commit({ sessionId: current })
      void refresh(current)
    }
  }, [current])

  // 1s polling while mounted; the bar is mounted whenever the sidebar shell
  // exists, so history is always fresh even with the panel closed.
  useEffect(() => {
    if (polling) return
    polling = true
    const timer = window.setInterval(() => {
      const sid = state.sessionId
      if (sid !== undefined) void refresh(sid)
    }, 1000)
    return () => {
      window.clearInterval(timer)
      polling = false
    }
  }, [])

  // First mount: mobile viewports default to collapsed; the bar stays for
  // explicit open. Desktop defaults to the expanded panel.
  useEffect(() => {
    if (autoOpened) return
    autoOpened = true
    if (!window.matchMedia(MOBILE_QUERY).matches) commit({ open: true })
  }, [])

  // The rail has no room for the panel: force it closed while collapsed.
  useEffect(() => {
    if (!wide) commit({ open: false })
  }, [wide])

  const ordered = [...monitor.rows].sort((a, b) => {
    const ka = a.startedAt ?? a.sortKey ?? Number.NEGATIVE_INFINITY
    const kb = b.startedAt ?? b.sortKey ?? Number.NEGATIVE_INFINITY
    return kb - ka
  })
  const visible = ordered.filter(row => !monitor.hidden.includes(row.id))
  const running = visible.filter(row => row.status === 'running').length
  const done = visible.filter(row => row.status === 'completed').length
  const failed = visible.filter(row =>
    row.status === 'error' || row.status === 'aborted' || row.status === 'max-tokens' || row.status === 'refusal',
  ).length

  const openChild = (row: MonitorRow): void => {
    if (sessionsSvc === undefined || monitor.sessionId === undefined || row.mode === undefined) return
    const address: SubagentAddress = {
      parentSessionId: monitor.sessionId as SessionId,
      childSessionId: row.id as SessionId,
      mode: row.mode as 'one-shot' | 'continuable',
    }
    sessionsSvc.openSubagent(address)
  }

  // Rail mode: a compact icon button with a running-count badge. Clicking it
  // expands the sidebar column first, then opens the panel.
  if (!wide) {
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
        {running > 0 ? <span className="sav-rail-badge">{running}</span> : null}
      </button>
    )
  }

  // Count segments only shown when non-zero; "None" when every type is 0.
  // Dots follow the status legend: running = animated blue, done = green,
  // failed = red.
  const segments = [
    { status: 'running' as const, count: running },
    { status: 'completed' as const, count: done },
    { status: 'error' as const, count: failed },
  ].filter(segment => segment.count > 0)
  const statsEl = segments.length === 0
    ? <span className="sav-stats sav-stats-none">None</span>
    : (
      <span className="sav-stats">
        {segments.map((segment, index) => (
          <CountSegment
            key={segment.status}
            count={segment.count}
            status={segment.status}
            first={index === 0}
          />
        ))}
      </span>
      )

  return (
    <div className="sav-root">
      {monitor.open
        ? (
          <div className="sav-panel">
            <div
              className="sav-panel-header"
              title="Collapse panel"
              onClick={() => commit({ open: false })}
            >
              <span className="sav-panel-title">Subagents</span>
              {subagentParent !== undefined && sessionsSvc !== undefined
                ? (
                  <button
                    className="sav-btn sav-back"
                    type="button"
                    title="Back to main session"
                    onClick={(event) => {
                      event.stopPropagation()
                      sessionsSvc?.open(subagentParent as SessionId)
                    }}
                  >
                    ← Main session
                  </button>
                  )
                : null}
              <span className="sav-panel-spacer" />
              {running > 0 ? <span className="sav-panel-running">{running} running</span> : null}
            </div>
            {visible.length === 0
              ? (
                <div className="sav-empty">
                  {monitor.sessionId === undefined ? 'No session selected' : 'No subagent activity in this session'}
                </div>
                )
              : (
                <div className="sav-rows">
                  {visible.map(row => {
                    const meta = STATUS[row.status] ?? UNKNOWN
                    const elapsed = row.status === 'running'
                      ? fmtDuration(row.startedAt, state.now)
                      : fmtDuration(row.startedAt, row.endedAt)
                    const depth = typeof row.depth === 'number' ? row.depth : 1
                    const indent = Math.max(0, depth - 1) * 14
                    const modeText = row.mode === 'continuable' ? 'continuable' : row.mode === 'one-shot' ? 'one-shot' : ''
                    const metaLine = [row.provider, modeText, shortId(row.id)]
                      .filter(value => typeof value === 'string' && value !== '')
                      .join(' · ')
                    return (
                      <div key={row.id} className="sav-row" style={{ marginLeft: indent }}>
                        <div className="sav-row-main">
                          <StatusDot status={row.status} />
                          <span className="sav-row-label" title={rowLabel(row)}>{rowLabel(row)}</span>
                          {row.mode !== undefined && sessionsSvc !== undefined
                            ? (
                              <button className="sav-btn sav-row-open" type="button" onClick={() => openChild(row)}>
                                Open
                              </button>
                              )
                            : null}
                        </div>
                        <div className="sav-row-foot">
                          <span className="sav-row-meta">{metaLine !== '' ? metaLine : '\u00A0'}</span>
                          <span className="sav-row-time">
                            {row.status === 'running' ? `${elapsed} · ${meta.label}` : `${meta.label} · ${elapsed}`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                )}
            <div className="sav-panel-footer">
              <span className="sav-panel-stats">{statsEl}</span>
              <span className="sav-panel-spacer" />
              {monitor.hidden.length > 0
                ? (
                  <button className="sav-btn" type="button" onClick={() => commit({ hidden: [] })}>
                    {`Show hidden (${monitor.hidden.length})`}
                  </button>
                  )
                : null}
              <button
                className="sav-btn"
                type="button"
                onClick={() => {
                  const hidden = [...state.hidden]
                  for (const row of state.rows) {
                    if (row.status !== 'running' && !hidden.includes(row.id)) hidden.push(row.id)
                  }
                  commit({ hidden })
                }}
              >
                Clear finished
              </button>
            </div>
          </div>
          )
        : null}
      <button className="sav-bar" type="button" title="Subagent runs" onClick={() => commit({ open: !state.open })}>
        <span className="sav-bar-label">Subagents</span>
        <span className="sav-bar-stats">{statsEl}</span>
        <span className={`sav-bar-chevron${monitor.open ? ' sav-bar-chevron-open' : ''}`} aria-hidden="true">▾</span>
      </button>
    </div>
  )
}

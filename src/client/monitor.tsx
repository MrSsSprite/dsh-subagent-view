/**
 * subagent-view, browser half: the shared subagent monitor.
 *
 * One module-local store, one poller and one panel component serve BOTH hosts
 * of the monitor — the left-sidebar docked bar/panel (`panel.tsx`, slot
 * `sidebar.footer.action`) and the right-sidebar tab body (`rightbar.tsx`,
 * keyed slot `sidebar.right.pane.tab`). Nothing here is host-specific: the
 * hosts differ only in the chrome around the panel (bar + rail + open flag on
 * the left; the platform's tab strip on the right) and in the two layout
 * deviations the rightbar contract requires (fill the pane, no
 * click-to-collapse header).
 *
 * The panel polls the host half's snapshot route once per second while at least
 * one host is mounted, so a page refresh recovers everything without any model
 * interaction. The poller is reference-counted: two mounted hosts produce one
 * interval, and the interval survives the unmount of either host while the
 * other is still mounted.
 */
import {
  useEffect, useMemo, useSyncExternalStore,
  type ReactElement,
} from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
// The session kit's global hook type (`useSessions`) as the slot framework
// hands it to every component seat (type-only).
import type { UseSessions } from '@deepseek-ai/dsh-client-ui-session/client'
import { ArchivedFolder, splitArchived, SubagentTree, type TreeRowContext } from './tree'

// ---- wire shape shared with the node half ----

export interface MonitorRow {
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

export interface SnapshotPayload {
  sessionId?: string
  now?: number
  rows?: MonitorRow[]
  /** Host-side diagnostic when the route degraded; the payload is still valid. */
  error?: string
}

// ---- page-local store (one instance per page) ----

export interface MonitorState {
  sessionId: string | undefined
  now: number
  rows: MonitorRow[]
  open: boolean
  hidden: string[]
  /** Ids of branches whose children are shown; empty = every branch collapsed. */
  expanded: ReadonlySet<string>
  /** Whether the Archived folder body is shown; collapsed by default. */
  archiveOpen: boolean
}

const listeners = new Set<() => void>()
let state: MonitorState = {
  sessionId: undefined,
  now: Date.now(),
  rows: [],
  open: false,
  hidden: [],
  expanded: new Set(),
  archiveOpen: false,
}
let autoOpened = false

export const commit = (patch: Partial<MonitorState>): void => {
  state = { ...state, ...patch }
  for (const listener of [...listeners]) listener()
}
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getSnapshot = (): MonitorState => state

export const useMonitor = (): MonitorState => useSyncExternalStore(subscribe, getSnapshot)

/** Whether the left host's panel has already auto-opened once (page lifetime). */
export const claimAutoOpen = (): boolean => {
  if (autoOpened) return false
  autoOpened = true
  return true
}

export async function refresh(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`/api/subagent-view/snapshot?sessionId=${encodeURIComponent(sessionId)}`)
    const data = await res.json() as SnapshotPayload
    if (data.sessionId !== state.sessionId) return
    if (data.error !== undefined) console.warn('subagent-view: snapshot degraded:', data.error)
    commit({ rows: data.rows ?? [], now: data.now ?? Date.now() })
  } catch (error) {
    // The host half answers 200 with a well-formed payload for every input
    // (including its own failures), so a throw here is a transport problem and
    // the next tick retries. Log it rather than swallowing it silently: an
    // invisible failure is exactly what turned a host-side crash into "the
    // panel just loses rows" on the DSH 0.1.2-rc.1 upgrade.
    console.warn('subagent-view: snapshot poll failed', error)
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

// ---- shared lifecycle ----

/**
 * Track one session in the shared store. The first poll of a new session pulls
 * the durable catalog + event history, which is what makes refresh recovery
 * work. `undefined` clears the store (no session selected).
 */
export function useMonitorSession(sessionId: string | undefined): void {
  useEffect(() => {
    if (sessionId === undefined) {
      if (state.sessionId !== undefined) commit({ sessionId: undefined, rows: [] })
      return
    }
    if (sessionId !== state.sessionId) {
      commit({ sessionId })
      void refresh(sessionId)
    }
  }, [sessionId])
}

/**
 * One reference-counted 1-second poller for every mounted host. The count, not
 * a mount-order-dependent boolean, decides the interval's life: the second host
 * to mount joins the running interval, and only the last unmount clears it.
 */
let pollConsumers = 0
let pollTimer: number | undefined

export function useMonitorPolling(): void {
  useEffect(() => {
    pollConsumers += 1
    if (pollTimer === undefined) {
      pollTimer = window.setInterval(() => {
        const sid = state.sessionId
        if (sid !== undefined) void refresh(sid)
      }, 1000)
    }
    return () => {
      pollConsumers -= 1
      if (pollConsumers > 0) return
      pollConsumers = 0
      if (pollTimer === undefined) return
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }
  }, [])
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

export function StatusDot({ status }: { status: string }): ReactElement {
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

/**
 * The rows a host may show: `hidden` names whole pruned subtrees, and any row
 * with a hidden ancestor stays hidden too, so the tree never orphans a visible
 * child of a hidden parent. Both hosts filter through here, so the bar's counts
 * and the open panel always agree.
 */
export function visibleMonitorRows(rows: readonly MonitorRow[], hidden: readonly string[]): MonitorRow[] {
  const hiddenSet = new Set(hidden)
  const effectiveHidden = new Set<string>()
  const visible: MonitorRow[] = []
  for (const row of rows) {
    const isHidden = hiddenSet.has(row.id)
      || (row.parentId !== undefined && effectiveHidden.has(row.parentId))
    if (isHidden) effectiveHidden.add(row.id)
    else visible.push(row)
  }
  return visible
}

/** The three counts the stats line and the header read, over visible rows only. */
export function monitorCounts(rows: readonly MonitorRow[]): { running: number; done: number; failed: number } {
  return {
    running: rows.filter(row => row.status === 'running').length,
    done: rows.filter(row => row.status === 'completed').length,
    failed: rows.filter(row =>
      row.status === 'error'
      || row.status === 'aborted'
      || row.status === 'max-tokens'
      || row.status === 'refusal',
    ).length,
  }
}

/**
 * The counts line: non-zero segments only, `·` separator, "None" when every
 * type is 0. Dots follow the status legend: running = animated blue,
 * done = green, failed = red.
 */
export function MonitorStats({ rows }: { rows: readonly MonitorRow[] }): ReactElement {
  const { running, done, failed } = monitorCounts(rows)
  const segments = [
    { status: 'running' as const, count: running },
    { status: 'completed' as const, count: done },
    { status: 'error' as const, count: failed },
  ].filter(segment => segment.count > 0)
  if (segments.length === 0) return <span className="sav-stats sav-stats-none">None</span>
  return (
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
}

export function fmtDuration(start: number | undefined, end: number | undefined): string {
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

export const shortId = (id: string | undefined): string =>
  id === undefined || id.length <= 8 ? id ?? '—' : id.slice(0, 8)

export function rowLabel(row: MonitorRow): string {
  if (typeof row.label === 'string' && row.label !== '') return row.label
  if (typeof row.provider === 'string' && row.provider !== '') return `[${row.provider}] subagent`
  return `subagent ${shortId(row.id)}`
}

// ---- the shared panel card ----

export interface SubagentMonitorPanelProps {
  /** Session kit hook, used for the Back-to-main fact only. */
  useSessions: UseSessions
  /**
   * `left` — the docked card: auto height with the min/max clamp, header
   * click collapses the docked panel.
   * `tab` — the right-sidebar body: fills the pane (deviation D-2 of
   * docs/RIGHTBAR-INTEGRATION-SPEC.md) and the header carries no click
   * affordance (D-3).
   */
  variant: 'left' | 'tab'
  /** Left host only: collapse the docked panel when the header is clicked. */
  onCollapse?: () => void
}

/**
 * The monitor panel: header (title, optional Back, running count), the
 * disclosure forest with its Archived folder (or the empty state), and the
 * footer actions. Both hosts render exactly this component so their content
 * and behaviour cannot drift.
 *
 * The component is presentational on purpose: each HOST owns the shared
 * lifecycle (`useMonitorSession` + `useMonitorPolling`) at its own top level,
 * so the left bar keeps polling while its panel is closed, and each host's
 * mount/unmount contributes one entry to the poller's reference count.
 */
export function SubagentMonitorPanel(props: SubagentMonitorPanelProps): ReactElement {
  const { useSessions, variant, onCollapse } = props
  const monitor = useMonitor()
  const subagentParent = useSessions((select: SessionListState) => (
    select.currentAddress === undefined ? undefined : select.currentAddress.parentSessionId
  ))

  // Rows arrive in tree pre-order (parent before child) from the host, and the
  // hidden-subtree pruning is the shared one the bar's counts also use.
  const visible = visibleMonitorRows(monitor.rows, monitor.hidden)
  const { running } = monitorCounts(visible)

  // Branches are collapsed unless explicitly expanded: every subagent —
  // including ones that appear later — starts collapsed, per the sidebar
  // default.
  const collapsed = useMemo(() => {
    const parents = new Set<string>()
    for (const row of visible) {
      if (row.parentId !== undefined) parents.add(row.parentId)
    }
    const set = new Set<string>()
    for (const id of parents) {
      if (!monitor.expanded.has(id)) set.add(id)
    }
    return set
  }, [visible, monitor.expanded])

  const toggleBranch = (id: string): void => {
    const next = new Set(monitor.expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    commit({ expanded: next })
  }

  const openChild = (row: MonitorRow): void => {
    if (sessionsSvc === undefined || monitor.sessionId === undefined || row.mode === undefined) return
    const address: SubagentAddress = {
      parentSessionId: monitor.sessionId as SessionId,
      childSessionId: row.id as SessionId,
      mode: row.mode as 'one-shot' | 'continuable',
    }
    sessionsSvc.openSubagent(address)
  }

  /**
   * Hide every fully-finished subtree (no running row anywhere below it).
   * Whole branches are hidden — never single rows — so children always stay
   * attached to a visible ancestor.
   */
  const clearFinished = (): void => {
    const byParent = new Map<string, MonitorRow[]>()
    for (const row of state.rows) {
      if (row.parentId === undefined) continue
      const siblings = byParent.get(row.parentId)
      if (siblings === undefined) byParent.set(row.parentId, [row])
      else siblings.push(row)
    }
    const keep = new Set<string>()
    for (let index = state.rows.length - 1; index >= 0; index--) {
      const row = state.rows[index]
      if (row === undefined) continue
      const kept = row.status === 'running'
        || (byParent.get(row.id) ?? []).some(child => keep.has(child.id))
      if (kept) keep.add(row.id)
    }
    const hidden = new Set(state.hidden)
    for (const row of state.rows) {
      if (!keep.has(row.id)) hidden.add(row.id)
    }
    commit({ hidden: [...hidden] })
  }

  // Completed one-shot subagents move into the Archived folder; the rest of
  // the visible forest stays in the main list.
  const { main, archived, count } = splitArchived(visible)

  const renderMonitorRow = (row: MonitorRow, ctx: TreeRowContext): ReactElement => {
    const meta = STATUS[row.status] ?? UNKNOWN
    const elapsed = row.status === 'running'
      ? fmtDuration(row.startedAt, state.now)
      : fmtDuration(row.startedAt, row.endedAt)
    const modeText = row.mode === 'continuable' ? 'continuable' : row.mode === 'one-shot' ? 'one-shot' : ''
    const metaLine = [row.provider, modeText, shortId(row.id)]
      .filter(value => typeof value === 'string' && value !== '')
      .join(' · ')
    return (
      <div className={`sav-row${ctx.expanded && ctx.hasChildren ? ' sav-row-branch-open' : ''}`}>
        <div className="sav-row-main">
          {ctx.disclosure}
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
  }

  const collapsible = variant === 'left' && onCollapse !== undefined

  return (
    <div className={`sav-panel${variant === 'tab' ? ' sav-panel-tab' : ''}`}>
      <div
        className={`sav-panel-header${collapsible ? '' : ' sav-panel-header-tab'}`}
        {...(collapsible ? { title: 'Collapse panel', onClick: onCollapse } : {})}
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
            <SubagentTree
              rows={main}
              collapsed={collapsed}
              onToggle={toggleBranch}
              cls="sav"
              renderRow={renderMonitorRow}
            />
            <ArchivedFolder
              rows={archived}
              count={count}
              cls="sav"
              collapsed={collapsed}
              onToggle={toggleBranch}
              renderRow={renderMonitorRow}
              open={monitor.archiveOpen}
              onToggleFolder={() => commit({ archiveOpen: !monitor.archiveOpen })}
            />
          </div>
          )}
      <div className="sav-panel-footer">
        <span className="sav-panel-stats"><MonitorStats rows={visible} /></span>
        <span className="sav-panel-spacer" />
        {monitor.hidden.length > 0
          ? (
            <button className="sav-btn" type="button" onClick={() => commit({ hidden: [] })}>
              {`Show hidden (${monitor.hidden.length})`}
            </button>
            )
          : null}
        <button className="sav-btn" type="button" onClick={clearFinished}>
          Clear finished
        </button>
      </div>
    </div>
  )
}

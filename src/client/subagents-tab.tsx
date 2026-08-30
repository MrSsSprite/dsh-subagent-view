/**
 * subagent-view, browser half: the conversation "Subagents" view tab.
 *
 * One list entry in the `conversation.view` slot renders the root→current
 * breadcrumb, the running/done/failed summary strip, and the host-order
 * subagent tree. The tree follows the DSH-canonical disclosure visual
 * (chevron-right ">" that rotates downward when expanded, gray "L"-shape
 * guide lines), fully expanded by default. The tab polls the host half's
 * `/api/subagent-view/tab` route once per second while mounted, so a page
 * refresh recovers the whole forest without any model interaction. All
 * styling lives in the single `<style data-plugin="subagent-view">` tag in
 * src/client/index.ts.
 */
import {
  Fragment,
  useEffect, useState, useSyncExternalStore,
  type ReactElement,
} from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client' // adds 'conversation.view' to SlotMap
import type { SessionId, SubagentAddress } from '@deepseek-ai/dsh-client-runtime/client'
import { ArchivedFolder, splitArchived, SubagentTree, type TreeRowContext } from './tree'

// ---- wire shape shared with the node half ----

interface AncestorRow {
  id: string
  label: string
  depth: number
  isCurrent: boolean
}

interface TabRow {
  id: string
  label?: string
  mode?: string
  depth: number
  parentId?: string
  runId?: string
  provider?: string
  local?: boolean
  startedAt?: number
  endedAt?: number
  status: string
  sortKey?: number
  isCurrent: boolean
  hasChildren: boolean
  activity?: string
  reason?: string
  purpose?: string
  tokens?: number
  settledMs?: number
  activeSince?: number
  activeThrough?: number
}

interface TabPayload {
  currentId: string
  rootId?: string
  now: number
  ancestors: AncestorRow[]
  rows: TabRow[]
}

// ---- page-local store (one instance per page) ----

interface TabState {
  sessionId: string | undefined
  now: number
  ancestors: AncestorRow[]
  rows: TabRow[]
}

const listeners = new Set<() => void>()
let state: TabState = { sessionId: undefined, now: Date.now(), ancestors: [], rows: [] }
let polling = false

const commit = (patch: Partial<TabState>): void => {
  state = { ...state, ...patch }
  for (const listener of [...listeners]) listener()
}
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getSnapshot = (): TabState => state

const useTab = (): TabState => useSyncExternalStore(subscribe, getSnapshot)

async function refresh(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`/api/subagent-view/tab?sessionId=${encodeURIComponent(sessionId)}`)
    const data = await res.json() as TabPayload
    if (data.currentId !== state.sessionId) return
    commit({ ancestors: data.ancestors ?? [], rows: data.rows ?? [], now: data.now ?? Date.now() })
  } catch {
    // Transient network failure: the next tick retries.
  }
}

// ---- helpers ----

interface StatusMeta {
  cls: string
  label: string
}

const UNKNOWN: StatusMeta = { cls: 'sat-dot-off', label: 'Unknown' }

const STATUS: Record<string, StatusMeta> = {
  running: { cls: 'sat-dot-running', label: 'Running' },
  completed: { cls: 'sat-dot-ok', label: 'Done' },
  error: { cls: 'sat-dot-error', label: 'Failed' },
  aborted: { cls: 'sat-dot-warn', label: 'Interrupted' },
  'max-tokens': { cls: 'sat-dot-warn', label: 'Token limit' },
  refusal: { cls: 'sat-dot-warn', label: 'Refused' },
}

// ---- status marker: DSH-native StateDot spec (copied from panel.tsx) ----
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
        className="sat-dot sat-dot-running"
        width={10}
        height={10}
        viewBox="0 0 10 10"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {CHASE_CELLS.map(([x, y], index) => (
          <rect
            key={`${x}-${y}`}
            className="sat-dot-cell"
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
  return <span className={`sat-dot ${meta.cls}`} aria-hidden="true" />
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

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function activeMsFor(row: TabRow, now: number): number | undefined {
  if (row.settledMs === undefined) return undefined
  if (row.activeSince === undefined) return row.settledMs
  const end = row.status === 'running' ? now : (row.activeThrough ?? now)
  return row.settledMs + Math.max(0, end - row.activeSince)
}

const shortId = (id: string | undefined): string =>
  id === undefined || id.length <= 8 ? id ?? '—' : id.slice(0, 8)

const fmtTime = (ms: number): string => new Date(ms).toLocaleString()

const outcomeLabel = (status: string): string => STATUS[status]?.label ?? 'Unknown'

function rowLabel(row: TabRow): string {
  if (typeof row.label === 'string' && row.label !== '') return row.label
  if (typeof row.provider === 'string' && row.provider !== '') return row.provider
  return `subagent ${shortId(row.id)}`
}

function providerChipText(provider: string): string {
  if (provider === 'fork') return '⑂ fork'
  if (provider === 'spawn') return '✦ spawn'
  return provider
}

function toggleMember(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

// ---- sub-render pieces ----

function SummaryCell({ caption, count, status }: {
  caption: string
  count: number
  status: 'running' | 'completed' | 'error'
}): ReactElement {
  return (
    <span className="sat-sum-cell">
      <span className="sat-sum-num">{count}</span>
      <StatusDot status={status} />
      <span className="sat-sum-caption">{caption}</span>
    </span>
  )
}

function ModeChip({ mode }: { mode: string | undefined }): ReactElement | null {
  if (mode === 'continuable') {
    return <span className="sat-mode-chip sat-mode-chip-brand">↻ continuable</span>
  }
  if (mode === 'one-shot') {
    return <span className="sat-mode-chip sat-mode-chip-neutral">⚡ one-shot</span>
  }
  return null
}

function detailsFields(row: TabRow): [string, string][] {
  const fields: [string, string][] = []
  if (row.startedAt !== undefined) fields.push(['Started', fmtTime(row.startedAt)])
  if (row.endedAt !== undefined) fields.push(['Ended', fmtTime(row.endedAt)])
  fields.push(['Outcome', outcomeLabel(row.status)])
  if (row.parentId !== undefined) fields.push(['Parent', shortId(row.parentId)])
  if (row.activity !== undefined) fields.push(['Activity', row.activity])
  fields.push(['Has children', row.hasChildren ? 'yes' : 'no'])
  if (row.reason !== undefined) fields.push(['Unreadable', row.reason])
  return fields
}

/**
 * Floating details window: the friendly overview fields first, then the raw
 * wire fields, divided by a hairline. Anchored to the row card (absolute,
 * `top: 100%`), like the old raw-fields popover.
 */
function DetailsPopover({ row }: { row: TabRow }): ReactElement {
  const overview = detailsFields(row)
  const raw = rawFields(row)
  return (
    <div className="sat-popover">
      {overview.map(([key, value]) => (
        <div key={key} className="sat-pop-row">
          <span className="sat-pop-key">{key}:</span>
          <span className="sat-pop-value">{value}</span>
        </div>
      ))}
      {raw.length > 0 ? <div className="sat-pop-div" aria-hidden="true" /> : null}
      {raw.map(([key, value]) => (
        <div key={key} className="sat-pop-row">
          <span className="sat-pop-key">{key}:</span>
          <span className="sat-pop-value">{value}</span>
        </div>
      ))}
    </div>
  )
}

function rawFields(row: TabRow): [string, string][] {
  const fields: [string, string][] = [['id', row.id]]
  if (row.runId !== undefined) fields.push(['runId', row.runId])
  if (row.local !== undefined) fields.push(['local', String(row.local)])
  fields.push(['depth', String(row.depth)])
  if (row.sortKey !== undefined) fields.push(['sortKey', String(row.sortKey)])
  if (row.mode !== undefined) fields.push(['mode', row.mode])
  if (row.provider !== undefined) fields.push(['provider', row.provider])
  fields.push(['isCurrent', String(row.isCurrent)])
  if (row.purpose !== undefined) fields.push(['purpose', row.purpose])
  return fields
}

// ---- component ----

type TabProps = PropsRuntime<'conversation.view'> & {
  open(id: SessionId): void
  openSubagent(address: SubagentAddress): void
}

export function SubagentsView(props: TabProps): ReactElement {
  const { sessionId, open } = props
  const tab = useTab()

  // Track the current session; the first poll of a new session pulls the
  // durable catalog + event history, which is what makes refresh recovery work.
  useEffect(() => {
    if (sessionId !== state.sessionId) {
      commit({ sessionId, ancestors: [], rows: [] })
      void refresh(sessionId)
    }
  }, [sessionId])

  // 1s polling while mounted; the tab is mounted only while it is active.
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

  // The row id of the single floating details window, or null when closed.
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null)

  // Archived folder body; collapsed by default. Branches inside it keep the
  // tab's expanded-by-default branch behavior. Resets on mount, like the
  // other page-local state.
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Close the floating window on any pointer-down outside it. The toggle
  // button is exempt (its click handler opens/closes), and so is the window
  // itself, so interacting with either never dismisses it mid-click.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.sat-popover') !== null) return
      if (target.closest('.sat-row-btn') !== null) return
      setDetailsOpen(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // Branch collapse state, keyed by row id. Empty set = every branch expanded,
  // which is the tab's default; a branch toggled shut stays collapsed across
  // the 1s polls (ids are stable for the life of the session).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  const toggleBranch = (id: string): void => {
    setCollapsed(prev => toggleMember(prev, id))
  }

  const { ancestors, rows, now } = tab
  const running = rows.filter(row => row.status === 'running').length
  const done = rows.filter(row => row.status === 'completed').length
  const failed = rows.filter(row =>
    row.status === 'error' || row.status === 'aborted' || row.status === 'max-tokens' || row.status === 'refusal',
  ).length
  const total = rows.length
  const pct = (count: number): number => total === 0 ? 0 : Math.round((count / total) * 100)
  const totalTokens = rows.reduce((sum, row) => sum + (row.tokens ?? 0), 0)
  const totalActiveMs = rows.reduce((sum, row) => {
    const active = activeMsFor(row, now)
    return sum + (active ?? 0)
  }, 0)

  // Completed one-shot subagents move into the Archived folder; the rest of
  // the forest stays in the main list. Summary counts keep covering all rows.
  const { main, archived, count } = splitArchived(rows)

  const renderTabRow = (row: TabRow, ctx: TreeRowContext): ReactElement => {
    const label = rowLabel(row)
    const activeMs = activeMsFor(row, now)
    return (
      <div
        className={`sat-row${row.isCurrent ? ' sat-row-current' : ''}${ctx.expanded && ctx.hasChildren ? ' sat-row-branch-open' : ''}`}
      >
        <div className="sat-row-main">
          {ctx.disclosure}
          <StatusDot status={row.status} />
          <ModeChip mode={row.mode} />
          <span className="sat-label" title={label}>{label}</span>
          {typeof row.provider === 'string' && row.provider !== ''
            ? <span className="sat-provider-chip">{providerChipText(row.provider)}</span>
            : null}
          <span className="sat-metrics">
            {row.tokens !== undefined
              ? <span className="sat-metric-token">{fmtTokens(row.tokens)} tok</span>
              : null}
            {activeMs !== undefined
              ? <span className="sat-metric-duration">{fmtDuration(0, activeMs)}</span>
              : null}
          </span>
          <span className="sat-row-actions">
            <button
              className="sat-row-btn"
              type="button"
              title="Details"
              onClick={() => setDetailsOpen(prev => (prev === row.id ? null : row.id))}
            >
              ⓘ
            </button>
          </span>
        </div>
        {typeof row.purpose === 'string' && row.purpose !== ''
          ? <div className="sat-purpose" title={row.purpose}>{row.purpose}</div>
          : null}
        {detailsOpen === row.id ? <DetailsPopover row={row} /> : null}
      </div>
    )
  }

  return (
    <div className="sat-root">
      {ancestors.length > 0
        ? (
          <nav className="sat-crumbs" aria-label="Subagent lineage">
            {ancestors.map((ancestor, index) => {
              const crumb = ancestor.isCurrent
                ? (
                  <span className="sat-crumb sat-crumb-current" title="You are here">
                    {ancestor.label}
                  </span>
                  )
                : (
                  <button
                    className="sat-crumb sat-crumb-link"
                    type="button"
                    title={ancestor.label}
                    onClick={() => open(ancestor.id as SessionId)}
                  >
                    {ancestor.label}
                  </button>
                  )
              return (
                <Fragment key={ancestor.id}>
                  {index > 0 ? <span className="sat-crumb-sep" aria-hidden="true">/</span> : null}
                  {crumb}
                </Fragment>
              )
            })}
          </nav>
          )
        : null}

      <div className="sat-summary">
        <div className="sat-sum-cells">
          <SummaryCell caption="Running" count={running} status="running" />
          <SummaryCell caption="Done" count={done} status="completed" />
          <SummaryCell caption="Failed" count={failed} status="error" />
        </div>
        <div className="sat-sum-bar">
          <div
            className="sat-proportion"
            role="img"
            aria-label={`${running} running, ${done} done, ${failed} failed`}
          >
            <span className="sat-prop-seg sat-prop-running" style={{ width: `${pct(running)}%` }} />
            <span className="sat-prop-seg sat-prop-done" style={{ width: `${pct(done)}%` }} />
            <span className="sat-prop-seg sat-prop-failed" style={{ width: `${pct(failed)}%` }} />
          </div>
          <span className="sat-sum-total">total {total}</span>
        </div>
        <div className="sat-sum-totals">
          {fmtTokens(totalTokens)} tokens · {fmtDuration(0, totalActiveMs)} active time
        </div>
      </div>

      {rows.length === 0
        ? (
          <div className="sat-empty">No subagent activity in this session</div>
          )
        : (
          <div className="sat-tree">
            <SubagentTree
              rows={main}
              collapsed={collapsed}
              onToggle={toggleBranch}
              cls="sat"
              renderRow={renderTabRow}
            />
            <ArchivedFolder
              rows={archived}
              count={count}
              cls="sat"
              collapsed={collapsed}
              onToggle={toggleBranch}
              renderRow={renderTabRow}
              open={archiveOpen}
              onToggleFolder={() => setArchiveOpen(prev => !prev)}
            />
          </div>
          )}
    </div>
  )
}

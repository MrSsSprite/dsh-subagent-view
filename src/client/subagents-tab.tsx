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
// Type homes under DSH 0.1.2-rc.1, matching src/client/index.ts: the session
// and subagent packages the client controllers re-export them from.
// (`@deepseek-ai/dsh-client-runtime` is not published beyond 0.1.1-rc.2.)
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client'
import { ArchivedFolder, splitArchived, SubagentTree, type TreeRowContext } from './tree'

// ---- wire shape shared with the node half ----

interface AncestorRow {
  id: string
  label: string
  depth: number
  isCurrent: boolean
}

/**
 * Current context-window composition of one row's session, mirrored from the
 * node half's `RowContext` (the two halves cannot share a module — DSH.md §3).
 * Members are omitted rather than set to undefined.
 *
 * This is the CURRENT window, not the cumulative lifetime usage in
 * {@link TabRow.tokens}; the two are different quantities and are rendered
 * side by side on purpose.
 */
interface RowContext {
  /** Context-window capacity in tokens (the occupancy denominator). */
  window?: number
  /** Heuristic tokens of the system prompt. */
  system?: number
  /** Heuristic tokens of the tool definitions. */
  tools?: number
  /** Heuristic tokens of the conversation surface. */
  messages?: number
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
  /** Cumulative lifetime tokens across every turn (not current occupancy). */
  tokens?: number
  /** Current context-window composition; absent when the host could not read it. */
  ctx?: RowContext
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

// ---- status marker: DSH-native StateDot spec (copied from monitor.tsx) ----
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

/**
 * A share of the bar's denominator as text. The value is rounded to a tenth of
 * a percent FIRST, so what is displayed can never disagree with the `0` it
 * would otherwise round to: a non-zero share below the resolution reports as
 * `0.05%` rather than a misleading `0%`, and an exact zero stays `0%`.
 */
function fmtPercent(tokens: number, total: number): string {
  if (total <= 0 || tokens <= 0) return '0%'
  // Rounding to tenths first is what keeps every non-zero share honest: a share
  // that a whole-percent reading would collapse to "0%" (0.08%, or 0.28% for a
  // 2.8k system prompt on a 1M window) still shows its own magnitude, while a
  // share at or above a tenth of a percent reads naturally as a whole percent.
  const tenths = Math.round(tokens / total * 1000) / 10
  // Below 1% the tenth is only a rounding artefact, so show the real
  // hundredth (0.08% for an 800-token prompt on a 1M window) rather than
  // presenting 0.1% as if it were a measured tenth.
  if (tenths >= 1) return `${tenths.toFixed(1).replace(/\.0$/, '')}%`
  if (tenths > 0) return `${(Math.round(tokens / total * 10000) / 100).toFixed(2)}%`
  // Below the resolution (under 0.005%): never print a bare "0%" beside a
  // non-zero count — report that the share is under the resolution instead.
  return '<0.01%'
}

// ---- context bar ----

/** Segment identity and its tint class; the array order is the tie-break order. */
type ContextKey = 'system' | 'tools' | 'messages' | 'free'

const CONTEXT_ROWS: readonly { key: ContextKey; label: string; cls: string }[] = [
  { key: 'system', label: 'System', cls: 'sat-context-system' },
  { key: 'tools', label: 'Tools', cls: 'sat-context-tools' },
  { key: 'messages', label: 'Messages', cls: 'sat-context-messages' },
  { key: 'free', label: 'Free', cls: 'sat-context-free' },
]

interface ContextSegment {
  key: ContextKey
  /** Tint class from {@link CONTEXT_ROWS}, shared by the segment and its swatch. */
  cls: string
  label: string
  tokens: number
  /** Share of the denominator, 0-100. */
  width: number
}

/**
 * The context bar: one segment per type of context occupying the session's
 * context window, plus the free remainder, all drawn on one scale
 * (`contextWindow` when known, otherwise the usage sum).
 *
 * **Ordering rule (load-bearing):** segments are graded by size, biggest
 * first, with ties broken by the fixed class order in {@link CONTEXT_ROWS} so
 * the layout is deterministic. The *free* remainder is then pinned to the last
 * position: the user's `bigger on the left` applies to the context types, and
 * the remaining window is the tail of the rail by definition. Colors are the
 * platform `ContextMeter` tints (see the `.sat-context-*` rules).
 *
 * Renders nothing when there is nothing measurable: every class is zero (a
 * session with no token activity yet, where a full-width "free" rail would
 * claim a measurement that was never taken), or the capacity is unknown AND
 * nothing occupies it. It also renders no *free* segment when the capacity is
 * unknown — an invented remainder would be a lie.
 */
function ContextBar({ ctx }: { ctx: RowContext }): ReactElement | null {
  const system = ctx.system ?? 0
  const tools = ctx.tools ?? 0
  const messages = ctx.messages ?? 0
  const usage = system + tools + messages
  // Nothing is occupying the window, so there is no composition to show.
  if (usage <= 0) return null
  const free = ctx.window === undefined ? undefined : Math.max(0, ctx.window - usage)
  // Denominator: the real capacity when the provider reported one, otherwise
  // what is known to be occupied. Never zero — the bar would be meaningless.
  const total = ctx.window ?? usage
  if (total <= 0) return null

  const candidates: ContextSegment[] = CONTEXT_ROWS
    .map((row): ContextSegment | undefined => {
      const tokens = row.key === 'free'
        ? free
        : row.key === 'system' ? system : row.key === 'tools' ? tools : messages
      if (tokens === undefined || tokens <= 0) return undefined
      return {
        key: row.key,
        cls: row.cls,
        label: row.label,
        tokens,
        width: Math.min(100, tokens / total * 100),
      }
    })
    .filter((segment): segment is ContextSegment => segment !== undefined)
  if (candidates.length === 0) return null

  const order = new Map(CONTEXT_ROWS.map((row, index) => [row.key, index] as const))
  const segments = [...candidates].sort((left, right) =>
    right.tokens - left.tokens || (order.get(left.key) ?? 0) - (order.get(right.key) ?? 0),
  )
  // Free is the tail regardless of its size (see the ordering rule above).
  const freeIndex = segments.findIndex(segment => segment.key === 'free')
  if (freeIndex >= 0 && freeIndex !== segments.length - 1) {
    const [freeSegment] = segments.splice(freeIndex, 1)
    if (freeSegment !== undefined) segments.push(freeSegment)
  }

  const describe = (segment: ContextSegment): string =>
    `${segment.label} ${fmtTokens(segment.tokens)} (${fmtPercent(segment.tokens, total)})`

  return (
    <div className="sat-context">
      <div
        className="sat-context-bar"
        role="img"
        aria-label={`Context: ${segments.map(describe).join(', ')}`}
      >
        {segments.map(segment => (
          <span
            key={segment.key}
            className={`sat-context-seg ${segment.cls}`}
            style={{ width: `${segment.width}%` }}
            title={describe(segment)}
          />
        ))}
      </div>
      <div className="sat-context-legend">
        {segments.map(segment => (
          <span key={segment.key} className="sat-context-legend-item">
            <span className={`sat-context-swatch ${segment.cls}`} aria-hidden="true" />
            {segment.label} {fmtTokens(segment.tokens)} {fmtPercent(segment.tokens, total)}
          </span>
        ))}
      </div>
    </div>
  )
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
  /** Open any session in the main view (the breadcrumb's back-navigation). */
  open(id: SessionId): void
  /** Open a direct child's own conversation, addressed by parent, child and mode. */
  openSubagent(address: SubagentAddress): void
}

export function SubagentsView(props: TabProps): ReactElement {
  const { sessionId, open, openSubagent } = props
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

  // Direct children are addressable by parent + child + mode, which is what the
  // `conversation.view` inject hands over. Rows without a durable mode (an
  // event-only straggler) and the row for the conversation you are already in
  // have no address, so they get no action.
  const openChild = (row: TabRow): void => {
    if (row.isCurrent || row.mode === undefined || row.mode === '') return
    openSubagent({
      parentSessionId: sessionId,
      childSessionId: row.id as SessionId,
      mode: row.mode === 'continuable' ? 'continuable' : 'one-shot',
    })
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
            {row.isCurrent || row.mode === undefined || row.mode === ''
              ? null
              : (
                <button
                  className="sat-row-btn"
                  type="button"
                  title="Open this subagent's conversation"
                  onClick={() => openChild(row)}
                >
                  ↗
                </button>
                )}
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
        {row.ctx !== undefined ? <ContextBar ctx={row.ctx} /> : null}
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

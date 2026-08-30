/**
 * subagent-view — host (node) half.
 *
 * A process-wide observer over the subagent lifecycle event pair
 * (`subagent/start` → `subagent/end`) plus the polling endpoint the
 * browser panel reads. Observed runs are kept in memory keyed by run id
 * and attributed to their ROOT session by walking the live in-memory
 * parent chain, so one snapshot serves exactly one session's subagent
 * forest. Durable catalog facts (label, mode, depth, parent) come from
 * `ctx.subagents.listDescendants` and are merged in at request time.
 *
 * Every value that reaches the wire is a plain scalar (string, number or
 * boolean), so the snapshot payload is lossless JSON with no undefined
 * members.
 */
import { z } from 'zod'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import type { SubagentRunEndInfo, SubagentRunInfo } from '@deepseek-ai/dsh-subagent'
import type { IncomingMessage, ServerResponse } from 'node:http'
// Loads the Context augmentations that provide `ctx.sessions`,
// `ctx.subagents` and `ctx.webServer`; the package is not imported at
// runtime.
import type {} from '@deepseek-ai/dsh-host-webserver'
// Loads the Context augmentation that provides `ctx.sessionProjections`.
import type {} from '@deepseek-ai/dsh-session-projection'

/**
 * Durable outcome projection unit: folds each turn's end reason after the
 * child's own `subagent/descriptor` (which resets fork-seed history), so a
 * subagent's terminal outcome survives process restarts through the
 * projection cache. Registered in `apply` under the same key.
 */
const outcomeStateSchema = z.object({
  stopReason: z.string().nullable(),
})

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    subagentOutcome: { stopReason: string | null }
  }
  interface SessionProjectionMap {
    subagentOutcome: { stopReason: string | null }
  }
}

/**
 * One observed run, held in memory between its start and end events.
 * All members are scalars, so a row can be copied into a JSON response
 * without any transformation.
 */
interface RunRow {
  /** Shared identity of the start/end event pair. */
  runId: string
  /** The subagent child's session id. */
  id: string
  /** Name of the provider that established the run. */
  provider: string
  /** Whether the run had a local in-process agent. */
  local: boolean
  /** The top-level session this run belongs to. */
  rootId: string
  /** Epoch milliseconds when `subagent/start` was observed. */
  startedAt: number
  /** `running` until the end event, then the terminal stop reason. */
  status: string
  /** Epoch milliseconds when `subagent/end` was observed. */
  endedAt?: number
}

/** Durable facts the descendant catalog contributes to a row. */
interface CatalogFacts {
  id: string
  label?: string
  mode?: string
  depth: number
  parentId: string
}

/**
 * One snapshot row: an observed run enriched with durable catalog facts
 * (label, mode, depth, parent id). Optional members are omitted rather
 * than set to undefined so nothing undefined reaches the wire.
 */
interface PanelRow {
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
  /** Recency hint for catalog rows never observed running (informational only; rows are ordered by tree position). */
  sortKey?: number
}

/** One root→current breadcrumb entry for the tab route. */
interface AncestorRow {
  id: string
  label: string
  depth: number
  isCurrent: boolean
}

/**
 * One tab row: an observed run enriched with durable catalog facts plus the
 * live activity / hasChildren / reason fields, the current-session marker and
 * the child's first post-seed user prompt (`purpose`). Optional members are
 * omitted rather than set to undefined so nothing undefined reaches the wire.
 */
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
  /** Recency hint for catalog rows never observed running (informational only; rows are ordered by tree position). */
  sortKey?: number
  isCurrent: boolean
  hasChildren: boolean
  activity?: string
  reason?: string
  purpose?: string
  /** Total provider-reported tokens (four disjoint buckets). */
  tokens?: number
  /** Settled active-turn milliseconds. */
  settledMs?: number
  /** Open turn start (epoch ms), when one is in flight. */
  activeSince?: number
  /** Open turn latest folded event time (epoch ms). */
  activeThrough?: number
}

/** Payload of `GET /api/subagent-view/tab`. */
interface TabPayload {
  currentId: string
  rootId?: string
  now: number
  ancestors: AncestorRow[]
  rows: TabRow[]
}

/** Maximum number of observed rows kept per root session. */
const MAX_ROWS_PER_ROOT = 200
/** Parent-chain hop budget when resolving a child to its root session. */
const MAX_ROOT_HOPS = 32

export const inject = ['sessions', 'subagents', 'webServer', 'sessionProjections']

export function apply(ctx: Context): void {
  /** Observed runs, keyed by run id. */
  const runs = new Map<string, RunRow>()

  /** Defensive identity coercion: branded ids are strings at runtime. */
  const asString = (value: unknown): string => typeof value === 'string' ? value : String(value)

  /**
   * Resolve a child session to its root session id by following the
   * in-memory `parentSession` chain. Returns undefined when the child is
   * not live or the chain exceeds the hop budget.
   */
  const rootOf = (childId: string): string | undefined => {
    let current = ctx.sessions.get(childId as SessionId)
    let hops = 0
    while (current !== undefined && hops < MAX_ROOT_HOPS) {
      const parentId = current.header.parentSession
      if (parentId === undefined) return asString(current.id)
      current = ctx.sessions.get(parentId)
      hops += 1
    }
    return undefined
  }

  /**
   * Enforce the per-root capacity: once a root has more than
   * MAX_ROWS_PER_ROOT rows, evict the oldest non-running rows for that
   * root only. Running rows are never evicted, so a burst of concurrent
   * runs may temporarily overshoot the cap.
   */
  const prune = (): void => {
    const counts = new Map<string, number>()
    for (const row of runs.values()) {
      counts.set(row.rootId, (counts.get(row.rootId) ?? 0) + 1)
    }
    for (const [rootId, count] of counts) {
      if (count <= MAX_ROWS_PER_ROOT) continue
      let excess = count - MAX_ROWS_PER_ROOT
      const candidates = [...runs.values()]
        .filter(row => row.rootId === rootId && row.status !== 'running')
        .sort((a, b) => a.startedAt - b.startedAt)
      for (const row of candidates) {
        if (excess <= 0) break
        runs.delete(row.runId)
        excess -= 1
      }
    }
  }

  /** `subagent/start`: attribute the child to its root and remember the run. */
  const onStart = (info: SubagentRunInfo): void => {
    const childId = asString(info.id)
    const rootId = rootOf(childId)
    if (rootId === undefined) return
    runs.set(asString(info.runId), {
      runId: asString(info.runId),
      id: childId,
      provider: info.provider,
      local: info.local,
      rootId,
      startedAt: Date.now(),
      status: 'running',
    })
    prune()
  }

  /** `subagent/end`: record the terminal stop reason as the row's status. */
  const onEnd = (info: SubagentRunEndInfo): void => {
    const row = runs.get(asString(info.runId))
    if (row === undefined) return
    row.status = info.stopReason
    row.endedAt = Date.now()
  }

  ctx.on('subagent/start', onStart, { global: true })
  ctx.on('subagent/end', onEnd, { global: true })

  /**
   * Register the `subagentOutcome` projection so every session's terminal
   * turn reason is folded durably and checkpointed by the projection cache
   * (at turn/end and session disposal), making it readable for cold sessions.
   */
  ctx.effect(() => {
    return ctx.sessionProjections.register({
      key: 'subagentOutcome',
      stateVersion: 0,
      stateSchema: outcomeStateSchema,
      init: () => ({ stopReason: null }),
      apply: (state, event) => {
        if (event.type === 'subagent/descriptor') {
          // The child's own descriptor is the outcome origin: anything folded
          // before it (a fork seed's ancestor turns) is discarded.
          return state.stopReason === null ? state : { stopReason: null }
        }
        if (event.type === 'turn/end') {
          const kind = event.data.reason.kind
          return state.stopReason === kind ? state : { stopReason: kind }
        }
        return state
      },
      wire: {
        viewSchema: outcomeStateSchema,
        view: state => ({ stopReason: state.stopReason }),
      },
    })
  }, 'subagent-view: outcome projection')

  /**
   * Merge the observed event rows for one root with the durable
   * descendant catalog. The catalog supplies id, label, mode, depth and
   * parentId; observed runs override with their event data; catalog
   * entries without an observed run get a recency sort key and a
   * `running`/`unknown` status; event rows the catalog does not mention
   * are kept with depth 0. Rows keep the catalog's stable pre-order
   * (parents before their children), so the client renders the tree
   * top-down; event-only stragglers trail the list.
   */
  const enrich = async (sessionId: string): Promise<PanelRow[]> => {
    let catalog: Awaited<ReturnType<typeof ctx.subagents.listDescendants>> = []
    try {
      catalog = await ctx.subagents.listDescendants(sessionId as SessionId)
    } catch {
      catalog = []
    }

    const eventRows: RunRow[] = []
    for (const row of runs.values()) {
      if (row.rootId === sessionId) eventRows.push({ ...row })
    }
    eventRows.sort((a, b) => a.startedAt - b.startedAt)

    // Resolve each candidate's projection values (live watermark or persisted
    // projection cache) so the durable outcome survives restarts.
    const candidateIds = new Set<string>()
    for (const entry of catalog) candidateIds.add(asString(entry.id))
    for (const row of eventRows) candidateIds.add(row.id)
    const valuesById = await resolveValues([...candidateIds])

    const merged: PanelRow[] = []
    const seen = new Set<string>()
    // The catalog arrives in stable pre-order (a parent always precedes its
    // descendants), so pushing rows in catalog order preserves the tree.
    for (let index = 0; index < catalog.length; index++) {
      const entry = catalog[index]
      if (entry === undefined) continue
      const id = asString(entry.id)
      seen.add(id)
      const base: CatalogFacts = {
        id,
        depth: entry.depth,
        parentId: asString(entry.parentId),
      }
      if (entry.kind === 'child') {
        if (entry.label !== undefined) base.label = entry.label
        base.mode = entry.mode
      }
      const observed = eventRows.find(row => row.id === id)
      if (observed !== undefined) {
        const row: PanelRow = {
          ...base,
          runId: observed.runId,
          provider: observed.provider,
          local: observed.local,
          startedAt: observed.startedAt,
          status: observed.status,
        }
        if (observed.endedAt !== undefined) row.endedAt = observed.endedAt
        merged.push(row)
      } else {
        const outcome = projectionsFor(valuesById.get(id)).stopReason
        merged.push({
          ...base,
          local: true,
          sortKey: -(catalog.length - index),
          status: entry.kind === 'child'
            ? (entry.activity === 'running' ? 'running' : (outcome ?? 'unknown'))
            : 'unknown',
        })
      }
    }
    for (const observed of eventRows) {
      if (seen.has(observed.id)) continue
      merged.push({
        id: observed.id,
        depth: 0,
        runId: observed.runId,
        provider: observed.provider,
        local: observed.local,
        startedAt: observed.startedAt,
        status: observed.status,
        ...(observed.endedAt !== undefined ? { endedAt: observed.endedAt } : {}),
      })
    }
    // No re-sort: catalog pre-order is the tree order; event-only rows
    // appended above trail the list in start order.
    return merged
  }

  /**
   * First post-seed user prompt of a child session, used as a short
   * human-readable purpose on the tab row. Returns undefined when the session
   * is not live or has no post-seed user message.
   */
  const purposeFor = (id: string): string | undefined => {
    const session = ctx.sessions.get(id as SessionId)
    if (session === undefined) return undefined
    const seed = session.header.seedLength ?? 0
    for (const event of session.events) {
      if (event.seq < seed) continue
      if (event.type !== 'user/message') continue
      const text = event.data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join(' ')
        .trim()
      return text.slice(0, 500)
    }
    return undefined
  }

  /** Minimal faces of the optional cold-read services (read defensively). */
  interface ProjectionCacheFace {
    cachedSnapshot(meta: SessionHeader): { values: Record<string, unknown> } | undefined
    coldSnapshot(id: string): Promise<{ values: Record<string, unknown> }>
  }
  interface PersistenceListFace {
    list(): Promise<SessionHeader[]>
  }

  /** Token + active-timing + outcome projections read for one row. */
  interface ProjectionsFor {
    tokens?: number
    settledMs?: number
    activeSince?: number
    activeThrough?: number
    stopReason?: string
  }

  /** Short TTL cache over the persistence metadata listing. */
  let headersCache: { at: number; headers: Map<string, SessionHeader> } | undefined

  const persistedHeaders = async (): Promise<Map<string, SessionHeader>> => {
    const now = Date.now()
    if (headersCache !== undefined && now - headersCache.at < 5000) return headersCache.headers
    const headers = new Map<string, SessionHeader>()
    try {
      const persistence = ctx.get('sessionPersistence') as PersistenceListFace | undefined
      if (persistence !== undefined) {
        for (const header of await persistence.list()) {
          headers.set(asString(header.id), header)
        }
      }
    } catch {
      // fail-soft: cold rows degrade to no projection values
    }
    headersCache = { at: now, headers }
    return headers
  }

  /**
   * One-time cold-outcome recovery promises, keyed by session id, so the
   * sidebar and tab endpoints share each full-log refold. Failures are not
   * memoized, so the next poll retries.
   */
  const coldRecoveries = new Map<string, Promise<Record<string, unknown> | undefined>>()

  const recoverCold = (id: string, cache: ProjectionCacheFace): Promise<Record<string, unknown> | undefined> => {
    let promise = coldRecoveries.get(id)
    if (promise === undefined) {
      promise = cache.coldSnapshot(id)
        .then(snapshot => snapshot.values)
        .catch(() => {
          coldRecoveries.delete(id)
          return undefined
        })
      coldRecoveries.set(id, promise)
    }
    return promise
  }

  /**
   * Resolve each session's projection values, live or cold. Live children cut
   * the registry's live watermark cache; cold children view the projection
   * cache's stored rows (zero log load), with a one-time `coldSnapshot` full
   * refold when the durable outcome row is missing (e.g. a session that went
   * cold before this plugin's unit existed).
   */
  const resolveValues = async (ids: readonly string[]): Promise<Map<string, Record<string, unknown> | undefined>> => {
    const out = new Map<string, Record<string, unknown> | undefined>()
    const coldIds: string[] = []
    for (const id of ids) {
      const live = ctx.sessions.get(id as SessionId)
      if (live !== undefined) {
        out.set(id, ctx.sessionProjections.snapshot(live).values as unknown as Record<string, unknown>)
      } else {
        coldIds.push(id)
      }
    }
    if (coldIds.length === 0) return out

    const cache = ctx.get('sessionProjectionCache') as ProjectionCacheFace | undefined
    const headers = cache === undefined ? new Map<string, SessionHeader>() : await persistedHeaders()
    for (const id of coldIds) {
      const header = headers.get(id)
      if (header === undefined || cache === undefined) {
        out.set(id, undefined)
        continue
      }
      const cached = cache.cachedSnapshot(header)
      const cachedValues = cached?.values
      if (cachedValues !== undefined && (cachedValues as { subagentOutcome?: unknown }).subagentOutcome !== undefined) {
        out.set(id, cachedValues)
        continue
      }
      const recovered = await recoverCold(id, cache)
      out.set(id, recovered ?? cachedValues)
    }
    return out
  }

  /**
   * Extract the wire fields the tab needs from one session's projection
   * values: tokenUsage (four disjoint buckets), subagentTiming (settled +
   * active window), and the durable subagentOutcome stop reason.
   */
  const projectionsFor = (values: Record<string, unknown> | undefined): ProjectionsFor => {
    const out: ProjectionsFor = {}
    if (values === undefined) return out
    const usage = values.tokenUsage as { uncachedInputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } | undefined
    if (usage !== undefined) {
      out.tokens = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    }
    const timing = values.subagentTiming as { settledMs: number; active?: { since: number; through: number } } | undefined
    if (timing !== undefined) {
      out.settledMs = timing.settledMs
      if (timing.active !== undefined) {
        out.activeSince = timing.active.since
        out.activeThrough = timing.active.through
      }
    }
    const outcome = values.subagentOutcome as { stopReason: string | null } | undefined
    if (outcome !== undefined && outcome.stopReason !== null) {
      out.stopReason = outcome.stopReason
    }
    return out
  }

  /**
   * Build the root-anchored tab payload: the descendant catalog (rooted at the
   * session's resolved root) merged with the observed event rows, each row
   * carrying the new activity / hasChildren / reason / purpose fields and the
   * current-session marker, plus a root→current ancestor breadcrumb.
   */
  const tabFor = async (sessionId: string): Promise<TabPayload> => {
    const rootId = rootOf(sessionId) ?? sessionId

    let catalog: Awaited<ReturnType<typeof ctx.subagents.listDescendants>> = []
    try {
      catalog = await ctx.subagents.listDescendants(rootId as SessionId)
    } catch {
      catalog = []
    }

    const eventRows: RunRow[] = []
    for (const row of runs.values()) {
      if (row.rootId === rootId) eventRows.push({ ...row })
    }
    eventRows.sort((a, b) => a.startedAt - b.startedAt)

    // Ancestor facts: the root itself plus every child/diagnostic catalog
    // entry, so the breadcrumb walk can resolve label, depth and parent id.
    const ancestorFacts = new Map<string, { label?: string; parentId?: string; depth?: number }>()
    ancestorFacts.set(rootId, { label: 'Main session', depth: 0 })
    for (let index = 0; index < catalog.length; index++) {
      const entry = catalog[index]
      if (entry === undefined) continue
      ancestorFacts.set(asString(entry.id), {
        ...(entry.kind === 'child' && entry.label !== undefined ? { label: entry.label } : {}),
        parentId: asString(entry.parentId),
        depth: entry.depth,
      })
    }

    // Breadcrumb: walk from the current session up to the root, then reverse
    // into root→current order. A node missing from the map falls back to a
    // derived label and the parent-relative depth hint.
    const ancestors: AncestorRow[] = []
    if (sessionId === rootId) {
      ancestors.push({ id: rootId, label: 'Main session', depth: 0, isCurrent: true })
    } else {
      const chain: AncestorRow[] = []
      let cursor = sessionId
      let hops = 0
      let depthHint = 0
      while (hops <= MAX_ROOT_HOPS) {
        const facts = ancestorFacts.get(cursor)
        const isRoot = cursor === rootId
        const label = facts?.label ?? (isRoot ? 'Main session' : 'subagent ' + cursor.slice(0, 8))
        const depth = facts?.depth ?? (isRoot ? 0 : depthHint)
        chain.push({ id: cursor, label, depth, isCurrent: cursor === sessionId })
        if (isRoot) break
        const parentId = facts?.parentId
        if (parentId === undefined || parentId === cursor) break
        depthHint = depth - 1
        cursor = parentId
        hops += 1
      }
      chain.reverse()
      ancestors.push(...chain)
    }

    // Resolve each candidate's projection values (live watermark or persisted
    // projection cache), so token/timing/outcome survive restarts.
    const candidateIds = new Set<string>()
    for (const entry of catalog) candidateIds.add(asString(entry.id))
    for (const row of eventRows) candidateIds.add(row.id)
    const valuesById = await resolveValues([...candidateIds])

    // Merge the catalog with observed event rows, mirroring `enrich` but
    // carrying the tab-specific fields (activity/hasChildren/reason/purpose
    // and the current marker).
    const merged: TabRow[] = []
    const seen = new Set<string>()
    for (let index = 0; index < catalog.length; index++) {
      const entry = catalog[index]
      if (entry === undefined) continue
      const id = asString(entry.id)
      seen.add(id)
      const base = {
        id,
        depth: entry.depth,
        parentId: asString(entry.parentId),
        isCurrent: id === sessionId,
        hasChildren: entry.kind === 'child' ? entry.hasChildren : false,
      }
      const purpose = purposeFor(id)
      const projections = projectionsFor(valuesById.get(id))
      const observed = eventRows.find(row => row.id === id)
      if (observed !== undefined) {
        const row: TabRow = {
          ...base,
          runId: observed.runId,
          provider: observed.provider,
          local: observed.local,
          startedAt: observed.startedAt,
          status: observed.status,
        }
        if (entry.kind === 'child') {
          if (entry.label !== undefined) row.label = entry.label
          row.mode = entry.mode
          row.activity = entry.activity
        } else {
          row.reason = entry.reason
        }
        if (observed.endedAt !== undefined) row.endedAt = observed.endedAt
        if (purpose !== undefined) row.purpose = purpose
        if (projections.tokens !== undefined) row.tokens = projections.tokens
        if (projections.settledMs !== undefined) row.settledMs = projections.settledMs
        if (projections.activeSince !== undefined) row.activeSince = projections.activeSince
        if (projections.activeThrough !== undefined) row.activeThrough = projections.activeThrough
        merged.push(row)
      } else {
        const row: TabRow = {
          ...base,
          local: true,
          sortKey: -(catalog.length - index),
          status: entry.kind === 'child'
            ? (entry.activity === 'running' ? 'running' : (projections.stopReason ?? 'unknown'))
            : 'unknown',
        }
        if (entry.kind === 'child') {
          if (entry.label !== undefined) row.label = entry.label
          row.mode = entry.mode
          row.activity = entry.activity
        } else {
          row.reason = entry.reason
        }
        if (purpose !== undefined) row.purpose = purpose
        if (projections.tokens !== undefined) row.tokens = projections.tokens
        if (projections.settledMs !== undefined) row.settledMs = projections.settledMs
        if (projections.activeSince !== undefined) row.activeSince = projections.activeSince
        if (projections.activeThrough !== undefined) row.activeThrough = projections.activeThrough
        merged.push(row)
      }
    }
    for (const observed of eventRows) {
      if (seen.has(observed.id)) continue
      const purpose = purposeFor(observed.id)
      const projections = projectionsFor(valuesById.get(observed.id))
      const row: TabRow = {
        id: observed.id,
        depth: 0,
        runId: observed.runId,
        provider: observed.provider,
        local: observed.local,
        startedAt: observed.startedAt,
        status: observed.status,
        isCurrent: observed.id === sessionId,
        hasChildren: false,
      }
      if (observed.endedAt !== undefined) row.endedAt = observed.endedAt
      if (purpose !== undefined) row.purpose = purpose
      if (projections.tokens !== undefined) row.tokens = projections.tokens
      if (projections.settledMs !== undefined) row.settledMs = projections.settledMs
      if (projections.activeSince !== undefined) row.activeSince = projections.activeSince
      if (projections.activeThrough !== undefined) row.activeThrough = projections.activeThrough
      merged.push(row)
    }
    // No re-sort: catalog pre-order is the tree order; event-only rows
    // appended above trail the list in start order.
    return {
      currentId: sessionId,
      rootId,
      now: Date.now(),
      ancestors,
      rows: merged,
    }
  }

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/api/subagent-view/snapshot',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        // `get` returns null only when the param is absent; an empty
        // `?sessionId=` is treated as a real (empty) session id.
        const sessionId = url.searchParams.get('sessionId')
        const payload = sessionId === null
          ? { now: Date.now(), rows: [] }
          : { sessionId, now: Date.now(), rows: await enrich(sessionId) }
        res.writeHead(200, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify(payload))
      },
    })
  }, 'subagent-view: snapshot route')

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/api/subagent-view/tab',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const sessionId = url.searchParams.get('sessionId')
        const payload = sessionId === null
          ? { currentId: '', now: Date.now(), ancestors: [], rows: [] }
          : await tabFor(sessionId)
        res.writeHead(200, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify(payload))
      },
    })
  }, 'subagent-view: tab route')
}

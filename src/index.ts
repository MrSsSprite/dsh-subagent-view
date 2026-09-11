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
import { SessionLogOffset } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import type { SubagentRunEndInfo, SubagentRunInfo } from '@deepseek-ai/dsh-subagent'
import type { IncomingMessage, ServerResponse } from 'node:http'
// Loads the Context augmentations that provide `ctx.sessions`,
// `ctx.subagents` and `ctx.webServer`; the package is not imported at
// runtime.
import type {} from '@deepseek-ai/dsh-host-webserver'
// Loads the Context augmentation that provides `ctx.sessionProjections`.
import type {} from '@deepseek-ai/dsh-session-projection'
// Loads the Context augmentations that provide the cold-read services
// `ctx.sessionProjectionCache` and `ctx.sessionQuery`. Both are read through
// `ctx.get`, so the plugins that provide them stay optional.
import type {} from '@deepseek-ai/dsh-session-projection-cache'
// The cold log read goes through `ctx.sessionQuery` (which serves live and
// persisted sessions alike), so the persistence backend itself is never called
// directly. The import keeps the declared peer surface honest: a deployment
// that composes `sessionQuery` over persistence is exactly what this cold path
// requires, and the augmentation proves the service name this plugin's
// `durableHeaders` comment refers to.
import type {} from '@deepseek-ai/dsh-session-persistence'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'

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

/**
 * Payload of `GET /api/subagent-view/tab`.
 *
 * `error` is diagnostic only and never a failure signal: both routes answer
 * `200` with a well-formed payload for every input, so a client can always
 * trust a non-2xx/parse failure to mean "network", not "the handler crashed".
 */
interface TabPayload {
  currentId: string
  rootId?: string
  now: number
  ancestors: AncestorRow[]
  rows: TabRow[]
  error?: string
}

/** Payload of `GET /api/subagent-view/snapshot`; see {@link TabPayload} on `error`. */
interface SnapshotPayload {
  sessionId?: string
  now: number
  rows: PanelRow[]
  error?: string
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
   *
   * The child's own log is read through `Session.ownEvents()`, which returns
   * exactly the events after the fork-inherited prefix — the same cut the old
   * `header.seedLength` filter expressed. DSH 0.1.2-rc.1 removed both the
   * `Session.events` accessor and `SessionHeader.seedLength`, so reading either
   * one threw `TypeError` here and turned `/api/subagent-view/tab` into a
   * body-less HTTP 400 (see docs/DIAGNOSIS-0.1.2-rc.1.md, S2).
   */
  const purposeFor = (id: string): string | undefined => {
    const session = ctx.sessions.get(id as SessionId)
    if (session === undefined) return undefined
    try {
      for (const event of session.ownEvents()) {
        if (event.type !== 'user/message') continue
        const text = event.data.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join(' ')
          .trim()
        return text.slice(0, 500)
      }
    } catch (error) {
      // Same rule as every other per-row read: a degraded `purpose` must not
      // be able to take a row — or the route — with it.
      ctx.logger.warn(`subagent-view: own-log read failed for ${id}: ${String(error)}`)
    }
    return undefined
  }

  /** Token + active-timing + outcome projections read for one row. */
  interface ProjectionsFor {
    tokens?: number
    settledMs?: number
    activeSince?: number
    activeThrough?: number
    stopReason?: string
  }

  /** Short TTL cache over the durable session-header listing. */
  let headersCache: { at: number; headers: Map<string, SessionHeader> } | undefined

  /**
   * Durable session headers, from the query engine's live-preferred corpus
   * (`ctx.sessionQuery.listSessions`). The cache's `cachedSnapshot` needs the
   * caller's header as the identity witness for the stored row, so a cold id
   * is unreadable without it. Fail-soft: no query service or a throwing
   * listing degrades every cold row to no projection values, never to a
   * failed route.
   */
  const durableHeaders = async (): Promise<Map<string, SessionHeader>> => {
    const now = Date.now()
    if (headersCache !== undefined && now - headersCache.at < 5000) return headersCache.headers
    const headers = new Map<string, SessionHeader>()
    const query = ctx.get('sessionQuery')
    try {
      if (query !== undefined) {
        for (const record of await query.listSessions()) {
          headers.set(asString(record.header.id), record.header)
        }
      }
    } catch (error) {
      ctx.logger.warn(`subagent-view: durable session listing failed: ${String(error)}`)
    }
    headersCache = { at: now, headers }
    return headers
  }

  /**
   * The exact fork-inherited prefix length of one stored session. A header
   * records only *whether* a session was seeded (`isSeeded`), so an unseeded
   * session is exactly 0 and a seeded one costs one log read
   * (`SessionLogSnapshot.inheritedEventCount`). Returns undefined only when a
   * seeded session's log cannot be read — the caller then skips that
   * candidate's projection values, which is what `isSeeded` being a boolean
   * rather than a length forces.
   */
  const inheritedEventCountOf = async (header: SessionHeader): Promise<SessionLogOffset | undefined> => {
    if (!header.isSeeded) return SessionLogOffset(0)
    let snapshot: SessionLogSnapshot
    try {
      snapshot = await ctx.sessionQuery.readSession(header.id)
    } catch (error) {
      ctx.logger.warn(
        `subagent-view: log read failed for seeded session ${asString(header.id)}: ${String(error)}`,
      )
      return undefined
    }
    return snapshot.inheritedEventCount
  }

  /**
   * One-time cold full-log refolds, keyed by session id, so the sidebar and
   * tab endpoints share each refold and its durable write-back side effect.
   * An entry is dropped when the refold fails, so the next poll retries. The
   * map is bounded and oldest-first, so a process that has seen thousands of
   * finished sessions cannot accumulate refolds for ever.
   */
  const coldRefolds = new Map<string, Promise<Record<string, unknown>>>()
  const MAX_COLD_REFOLDS = 512

  const coldValues = (meta: SessionHeader, inheritedEventCount: SessionLogOffset, events: readonly SessionEvent[]): Promise<Record<string, unknown>> => {
    const id = asString(meta.id)
    let refold = coldRefolds.get(id)
    if (refold === undefined) {
      refold = (async (): Promise<Record<string, unknown>> => {
        try {
          // Synchronous, and it writes the refreshed checkpoint back
          // (fail-soft, fire-and-forget) — hence one memoized call per session.
          return ctx.sessionProjectionCache.coldSnapshot(meta, inheritedEventCount, events).values as unknown as Record<string, unknown>
        } catch (error) {
          coldRefolds.delete(id)
          ctx.logger.warn(`subagent-view: cold projection refold failed for ${id}: ${String(error)}`)
          return {}
        }
      })()
      coldRefolds.set(id, refold)
      if (coldRefolds.size > MAX_COLD_REFOLDS) {
        const oldest = coldRefolds.keys().next()
        if (oldest.done !== true) coldRefolds.delete(oldest.value)
      }
    }
    return refold
  }

  /**
   * The one projection key this plugin OWNS, and the only one that decides a
   * row's terminal status — which in turn drives the Done count and the
   * Archived folder. It is requested ON ITS OWN because
   * `sessionProjections.viewCheckpoint` parses the view of every requested key
   * and does not guard that parse (`dsh-session-projection/lib/index.js:259`),
   * so a single rejecting unit throws the whole read. Isolating the outcome
   * means a broken platform unit can no longer deny this plugin the one value
   * that decides whether a finished subagent is reported as finished.
   *
   * `ProjectionsFor` below is the readable contract for what this plugin reads.
   * The lists are plain `string[]` rather than typed key tuples on purpose:
   * `SessionProjectionMap` is widened by declaration merging from the hosting
   * deployment's package set, so typing them here would couple this plugin's
   * compile to platform packages it does not depend on. The single cast at each
   * read site is the price of that decoupling.
   */
  const OUTCOME_KEYS = ['subagentOutcome']

  /**
   * Decoration keys (token totals, settled/active timing), read as their own
   * group so a rejecting unit here costs only the decoration and never the
   * status.
   */
  const DECOR_KEYS = ['tokenUsage', 'subagentTiming']

  /** The narrowed `keys` parameter of `snapshot`/`cachedSnapshot`; see above. */
  const keyList = (keys: readonly string[]): readonly never[] => keys as unknown as readonly never[]

  /** Merge projection groups left to right; an earlier key is never overwritten. */
  const mergeValues = (
    ...groups: readonly (Record<string, unknown> | undefined)[]
  ): Record<string, unknown> => {
    const merged: Record<string, unknown> = {}
    for (const group of groups) {
      if (group === undefined) continue
      for (const [key, value] of Object.entries(group)) {
        if (!(key in merged)) merged[key] = value
      }
    }
    return merged
  }

  /**
   * Resolve each session's projection values, live or cold. Live children cut
   * the registry's live watermark cache; cold children view the projection
   * cache's stored rows (zero log load), with a one-time `coldSnapshot` full
   * refold when the durable outcome row is missing (e.g. a session that went
   * cold before this plugin's unit existed).
   *
   * The live read is fail-soft in three steps: the keyed snapshot, then the
   * already-materialized cells only (no history refold), then no values at all.
   * Projection values are decoration — token counts, timings, the durable
   * outcome — so losing them must never take the route with it.
   *
   * Each step is guarded because DSH 0.1.2-rc.1's `snapshot()` still folds
   * every registered unit via `materializeCells` and parses every wire view:
   * an unrelated unit of the deployment can therefore reject our read, which
   * must degrade this row rather than reject the whole HTTP response.
   */
  const liveValues = (live: Session): Record<string, unknown> => {
    const id = asString(live.id)
    /**
     * One key group, fail-soft in three steps: the keyed snapshot, then the
     * already-materialized cells only (no history refold), then nothing. Each
     * group is read on its own so a rejecting platform unit degrades only
     * itself — and never the outcome group that decides the status.
     */
    const read = (keys: readonly string[]): Record<string, unknown> | undefined => {
      try {
        return ctx.sessionProjections.snapshot(live, keyList(keys)).values as unknown as Record<string, unknown>
      } catch (error) {
        ctx.logger.warn(
          `subagent-view: live projection snapshot failed for ${id} (${keys.join(',')}): ${String(error)}`,
        )
      }
      try {
        return (ctx.sessionProjections.cachedSnapshot(live, keyList(keys))?.values ?? {}) as unknown as Record<string, unknown>
      } catch {
        return undefined
      }
    }
    return mergeValues(read(OUTCOME_KEYS), read(DECOR_KEYS))
  }

  /**
   * One cold candidate's projection values, fail-soft at every step.
   *
   * The durable row is bound to an exact `(header, inheritedEventCount)`
   * identity, so the second argument is load-bearing: a missing one makes
   * `cachedSnapshot` throw (`SessionLogOffset` brands it). The stored row is
   * preferred (zero log load); a session with no stored row — or one whose row
   * predates this plugin's `subagentOutcome` unit — is refolded once from its
   * complete log through `coldSnapshot`, which also writes the refreshed
   * checkpoint back so later polls take the cheap path.
   *
   * Never throws: a candidate whose log is unreadable, whose header is absent,
   * or whose fold rejects simply contributes no values. Projection values are
   * decoration, and one undecorated row must never cost the row list.
   */
  const coldValuesFor = async (
    id: string,
    header: SessionHeader,
    loaded: Map<string, SessionLogSnapshot | undefined>,
  ): Promise<Record<string, unknown> | undefined> => {
    const inheritedEventCount = await inheritedEventCountOf(header)
    if (inheritedEventCount === undefined) return undefined

    /**
     * One key group from the durable row. A THROW is an expected outcome, not
     * a dead end: `viewCheckpoint` leaves `wire.viewSchema.parse` unguarded, so
     * one rejecting unit inside the requested group throws the whole call. The
     * group is therefore isolated, and a throw falls through to the refold
     * below instead of denying this row its values.
     */
    const durable = (keys: readonly string[]): Record<string, unknown> | undefined => {
      try {
        return ctx.sessionProjectionCache
          .cachedSnapshot(header, inheritedEventCount, keyList(keys))
          ?.values as unknown as Record<string, unknown> | undefined
      } catch (error) {
        ctx.logger.warn(
          `subagent-view: durable projection row unreadable for ${id} (${keys.join(',')}): ${String(error)}`,
        )
        return undefined
      }
    }

    let values = mergeValues(durable(OUTCOME_KEYS), durable(DECOR_KEYS))

    // Recovery rung: refold from the complete log whenever the durable row
    // could not serve a group (it threw, is absent, or predates our unit).
    // `coldValues` memoizes the refold per session - and the refreshed
    // checkpoint it writes back makes later polls take the cheap path - so this
    // is paid at most once per session and never per poll.
    if (values['subagentOutcome'] === undefined
      || values['tokenUsage'] === undefined
      || values['subagentTiming'] === undefined) {
      const log = await coldLog(id, loaded)
      if (log !== undefined) {
        values = mergeValues(values, await coldValues(log.session, log.inheritedEventCount, log.events))
      }
    }
    return values
  }

  /**
   * One cold candidate's complete log, read at most once per poll: the sidebar
   * and tab endpoints call `resolveValues` separately, and the memo makes them
   * share the read within one request instead of decompressing the same log
   * twice.
   */
  const coldLog = async (
    id: string,
    loaded: Map<string, SessionLogSnapshot | undefined>,
  ): Promise<SessionLogSnapshot | undefined> => {
    if (loaded.has(id)) return loaded.get(id)
    let snapshot: SessionLogSnapshot | undefined
    try {
      snapshot = await ctx.sessionQuery.readSession(id as SessionId)
    } catch (error) {
      ctx.logger.warn(`subagent-view: cold log read failed for ${id}: ${String(error)}`)
    }
    loaded.set(id, snapshot)
    return snapshot
  }

  const resolveValues = async (ids: readonly string[]): Promise<Map<string, Record<string, unknown> | undefined>> => {
    const out = new Map<string, Record<string, unknown> | undefined>()
    const coldIds: string[] = []
    for (const id of ids) {
      const live = ctx.sessions.get(id as SessionId)
      if (live !== undefined) {
        out.set(id, liveValues(live))
      } else {
        coldIds.push(id)
      }
    }
    if (coldIds.length === 0) return out

    const cache = ctx.get('sessionProjectionCache')
    const query = ctx.get('sessionQuery')
    if (cache === undefined || query === undefined) {
      for (const id of coldIds) out.set(id, undefined)
      return out
    }
    const headers = await durableHeaders()
    const loaded = new Map<string, SessionLogSnapshot | undefined>()
    for (const id of coldIds) {
      const header = headers.get(id)
      if (header === undefined) {
        out.set(id, undefined)
        continue
      }
      try {
        out.set(id, await coldValuesFor(id, header, loaded))
      } catch (error) {
        ctx.logger.warn(`subagent-view: cold read failed for ${id}: ${String(error)}`)
        out.set(id, undefined)
      }
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

  /**
   * The `sessionId` query parameter, or null when it is absent. `get` returns
   * null only for an absent param; an empty `?sessionId=` is a real (empty)
   * session id.
   */
  const sessionIdOf = (req: IncomingMessage): string | null =>
    new URL(req.url ?? '/', 'http://localhost').searchParams.get('sessionId')

  /** Failure diagnostic for a degraded payload. */
  const errorText = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

  /**
   * Answer one JSON payload. Both routes go through here so a future platform
   * drift can never again surface as the body-less HTTP 400 that
   * `dsh-host-webserver` produces for an uncaught handler exception: the
   * plugin's client halves treat an unparseable body as a transient network
   * failure and would silently render their empty state for ever
   * (docs/DIAGNOSIS-0.1.2-rc.1.md §5).
   */
  const replyJson = (res: ServerResponse, payload: unknown): void => {
    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify(payload))
  }

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/api/subagent-view/snapshot',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const sessionId = sessionIdOf(req)
        if (sessionId === null) {
          replyJson(res, { now: Date.now(), rows: [] } satisfies SnapshotPayload)
          return
        }
        let payload: SnapshotPayload
        try {
          payload = { sessionId, now: Date.now(), rows: await enrich(sessionId) }
        } catch (error) {
          ctx.logger.warn(`subagent-view: snapshot failed for ${sessionId}: ${String(error)}`)
          payload = { sessionId, now: Date.now(), rows: [], error: errorText(error) }
        }
        replyJson(res, payload)
      },
    })
  }, 'subagent-view: snapshot route')

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/api/subagent-view/tab',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const sessionId = sessionIdOf(req)
        if (sessionId === null) {
          replyJson(res, { currentId: '', now: Date.now(), ancestors: [], rows: [] } satisfies TabPayload)
          return
        }
        let payload: TabPayload
        try {
          payload = await tabFor(sessionId)
        } catch (error) {
          ctx.logger.warn(`subagent-view: tab failed for ${sessionId}: ${String(error)}`)
          payload = {
            currentId: sessionId,
            now: Date.now(),
            ancestors: [],
            rows: [],
            error: errorText(error),
          }
        }
        replyJson(res, payload)
      },
    })
  }, 'subagent-view: tab route')
}

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
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SubagentRunEndInfo, SubagentRunInfo } from '@deepseek-ai/dsh-subagent'
import type { IncomingMessage, ServerResponse } from 'node:http'
// Loads the Context augmentations that provide `ctx.sessions`,
// `ctx.subagents` and `ctx.webServer`; the package is not imported at
// runtime.
import type {} from '@deepseek-ai/dsh-host-webserver'

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
  /** Newest-first key for catalog rows that were never observed running. */
  sortKey?: number
}

/** Maximum number of observed rows kept per root session. */
const MAX_ROWS_PER_ROOT = 200
/** Parent-chain hop budget when resolving a child to its root session. */
const MAX_ROOT_HOPS = 32

export const inject = ['sessions', 'subagents', 'webServer']

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
   * Merge the observed event rows for one root with the durable
   * descendant catalog. The catalog supplies id, label, mode, depth and
   * parentId; observed runs override with their event data; catalog
   * entries without an observed run get a recency sort key and a
   * `running`/`unknown` status; event rows the catalog does not mention
   * are kept with depth 0. The result sorts newest-first: observed runs
   * by start time, catalog-only rows by their recency key.
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

    const merged: PanelRow[] = []
    const seen = new Set<string>()
    // Catalog order is oldest-first, so the descending recency key makes
    // unobserved rows rank newest-first below any observed run.
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
        merged.push({
          ...base,
          local: true,
          sortKey: -(catalog.length - index),
          status: entry.kind === 'child' && entry.activity === 'running' ? 'running' : 'unknown',
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
    merged.sort((a, b) => {
      const keyA = a.startedAt ?? a.sortKey ?? Number.NEGATIVE_INFINITY
      const keyB = b.startedAt ?? b.sortKey ?? Number.NEGATIVE_INFINITY
      return keyB - keyA
    })
    return merged
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
}

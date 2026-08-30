//#region src/index.ts
/** Maximum number of observed rows kept per root session. */
const MAX_ROWS_PER_ROOT = 200;
/** Parent-chain hop budget when resolving a child to its root session. */
const MAX_ROOT_HOPS = 32;
const inject = [
	"sessions",
	"subagents",
	"webServer"
];
function apply(ctx) {
	/** Observed runs, keyed by run id. */
	const runs = /* @__PURE__ */ new Map();
	/** Defensive identity coercion: branded ids are strings at runtime. */
	const asString = (value) => typeof value === "string" ? value : String(value);
	/**
	* Resolve a child session to its root session id by following the
	* in-memory `parentSession` chain. Returns undefined when the child is
	* not live or the chain exceeds the hop budget.
	*/
	const rootOf = (childId) => {
		let current = ctx.sessions.get(childId);
		let hops = 0;
		while (current !== void 0 && hops < MAX_ROOT_HOPS) {
			const parentId = current.header.parentSession;
			if (parentId === void 0) return asString(current.id);
			current = ctx.sessions.get(parentId);
			hops += 1;
		}
	};
	/**
	* Enforce the per-root capacity: once a root has more than
	* MAX_ROWS_PER_ROOT rows, evict the oldest non-running rows for that
	* root only. Running rows are never evicted, so a burst of concurrent
	* runs may temporarily overshoot the cap.
	*/
	const prune = () => {
		const counts = /* @__PURE__ */ new Map();
		for (const row of runs.values()) counts.set(row.rootId, (counts.get(row.rootId) ?? 0) + 1);
		for (const [rootId, count] of counts) {
			if (count <= MAX_ROWS_PER_ROOT) continue;
			let excess = count - MAX_ROWS_PER_ROOT;
			const candidates = [...runs.values()].filter((row) => row.rootId === rootId && row.status !== "running").sort((a, b) => a.startedAt - b.startedAt);
			for (const row of candidates) {
				if (excess <= 0) break;
				runs.delete(row.runId);
				excess -= 1;
			}
		}
	};
	/** `subagent/start`: attribute the child to its root and remember the run. */
	const onStart = (info) => {
		const childId = asString(info.id);
		const rootId = rootOf(childId);
		if (rootId === void 0) return;
		runs.set(asString(info.runId), {
			runId: asString(info.runId),
			id: childId,
			provider: info.provider,
			local: info.local,
			rootId,
			startedAt: Date.now(),
			status: "running"
		});
		prune();
	};
	/** `subagent/end`: record the terminal stop reason as the row's status. */
	const onEnd = (info) => {
		const row = runs.get(asString(info.runId));
		if (row === void 0) return;
		row.status = info.stopReason;
		row.endedAt = Date.now();
	};
	ctx.on("subagent/start", onStart, { global: true });
	ctx.on("subagent/end", onEnd, { global: true });
	/**
	* Merge the observed event rows for one root with the durable
	* descendant catalog. The catalog supplies id, label, mode, depth and
	* parentId; observed runs override with their event data; catalog
	* entries without an observed run get a recency sort key and a
	* `running`/`unknown` status; event rows the catalog does not mention
	* are kept with depth 0. The result sorts newest-first: observed runs
	* by start time, catalog-only rows by their recency key.
	*/
	const enrich = async (sessionId) => {
		let catalog = [];
		try {
			catalog = await ctx.subagents.listDescendants(sessionId);
		} catch {
			catalog = [];
		}
		const eventRows = [];
		for (const row of runs.values()) if (row.rootId === sessionId) eventRows.push({ ...row });
		eventRows.sort((a, b) => a.startedAt - b.startedAt);
		const merged = [];
		const seen = /* @__PURE__ */ new Set();
		for (let index = 0; index < catalog.length; index++) {
			const entry = catalog[index];
			if (entry === void 0) continue;
			const id = asString(entry.id);
			seen.add(id);
			const base = {
				id,
				depth: entry.depth,
				parentId: asString(entry.parentId)
			};
			if (entry.kind === "child") {
				if (entry.label !== void 0) base.label = entry.label;
				base.mode = entry.mode;
			}
			const observed = eventRows.find((row) => row.id === id);
			if (observed !== void 0) {
				const row = {
					...base,
					runId: observed.runId,
					provider: observed.provider,
					local: observed.local,
					startedAt: observed.startedAt,
					status: observed.status
				};
				if (observed.endedAt !== void 0) row.endedAt = observed.endedAt;
				merged.push(row);
			} else merged.push({
				...base,
				local: true,
				sortKey: -(catalog.length - index),
				status: entry.kind === "child" && entry.activity === "running" ? "running" : "unknown"
			});
		}
		for (const observed of eventRows) {
			if (seen.has(observed.id)) continue;
			merged.push({
				id: observed.id,
				depth: 0,
				runId: observed.runId,
				provider: observed.provider,
				local: observed.local,
				startedAt: observed.startedAt,
				status: observed.status,
				...observed.endedAt !== void 0 ? { endedAt: observed.endedAt } : {}
			});
		}
		merged.sort((a, b) => {
			const keyA = a.startedAt ?? a.sortKey ?? Number.NEGATIVE_INFINITY;
			return (b.startedAt ?? b.sortKey ?? Number.NEGATIVE_INFINITY) - keyA;
		});
		return merged;
	};
	/**
	* First post-seed user prompt of a child session, used as a short
	* human-readable purpose on the tab row. Returns undefined when the session
	* is not live or has no post-seed user message.
	*/
	const purposeFor = (id) => {
		const session = ctx.sessions.get(id);
		if (session === void 0) return void 0;
		const seed = session.header.seedLength ?? 0;
		for (const event of session.events) {
			if (event.seq < seed) continue;
			if (event.type !== "user/message") continue;
			return event.data.content.filter((block) => block.type === "text").map((block) => block.text).join(" ").trim().slice(0, 500);
		}
	};
	/**
	* Build the root-anchored tab payload: the descendant catalog (rooted at the
	* session's resolved root) merged with the observed event rows, each row
	* carrying the new activity / hasChildren / reason / purpose fields and the
	* current-session marker, plus a root→current ancestor breadcrumb.
	*/
	const tabFor = async (sessionId) => {
		const rootId = rootOf(sessionId) ?? sessionId;
		let catalog = [];
		try {
			catalog = await ctx.subagents.listDescendants(rootId);
		} catch {
			catalog = [];
		}
		const eventRows = [];
		for (const row of runs.values()) if (row.rootId === rootId) eventRows.push({ ...row });
		eventRows.sort((a, b) => a.startedAt - b.startedAt);
		const ancestorFacts = /* @__PURE__ */ new Map();
		ancestorFacts.set(rootId, {
			label: "Main session",
			depth: 0
		});
		for (let index = 0; index < catalog.length; index++) {
			const entry = catalog[index];
			if (entry === void 0) continue;
			ancestorFacts.set(asString(entry.id), {
				...entry.kind === "child" && entry.label !== void 0 ? { label: entry.label } : {},
				parentId: asString(entry.parentId),
				depth: entry.depth
			});
		}
		const ancestors = [];
		if (sessionId === rootId) ancestors.push({
			id: rootId,
			label: "Main session",
			depth: 0,
			isCurrent: true
		});
		else {
			const chain = [];
			let cursor = sessionId;
			let hops = 0;
			let depthHint = 0;
			while (hops <= MAX_ROOT_HOPS) {
				const facts = ancestorFacts.get(cursor);
				const isRoot = cursor === rootId;
				const label = facts?.label ?? (isRoot ? "Main session" : "subagent " + cursor.slice(0, 8));
				const depth = facts?.depth ?? (isRoot ? 0 : depthHint);
				chain.push({
					id: cursor,
					label,
					depth,
					isCurrent: cursor === sessionId
				});
				if (isRoot) break;
				const parentId = facts?.parentId;
				if (parentId === void 0 || parentId === cursor) break;
				depthHint = depth - 1;
				cursor = parentId;
				hops += 1;
			}
			chain.reverse();
			ancestors.push(...chain);
		}
		const merged = [];
		const seen = /* @__PURE__ */ new Set();
		for (let index = 0; index < catalog.length; index++) {
			const entry = catalog[index];
			if (entry === void 0) continue;
			const id = asString(entry.id);
			seen.add(id);
			const base = {
				id,
				depth: entry.depth,
				parentId: asString(entry.parentId),
				isCurrent: id === sessionId,
				hasChildren: entry.kind === "child" ? entry.hasChildren : false
			};
			const purpose = purposeFor(id);
			const observed = eventRows.find((row) => row.id === id);
			if (observed !== void 0) {
				const row = {
					...base,
					runId: observed.runId,
					provider: observed.provider,
					local: observed.local,
					startedAt: observed.startedAt,
					status: observed.status
				};
				if (entry.kind === "child") {
					if (entry.label !== void 0) row.label = entry.label;
					row.mode = entry.mode;
					row.activity = entry.activity;
				} else row.reason = entry.reason;
				if (observed.endedAt !== void 0) row.endedAt = observed.endedAt;
				if (purpose !== void 0) row.purpose = purpose;
				merged.push(row);
			} else {
				const row = {
					...base,
					local: true,
					sortKey: -(catalog.length - index),
					status: entry.kind === "child" && entry.activity === "running" ? "running" : "unknown"
				};
				if (entry.kind === "child") {
					if (entry.label !== void 0) row.label = entry.label;
					row.mode = entry.mode;
					row.activity = entry.activity;
				} else row.reason = entry.reason;
				if (purpose !== void 0) row.purpose = purpose;
				merged.push(row);
			}
		}
		for (const observed of eventRows) {
			if (seen.has(observed.id)) continue;
			const purpose = purposeFor(observed.id);
			const row = {
				id: observed.id,
				depth: 0,
				runId: observed.runId,
				provider: observed.provider,
				local: observed.local,
				startedAt: observed.startedAt,
				status: observed.status,
				isCurrent: observed.id === sessionId,
				hasChildren: false
			};
			if (observed.endedAt !== void 0) row.endedAt = observed.endedAt;
			if (purpose !== void 0) row.purpose = purpose;
			merged.push(row);
		}
		merged.sort((a, b) => {
			const keyA = a.startedAt ?? a.sortKey ?? Number.NEGATIVE_INFINITY;
			return (b.startedAt ?? b.sortKey ?? Number.NEGATIVE_INFINITY) - keyA;
		});
		return {
			currentId: sessionId,
			rootId,
			now: Date.now(),
			ancestors,
			rows: merged
		};
	};
	ctx.effect(() => {
		return ctx.webServer.register({
			kind: "exact",
			path: "/api/subagent-view/snapshot",
			handler: async (req, res) => {
				const sessionId = new URL(req.url ?? "/", "http://localhost").searchParams.get("sessionId");
				const payload = sessionId === null ? {
					now: Date.now(),
					rows: []
				} : {
					sessionId,
					now: Date.now(),
					rows: await enrich(sessionId)
				};
				res.writeHead(200, {
					"content-type": "application/json",
					"cache-control": "no-store"
				});
				res.end(JSON.stringify(payload));
			}
		});
	}, "subagent-view: snapshot route");
	ctx.effect(() => {
		return ctx.webServer.register({
			kind: "exact",
			path: "/api/subagent-view/tab",
			handler: async (req, res) => {
				const sessionId = new URL(req.url ?? "/", "http://localhost").searchParams.get("sessionId");
				const payload = sessionId === null ? {
					currentId: "",
					now: Date.now(),
					ancestors: [],
					rows: []
				} : await tabFor(sessionId);
				res.writeHead(200, {
					"content-type": "application/json",
					"cache-control": "no-store"
				});
				res.end(JSON.stringify(payload));
			}
		});
	}, "subagent-view: tab route");
}
//#endregion
export { apply, inject };

//# sourceMappingURL=index.js.map
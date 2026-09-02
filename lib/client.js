window.__ModuleLoader__.load({
	id: "subagent-view",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/tree.tsx
		/**
		* subagent-view, browser half: shared subagent hierarchy renderer.
		*
		* Replicates the DSH-canonical disclosure tree visual (the authority pattern
		* from `@deepseek-ai/dsh-client-ui-subagent`'s catalog rows): rows that have
		* children get a chevron-right ">" disclosure button on their left, which
		* rotates 90° to point downward when the branch is expanded, and gray
		* "L"-shaped guide lines (a vertical line through the parent's chevron column
		* plus a short horizontal tick reaching each child row's chevron) mark the
		* parent-child relationships.
		*
		* Geometry contract with the row cards and the CSS in src/client/index.ts
		* (mirrors the canonical catalog row numbers):
		* - a row card carries class `${cls}-row`, is `position: relative`, and is
		*   padded 11px from the left so the 14px disclosure's center sits at x=18px;
		* - every nested level renders as a `.${cls}-children` block (margin-left
		*   18px + padding-left 4px) of `.${cls}-node` wrappers, each node holding
		*   one row card plus, when expanded, its own children block;
		* - the guide lines are drawn purely by CSS: a per-node vertical line at
		*   left:-4px (the parent's chevron column), a per-row horizontal tick at
		*   left:-4px / top:16px (the chevron's vertical center), a 17px-tall final
		*   segment on the last sibling, and a vertical bridge (the
		*   `.${cls}-row-branch-open` pseudo-element) from an expanded parent's
		*   chevron down to its children. The bridge spans the row's full remaining
		*   height, so rows of any height (details blocks, purpose lines) stay
		*   connected.
		*/
		/** Build the forest over `rows`, then recurse only through expanded branches. */
		function SubagentTree(props) {
			const { rows, collapsed, onToggle, cls, renderRow } = props;
			const childrenByParent = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				const known = /* @__PURE__ */ new Set();
				for (const row of rows) known.add(row.id);
				for (const row of rows) {
					if (row.parentId === void 0 || !known.has(row.parentId)) continue;
					const siblings = map.get(row.parentId);
					if (siblings === void 0) map.set(row.parentId, [row]);
					else siblings.push(row);
				}
				return map;
			}, [rows]);
			const roots = (0, react.useMemo)(() => {
				const known = /* @__PURE__ */ new Set();
				for (const row of rows) known.add(row.id);
				return rows.filter((row) => row.parentId === void 0 || !known.has(row.parentId));
			}, [rows]);
			const renderNode = (row, depth, last, nodeKey) => {
				const children = childrenByParent.get(row.id) ?? [];
				const hasChildren = children.length > 0;
				const expanded = hasChildren && !collapsed.has(row.id);
				const name = row.label !== void 0 && row.label !== "" ? row.label : "subagent";
				const disclosure = hasChildren ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					className: `${cls}-disclosure${expanded ? ` ${cls}-disclosure-open` : ""}`,
					type: "button",
					"aria-expanded": expanded,
					"aria-label": expanded ? `Collapse ${name} descendants` : `Expand ${name} descendants`,
					title: expanded ? "Collapse descendants" : "Expand descendants",
					onClick: (event) => {
						event.stopPropagation();
						onToggle(row.id);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {})
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: `${cls}-disclosure-space`,
					"aria-hidden": "true"
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${cls}-node`,
					children: [renderRow(row, {
						hasChildren,
						expanded,
						last,
						depth,
						disclosure
					}), expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${cls}-children`,
						role: "group",
						children: children.map((child, index) => renderNode(child, depth + 1, index === children.length - 1, child.id))
					}) : null]
				}, nodeKey);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: roots.map((row, index) => renderNode(row, 0, index === roots.length - 1, row.id)) });
		}
		/**
		* Partition `rows` into the main forest and the Archived folder. A member is
		* a completed one-shot row; the folder takes each member's whole subtree, so
		* the tree never orphans a child of a moved row. Nested members stay nested:
		* only the outermost archived ancestor becomes a folder root.
		*/
		function splitArchived(rows) {
			const isMember = (row) => row.mode === "one-shot" && row.status === "completed";
			const memberIds = /* @__PURE__ */ new Set();
			for (const row of rows) if (isMember(row)) memberIds.add(row.id);
			const archiveRoots = /* @__PURE__ */ new Set();
			for (const row of rows) {
				if (!memberIds.has(row.id)) continue;
				if (row.parentId === void 0 || !memberIds.has(row.parentId)) archiveRoots.add(row.id);
			}
			const byId = /* @__PURE__ */ new Map();
			for (const row of rows) byId.set(row.id, row);
			const inFolder = (row, seen) => {
				if (archiveRoots.has(row.id)) return true;
				if (row.parentId === void 0 || seen.has(row.id)) return false;
				seen.add(row.id);
				const parent = byId.get(row.parentId);
				return parent !== void 0 && inFolder(parent, seen);
			};
			const moved = /* @__PURE__ */ new Set();
			let count = 0;
			for (const row of rows) {
				if (!inFolder(row, /* @__PURE__ */ new Set())) continue;
				moved.add(row.id);
				if (isMember(row)) count += 1;
			}
			const archived = rows.filter((row) => moved.has(row.id));
			return {
				main: rows.filter((row) => !moved.has(row.id)),
				archived,
				count
			};
		}
		/**
		* The "Archived" container: a disclosure-style header (chevron + folder icon +
		* member count) whose body renders the archive forest with the same tree
		* visuals as the main list. Renders nothing while empty.
		*/
		function ArchivedFolder(props) {
			const { rows, count, cls, collapsed, onToggle, renderRow, open, onToggleFolder } = props;
			if (rows.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${cls}-folder`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: `${cls}-folder-header${open ? ` ${cls}-folder-open` : ""}`,
					type: "button",
					"aria-expanded": open,
					title: open ? "Collapse archived" : "Expand archived",
					onClick: onToggleFolder,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${cls}-folder-chevron${open ? ` ${cls}-folder-chevron-open` : ""}`,
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {})
						}),
						open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, {
							size: 14,
							className: `${cls}-folder-icon`
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, {
							size: 14,
							className: `${cls}-folder-icon`
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${cls}-folder-label`,
							children: "Archived"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${cls}-folder-count`,
							children: count
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${cls}-folder-body`,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentTree, {
						rows,
						collapsed,
						onToggle,
						cls,
						renderRow
					})
				}) : null]
			});
		}
		//#endregion
		//#region src/client/panel.tsx
		/**
		* subagent-view, browser half: the sidebar-docked bar and expandable panel.
		* One entry in `sidebar.footer.action` renders a column block — the compact
		* bottom bar ("n running · m done · k failed") and, when open, the full panel
		* above it, both inside the sidebar column. The panel polls the host half's
		* snapshot route once per second while mounted, so a page refresh recovers
		* everything without any model interaction.
		*/
		const listeners$1 = /* @__PURE__ */ new Set();
		let state$1 = {
			sessionId: void 0,
			now: Date.now(),
			rows: [],
			open: false,
			hidden: [],
			expanded: /* @__PURE__ */ new Set(),
			archiveOpen: false
		};
		let autoOpened = false;
		let polling$1 = false;
		const commit$1 = (patch) => {
			state$1 = {
				...state$1,
				...patch
			};
			for (const listener of [...listeners$1]) listener();
		};
		const subscribe$1 = (listener) => {
			listeners$1.add(listener);
			return () => {
				listeners$1.delete(listener);
			};
		};
		const getSnapshot$1 = () => state$1;
		const useMonitor = () => (0, react.useSyncExternalStore)(subscribe$1, getSnapshot$1);
		async function refresh$1(sessionId) {
			try {
				const data = await (await fetch(`/api/subagent-view/snapshot?sessionId=${encodeURIComponent(sessionId)}`)).json();
				if (data.sessionId !== state$1.sessionId) return;
				commit$1({
					rows: data.rows ?? [],
					now: data.now ?? Date.now()
				});
			} catch {}
		}
		let sessionsSvc;
		function setSessionsService(service) {
			sessionsSvc = service;
		}
		const UNKNOWN$1 = {
			cls: "sav-dot-off",
			label: "Ended"
		};
		const STATUS$1 = {
			running: {
				cls: "sav-dot-running",
				label: "Running"
			},
			completed: {
				cls: "sav-dot-ok",
				label: "Done"
			},
			error: {
				cls: "sav-dot-error",
				label: "Failed"
			},
			aborted: {
				cls: "sav-dot-warn",
				label: "Interrupted"
			},
			"max-tokens": {
				cls: "sav-dot-warn",
				label: "Token limit"
			},
			refusal: {
				cls: "sav-dot-warn",
				label: "Refused"
			}
		};
		/** Outer 3x3 matrix cells (2px pixels on a 10px grid), clockwise from top-left. */
		const CHASE_CELLS$1 = [
			[0, 0],
			[4, 0],
			[8, 0],
			[8, 4],
			[8, 8],
			[4, 8],
			[0, 8],
			[0, 4]
		];
		function StatusDot$1({ status }) {
			if (status === "running") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "sav-dot sav-dot-running",
				width: 10,
				height: 10,
				viewBox: "0 0 10 10",
				shapeRendering: "crispEdges",
				"aria-hidden": "true",
				children: CHASE_CELLS$1.map(([x, y], index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					className: "sav-dot-cell",
					x,
					y,
					width: "2",
					height: "2",
					style: { animationDelay: `${(index - CHASE_CELLS$1.length) * 125}ms` }
				}, `${x}-${y}`))
			});
			const meta = STATUS$1[status] ?? UNKNOWN$1;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `sav-dot ${meta.cls}`,
				"aria-hidden": "true"
			});
		}
		/** One "n ●" count segment in the stats line; non-first segments lead with a separator. */
		function CountSegment({ count, status, first }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "sav-count-seg",
				children: [
					first ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sav-count-sep",
						"aria-hidden": "true",
						children: "·"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sav-count-num",
						children: count
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot$1, { status })
				]
			});
		}
		function fmtDuration$1(start, end) {
			if (start === void 0) return "—";
			const ms = (end ?? Date.now()) - start;
			if (ms < 0) return "00:00";
			const s = Math.floor(ms / 1e3);
			const h = Math.floor(s / 3600);
			const m = Math.floor(s % 3600 / 60);
			const sec = s % 60;
			const pad = (n) => String(n).padStart(2, "0");
			return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
		}
		const shortId$1 = (id) => id === void 0 || id.length <= 8 ? id ?? "—" : id.slice(0, 8);
		function rowLabel$1(row) {
			if (typeof row.label === "string" && row.label !== "") return row.label;
			if (typeof row.provider === "string" && row.provider !== "") return `[${row.provider}] subagent`;
			return `subagent ${shortId$1(row.id)}`;
		}
		const MOBILE_QUERY = "(max-width: 768px)";
		function SubagentViewBarPanel(props) {
			const { wide, toggleSidebar } = props;
			const monitor = useMonitor();
			const current = props.useSessions((select) => select.current);
			const subagentParent = props.useSessions((select) => select.currentAddress === void 0 ? void 0 : select.currentAddress.parentSessionId);
			(0, react.useEffect)(() => {
				if (current === void 0) {
					if (state$1.sessionId !== void 0) commit$1({
						sessionId: void 0,
						rows: []
					});
					return;
				}
				if (current !== state$1.sessionId) {
					commit$1({ sessionId: current });
					refresh$1(current);
				}
			}, [current]);
			(0, react.useEffect)(() => {
				if (polling$1) return;
				polling$1 = true;
				const timer = window.setInterval(() => {
					const sid = state$1.sessionId;
					if (sid !== void 0) refresh$1(sid);
				}, 1e3);
				return () => {
					window.clearInterval(timer);
					polling$1 = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				if (autoOpened) return;
				autoOpened = true;
				if (!window.matchMedia(MOBILE_QUERY).matches) commit$1({ open: true });
			}, []);
			(0, react.useEffect)(() => {
				if (!wide) commit$1({ open: false });
			}, [wide]);
			const effectiveHidden = /* @__PURE__ */ new Set();
			const visible = [];
			const hiddenSet = new Set(monitor.hidden);
			for (const row of monitor.rows) if (hiddenSet.has(row.id) || row.parentId !== void 0 && effectiveHidden.has(row.parentId)) effectiveHidden.add(row.id);
			else visible.push(row);
			const running = visible.filter((row) => row.status === "running").length;
			const done = visible.filter((row) => row.status === "completed").length;
			const failed = visible.filter((row) => row.status === "error" || row.status === "aborted" || row.status === "max-tokens" || row.status === "refusal").length;
			const collapsed = (0, react.useMemo)(() => {
				const parents = /* @__PURE__ */ new Set();
				for (const row of visible) if (row.parentId !== void 0) parents.add(row.parentId);
				const set = /* @__PURE__ */ new Set();
				for (const id of parents) if (!monitor.expanded.has(id)) set.add(id);
				return set;
			}, [visible, monitor.expanded]);
			const toggleBranch = (id) => {
				const next = new Set(monitor.expanded);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				commit$1({ expanded: next });
			};
			const openChild = (row) => {
				if (sessionsSvc === void 0 || monitor.sessionId === void 0 || row.mode === void 0) return;
				const address = {
					parentSessionId: monitor.sessionId,
					childSessionId: row.id,
					mode: row.mode
				};
				sessionsSvc.openSubagent(address);
			};
			/**
			* Hide every fully-finished subtree (no running row anywhere below it).
			* Whole branches are hidden — never single rows — so children always stay
			* attached to a visible ancestor.
			*/
			const clearFinished = () => {
				const byParent = /* @__PURE__ */ new Map();
				for (const row of state$1.rows) {
					if (row.parentId === void 0) continue;
					const siblings = byParent.get(row.parentId);
					if (siblings === void 0) byParent.set(row.parentId, [row]);
					else siblings.push(row);
				}
				const keep = /* @__PURE__ */ new Set();
				for (let index = state$1.rows.length - 1; index >= 0; index--) {
					const row = state$1.rows[index];
					if (row === void 0) continue;
					if (row.status === "running" || (byParent.get(row.id) ?? []).some((child) => keep.has(child.id))) keep.add(row.id);
				}
				const hidden = new Set(state$1.hidden);
				for (const row of state$1.rows) if (!keep.has(row.id)) hidden.add(row.id);
				commit$1({ hidden: [...hidden] });
			};
			const { main, archived, count } = splitArchived(visible);
			const renderMonitorRow = (row, ctx) => {
				const meta = STATUS$1[row.status] ?? UNKNOWN$1;
				const elapsed = row.status === "running" ? fmtDuration$1(row.startedAt, state$1.now) : fmtDuration$1(row.startedAt, row.endedAt);
				const modeText = row.mode === "continuable" ? "continuable" : row.mode === "one-shot" ? "one-shot" : "";
				const metaLine = [
					row.provider,
					modeText,
					shortId$1(row.id)
				].filter((value) => typeof value === "string" && value !== "").join(" · ");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `sav-row${ctx.expanded && ctx.hasChildren ? " sav-row-branch-open" : ""}`,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "sav-row-main",
						children: [
							ctx.disclosure,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot$1, { status: row.status }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "sav-row-label",
								title: rowLabel$1(row),
								children: rowLabel$1(row)
							}),
							row.mode !== void 0 && sessionsSvc !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "sav-btn sav-row-open",
								type: "button",
								onClick: () => openChild(row),
								children: "Open"
							}) : null
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "sav-row-foot",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sav-row-meta",
							children: metaLine !== "" ? metaLine : "\xA0"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sav-row-time",
							children: row.status === "running" ? `${elapsed} · ${meta.label}` : `${meta.label} · ${elapsed}`
						})]
					})]
				});
			};
			if (!wide) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				className: "sav-rail-btn",
				type: "button",
				title: "Subagent runs",
				onClick: () => {
					toggleSidebar();
					commit$1({ open: true });
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					className: "sav-rail-icon",
					width: "16",
					height: "16",
					viewBox: "0 0 16 16",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 2h4v4H3zM9 2h4v4H9zM3 10h4v4H3zM9 10h4v4H9z" })
				}), running > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "sav-rail-badge",
					children: running
				}) : null]
			});
			const segments = [
				{
					status: "running",
					count: running
				},
				{
					status: "completed",
					count: done
				},
				{
					status: "error",
					count: failed
				}
			].filter((segment) => segment.count > 0);
			const statsEl = segments.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "sav-stats sav-stats-none",
				children: "None"
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "sav-stats",
				children: segments.map((segment, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CountSegment, {
					count: segment.count,
					status: segment.status,
					first: index === 0
				}, segment.status))
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "sav-root",
				children: [monitor.open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "sav-panel",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "sav-panel-header",
							title: "Collapse panel",
							onClick: () => commit$1({ open: false }),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "sav-panel-title",
									children: "Subagents"
								}),
								subagentParent !== void 0 && sessionsSvc !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "sav-btn sav-back",
									type: "button",
									title: "Back to main session",
									onClick: (event) => {
										event.stopPropagation();
										sessionsSvc?.open(subagentParent);
									},
									children: "← Main session"
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sav-panel-spacer" }),
								running > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "sav-panel-running",
									children: [running, " running"]
								}) : null
							]
						}),
						visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "sav-empty",
							children: monitor.sessionId === void 0 ? "No session selected" : "No subagent activity in this session"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "sav-rows",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentTree, {
								rows: main,
								collapsed,
								onToggle: toggleBranch,
								cls: "sav",
								renderRow: renderMonitorRow
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArchivedFolder, {
								rows: archived,
								count,
								cls: "sav",
								collapsed,
								onToggle: toggleBranch,
								renderRow: renderMonitorRow,
								open: monitor.archiveOpen,
								onToggleFolder: () => commit$1({ archiveOpen: !monitor.archiveOpen })
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "sav-panel-footer",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "sav-panel-stats",
									children: statsEl
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sav-panel-spacer" }),
								monitor.hidden.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "sav-btn",
									type: "button",
									onClick: () => commit$1({ hidden: [] }),
									children: `Show hidden (${monitor.hidden.length})`
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "sav-btn",
									type: "button",
									onClick: clearFinished,
									children: "Clear finished"
								})
							]
						})
					]
				}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: "sav-bar",
					type: "button",
					title: "Subagent runs",
					onClick: () => commit$1({ open: !state$1.open }),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sav-bar-label",
							children: "Subagents"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sav-bar-stats",
							children: statsEl
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `sav-bar-chevron${monitor.open ? " sav-bar-chevron-open" : ""}`,
							"aria-hidden": "true",
							children: "▾"
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/subagents-tab.tsx
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
		const listeners = /* @__PURE__ */ new Set();
		let state = {
			sessionId: void 0,
			now: Date.now(),
			ancestors: [],
			rows: []
		};
		let polling = false;
		const commit = (patch) => {
			state = {
				...state,
				...patch
			};
			for (const listener of [...listeners]) listener();
		};
		const subscribe = (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		};
		const getSnapshot = () => state;
		const useTab = () => (0, react.useSyncExternalStore)(subscribe, getSnapshot);
		async function refresh(sessionId) {
			try {
				const data = await (await fetch(`/api/subagent-view/tab?sessionId=${encodeURIComponent(sessionId)}`)).json();
				if (data.currentId !== state.sessionId) return;
				commit({
					ancestors: data.ancestors ?? [],
					rows: data.rows ?? [],
					now: data.now ?? Date.now()
				});
			} catch {}
		}
		const UNKNOWN = {
			cls: "sat-dot-off",
			label: "Unknown"
		};
		const STATUS = {
			running: {
				cls: "sat-dot-running",
				label: "Running"
			},
			completed: {
				cls: "sat-dot-ok",
				label: "Done"
			},
			error: {
				cls: "sat-dot-error",
				label: "Failed"
			},
			aborted: {
				cls: "sat-dot-warn",
				label: "Interrupted"
			},
			"max-tokens": {
				cls: "sat-dot-warn",
				label: "Token limit"
			},
			refusal: {
				cls: "sat-dot-warn",
				label: "Refused"
			}
		};
		/** Outer 3x3 matrix cells (2px pixels on a 10px grid), clockwise from top-left. */
		const CHASE_CELLS = [
			[0, 0],
			[4, 0],
			[8, 0],
			[8, 4],
			[8, 8],
			[4, 8],
			[0, 8],
			[0, 4]
		];
		function StatusDot({ status }) {
			if (status === "running") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "sat-dot sat-dot-running",
				width: 10,
				height: 10,
				viewBox: "0 0 10 10",
				shapeRendering: "crispEdges",
				"aria-hidden": "true",
				children: CHASE_CELLS.map(([x, y], index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					className: "sat-dot-cell",
					x,
					y,
					width: "2",
					height: "2",
					style: { animationDelay: `${(index - CHASE_CELLS.length) * 125}ms` }
				}, `${x}-${y}`))
			});
			const meta = STATUS[status] ?? UNKNOWN;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `sat-dot ${meta.cls}`,
				"aria-hidden": "true"
			});
		}
		function fmtDuration(start, end) {
			if (start === void 0) return "—";
			const ms = (end ?? Date.now()) - start;
			if (ms < 0) return "00:00";
			const s = Math.floor(ms / 1e3);
			const h = Math.floor(s / 3600);
			const m = Math.floor(s % 3600 / 60);
			const sec = s % 60;
			const pad = (n) => String(n).padStart(2, "0");
			return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
		}
		function fmtTokens(n) {
			if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
			if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
			return String(n);
		}
		function activeMsFor(row, now) {
			if (row.settledMs === void 0) return void 0;
			if (row.activeSince === void 0) return row.settledMs;
			const end = row.status === "running" ? now : row.activeThrough ?? now;
			return row.settledMs + Math.max(0, end - row.activeSince);
		}
		const shortId = (id) => id === void 0 || id.length <= 8 ? id ?? "—" : id.slice(0, 8);
		const fmtTime = (ms) => new Date(ms).toLocaleString();
		const outcomeLabel = (status) => STATUS[status]?.label ?? "Unknown";
		function rowLabel(row) {
			if (typeof row.label === "string" && row.label !== "") return row.label;
			if (typeof row.provider === "string" && row.provider !== "") return row.provider;
			return `subagent ${shortId(row.id)}`;
		}
		function providerChipText(provider) {
			if (provider === "fork") return "⑂ fork";
			if (provider === "spawn") return "✦ spawn";
			return provider;
		}
		function toggleMember(set, id) {
			const next = new Set(set);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		}
		function SummaryCell({ caption, count, status }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "sat-sum-cell",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sat-sum-num",
						children: count
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, { status }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sat-sum-caption",
						children: caption
					})
				]
			});
		}
		function ModeChip({ mode }) {
			if (mode === "continuable") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "sat-mode-chip sat-mode-chip-brand",
				children: "↻ continuable"
			});
			if (mode === "one-shot") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "sat-mode-chip sat-mode-chip-neutral",
				children: "⚡ one-shot"
			});
			return null;
		}
		function detailsFields(row) {
			const fields = [];
			if (row.startedAt !== void 0) fields.push(["Started", fmtTime(row.startedAt)]);
			if (row.endedAt !== void 0) fields.push(["Ended", fmtTime(row.endedAt)]);
			fields.push(["Outcome", outcomeLabel(row.status)]);
			if (row.parentId !== void 0) fields.push(["Parent", shortId(row.parentId)]);
			if (row.activity !== void 0) fields.push(["Activity", row.activity]);
			fields.push(["Has children", row.hasChildren ? "yes" : "no"]);
			if (row.reason !== void 0) fields.push(["Unreadable", row.reason]);
			return fields;
		}
		/**
		* Floating details window: the friendly overview fields first, then the raw
		* wire fields, divided by a hairline. Anchored to the row card (absolute,
		* `top: 100%`), like the old raw-fields popover.
		*/
		function DetailsPopover({ row }) {
			const overview = detailsFields(row);
			const raw = rawFields(row);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "sat-popover",
				children: [
					overview.map(([key, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "sat-pop-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "sat-pop-key",
							children: [key, ":"]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sat-pop-value",
							children: value
						})]
					}, key)),
					raw.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "sat-pop-div",
						"aria-hidden": "true"
					}) : null,
					raw.map(([key, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "sat-pop-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "sat-pop-key",
							children: [key, ":"]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sat-pop-value",
							children: value
						})]
					}, key))
				]
			});
		}
		function rawFields(row) {
			const fields = [["id", row.id]];
			if (row.runId !== void 0) fields.push(["runId", row.runId]);
			if (row.local !== void 0) fields.push(["local", String(row.local)]);
			fields.push(["depth", String(row.depth)]);
			if (row.sortKey !== void 0) fields.push(["sortKey", String(row.sortKey)]);
			if (row.mode !== void 0) fields.push(["mode", row.mode]);
			if (row.provider !== void 0) fields.push(["provider", row.provider]);
			fields.push(["isCurrent", String(row.isCurrent)]);
			if (row.purpose !== void 0) fields.push(["purpose", row.purpose]);
			return fields;
		}
		function SubagentsView(props) {
			const { sessionId, open } = props;
			const tab = useTab();
			(0, react.useEffect)(() => {
				if (sessionId !== state.sessionId) {
					commit({
						sessionId,
						ancestors: [],
						rows: []
					});
					refresh(sessionId);
				}
			}, [sessionId]);
			(0, react.useEffect)(() => {
				if (polling) return;
				polling = true;
				const timer = window.setInterval(() => {
					const sid = state.sessionId;
					if (sid !== void 0) refresh(sid);
				}, 1e3);
				return () => {
					window.clearInterval(timer);
					polling = false;
				};
			}, []);
			const [detailsOpen, setDetailsOpen] = (0, react.useState)(null);
			const [archiveOpen, setArchiveOpen] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const onPointerDown = (event) => {
					const target = event.target;
					if (!(target instanceof Element)) return;
					if (target.closest(".sat-popover") !== null) return;
					if (target.closest(".sat-row-btn") !== null) return;
					setDetailsOpen(null);
				};
				document.addEventListener("pointerdown", onPointerDown);
				return () => document.removeEventListener("pointerdown", onPointerDown);
			}, []);
			const [collapsed, setCollapsed] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const toggleBranch = (id) => {
				setCollapsed((prev) => toggleMember(prev, id));
			};
			const { ancestors, rows, now } = tab;
			const running = rows.filter((row) => row.status === "running").length;
			const done = rows.filter((row) => row.status === "completed").length;
			const failed = rows.filter((row) => row.status === "error" || row.status === "aborted" || row.status === "max-tokens" || row.status === "refusal").length;
			const total = rows.length;
			const pct = (count) => total === 0 ? 0 : Math.round(count / total * 100);
			const totalTokens = rows.reduce((sum, row) => sum + (row.tokens ?? 0), 0);
			const totalActiveMs = rows.reduce((sum, row) => {
				return sum + (activeMsFor(row, now) ?? 0);
			}, 0);
			const { main, archived, count } = splitArchived(rows);
			const renderTabRow = (row, ctx) => {
				const label = rowLabel(row);
				const activeMs = activeMsFor(row, now);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `sat-row${row.isCurrent ? " sat-row-current" : ""}${ctx.expanded && ctx.hasChildren ? " sat-row-branch-open" : ""}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "sat-row-main",
							children: [
								ctx.disclosure,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, { status: row.status }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModeChip, { mode: row.mode }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "sat-label",
									title: label,
									children: label
								}),
								typeof row.provider === "string" && row.provider !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "sat-provider-chip",
									children: providerChipText(row.provider)
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "sat-metrics",
									children: [row.tokens !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "sat-metric-token",
										children: [fmtTokens(row.tokens), " tok"]
									}) : null, activeMs !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "sat-metric-duration",
										children: fmtDuration(0, activeMs)
									}) : null]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "sat-row-actions",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "sat-row-btn",
										type: "button",
										title: "Details",
										onClick: () => setDetailsOpen((prev) => prev === row.id ? null : row.id),
										children: "ⓘ"
									})
								})
							]
						}),
						typeof row.purpose === "string" && row.purpose !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "sat-purpose",
							title: row.purpose,
							children: row.purpose
						}) : null,
						detailsOpen === row.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DetailsPopover, { row }) : null
					]
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "sat-root",
				children: [
					ancestors.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
						className: "sat-crumbs",
						"aria-label": "Subagent lineage",
						children: ancestors.map((ancestor, index) => {
							const crumb = ancestor.isCurrent ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "sat-crumb sat-crumb-current",
								title: "You are here",
								children: ancestor.label
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "sat-crumb sat-crumb-link",
								type: "button",
								title: ancestor.label,
								onClick: () => open(ancestor.id),
								children: ancestor.label
							});
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [index > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "sat-crumb-sep",
								"aria-hidden": "true",
								children: "/"
							}) : null, crumb] }, ancestor.id);
						})
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "sat-summary",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "sat-sum-cells",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryCell, {
										caption: "Running",
										count: running,
										status: "running"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryCell, {
										caption: "Done",
										count: done,
										status: "completed"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryCell, {
										caption: "Failed",
										count: failed,
										status: "error"
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "sat-sum-bar",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "sat-proportion",
									role: "img",
									"aria-label": `${running} running, ${done} done, ${failed} failed`,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "sat-prop-seg sat-prop-running",
											style: { width: `${pct(running)}%` }
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "sat-prop-seg sat-prop-done",
											style: { width: `${pct(done)}%` }
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "sat-prop-seg sat-prop-failed",
											style: { width: `${pct(failed)}%` }
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "sat-sum-total",
									children: ["total ", total]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "sat-sum-totals",
								children: [
									fmtTokens(totalTokens),
									" tokens · ",
									fmtDuration(0, totalActiveMs),
									" active time"
								]
							})
						]
					}),
					rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "sat-empty",
						children: "No subagent activity in this session"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "sat-tree",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentTree, {
							rows: main,
							collapsed,
							onToggle: toggleBranch,
							cls: "sat",
							renderRow: renderTabRow
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArchivedFolder, {
							rows: archived,
							count,
							cls: "sat",
							collapsed,
							onToggle: toggleBranch,
							renderRow: renderTabRow,
							open: archiveOpen,
							onToggleFolder: () => setArchiveOpen((prev) => !prev)
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"sessions",
			"layout"
		];
		function apply(ctx) {
			setSessionsService(ctx.sessions);
			ctx.effect(() => {
				const tag = document.createElement("style");
				tag.dataset.plugin = "subagent-view";
				tag.textContent = `
.sav-root {
  display: flex; flex-direction: column; gap: 0;
  width: 100%; min-width: 0;
  font-family: var(--dsw-font-family, inherit);
  font-size: 12px;
  color: var(--dsw-alias-label-primary, inherit);
}
.sav-bar {
  flex: none; width: 100%;
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border: none; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit; font-size: 12px; line-height: 18px;
  cursor: pointer; text-align: left;
}
.sav-bar:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.05)); }
.sav-bar-label {
  flex: none; font-weight: 500;
  color: var(--dsw-alias-label-primary, inherit);
}
.sav-bar-stats {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums;
  display: flex; align-items: center;
}
.sav-stats { display: inline-flex; align-items: center; gap: 6px; }
.sav-stats-none { color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sav-count-seg { display: inline-flex; align-items: center; gap: 3px; }
.sav-count-sep { color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sav-count-num { font-variant-numeric: tabular-nums; }
.sav-bar-chevron {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-size: 10px; transition: transform var(--ds-transition-duration-slow, 160ms) var(--ds-ease-in-out, ease-in-out);
}
.sav-bar-chevron-open { transform: rotate(180deg); }
.sav-rail-btn {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: none; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  cursor: pointer;
}
.sav-rail-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.05)); }
.sav-rail-icon { fill: currentColor; opacity: 0.8; }
.sav-rail-badge {
  position: absolute; top: -2px; right: -4px;
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  background: var(--dsw-alias-brand-primary, #2563eb); color: #ffffff;
  font-size: 10px; line-height: 16px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.sav-panel {
  flex: none; width: 100%; min-width: 0;
  display: flex; flex-direction: column;
  /* Auto-size to content, clamped between a floor that keeps the empty state
     ("No subagent activity in this session") legible and the former fixed
     height — now the ceiling — so a long list never fills the whole bar. */
  height: auto; min-height: 140px; max-height: min(60vh, 480px);
  margin-bottom: 4px;
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base, #ffffff));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  box-shadow: var(--dsw-shadow-lv1, 0 2px 4px rgba(15, 23, 42, 0.04));
  overflow: hidden;
}
.sav-panel-header {
  flex: none; display: flex; align-items: center; gap: 6px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06));
  user-select: none;
  cursor: pointer;
}
.sav-panel-header:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04)); }
.sav-panel-title { flex: none; font-weight: 600; font-size: 13px; line-height: 18px; }
.sav-panel-running {
  flex: none; color: var(--dsw-alias-brand-primary, #2563eb); font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.sav-panel-spacer { flex: 1; }
.sav-rows {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(15, 23, 42, 0.15));
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(15, 23, 42, 0.25));
}
.sav-empty { flex: 1; padding: 24px 12px; text-align: center; color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sav-row {
  flex: none; position: relative;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
  /* 11px left pad + 14px disclosure box puts the chevron center at x=18px,
     the column the tree guide lines run through. */
  padding: 7px 8px 7px 11px;
}
.sav-row-main { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sav-dot { width: 10px; height: 10px; flex: none; }
/* Running: pixel-art chase around the 3x3 outer ring. */
.sav-dot-running { color: var(--dsw-static-deepseek-450, rgb(86, 134, 254)); }
.sav-dot-cell { fill: currentColor; opacity: 0.15; animation: sav-dot-chase 1s infinite; }
@keyframes sav-dot-chase {
  0%, 12.4% { opacity: 1; }
  12.5%, 24.9% { opacity: 0.6; }
  25%, 37.4% { opacity: 0.35; }
  37.5%, 100% { opacity: 0.15; }
}
/* Terminal states: 10% same-color halo around a 6/10 solid core. */
.sav-dot-ok, .sav-dot-error, .sav-dot-warn, .sav-dot-off {
  position: relative; display: inline-block;
}
.sav-dot-ok::before, .sav-dot-error::before, .sav-dot-warn::before, .sav-dot-off::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: currentColor; opacity: 0.1;
}
.sav-dot-ok::after, .sav-dot-error::after, .sav-dot-warn::after, .sav-dot-off::after {
  content: ''; position: absolute; inset: 20%; border-radius: 50%;
  background: currentColor;
}
.sav-dot-ok { color: var(--dsw-alias-state-success-primary, rgb(34, 197, 94)); }
.sav-dot-error { color: var(--dsw-alias-state-error-primary, rgb(236, 19, 19)); }
.sav-dot-warn { color: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11)); }
.sav-dot-off { color: var(--dsw-alias-label-tertiary, #cbd5e1); }
.sav-row-label {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; line-height: 18px;
}
.sav-row-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 2px; padding-left: 22px;
}
.sav-row-time {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
}
.sav-row-meta {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, #a3aec2); font-size: 11px; line-height: 16px;
}
.sav-row-open { flex: none; }
.sav-panel-footer {
  flex: none; display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06));
}
.sav-panel-stats {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8); font-size: 11px;
  font-variant-numeric: tabular-nums;
  display: flex; align-items: center;
}
.sav-btn {
  flex: none;
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.12));
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  border-radius: 6px; padding: 1px 8px; font-size: 11px; line-height: 16px;
  cursor: pointer; font-family: inherit;
}
.sav-btn:hover {
  border-color: var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.3));
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sav-back { color: var(--dsw-alias-brand-primary, #2563eb); border-color: var(--dsw-alias-brand-primary, #2563eb); }
/* ---- canonical disclosure tree (shared by the sidebar panel "sav" and the
   Subagents tab "sat") — faithful port of the authority visual from
   @deepseek-ai/dsh-client-ui-subagent: a chevron-right ">" to the left of
   rows that have children (it rotates 90° to point downward when the branch
   expands) plus gray "L"-shape guide lines marking parent-child links. ----
   Geometry: row cards are padded 11px left, so the 14px chevron's center
   sits at x=18px; each child level is offset 22px (18px margin + 4px
   padding) and its rows carry the guide lines through the parent's chevron
   column (x=-4px relative to the node) with a 14px horizontal tick reaching
   each child's chevron (top:16px = its vertical center). */
.sav-disclosure, .sat-disclosure {
  flex: none; align-self: flex-start;
  width: 14px; height: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; padding: 0; background: transparent;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  cursor: pointer;
  transition: transform 120ms var(--ds-ease-in-out, ease-in-out);
}
.sav-disclosure:hover, .sat-disclosure:hover { color: var(--dsw-alias-label-primary, inherit); }
.sav-disclosure-open, .sat-disclosure-open { transform: rotate(90deg); }
.sav-disclosure-space, .sat-disclosure-space {
  flex: none; align-self: flex-start;
  width: 14px; height: 18px;
}
.sav-node, .sat-node {
  position: relative; min-width: 0;
  display: flex; flex-direction: column;
}
.sav-children, .sat-children {
  position: relative;
  margin-left: 18px; padding-left: 4px;
  display: flex; flex-direction: column; gap: 6px;
}
/* Vertical guide line through the parent's chevron column: one per child,
   spanning its whole subtree. The 6px downward overhang bridges the inter-row
   gap so the line stays continuous; the last sibling stops at its tick. */
.sav-children > .sav-node::before, .sat-children > .sat-node::before {
  content: ''; position: absolute; top: 0; bottom: -6px; left: -4px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
}
.sav-children > .sav-node:last-child::before, .sat-children > .sat-node:last-child::before {
  height: 17px; bottom: auto;
}
/* Horizontal tick from the parent's line into each child row's chevron. */
.sav-children > .sav-node > .sav-row::before, .sat-children > .sat-node > .sat-row::before {
  content: ''; position: absolute; top: 16px; left: -4px; width: 14px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
}
/* Vertical bridge from an expanded parent's chevron down to its children:
   spans the rest of the row card, so rows of any height stay connected. */
.sav-node > .sav-row.sav-row-branch-open::after, .sat-node > .sat-row.sat-row-branch-open::after {
  content: ''; position: absolute; top: 24px; bottom: -1px; left: 18px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
}
/* ---- Archived folder (shared by the sidebar panel "sav" and the Subagents
   tab "sat") ---- a disclosure-style header whose chevron sits on the same
   x=18px column as row chevrons, with the folder body indented like a
   children block and a guide-line bridge from the open header down to it. */
.sav-folder, .sat-folder {
  flex: none; display: flex; flex-direction: column;
}
.sav-folder-header, .sat-folder-header {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  width: 100%;
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  /* 11px left pad + 14px chevron box puts the chevron center at x=18px. */
  padding: 7px 8px 7px 11px;
  font-family: inherit; font-size: 12px; line-height: 18px;
  color: var(--dsw-alias-label-primary, inherit);
  cursor: pointer; text-align: left;
}
.sav-folder-header:hover, .sat-folder-header:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sav-folder-chevron, .sat-folder-chevron {
  flex: none; width: 14px; height: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  transition: transform 120ms var(--ds-ease-in-out, ease-in-out);
}
.sav-folder-chevron-open, .sat-folder-chevron-open { transform: rotate(90deg); }
.sav-folder-icon, .sat-folder-icon {
  flex: none; width: 14px; height: 14px;
  color: var(--dsw-alias-label-secondary, #64748b);
}
.sav-folder-label, .sat-folder-label { flex: none; font-weight: 600; }
.sav-folder-count, .sat-folder-count {
  flex: none; min-width: 16px; text-align: center;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
}
.sav-folder-body, .sat-folder-body {
  display: flex; flex-direction: column; gap: 6px;
  margin-left: 18px; padding-left: 4px;
}
/* Guide-line bridge from the open folder header's chevron down to the body. */
.sav-folder-open::after, .sat-folder-open::after {
  content: ''; position: absolute; top: 24px; bottom: -1px; left: 18px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
}
/* ---- Subagents tab (conversation.view) ---- */
.sat-root {
  display: flex; flex-direction: column; gap: 8px;
  width: 100%; min-width: 0; height: 100%; min-height: 0;
  font-family: var(--dsw-font-family, inherit);
  font-size: 12px;
  color: var(--dsw-alias-label-primary, inherit);
}
.sat-crumbs {
  flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
}
.sat-crumb { font-size: 12px; line-height: 18px; }
.sat-crumb-link {
  border: none; background: transparent; padding: 0; cursor: pointer;
  color: var(--dsw-alias-brand-primary, #2563eb);
  font-family: inherit; font-size: 12px; line-height: 18px;
}
.sat-crumb-link:hover { text-decoration: underline; }
.sat-crumb-current {
  color: var(--dsw-alias-label-primary, inherit);
  font-weight: 600;
}
.sat-crumb-sep { color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sat-summary {
  flex: none; display: flex; flex-direction: column; gap: 6px;
  padding: 8px 10px;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
}
.sat-sum-cells { display: flex; align-items: center; gap: 20px; }
.sat-sum-cell { display: inline-flex; align-items: center; gap: 6px; }
.sat-sum-num {
  font-size: 24px; line-height: 28px; font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, inherit);
}
.sat-sum-caption {
  font-size: 11px; line-height: 16px;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
}
.sat-sum-bar { display: flex; align-items: center; gap: 10px; }
.sat-proportion {
  flex: 1; min-width: 0; height: 6px; border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1, rgba(15, 23, 42, 0.06));
  display: flex; overflow: hidden;
}
.sat-prop-seg { height: 100%; }
.sat-prop-running { background: var(--dsw-static-deepseek-450, rgb(86, 134, 254)); }
.sat-prop-done { background: var(--dsw-alias-state-success-primary, rgb(34, 197, 94)); }
.sat-prop-failed { background: var(--dsw-alias-state-error-primary, rgb(236, 19, 19)); }
.sat-sum-total {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
}
.sat-sum-totals {
  color: var(--dsw-alias-label-secondary, #64748b);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
}
.sat-metrics {
  flex: none; display: flex; flex-direction: column; align-items: flex-end;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
  white-space: nowrap;
}
.sat-metric-token { color: var(--dsw-alias-label-secondary, #64748b); }
.sat-metric-duration { color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sat-tree {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  padding: 4px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(15, 23, 42, 0.15));
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(15, 23, 42, 0.25));
}
.sat-empty { flex: 1; padding: 24px 12px; text-align: center; color: var(--dsw-alias-label-tertiary, #94a3b8); }
.sat-row {
  position: relative; flex: none;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
  /* 11px left pad + 14px disclosure box puts the chevron center at x=18px,
     the column the tree guide lines run through. */
  padding: 7px 8px 7px 11px;
}
.sat-row-current {
  /* Inset accent instead of a thicker border: keeps the content box (and the
     chevron guide column) aligned with every other row. */
  box-shadow: inset 3px 0 0 var(--dsw-alias-brand-primary, #2563eb);
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sat-row-main { display: flex; align-items: center; gap: 6px; }
.sat-label {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 600; font-size: 12px; line-height: 18px;
}
.sat-provider-chip {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-size: 11px; line-height: 16px; white-space: nowrap;
}
.sat-mode-chip {
  flex: none; font-size: 10px; line-height: 16px; padding: 0 6px;
  border-radius: 999px; border: 1px solid; white-space: nowrap;
}
.sat-mode-chip-brand {
  color: var(--dsw-alias-brand-primary, #2563eb);
  border-color: var(--dsw-alias-brand-primary, #2563eb);
}
.sat-mode-chip-neutral {
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  border-color: var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.12));
}
.sat-duration {
  flex: none; color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px;
  white-space: nowrap;
}
.sat-row-actions { flex: none; display: inline-flex; gap: 2px; }
.sat-row-btn {
  flex: none; width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.12));
  background: transparent; color: var(--dsw-alias-label-tertiary, #94a3b8);
  border-radius: 6px; font-size: 12px; line-height: 1; cursor: pointer;
  font-family: inherit;
}
.sat-row-btn:hover {
  border-color: var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.3));
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sat-purpose {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-size: 11px; line-height: 16px;
  margin-top: 2px; padding-left: 22px;
}
.sat-popover {
  position: absolute; right: 8px; top: 100%; z-index: 20;
  margin-top: 4px; min-width: 240px; max-width: 320px;
  background: var(--dsw-alias-bg-base, #ffffff);
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.08));
  border-radius: 8px;
  box-shadow: var(--dsw-shadow-lv2, 0 8px 24px rgba(15, 23, 42, 0.12));
  padding: 6px 8px;
}
.sat-pop-div {
  margin: 4px 0;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06));
}
.sat-pop-row { display: flex; gap: 8px; }
.sat-pop-key {
  flex: none; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px; line-height: 18px;
  color: var(--dsw-alias-label-primary, inherit);
}
.sat-pop-value {
  flex: 1; min-width: 0; word-break: break-all;
  font-size: 11px; line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
}
/* Status dots: pixel-chase running + terminal-core states (sat prefix). */
.sat-dot { width: 10px; height: 10px; flex: none; }
.sat-dot-running { color: var(--dsw-static-deepseek-450, rgb(86, 134, 254)); }
.sat-dot-cell { fill: currentColor; opacity: 0.15; animation: sat-dot-chase 1s infinite; }
@keyframes sat-dot-chase {
  0%, 12.4% { opacity: 1; }
  12.5%, 24.9% { opacity: 0.6; }
  25%, 37.4% { opacity: 0.35; }
  37.5%, 100% { opacity: 0.15; }
}
.sat-dot-ok, .sat-dot-error, .sat-dot-warn, .sat-dot-off {
  position: relative; display: inline-block;
}
.sat-dot-ok::before, .sat-dot-error::before, .sat-dot-warn::before, .sat-dot-off::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: currentColor; opacity: 0.1;
}
.sat-dot-ok::after, .sat-dot-error::after, .sat-dot-warn::after, .sat-dot-off::after {
  content: ''; position: absolute; inset: 20%; border-radius: 50%;
  background: currentColor;
}
.sat-dot-ok { color: var(--dsw-alias-state-success-primary, rgb(34, 197, 94)); }
.sat-dot-error { color: var(--dsw-alias-state-error-primary, rgb(236, 19, 19)); }
.sat-dot-warn { color: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11)); }
.sat-dot-off { color: var(--dsw-alias-label-tertiary, #cbd5e1); }
`;
				document.head.appendChild(tag);
				return () => {
					tag.remove();
				};
			}, "subagent-view: styles");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "subagent-view",
				order: 100,
				inject: () => ({ toggleSidebar: () => ctx.layout.toggleSidebar() })
			}, SubagentViewBarPanel));
			const sessions = ctx.sessions;
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "subagent-view",
				order: 30,
				label: "Subagents",
				inject: (_sessionId) => ({
					open: (id) => sessions.open(id),
					openSubagent: (address) => sessions.openSubagent(address)
				})
			}, SubagentsView));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
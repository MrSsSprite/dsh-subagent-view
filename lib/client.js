window.__ModuleLoader__.load({
	id: "subagent-view",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
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
			hidden: []
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
			const visible = monitor.rows.filter((row) => !monitor.hidden.includes(row.id));
			const running = visible.filter((row) => row.status === "running").length;
			const done = visible.filter((row) => row.status === "completed").length;
			const failed = visible.filter((row) => row.status === "error" || row.status === "aborted" || row.status === "max-tokens" || row.status === "refusal").length;
			const openChild = (row) => {
				if (sessionsSvc === void 0 || monitor.sessionId === void 0 || row.mode === void 0) return;
				const address = {
					parentSessionId: monitor.sessionId,
					childSessionId: row.id,
					mode: row.mode
				};
				sessionsSvc.openSubagent(address);
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
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "sav-rows",
							children: visible.map((row) => {
								const meta = STATUS$1[row.status] ?? UNKNOWN$1;
								const elapsed = row.status === "running" ? fmtDuration$1(row.startedAt, state$1.now) : fmtDuration$1(row.startedAt, row.endedAt);
								const depth = typeof row.depth === "number" ? row.depth : 1;
								const indent = Math.max(0, depth - 1) * 14;
								const modeText = row.mode === "continuable" ? "continuable" : row.mode === "one-shot" ? "one-shot" : "";
								const metaLine = [
									row.provider,
									modeText,
									shortId$1(row.id)
								].filter((value) => typeof value === "string" && value !== "").join(" · ");
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "sav-row",
									style: { marginLeft: indent },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "sav-row-main",
										children: [
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
								}, row.id);
							})
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
									onClick: () => {
										const hidden = [...state$1.hidden];
										for (const row of state$1.rows) if (row.status !== "running" && !hidden.includes(row.id)) hidden.push(row.id);
										commit$1({ hidden });
									},
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
		* subagent tree. The tab polls the host half's `/api/subagent-view/tab`
		* route once per second while mounted, so a page refresh recovers the whole
		* forest without any model interaction. All styling lives in the single
		* `<style data-plugin="subagent-view">` tag in src/client/index.ts.
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
		function DetailsBlock({ row }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dl", {
				className: "sat-details",
				children: detailsFields(row).map(([key, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: key }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: value })] }, key))
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
		function RawPopover({ row }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "sat-popover",
				children: rawFields(row).map(([key, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "sat-pop-row",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "sat-pop-key",
						children: [key, ":"]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sat-pop-value",
						children: value
					})]
				}, key))
			});
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
			const [detailsOpen, setDetailsOpen] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [rawOpen, setRawOpen] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const { ancestors, rows, now } = tab;
			const running = rows.filter((row) => row.status === "running").length;
			const done = rows.filter((row) => row.status === "completed").length;
			const failed = rows.filter((row) => row.status === "error" || row.status === "aborted" || row.status === "max-tokens" || row.status === "refusal").length;
			const total = rows.length;
			const pct = (count) => total === 0 ? 0 : Math.round(count / total * 100);
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
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
						})]
					}),
					rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "sat-empty",
						children: "No subagent activity in this session"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "sat-tree",
						children: rows.map((row) => {
							const depth = typeof row.depth === "number" ? row.depth : 0;
							const indent = Math.max(0, depth) * 14;
							const label = rowLabel(row);
							const elapsed = row.status === "running" ? fmtDuration(row.startedAt, now) : fmtDuration(row.startedAt, row.endedAt);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `sat-row${row.isCurrent ? " sat-row-current" : ""}`,
								style: { marginLeft: indent },
								children: [
									indent > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "sat-row-guide",
										"aria-hidden": "true"
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "sat-row-main",
										children: [
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
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "sat-duration",
												children: elapsed
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "sat-row-actions",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "sat-row-btn",
													type: "button",
													title: "Details",
													onClick: () => setDetailsOpen((prev) => toggleMember(prev, row.id)),
													children: "ⓘ"
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "sat-row-btn",
													type: "button",
													title: "Raw fields",
													onClick: () => setRawOpen((prev) => toggleMember(prev, row.id)),
													children: "…"
												})]
											})
										]
									}),
									typeof row.purpose === "string" && row.purpose !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "sat-purpose",
										title: row.purpose,
										children: row.purpose
									}) : null,
									detailsOpen.has(row.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DetailsBlock, { row }) : null,
									rawOpen.has(row.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RawPopover, { row }) : null
								]
							}, row.id);
						})
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
  height: min(60vh, 480px); min-height: 240px;
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
  flex: none;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.07));
  border-radius: 8px;
  padding: 6px 8px;
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
  margin-top: 2px; padding-left: 18px;
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
  padding: 6px 8px;
}
.sat-row-current {
  border-left: 3px solid var(--dsw-alias-brand-primary, #2563eb);
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.04));
}
.sat-row-guide {
  position: absolute; top: 0; bottom: 0; left: -7px; width: 1px;
  background: var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.10));
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
  margin-top: 2px; padding-left: 16px;
}
.sat-details {
  display: grid; grid-template-columns: max-content 1fr;
  column-gap: 12px; row-gap: 2px;
  margin: 6px 0 0; padding: 6px 8px 0;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06));
}
.sat-details dt, .sat-details dd {
  font-size: 12px; line-height: 18px; margin: 0;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  font-weight: 400;
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
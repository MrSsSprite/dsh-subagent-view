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
		const listeners = /* @__PURE__ */ new Set();
		let state = {
			sessionId: void 0,
			now: Date.now(),
			rows: [],
			open: false,
			hidden: []
		};
		let autoOpened = false;
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
		const useMonitor = () => (0, react.useSyncExternalStore)(subscribe, getSnapshot);
		async function refresh(sessionId) {
			try {
				const data = await (await fetch(`/api/subagent-view/snapshot?sessionId=${encodeURIComponent(sessionId)}`)).json();
				if (data.sessionId !== state.sessionId) return;
				commit({
					rows: data.rows ?? [],
					now: data.now ?? Date.now()
				});
			} catch {}
		}
		let sessionsSvc;
		function setSessionsService(service) {
			sessionsSvc = service;
		}
		const UNKNOWN = {
			cls: "sav-dot-off",
			label: "Ended"
		};
		const STATUS = {
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
				className: "sav-dot sav-dot-running",
				width: 10,
				height: 10,
				viewBox: "0 0 10 10",
				shapeRendering: "crispEdges",
				"aria-hidden": "true",
				children: CHASE_CELLS.map(([x, y], index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					className: "sav-dot-cell",
					x,
					y,
					width: "2",
					height: "2",
					style: { animationDelay: `${(index - CHASE_CELLS.length) * 125}ms` }
				}, `${x}-${y}`))
			});
			const meta = STATUS[status] ?? UNKNOWN;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `sav-dot ${meta.cls}`,
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
		function rowLabel(row) {
			if (typeof row.label === "string" && row.label !== "") return row.label;
			if (typeof row.provider === "string" && row.provider !== "") return `[${row.provider}] subagent`;
			return `subagent ${shortId(row.id)}`;
		}
		const MOBILE_QUERY = "(max-width: 768px)";
		function SubagentViewBarPanel(props) {
			const { wide, toggleSidebar } = props;
			const monitor = useMonitor();
			const current = props.useSessions((select) => select.current);
			const subagentParent = props.useSessions((select) => select.currentAddress === void 0 ? void 0 : select.currentAddress.parentSessionId);
			(0, react.useEffect)(() => {
				if (current === void 0) {
					if (state.sessionId !== void 0) commit({
						sessionId: void 0,
						rows: []
					});
					return;
				}
				if (current !== state.sessionId) {
					commit({ sessionId: current });
					refresh(current);
				}
			}, [current]);
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
			(0, react.useEffect)(() => {
				if (autoOpened) return;
				autoOpened = true;
				if (!window.matchMedia(MOBILE_QUERY).matches) commit({ open: true });
			}, []);
			(0, react.useEffect)(() => {
				if (!wide) commit({ open: false });
			}, [wide]);
			const visible = [...monitor.rows].sort((a, b) => {
				const ka = a.startedAt ?? a.sortKey ?? Number.NEGATIVE_INFINITY;
				return (b.startedAt ?? b.sortKey ?? Number.NEGATIVE_INFINITY) - ka;
			}).filter((row) => !monitor.hidden.includes(row.id));
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
					commit({ open: true });
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
			const stats = `${running} running · ${done} done · ${failed} failed`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "sav-root",
				children: [monitor.open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "sav-panel",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "sav-panel-header",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "sav-panel-title",
									children: "Subagents"
								}),
								subagentParent !== void 0 && sessionsSvc !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "sav-btn sav-back",
									type: "button",
									title: "Back to main session",
									onClick: () => sessionsSvc?.open(subagentParent),
									children: "← Main session"
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sav-panel-spacer" }),
								running > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "sav-panel-running",
									children: [running, " running"]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "sav-btn",
									type: "button",
									title: "Collapse panel",
									onClick: () => commit({ open: false }),
									children: "▴"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "sav-btn",
									type: "button",
									title: "Close panel",
									onClick: () => commit({ open: false }),
									children: "✕"
								})
							]
						}),
						visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "sav-empty",
							children: monitor.sessionId === void 0 ? "No session selected" : "No subagent activity in this session"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "sav-rows",
							children: visible.map((row) => {
								const meta = STATUS[row.status] ?? UNKNOWN;
								const elapsed = row.status === "running" ? fmtDuration(row.startedAt, state.now) : fmtDuration(row.startedAt, row.endedAt);
								const depth = typeof row.depth === "number" ? row.depth : 1;
								const indent = Math.max(0, depth - 1) * 14;
								const modeText = row.mode === "continuable" ? "continuable" : row.mode === "one-shot" ? "one-shot" : "";
								const metaLine = [
									row.provider,
									modeText,
									shortId(row.id)
								].filter((value) => typeof value === "string" && value !== "").join(" · ");
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "sav-row",
									style: { marginLeft: indent },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "sav-row-main",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, { status: row.status }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "sav-row-label",
												title: rowLabel(row),
												children: rowLabel(row)
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
									children: stats
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sav-panel-spacer" }),
								monitor.hidden.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "sav-btn",
									type: "button",
									onClick: () => commit({ hidden: [] }),
									children: `Show hidden (${monitor.hidden.length})`
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "sav-btn",
									type: "button",
									onClick: () => {
										const hidden = [...state.hidden];
										for (const row of state.rows) if (row.status !== "running" && !hidden.includes(row.id)) hidden.push(row.id);
										commit({ hidden });
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
					onClick: () => commit({ open: !state.open }),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sav-bar-label",
							children: "Subagents"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sav-bar-stats",
							children: stats
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
}
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
}
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
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
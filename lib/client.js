window.__ModuleLoader__.load({
	id: "dsh-workspace-groups",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/store-core.ts
		/** Collapse writes `false` (key retained); expand writes `true`. */
		function setCategoryExpandedImpl(state, key, expanded) {
			state.categoryExpansion[key] = expanded;
		}
		/** Collapse writes `false` (key retained); expand writes `true`. */
		function setWorkspaceExpandedImpl(state, key, expanded) {
			state.workspaceExpansion[key] = expanded;
		}
		/** Drop expansion keys that no longer exist (renames/deletes/config edits). */
		function retainKeysImpl(state, categoryKeys, workspaceKeys) {
			state.categoryExpansion = Object.fromEntries(Object.entries(state.categoryExpansion).filter(([key]) => categoryKeys.includes(key)));
			state.workspaceExpansion = Object.fromEntries(Object.entries(state.workspaceExpansion).filter(([key]) => workspaceKeys.includes(key)));
		}
		//#endregion
		//#region src/client/stores.ts
		/**
		* The workspace-groups viewing store: category / workspace folder expansion,
		* persisted across reloads under an independent key (the official
		* ui-workspace store keeps its own `dsh.workspace.view.v5` — we never touch
		* it). Module level exports the factory only (a module-level handle would pin
		* the store identity across plugin reloads); register() receives the factory
		* and the browser derives its PropsStore share from the return type.
		*
		* The action implementations live in `store-core.ts` (pure, runtime-free) so
		* unit tests exercise the real semantics without a browser module loader;
		* this file only binds them through defineStore.
		*/
		/**
		* Create the workspace-groups viewing store handle.
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createGroupsViewStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					categoryExpansion: {},
					workspaceExpansion: {}
				}),
				persist: "dsh.workspace.groups.view.v1",
				actions: {
					setCategoryExpanded: setCategoryExpandedImpl,
					setWorkspaceExpanded: setWorkspaceExpandedImpl,
					retainKeys: retainKeysImpl
				}
			});
		}
		//#endregion
		//#region src/core/types.ts
		/** The label of the fallback bucket for unmatched workspaces. */
		const UNCATEGORIZED_LABEL = "未分类";
		/** Normalize a path for prefix matching: trailing slashes stripped. */
		function normalizePath(path) {
			return path.replace(/[/\\]+$/, "");
		}
		//#endregion
		//#region src/core/matcher.ts
		/**
		* Pure classification logic: decides which category a workspace belongs to.
		* Shared by the host half (validation) and the client half (tree derivation),
		* so the rule semantics can never drift between the config surface and the
		* rendered tree.
		*/
		/** One rule match against a workspace's path and title. */
		function ruleMatches(rule, path, title) {
			const normalized = normalizePath(path);
			if (rule.pathPrefix !== void 0 && normalized.startsWith(normalizePath(rule.pathPrefix))) return true;
			if (rule.pathExact !== void 0 && normalized === normalizePath(rule.pathExact)) return true;
			if (rule.nameContains !== void 0 && title.toLowerCase().includes(rule.nameContains.toLowerCase())) return true;
			if (rule.basenameContains !== void 0) {
				if ((path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? "").toLowerCase().includes(rule.basenameContains.toLowerCase())) return true;
			}
			return false;
		}
		/**
		* Classify a workspace into its category.
		* @param categories - configured categories, in render order.
		* @param path - workspace canonical directory path.
		* @param title - workspace display title.
		* @returns the matching category, or undefined when no rule matches.
		*/
		function classify(categories, path, title) {
			for (const category of categories) if (category.rules.some((rule) => ruleMatches(rule, path, title))) return category;
		}
		//#endregion
		//#region src/client/tree.ts
		/**
		* Derives the three-level workspace-groups tree: 分类文件夹 → 项目文件夹 →
		* 会话行. Pure derivation — all inputs are snapshots; the renderer never
		* scans. Session visibility rules mirror the official ui-workspace tree
		* (blank rows only when current, archived excluded, subagent rows excluded).
		*/
		/** Key of the uncategorized bucket (matches the config fallback label). */
		const UNCATEGORIZED_KEY = UNCATEGORIZED_LABEL;
		/** Directory display label: basename of the path (both separators accepted). */
		function workspaceLabel(cwd) {
			if (cwd === void 0 || cwd === "") return UNCATEGORIZED_LABEL;
			const base = cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
			return base !== void 0 && base !== "" ? base : cwd;
		}
		/** Ordinary sessions are visible; blank only when current; archived/subagent never. */
		function sessionVisible(session, current, archived) {
			return session.origin !== "subagent" && !archived.has(session.id) && (!session.blank || session.id === current);
		}
		/** Blank rows display the localized New Session label (never enters search). */
		function sessionTitle(session) {
			return session.blank ? "New Session" : session.displayTitle;
		}
		function sessionNode(s, descendants) {
			return {
				id: s.id,
				title: sessionTitle(s),
				blank: s.blank,
				running: s.running,
				runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
				completed: s.completed === true,
				updatedAt: s.updatedAt,
				...s.pendingInteraction === void 0 ? {} : { pendingInteraction: s.pendingInteraction }
			};
		}
		/** Visible sessions of one workspace in its stored account order. */
		function workspaceSessions(list, workspace, archived, descendants) {
			const nodes = [];
			for (const id of workspace.sessionIds) {
				const summary = list.byId[id];
				if (summary === void 0) continue;
				if (!sessionVisible(summary, list.current, archived)) continue;
				nodes.push(sessionNode(summary, descendants));
			}
			return nodes;
		}
		/**
		* Derive the three-level tree.
		* @param list - sessions list snapshot (`current` feeds containsCurrent).
		* @param workspaces - real workspaces in stable Host order.
		* @param archivedSessionIds - registry-global archive set.
		* @param config - sidecar grouping config.
		* @param view - local expansion arrays.
		* @returns category sections in render order (configured categories first, uncategorized last).
		*/
		function deriveGroups(list, workspaces, archivedSessionIds, config, view) {
			const archived = new Set(archivedSessionIds);
			const expandedCategories = new Set(view.expandedCategories);
			const expandedWorkspaces = new Set(view.expandedWorkspaces);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const byCategory = /* @__PURE__ */ new Map();
			const categorized = /* @__PURE__ */ new Set();
			for (const category of config.categories) byCategory.set(category.name, []);
			for (const workspace of workspaces) {
				const category = classify(config.categories, workspace.path, workspace.title);
				const key = category !== void 0 ? category.name : UNCATEGORIZED_KEY;
				if (!byCategory.has(key)) byCategory.set(key, []);
				byCategory.get(key).push(workspace);
				categorized.add(workspace.workspaceId);
			}
			const currentWorkspaceId = list.current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(list.current))?.workspaceId;
			const nodes = [];
			for (const [key, bucket] of byCategory) {
				if (bucket.length === 0) continue;
				const expanded = expandedCategories.has(key);
				const workspaceNodes = [];
				let containsCurrent = false;
				for (const workspace of bucket) {
					const sessions = workspaceSessions(list, workspace, archived, descendants);
					const wsExpanded = expandedWorkspaces.has(workspace.workspaceId);
					const wsContainsCurrent = workspace.workspaceId === currentWorkspaceId;
					if (wsContainsCurrent) containsCurrent = true;
					workspaceNodes.push({
						workspaceId: workspace.workspaceId,
						path: workspace.path,
						label: workspace.title,
						createdAt: Date.parse(workspace.createdAt),
						sessionCount: sessions.length,
						expanded: wsExpanded,
						containsCurrent: wsContainsCurrent,
						sessions: wsExpanded ? sessions : []
					});
				}
				nodes.push({
					key,
					label: key === UNCATEGORIZED_KEY ? UNCATEGORIZED_LABEL : key,
					expanded,
					containsCurrent,
					workspaces: workspaceNodes
				});
			}
			return nodes;
		}
		/** Recency comparator: newest first, id as the deterministic tiebreak. */
		function byRecency(a, b) {
			if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
			return a.id < b.id ? -1 : 1;
		}
		/**
		* Compute the matched-session set: immediate title/Workspace substring matches
		* from the local list, merged with ranked Host content matches. The consumer
		* (SearchBody) derives the pruned three-level tree from these ids.
		*/
		function deriveSearchMatches(list, workspaces, config, query, archivedSessionIds, content, limit) {
			const q = query.trim().toLowerCase();
			if (q === "") return {
				matchedIds: /* @__PURE__ */ new Set(),
				snippetsBySession: /* @__PURE__ */ new Map(),
				hasMore: false
			};
			const archived = new Set(archivedSessionIds);
			(0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const workspaceBySession = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) for (const sessionId of workspace.sessionIds) if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace);
			const labelOf = (summary) => workspaceBySession.get(summary.id)?.title ?? workspaceLabel(summary.cwd);
			const local = [];
			for (const id of list.ids) {
				const summary = list.byId[id];
				if (summary === void 0 || summary.blank || !sessionVisible(summary, list.current, archived)) continue;
				if (sessionTitle(summary).toLowerCase().includes(q) || labelOf(summary).toLowerCase().includes(q)) local.push(summary);
			}
			local.sort(byRecency);
			const ordered = [];
			const included = /* @__PURE__ */ new Set();
			const include = (summary) => {
				if (included.has(summary.id)) return;
				included.add(summary.id);
				ordered.push(summary);
			};
			for (const summary of local) include(summary);
			for (const item of content.items) {
				const summary = list.byId[item.sessionId];
				if (summary !== void 0 && !summary.blank && sessionVisible(summary, list.current, archived)) include(summary);
			}
			const snippets = /* @__PURE__ */ new Map();
			for (const item of content.items) if (item.snippet !== void 0) snippets.set(item.sessionId, item.snippet);
			return {
				matchedIds: ordered.slice(0, limit).reduce((set, summary) => {
					set.add(summary.id);
					return set;
				}, /* @__PURE__ */ new Set()),
				snippetsBySession: snippets,
				hasMore: content.hasMore || ordered.length > limit
			};
		}
		/**
		* Build a three-level search tree containing ONLY the branches that hold a
		* matched session: 分类文件夹 → 项目文件夹 → 命中会话行. Every matched
		* session carries `matched: true` so rows render with the search-hit tint.
		*
		* @param list - sessions list snapshot.
		* @param workspaces - real workspaces in stable Host order.
		* @param config - sidecar grouping config.
		* @param matchedIds - set of session ids that matched the query.
		* @param archivedSessionIds - registry-global archive set.
		* @param snippetsBySession - optional content-match snippets keyed by session id.
		* @returns categories in render order, pruned to matched branches only.
		*/
		function deriveSearchGroups(list, workspaces, config, matchedIds, archivedSessionIds, snippetsBySession) {
			const archived = new Set(archivedSessionIds);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const byCategory = /* @__PURE__ */ new Map();
			for (const category of config.categories) byCategory.set(category.name, []);
			for (const workspace of workspaces) {
				const nodes = [];
				for (const id of workspace.sessionIds) {
					const summary = list.byId[id];
					if (summary === void 0 || !matchedIds.has(id)) continue;
					if (!sessionVisible(summary, list.current, archived)) continue;
					const node = sessionNode(summary, descendants);
					const snippet = snippetsBySession?.get(id);
					nodes.push({
						...node,
						matched: true,
						...snippet === void 0 ? {} : { snippet }
					});
				}
				if (nodes.length === 0) continue;
				const category = classify(config.categories, workspace.path, workspace.title);
				const key = category !== void 0 ? category.name : UNCATEGORIZED_KEY;
				if (!byCategory.has(key)) byCategory.set(key, []);
				byCategory.get(key).push({
					workspaceId: workspace.workspaceId,
					path: workspace.path,
					label: workspace.title,
					createdAt: Date.parse(workspace.createdAt),
					sessionCount: nodes.length,
					expanded: true,
					containsCurrent: false,
					sessions: nodes
				});
			}
			const categories = [];
			for (const [key, workspaceNodes] of byCategory) {
				if (workspaceNodes.length === 0) continue;
				categories.push({
					key,
					label: key === UNCATEGORIZED_KEY ? UNCATEGORIZED_LABEL : key,
					expanded: true,
					containsCurrent: false,
					workspaces: workspaceNodes
				});
			}
			return categories;
		}
		//#endregion
		//#region src/client/rows.tsx
		/**
		* Row components for the workspace-groups tree. Kept dependency-light: they
		* consume only React, primitives (StateDot/Menu/icons), and the shared CSS
		* string. Each row owns its hover actions menu; dialogs live in the browser
		* root so they survive row unmounts during collapse.
		*/
		/** Pending interaction status → primitives StateDot state. */
		function pendingState(status) {
			switch (status) {
				case "approval":
				case "plan-review":
				case "question": return "warning";
				default: return;
			}
		}
		/** Primary status dot state for a session row. */
		function sessionDotState(node) {
			if (pendingState(node.pendingInteraction) !== void 0) return "warning";
			if (node.running || node.runningSubagentCount > 0) return "ongoing";
			return node.completed ? "done" : "done";
		}
		/** Compact relative time ("now"/"5min"/"3h"/"2d"/"4mo"/"1y"). */
		function relativeTimeLabel(updatedAt, now) {
			const diff = Math.max(0, now - updatedAt);
			const MIN = 6e4;
			const HOUR = 36e5;
			const DAY = 864e5;
			if (diff < MIN) return "now";
			if (diff < HOUR) return `${Math.floor(diff / MIN)}min`;
			if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
			if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d`;
			if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}mo`;
			return `${Math.floor(diff / (365 * DAY))}y`;
		}
		/** One category folder row. */
		function CategoryRow({ node, t, onToggle }) {
			const count = node.workspaces.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wgCategoryRow",
				role: "treeitem",
				"aria-expanded": node.expanded,
				"aria-label": t("section.workspaces"),
				onClick: onToggle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFill14, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryIcon",
						children: node.expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryLabel",
						children: node.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryCount",
						children: count
					})
				]
			});
		}
		/** One workspace folder row inside a category. */
		function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete }) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const menuItems = [{
				id: "rename",
				label: t("workspace.rename"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {})
			}, {
				id: "delete",
				label: t("workspace.delete"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}),
				danger: true
			}];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgProjectRow${node.containsCurrent ? " wgProjectActive" : ""}`,
				role: "treeitem",
				"aria-expanded": node.expanded,
				onClick: onToggle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFill14, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryIcon",
						children: node.expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgProjectLabel",
						title: node.path,
						children: node.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowActions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: menuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								if (id === "rename") onRename();
								if (id === "delete") onDelete();
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								"aria-label": `${t("workspace.rename")} ${node.label}`,
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutline16, {})
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "wgIconButton",
							"aria-label": `${t("session.new")} ${node.label}`,
							onClick: (e) => {
								e.stopPropagation();
								onNewSession();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, {})
						})]
					})
				]
			});
		}
		/** One session leaf row. */
		function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive }) {
			const selected = node.id === currentId;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const menuItems = [
				{
					id: "rename",
					label: t("session.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {})
				},
				{
					id: "fork",
					label: t("session.fork"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, {})
				},
				{
					id: "archive",
					label: t("session.archive"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, { size: 16 })
				}
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgSessionRow${selected ? " wgSelected" : ""}${node.matched === true ? " wgMatched" : ""}`,
				role: "treeitem",
				"aria-selected": selected,
				onClick: () => {
					onOpen(node.id);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgStatusSlot",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: sessionDotState(node) })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgSessionTitle",
						children: node.title
					}),
					!node.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgSessionTime",
						children: relativeTimeLabel(node.updatedAt, now)
					}),
					node.snippet !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgSessionSnippet",
						title: node.snippet,
						children: node.snippet
					}),
					!node.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgRowActions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: menuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								if (id === "rename") onRename(node.id, node.title);
								if (id === "fork") onFork(node.id);
								if (id === "archive") onArchive(node.id);
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								"aria-label": `${t("session.rename")} ${node.title}`,
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutline16, {})
							})
						})
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-workspace-groups-inline-css:/Users/zcol/Project/dsh-workspace-groups/src/client/styles.css.mjs
		var styles_css_default = ".wgRoot{flex-direction:column;flex:1;min-height:0;display:flex}.wgSectionHeader{flex:none;align-items:center;gap:4px;height:36px;padding:0 12px;display:flex}.wgSectionLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:45%;color:var(--dsw-fg-1,inherit);flex:none;font-size:12px;font-weight:600;overflow:hidden}.wgIconButton{width:26px;height:26px;color:var(--dsw-fg-2,inherit);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}.wgIconButton:hover{background:var(--dsw-bg-hover,#7f7f7f1f);color:var(--dsw-fg-1,inherit)}.wgIconButton:disabled{opacity:.5;cursor:default}.wgSearch{flex:1;align-items:center;min-width:0;max-width:28px;margin-left:auto;transition:max-width .18s;display:flex}.wgSearchExpanded{max-width:100%}.wgSearchInput{min-width:0;color:var(--dsw-fg-1,inherit);background:0 0;border:none;outline:none;flex:1;padding:0;font-size:12px}.wgTreeBody{flex:1;min-height:0;padding:0 8px 8px;overflow-y:auto}.wgList{flex-direction:column;gap:1px;display:flex}.wgEmpty{text-align:center;color:var(--dsw-fg-3,#7f7f7fcc);padding:16px 8px;font-size:12px}.wgCategoryRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:4px;height:28px;padding:0 4px;display:flex}.wgCategoryRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgChevron{width:14px;height:14px;color:var(--dsw-fg-3,#7f7f7fcc);flex:none;justify-content:center;align-items:center;transition:transform .12s;display:inline-flex}.wgChevronOpen{transform:rotate(90deg)}.wgCategoryIcon{color:var(--dsw-fg-2,inherit);flex:none;justify-content:center;align-items:center;display:inline-flex}.wgCategoryLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-fg-1,inherit);flex:1;font-size:12px;font-weight:600;overflow:hidden}.wgCategoryCount{color:var(--dsw-fg-3,#7f7f7fcc);flex:none;font-size:11px}.wgProjectRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:4px;height:28px;padding:0 4px 0 20px;display:flex}.wgProjectRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgProjectActive{color:var(--dsw-accent,#4a90d9)}.wgProjectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-fg-1,inherit);flex:1;font-size:12px;overflow:hidden}.wgRowActions{opacity:0;flex:none;align-items:center;gap:2px;display:inline-flex}.wgProjectRow:hover .wgRowActions,.wgProjectRow:focus-within .wgRowActions{opacity:1}.wgSessionRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:6px;height:30px;padding:0 4px 0 40px;display:flex}.wgSessionRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgSessionRow:hover .wgRowActions,.wgSessionRow:focus-within .wgRowActions{opacity:1}.wgSelected{background:var(--dsw-bg-selected,#4a90d92e)}.wgStatusSlot{flex:none;justify-content:center;align-items:center;width:14px;height:14px;display:inline-flex}.wgSessionTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-fg-1,inherit);flex:1;font-size:12px;overflow:hidden}.wgSessionTime{color:var(--dsw-fg-3,#7f7f7fcc);flex:none;font-size:11px}.wgVisuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.wgMatched{background:var(--dsw-bg-selected,#4a90d92e)}.wgSessionSnippet{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-fg-3,#7f7f7fcc);flex:1;font-size:11px;overflow:hidden}.wgSearchStatus{color:var(--dsw-fg-3,#7f7f7fcc);text-align:center;padding:8px;font-size:11px}.wgRail{flex-direction:column;align-items:center;gap:4px;padding:8px 0;display:flex}.wgAddError{color:var(--dsw-fg-1,inherit);white-space:pre-wrap;word-break:break-word;max-height:200px;font-size:12px;overflow-y:auto}.wgRenameInput{border:1px solid var(--dsw-border,#7f7f7f4d);background:var(--dsw-bg-1,transparent);width:100%;color:var(--dsw-fg-1,inherit);border-radius:6px;outline:none;padding:6px 8px;font-size:13px}.wgRenameInput:focus{border-color:var(--dsw-accent,#4a90d9)}";
		//#endregion
		//#region src/client/GroupsBrowser.tsx
		/**
		* The workspace-groups browsing region filling the sidebar shell's
		* `sidebar.workspaces` hole: section header (title + right-aligned search +
		* add workspace), the three-level tree (category → workspace → session),
		* and the workspace/session dialogs. Wide state renders the full browser;
		* rail state renders the two region icons (search / add workspace) as 36px
		* controls on the shell's shared rail entry path, each requesting expansion
		* through the owner share.
		*
		* Data: workspaces/sessions via the framework global hooks; grouping config
		* via the host half's `/workspace-groups/config` route (refetched on mount).
		*/
		const SEARCH_DEBOUNCE_MS = 250;
		const SEARCH_QUERY_MAX_CODE_UNITS = 500;
		function sanitizeSearchQuery(value) {
			const withoutNul = value.replaceAll("\0", "");
			if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
			return withoutNul.slice(0, SEARCH_QUERY_MAX_CODE_UNITS);
		}
		/** Minimal fetch of the grouping config (host route; no-cache revalidation). */
		async function fetchGroupsConfig() {
			const response = await fetch("/workspace-groups/config", { cache: "no-cache" });
			if (!response.ok) throw new Error(`config request failed: ${response.status}`);
			const body = await response.json();
			return Array.isArray(body.categories) ? body : { categories: [] };
		}
		/**
		* Render the browsing region.
		* @param props - composed slot props (shell owner share + store + injected actions).
		* @returns the region element tree.
		*/
		function GroupsBrowser({ wide, expandSidebar, useSessions, useWorkspaces, useStore, actions, startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, pickDirectory, searchSessions, searchResultLimit, t }) {
			(0, react.useEffect)(() => {
				const style = document.createElement("style");
				style.setAttribute("data-plugin", "dsh-workspace-groups");
				style.textContent = styles_css_default;
				document.head.append(style);
				return () => {
					style.remove();
				};
			}, []);
			const [config, setConfig] = (0, react.useState)({ categories: [] });
			const [configError, setConfigError] = (0, react.useState)(null);
			const reloadConfig = () => {
				setConfigError(null);
				fetchGroupsConfig().then(setConfig).catch((reason) => {
					setConfigError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			(0, react.useEffect)(() => {
				reloadConfig();
			}, []);
			const workspaces = useWorkspaces((state) => state.items);
			const workspacePhase = useWorkspaces((state) => state.phase);
			const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
			const categoryExpansion = useStore((s) => s.categoryExpansion);
			const workspaceExpansion = useStore((s) => s.workspaceExpansion);
			const list = useSessions((s) => s);
			const current = list.current;
			const currentWorkspaceKey = current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(current))?.workspaceId;
			(0, react.useEffect)(() => {
				if (current === void 0 || currentWorkspaceKey === void 0) return;
				const category = categoriesForCurrent(config, workspaces, current);
				if (category !== void 0 && !Object.hasOwn(categoryExpansion, category)) actions.setCategoryExpanded(category, true);
				if (!Object.hasOwn(workspaceExpansion, currentWorkspaceKey)) actions.setWorkspaceExpanded(currentWorkspaceKey, true);
			}, [
				current,
				currentWorkspaceKey,
				config,
				workspaces,
				categoryExpansion,
				workspaceExpansion,
				actions
			]);
			(0, react.useEffect)(() => {
				if (workspacePhase !== "ready") return;
				actions.retainKeys(config.categories.map((c) => c.name), workspaces.map((w) => w.workspaceId));
			}, [
				actions,
				config,
				workspacePhase,
				workspaces
			]);
			const [query, setQuery] = (0, react.useState)("");
			const [searchExpanded, setSearchExpanded] = (0, react.useState)(false);
			const normalizedQuery = sanitizeSearchQuery(query).trim();
			const [remoteSearch, setRemoteSearch] = (0, react.useState)({
				query: "",
				status: "idle",
				items: [],
				hasMore: false
			});
			const searchInput = (0, react.useRef)(null);
			const searchRoot = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (normalizedQuery === "") {
					setRemoteSearch({
						query: "",
						status: "idle",
						items: [],
						hasMore: false
					});
					return;
				}
				const controller = new AbortController();
				setRemoteSearch({
					query: normalizedQuery,
					status: "loading",
					items: [],
					hasMore: false
				});
				const timer = window.setTimeout(() => {
					searchSessions(normalizedQuery, controller.signal).then((result) => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "ready",
							items: result.items,
							hasMore: result.hasMore
						});
					}).catch(() => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "error",
							items: [],
							hasMore: false
						});
					});
				}, SEARCH_DEBOUNCE_MS);
				return () => {
					window.clearTimeout(timer);
					controller.abort();
				};
			}, [normalizedQuery, searchSessions]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded) return;
				const onClick = (event) => {
					if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return;
					searchInput.current?.blur();
					if (normalizedQuery !== "") return;
					setSearchExpanded(false);
				};
				document.addEventListener("click", onClick);
				return () => {
					document.removeEventListener("click", onClick);
				};
			}, [
				normalizedQuery,
				wide,
				searchExpanded
			]);
			const expandedCategories = (0, react.useMemo)(() => Object.entries(categoryExpansion).filter(([, v]) => v).map(([k]) => k), [categoryExpansion]);
			const expandedWorkspaces = (0, react.useMemo)(() => Object.entries(workspaceExpansion).filter(([, v]) => v).map(([k]) => k), [workspaceExpansion]);
			const groups = (0, react.useMemo)(() => deriveGroups(list, workspaces, archivedSessionIds, config, {
				expandedCategories,
				expandedWorkspaces
			}), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				expandedCategories,
				expandedWorkspaces
			]);
			const [adding, setAdding] = (0, react.useState)(false);
			const [addError, setAddError] = (0, react.useState)(null);
			const [addErrorOpen, setAddErrorOpen] = (0, react.useState)(false);
			const addWorkspace = async () => {
				if (adding) return;
				setAdding(true);
				setAddError(null);
				setAddErrorOpen(false);
				try {
					const path = await pickDirectory();
					if (path === null) return;
					startSession((await createWorkspace({ path })).workspaceId);
				} catch (reason) {
					const message = reason instanceof Error ? reason.message : String(reason);
					setAddError(message);
					setAddErrorOpen(true);
				} finally {
					setAdding(false);
				}
			};
			const [renameTarget, setRenameTarget] = (0, react.useState)(null);
			const [renameDraft, setRenameDraft] = (0, react.useState)("");
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [renameError, setRenameError] = (0, react.useState)(null);
			const renameTrimmed = renameDraft.trim();
			const renameDuplicate = renameTarget !== null && renameTrimmed !== "" && renameTrimmed !== renameTarget.currentTitle && workspaces.some((w) => w.title === renameTrimmed);
			const renameBlocked = renaming || renameTrimmed === "" || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate;
			const confirmRename = () => {
				if (renameBlocked || renameTarget === null) return;
				setRenaming(true);
				setRenameError(null);
				renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
					setRenaming(false);
					setRenameTarget(null);
				}).catch((reason) => {
					setRenaming(false);
					setRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [deleteError, setDeleteError] = (0, react.useState)(null);
			const confirmDelete = () => {
				if (deleting || deleteTarget === null) return;
				setDeleting(true);
				setDeleteError(null);
				deleteWorkspace(deleteTarget.workspaceId).then(() => {
					setDeleting(false);
					setDeleteTarget(null);
				}).catch((reason) => {
					setDeleting(false);
					setDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [sessionRenameTarget, setSessionRenameTarget] = (0, react.useState)(null);
			const [sessionRenameDraft, setSessionRenameDraft] = (0, react.useState)("");
			const [sessionRenaming, setSessionRenaming] = (0, react.useState)(false);
			const [sessionRenameError, setSessionRenameError] = (0, react.useState)(null);
			const sessionRenameTrimmed = sessionRenameDraft.trim();
			const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === "" || sessionRenameTarget === null;
			const confirmSessionRename = () => {
				if (sessionRenameBlocked || sessionRenameTarget === null) return;
				setSessionRenaming(true);
				setSessionRenameError(null);
				renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
					setSessionRenaming(false);
					setSessionRenameTarget(null);
				}).catch((reason) => {
					setSessionRenaming(false);
					setSessionRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const onSessionRename = (sessionId, currentTitle) => {
				setSessionRenameTarget({
					sessionId,
					currentTitle
				});
				setSessionRenameDraft(currentTitle);
				setSessionRenameError(null);
			};
			const onSessionArchive = (sessionId) => {
				archiveSession(sessionId).catch((reason) => {
					console.warn("session archive rejected:", reason);
				});
			};
			const now = Date.now();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgRoot${wide ? "" : " wgRail"}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgSectionHeader",
						children: [
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wgSectionLabel",
								children: t("section.workspaces")
							}),
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `wgSearch${searchExpanded ? " wgSearchExpanded" : ""}`,
								ref: searchRoot,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wgIconButton",
										"aria-label": t("search"),
										onClick: () => {
											setSearchExpanded(true);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: searchExpanded ? 11 : 14 })
									}),
									searchExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: searchInput,
										className: "wgSearchInput",
										type: "text",
										placeholder: t("search.placeholder"),
										maxLength: SEARCH_QUERY_MAX_CODE_UNITS,
										value: query,
										autoFocus: true,
										onChange: (e) => {
											setQuery(sanitizeSearchQuery(e.target.value));
										},
										onKeyDown: (e) => {
											if (e.key !== "Escape") return;
											setQuery("");
											setSearchExpanded(false);
										}
									}),
									searchExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wgIconButton",
										"aria-label": t("search.clear"),
										onClick: (e) => {
											e.stopPropagation();
											setQuery("");
											setSearchExpanded(false);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFill14, {})
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("workspace.add"),
								side: "bottom",
								delayMs: 500,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									"aria-label": t("workspace.add"),
									disabled: adding,
									onClick: addWorkspace,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutline16, { size: wide ? 16 : 18 })
								})
							})
						]
					}),
					!wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSectionHeader",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("search"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								"aria-label": t("search"),
								onClick: () => {
									setSearchExpanded(true);
									expandSidebar();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 18 })
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgTreeBody",
						children: [configError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgSearchStatus",
							role: "status",
							children: t("configUnavailable")
						}), wide && normalizedQuery !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchBody, {
							list,
							workspaces,
							config,
							archivedSessionIds,
							query: normalizedQuery,
							remote: remoteSearch,
							resultLimit: searchResultLimit,
							current,
							now,
							open,
							t
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgList",
							role: "tree",
							"aria-label": t("section.workspaces"),
							children: [groups.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgEmpty",
								children: workspacePhase === "ready" ? t("empty.noWorkspaces") : t("empty.none")
							}), groups.map((category) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategorySection, {
								category,
								current,
								now,
								t,
								onToggleCategory: () => {
									actions.setCategoryExpanded(category.key, !category.expanded);
								},
								onToggleWorkspace: (key) => {
									actions.setWorkspaceExpanded(key, !workspaceExpansion[key]);
								},
								onNewSession: startSession,
								onOpen: open,
								onRenameRequest: (workspaceId, title) => {
									setRenameTarget({
										workspaceId,
										currentTitle: title
									});
									setRenameDraft(title);
									setRenameError(null);
								},
								onDeleteRequest: (workspaceId, title) => {
									setDeleteTarget({
										workspaceId,
										title
									});
									setDeleteError(null);
								},
								onSessionRename,
								onSessionArchive,
								onFork: forkSession
							}, category.key))]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: renameTarget !== null,
						onClose: () => {
							setRenameTarget(null);
						},
						closeLabel: t("close"),
						title: t("workspace.renameTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setRenameTarget(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: renameBlocked,
							onClick: confirmRename,
							children: t("workspace.renameConfirm")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "wgRenameInput",
							value: renameDraft,
							"aria-label": t("workspace.renamePlaceholder"),
							autoFocus: true,
							onChange: (e) => {
								setRenameDraft(e.target.value);
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") confirmRename();
							}
						}), renameError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: renameError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== null,
						onClose: () => {
							setDeleteTarget(null);
						},
						closeLabel: t("close"),
						title: t("workspace.deleteTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setDeleteTarget(null);
							},
							children: t("workspace.deleteCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: confirmDelete,
							children: t("workspace.delete")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							children: t("workspace.deleteConfirm")
						}), deleteError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: deleteError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: sessionRenameTarget !== null,
						onClose: () => {
							setSessionRenameTarget(null);
						},
						closeLabel: t("close"),
						title: t("session.renameTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setSessionRenameTarget(null);
							},
							children: t("session.renameCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: sessionRenameBlocked,
							onClick: confirmSessionRename,
							children: t("session.renameConfirm")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "wgRenameInput",
							value: sessionRenameDraft,
							"aria-label": t("session.renamePlaceholder"),
							autoFocus: true,
							onChange: (e) => {
								setSessionRenameDraft(e.target.value);
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") confirmSessionRename();
							}
						}), sessionRenameError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: sessionRenameError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: addErrorOpen,
						onClose: () => {
							setAddErrorOpen(false);
						},
						closeLabel: t("close"),
						title: t("workspace.addErrorTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setAddErrorOpen(false);
							},
							children: t("close")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							onClick: addWorkspace,
							children: t("retry")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: addError
						})
					})
				]
			});
		}
		/** Resolve the category label containing the current session (auto-expand helper). */
		function categoriesForCurrent(config, workspaces, current) {
			const workspace = workspaces.find((w) => w.sessionIds.includes(current));
			if (workspace === void 0) return void 0;
			return classify(config.categories, workspace.path, workspace.title)?.name;
		}
		/** One category section: header row + expanded workspace folders. */
		function CategorySection({ category, current, now, t, onToggleCategory, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "group",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryRow, {
					node: category,
					t,
					onToggle: onToggleCategory
				}), category.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					role: "group",
					children: category.workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
							node: workspace,
							t,
							onToggle: () => {
								onToggleWorkspace(workspace.workspaceId);
							},
							onNewSession: () => {
								onNewSession(workspace.workspaceId);
							},
							onRename: () => {
								onRenameRequest(workspace.workspaceId, workspace.label);
							},
							onDelete: () => {
								onDeleteRequest(workspace.workspaceId, workspace.label);
							}
						}), workspace.expanded && workspace.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
							node: session,
							currentId: current,
							now,
							t,
							onOpen,
							onRename: onSessionRename,
							onFork,
							onArchive: onSessionArchive
						}, session.id))]
					}, workspace.workspaceId))
				})]
			});
		}
		/**
		* Search body rendered as a three-level tree pruned to matched branches:
		* 分类文件夹 → 项目文件夹 → 命中会话行. Reuses the same row components as
		* the idle tree, so search keeps the same folder hierarchy the user is used to.
		*/
		function SearchBody({ list, workspaces, config, archivedSessionIds, query, remote, resultLimit, current, now, open, t }) {
			const currentRemote = remote.query === query ? remote : {
				query,
				status: "loading",
				items: [],
				hasMore: false
			};
			const matches = (0, react.useMemo)(() => deriveSearchMatches(list, workspaces, config, query, archivedSessionIds, currentRemote, resultLimit), [
				list,
				workspaces,
				config,
				query,
				archivedSessionIds,
				currentRemote,
				resultLimit
			]);
			const groups = (0, react.useMemo)(() => deriveSearchGroups(list, workspaces, config, matches.matchedIds, archivedSessionIds, matches.snippetsBySession), [
				list,
				workspaces,
				config,
				matches,
				archivedSessionIds
			]);
			const pending = currentRemote.status === "loading";
			const failed = currentRemote.status === "error";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wgList",
				role: "tree",
				"aria-label": t("search.results.aria"),
				children: [
					groups.map((category) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryRow, {
							node: category,
							t,
							onToggle: () => {}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							children: category.workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								role: "group",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
									node: workspace,
									t,
									onToggle: () => {},
									onNewSession: () => {},
									onRename: () => {},
									onDelete: () => {}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									role: "group",
									children: workspace.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
										node: session,
										currentId: current,
										now,
										t,
										onOpen: open,
										onRename: () => {},
										onFork: () => {},
										onArchive: () => {}
									}, session.id))
								})]
							}, workspace.workspaceId))
						})]
					}, category.key)),
					pending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						role: "status",
						children: t("search.pending")
					}),
					failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						role: "status",
						children: t("search.unavailable")
					}),
					!pending && groups.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgEmpty",
						children: t("search.noMatches")
					}),
					matches.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						children: t("search.hasMore")
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Simplified Chinese dictionary. */
		const zh = {
			"section.workspaces": "工作区",
			"section.sessions": "会话",
			search: "搜索",
			"search.placeholder": "搜索会话…",
			"search.clear": "清除",
			"search.noMatches": "没有匹配的会话",
			"search.unavailable": "搜索不可用",
			"search.pending": "搜索中…",
			"search.hasMore": "结果过多，请细化关键词",
			"search.results.aria": "搜索结果",
			"workspace.add": "添加工作区",
			"workspace.addBusy": "正在添加…",
			"workspace.addError": "添加失败",
			"workspace.addErrorTitle": "无法添加工作区",
			"workspace.rename": "重命名",
			"workspace.delete": "删除",
			"workspace.deleteTitle": "删除工作区",
			"workspace.deleteConfirm": "仅删除注册信息，目录与会话日志保留。确定删除？",
			"workspace.deleteCancel": "取消删除",
			"workspace.renaming": "重命名中…",
			"workspace.deleting": "删除中…",
			"workspace.renameTitle": "重命名工作区",
			"workspace.renamePlaceholder": "工作区名称",
			"workspace.renameConfirm": "重命名",
			"workspace.renameCancel": "取消",
			"session.new": "新建会话",
			"session.rename": "重命名会话",
			"session.archive": "归档",
			"session.fork": "派生",
			"session.renameTitle": "重命名会话",
			"session.renamePlaceholder": "会话名称",
			"session.renameConfirm": "重命名",
			"session.renameCancel": "取消",
			"session.renaming": "重命名中…",
			uncategorized: "未分类",
			"empty.none": "暂无内容",
			"empty.noWorkspaces": "还没有工作区",
			close: "关闭",
			cancel: "取消",
			confirm: "确定",
			retry: "重试",
			configUnavailable: "分组配置不可用",
			collapse: "折叠",
			expandMore: "展开全部",
			newSession: "新建会话"
		};
		/** English dictionary. */
		const en = {
			"section.workspaces": "Workspaces",
			"section.sessions": "Sessions",
			search: "Search",
			"search.placeholder": "Search sessions…",
			"search.clear": "Clear",
			"search.noMatches": "No matching sessions",
			"search.unavailable": "Search unavailable",
			"search.pending": "Searching…",
			"search.hasMore": "Too many results — refine the query",
			"search.results.aria": "Search results",
			"workspace.add": "Add workspace",
			"workspace.addBusy": "Adding…",
			"workspace.addError": "Add failed",
			"workspace.addErrorTitle": "Could not add workspace",
			"workspace.rename": "Rename",
			"workspace.delete": "Delete",
			"workspace.deleteTitle": "Delete workspace",
			"workspace.deleteConfirm": "Only the registration is removed; the directory and session logs stay. Delete?",
			"workspace.deleteCancel": "Cancel delete",
			"workspace.renaming": "Renaming…",
			"workspace.deleting": "Deleting…",
			"workspace.renameTitle": "Rename workspace",
			"workspace.renamePlaceholder": "Workspace name",
			"workspace.renameConfirm": "Rename",
			"workspace.renameCancel": "Cancel",
			"session.new": "New Session",
			"session.rename": "Rename session",
			"session.archive": "Archive",
			"session.fork": "Fork",
			"session.renameTitle": "Rename session",
			"session.renamePlaceholder": "Session name",
			"session.renameConfirm": "Rename",
			"session.renameCancel": "Cancel",
			"session.renaming": "Renaming…",
			uncategorized: "Uncategorized",
			"empty.none": "Nothing here",
			"empty.noWorkspaces": "No workspaces yet",
			close: "Close",
			cancel: "Cancel",
			confirm: "Confirm",
			retry: "Retry",
			configUnavailable: "Grouping config unavailable",
			collapse: "Collapse",
			expandMore: "Show all",
			newSession: "New Session"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "workspaceGroups";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"locale",
			"connection"
		];
		/**
		* Register the grouped browser once the sidebar slot declaration is on the
		* ledger. Inject factory returns plain callbacks; data reads use the
		* framework's global hooks.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-workspace-groups: dictionaries");
			const searchSessions = async (query, signal) => {
				const result = await ctx.sessions.search(query, signal);
				if (!result.ok) throw new Error(result.error.message);
				return result.value;
			};
			const browserInjected = () => ({
				startSession: (workspaceId) => {
					ctx.workspaces.startSession(workspaceId);
				},
				open: (sessionId) => {
					ctx.sessions.open(sessionId);
				},
				searchSessions,
				searchResultLimit: ctx.sessions.searchResultLimit,
				renameSession: async (sessionId, title) => {
					const session = ctx.sessions.binding(sessionId)?.session;
					if (session === void 0) throw new Error(`unknown session "${sessionId}"`);
					const result = await session.rename(title);
					if (!result.ok) throw new Error(result.error.message);
				},
				forkSession: (sessionId) => {
					ctx.sessions.fork({
						sessionId,
						increaseTitle: true
					}).then((childId) => {
						ctx.sessions.open(childId);
					}).catch(() => {});
				},
				renameWorkspace: async (workspaceId, title) => {
					await ctx.workspaces.rename(workspaceId, title);
				},
				deleteWorkspace: async (workspaceId) => {
					await ctx.workspaces.delete(workspaceId);
				},
				insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
					await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId);
				},
				archiveSession: async (sessionId) => {
					await ctx.workspaces.archiveSession(sessionId);
				},
				insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
					await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId);
				},
				createWorkspace: (input) => ctx.workspaces.create(input),
				pickDirectory: () => ctx.workspaces.pickDirectory(),
				hooks: { hostDescription: ctx.get("connection").hostDescription }
			});
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				priority: -1,
				store: createGroupsViewStore(),
				inject: browserInjected,
				locale: NS,
				registrant: "dsh-workspace-groups"
			}, GroupsBrowser));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
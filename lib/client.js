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
		/** Set many category folders in one store action while preserving unrelated keys. */
		function setCategoriesExpandedImpl(state, keys, expanded) {
			for (const key of keys) state.categoryExpansion[key] = expanded;
		}
		/** Set many workspace folders in one store action while preserving unrelated keys. */
		function setWorkspacesExpandedImpl(state, keys, expanded) {
			for (const key of keys) state.workspaceExpansion[key] = expanded;
		}
		/** Restore temporary drag folding while preserving keys the user toggled during the drag. */
		function restoreExpansionSnapshotImpl(state, snapshot, touchedCategories, touchedWorkspaces) {
			const categoryTouches = new Set(touchedCategories);
			const workspaceTouches = new Set(touchedWorkspaces);
			for (const [key, value] of Object.entries(snapshot.categories)) if (!categoryTouches.has(key)) state.categoryExpansion[key] = value;
			for (const [key, value] of Object.entries(snapshot.workspaces)) if (!workspaceTouches.has(key)) state.workspaceExpansion[key] = value;
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
					setCategoriesExpanded: setCategoriesExpandedImpl,
					setWorkspacesExpanded: setWorkspacesExpandedImpl,
					restoreExpansionSnapshot: restoreExpansionSnapshotImpl,
					retainKeys: retainKeysImpl
				}
			});
		}
		/** @deprecated Use LEGACY_UNCATEGORIZED_LABEL for compatibility checks only. */
		const UNCATEGORIZED_LABEL = "未分类";
		/**
		* Reserved key under `workspaceOrder` holding the manual order of TOP-LEVEL
		* (ungrouped) project rows. Distinct from any real group display name (a group
		* may not be named this), so it can never collide; the top-level list's order
		* is preserved exactly like a group's, and top-level rows can be reordered by
		* dragging.
		*/
		const TOP_LEVEL_ORDER_KEY = "__topLevel__";
		/** Normalize separators and trailing slashes while preserving filesystem roots. */
		function normalizePath(path) {
			const normalized = path.replace(/\\/g, "/");
			if (/^\/+$/u.test(normalized)) return "/";
			if (/^[A-Za-z]:\/+$/u.test(normalized)) return `${normalized.slice(0, 2)}/`;
			return normalized.replace(/\/+$/u, "");
		}
		//#endregion
		//#region src/core/matcher.ts
		/**
		* Pure classification + ordering logic: decides which category a workspace
		* belongs to and how categories/workspaces are ordered. Shared by the host
		* half (validation) and the client half (tree derivation), so the semantics
		* can never drift between the config surface and the rendered tree.
		*
		* Category identity: a category's STABLE origin is its YAML rule category
		* name (or a manual-group name). Its DISPLAY key is what the tree renders and
		* what assignments reference — for rule categories that is the rename
		* override when present. Hidden rule categories are inert: workspaces that
		* would match them become top-level (ungrouped).
		*/
		/** One rule match against a workspace's path and title. */
		function ruleMatches(rule, path, title) {
			const normalized = normalizePath(path);
			if (rule.pathPrefix !== void 0) {
				const prefix = normalizePath(rule.pathPrefix);
				if (normalized === prefix || prefix === "/" || /^[A-Za-z]:\/$/.test(prefix) ? normalized.startsWith(prefix) : normalized.startsWith(`${prefix}/`)) return true;
			}
			if (rule.pathExact !== void 0 && normalized === normalizePath(rule.pathExact)) return true;
			if (rule.nameContains !== void 0 && title.toLowerCase().includes(rule.nameContains.toLowerCase())) return true;
			if (rule.basenameContains !== void 0) {
				if ((path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? "").toLowerCase().includes(rule.basenameContains.toLowerCase())) return true;
			}
			return false;
		}
		/** Display name of a rule category: the rename override when present. */
		function ruleDisplayName(manual, originalName) {
			return manual?.renamed?.[originalName] ?? originalName;
		}
		/** Whether a rule category has been hidden by a UI delete. */
		function isHiddenRule(manual, originalName) {
			return manual?.hidden?.includes(originalName) ?? false;
		}
		/** Original YAML rule name whose display name equals `key` (undefined when none). */
		function originalRuleNameForDisplay(categories, manual, key) {
			return categories.find((c) => ruleDisplayName(manual, c.name) === key)?.name;
		}
		function effectiveCategories(config, manual) {
			const entries = [];
			const seen = /* @__PURE__ */ new Set();
			for (const category of config.categories) {
				if (isHiddenRule(manual, category.name)) continue;
				const key = ruleDisplayName(manual, category.name);
				if (seen.has(key)) continue;
				seen.add(key);
				entries.push({
					key,
					source: "rule"
				});
			}
			for (const name of manual?.categories ?? []) {
				if (seen.has(name)) continue;
				seen.add(name);
				entries.push({
					key: name,
					source: "manual"
				});
			}
			const order = manual?.categoryOrder;
			if (order === void 0 || order.length === 0) return entries;
			const position = new Map(order.map((key, index) => [key, index]));
			return [...entries].sort((a, b) => {
				const pa = position.get(a.key);
				const pb = position.get(b.key);
				if (pa !== void 0 && pb !== void 0) return pa - pb;
				if (pa !== void 0) return -1;
				if (pb !== void 0) return 1;
				return 0;
			});
		}
		/** Display keys of all effective categories (top-level workspaces excluded). */
		function displayCategoryKeys(config, manual) {
			return effectiveCategories(config, manual).map((e) => e.key);
		}
		/**
		* Resolve the category key a workspace renders under, or `undefined` when it
		* is top-level (ungrouped). Precedence: manual override (`null` = forced
		* top-level) → rule classification (hidden rules inert) → top-level.
		*/
		function resolveCategory(config, manual, workspaceId, path, title) {
			const override = manual?.assignments[workspaceId];
			if (override !== void 0) {
				if (override === null || override === "未分类") return void 0;
				return new Set(displayCategoryKeys(config, manual)).has(override) ? override : void 0;
			}
			for (const category of config.categories) {
				if (isHiddenRule(manual, category.name)) continue;
				if (category.rules.some((rule) => ruleMatches(rule, path, title))) return ruleDisplayName(manual, category.name);
			}
		}
		/**
		* Names that may not be used for a new/renamed group: the legacy reserved
		* label plus every current display key.
		*/
		function takenCategoryNames(config, manual) {
			const taken = new Set(displayCategoryKeys(config, manual));
			taken.add(UNCATEGORIZED_LABEL);
			taken.add(TOP_LEVEL_ORDER_KEY);
			return taken;
		}
		/**
		* Order a bucket of workspace ids: the stored per-category order first
		* (filtered to actual members), then any remaining members in `fallback`
		* (host) order. Deterministic; the renderer never re-sorts on its own.
		*/
		function orderedWorkspaceIds(manual, categoryKey, members) {
			const stored = manual?.workspaceOrder?.[categoryKey];
			if (stored === void 0 || stored.length === 0) return [...members];
			const memberSet = new Set(members);
			const ordered = [];
			const seen = /* @__PURE__ */ new Set();
			for (const id of stored) {
				if (!memberSet.has(id) || seen.has(id)) continue;
				seen.add(id);
				ordered.push(id);
			}
			for (const id of members) {
				if (seen.has(id)) continue;
				ordered.push(id);
			}
			return ordered;
		}
		/** Move `id` before `beforeId` (undefined = append) within an ordered list. */
		function moveBefore(list, id, beforeId) {
			if (id === beforeId) return [...list];
			const rest = list.filter((x) => x !== id);
			if (beforeId === void 0) return [...rest, id];
			const index = rest.indexOf(beforeId);
			if (index === -1) return [...rest, id];
			rest.splice(index, 0, id);
			return rest;
		}
		/** Move `id` after `afterId` (undefined = append) within an ordered list. */
		function moveAfter(list, id, afterId) {
			if (id === afterId) return [...list];
			const rest = list.filter((x) => x !== id);
			if (afterId === void 0) return [...rest, id];
			const index = rest.indexOf(afterId);
			if (index === -1) return [...rest, id];
			rest.splice(index + 1, 0, id);
			return rest;
		}
		//#endregion
		//#region src/client/tree.ts
		/**
		* Derives the three-level workspace-groups tree: category folder → workspace folder →
		* session row. Pure derivation — all inputs are snapshots; the renderer never
		* scans. Session visibility rules mirror the official ui-workspace tree
		* (blank rows only when current, archived excluded, subagent rows excluded).
		*/
		const UNKNOWN_WORKSPACE_LABEL = "Unknown workspace";
		/** Key of the uncategorized bucket (matches the config fallback label). */
		const UNCATEGORIZED_KEY = UNCATEGORIZED_LABEL;
		/** Directory display label: basename of the path (both separators accepted). */
		function workspaceLabel(cwd) {
			if (cwd === void 0 || cwd === "") return UNKNOWN_WORKSPACE_LABEL;
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
		/** Derive the attention state for a single session node. */
		function sessionAttention(node) {
			if (node.pendingInteraction === "approval" || node.pendingInteraction === "plan-review" || node.pendingInteraction === "question") return "warning";
			if (node.running || node.runningSubagentCount > 0) return "ongoing";
			return node.completed ? "done" : void 0;
		}
		/** Aggregate attention state across session nodes with priority warning > ongoing > done. */
		function aggregateAttention(nodes) {
			let hasOngoing = false;
			let hasDone = false;
			for (const node of nodes) {
				const state = sessionAttention(node);
				if (state === "warning") return "warning";
				if (state === "ongoing") hasOngoing = true;
				else if (state === "done") hasDone = true;
			}
			if (hasOngoing) return "ongoing";
			if (hasDone) return "done";
		}
		/** Aggregate category attention across member workspace nodes with priority warning > ongoing > done. */
		function aggregateCategoryAttention$1(workspaces) {
			let hasOngoing = false;
			let hasDone = false;
			for (const ws of workspaces) {
				if (ws.attention === "warning") return "warning";
				if (ws.attention === "ongoing") hasOngoing = true;
				else if (ws.attention === "done") hasDone = true;
			}
			if (hasOngoing) return "ongoing";
			if (hasDone) return "done";
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
		* @param config - sidecar grouping config (rule categories).
		* @param view - local expansion arrays.
		* @param manual - runtime overlay (manual groups + overrides). A workspace's
		* manual override wins over rule classification; removing it reverts to rules.
		* @returns category sections in render order (rule categories first, then
		* manual-only ones, uncategorized last). Manual groups render even while
		* empty; empty rule buckets stay hidden.
		*/
		function deriveGroups(list, workspaces, archivedSessionIds, config, view, manual) {
			const archived = new Set(archivedSessionIds);
			const expandedCategories = new Set(view.expandedCategories);
			const expandedWorkspaces = new Set(view.expandedWorkspaces);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const byCategory = /* @__PURE__ */ new Map();
			for (const { key } of effectiveCategories(config, manual)) byCategory.set(key, []);
			for (const workspace of workspaces) {
				const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
				if (key === void 0) continue;
				if (!byCategory.has(key)) byCategory.set(key, []);
				byCategory.get(key).push(workspace);
			}
			const manualCategories = new Set(manual.categories);
			const currentWorkspaceId = list.current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(list.current))?.workspaceId;
			const nodes = [];
			for (const key of effectiveCategories(config, manual).map((e) => e.key)) {
				const bucket = byCategory.get(key) ?? [];
				if (bucket.length === 0 && !manualCategories.has(key)) continue;
				const expanded = expandedCategories.has(key);
				const ordered = orderedWorkspaceIds(manual, key, bucket.map((w) => w.workspaceId));
				const workspaceNodes = [];
				let containsCurrent = false;
				for (const workspaceId of ordered) {
					const workspace = bucket.find((w) => w.workspaceId === workspaceId);
					if (workspace === void 0) continue;
					const sessions = workspaceSessions(list, workspace, archived, descendants);
					const wsExpanded = expandedWorkspaces.has(workspace.workspaceId);
					const wsContainsCurrent = workspace.workspaceId === currentWorkspaceId;
					if (wsContainsCurrent) containsCurrent = true;
					const attention = aggregateAttention(sessions);
					workspaceNodes.push({
						workspaceId: workspace.workspaceId,
						path: workspace.path,
						label: workspace.title,
						createdAt: Date.parse(workspace.createdAt),
						sessionCount: sessions.length,
						expanded: wsExpanded,
						containsCurrent: wsContainsCurrent,
						sessions: wsExpanded ? sessions : [],
						...attention === void 0 ? {} : { attention }
					});
				}
				const catAttention = aggregateCategoryAttention$1(workspaceNodes);
				nodes.push({
					key,
					label: key,
					expanded,
					containsCurrent,
					workspaces: workspaceNodes,
					...catAttention === void 0 ? {} : { attention: catAttention }
				});
			}
			return nodes;
		}
		/**
		* Top-level (ungrouped) workspace rows: workspaces resolving to no category
		* (no manual override and no matching rule, or a forced `null` override).
		* Rendered after the group folders as plain project rows (not inside any
		* folder), in manual top-level order (`workspaceOrder[TOP_LEVEL_ORDER_KEY]`),
		* falling back to host registration order.
		*/
		function deriveTopLevel(list, workspaces, archivedSessionIds, config, view, manual) {
			const archived = new Set(archivedSessionIds);
			const expandedWorkspaces = new Set(view.expandedWorkspaces);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const currentWorkspaceId = list.current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(list.current))?.workspaceId;
			const topLevelIds = workspaces.filter((w) => resolveCategory(config, manual, w.workspaceId, w.path, w.title) === void 0).map((w) => w.workspaceId);
			const ordered = orderedWorkspaceIds(manual, TOP_LEVEL_ORDER_KEY, topLevelIds);
			const nodes = [];
			for (const workspaceId of ordered) {
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) continue;
				const sessions = workspaceSessions(list, workspace, archived, descendants);
				const wsExpanded = expandedWorkspaces.has(workspaceId);
				const attention = aggregateAttention(sessions);
				nodes.push({
					workspaceId: workspace.workspaceId,
					path: workspace.path,
					label: workspace.title,
					createdAt: Date.parse(workspace.createdAt),
					sessionCount: sessions.length,
					expanded: wsExpanded,
					containsCurrent: workspace.workspaceId === currentWorkspaceId,
					sessions: wsExpanded ? sessions : [],
					...attention === void 0 ? {} : { attention }
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
		* matched session: category folder → workspace folder → matched session row. Every matched
		* session carries `matched: true` so rows render with the search-hit tint.
		* Classification uses the same precedence as the idle tree (manual override →
		* rules), so search shows the same grouping the user sees. Matched top-level
		* workspaces are returned separately (rendered as plain rows).
		*
		* @param list - sessions list snapshot.
		* @param workspaces - real workspaces in stable Host order.
		* @param config - sidecar grouping config.
		* @param matchedIds - set of session ids that matched the query.
		* @param archivedSessionIds - registry-global archive set.
		* @param manual - runtime overlay (manual groups + overrides).
		* @param snippetsBySession - optional content-match snippets keyed by session id.
		* @returns group folders in render order plus top-level matched workspaces,
		* pruned to matched branches only.
		*/
		function deriveSearchGroups(list, workspaces, config, matchedIds, archivedSessionIds, manual, snippetsBySession) {
			const archived = new Set(archivedSessionIds);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const byCategory = /* @__PURE__ */ new Map();
			for (const key of effectiveCategories(config, manual).map((e) => e.key)) byCategory.set(key, []);
			const topLevel = [];
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
				const node = {
					workspaceId: workspace.workspaceId,
					path: workspace.path,
					label: workspace.title,
					createdAt: Date.parse(workspace.createdAt),
					sessionCount: nodes.length,
					expanded: true,
					containsCurrent: false,
					sessions: nodes
				};
				const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
				if (key === void 0) {
					topLevel.push(node);
					continue;
				}
				if (!byCategory.has(key)) byCategory.set(key, []);
				byCategory.get(key).push(node);
			}
			const categories = [];
			for (const key of effectiveCategories(config, manual).map((e) => e.key)) {
				const workspaceNodes = byCategory.get(key);
				if (workspaceNodes === void 0 || workspaceNodes.length === 0) continue;
				categories.push({
					key,
					label: key,
					expanded: true,
					containsCurrent: false,
					workspaces: workspaceNodes
				});
			}
			return {
				categories,
				topLevel
			};
		}
		//#endregion
		//#region src/client/tree-filter.ts
		/**
		* Pure filtering model for sidebar tree views (categories and workspaces).
		* Filters sessions by status, recency, and color preset tags, returning
		* filtered category and top-level workspace nodes alongside aggregated status counts.
		*/
		const DEFAULT_SIDEBAR_FILTER = {
			status: "all",
			recency: "all",
			color: null
		};
		function sidebarFilterActive(filter) {
			return filter.status !== "all" || filter.recency !== "all" || filter.color !== null;
		}
		function getRecencyCutoff(recency, now) {
			switch (recency) {
				case "24h": return now - 864e5;
				case "7d": return now - 6048e5;
				case "30d": return now - 2592e6;
				default: return -Infinity;
			}
		}
		function isWorkspaceColorMatched(workspaceId, categoryKey, targetColor, colors) {
			if (targetColor === null) return true;
			if (categoryKey !== void 0 && colors?.[categoryKey] === targetColor) return true;
			return colors?.[workspaceId] === targetColor;
		}
		function aggregateWorkspaceAttention(sessions) {
			let hasOngoing = false;
			let hasDone = false;
			for (const session of sessions) {
				const state = sessionAttention(session);
				if (state === "warning") return "warning";
				if (state === "ongoing") hasOngoing = true;
				else if (state === "done") hasDone = true;
			}
			if (hasOngoing) return "ongoing";
			if (hasDone) return "done";
		}
		function aggregateCategoryAttention(workspaces) {
			let hasOngoing = false;
			let hasDone = false;
			for (const ws of workspaces) {
				if (ws.attention === "warning") return "warning";
				if (ws.attention === "ongoing") hasOngoing = true;
				else if (ws.attention === "done") hasDone = true;
			}
			if (hasOngoing) return "ongoing";
			if (hasDone) return "done";
		}
		function applySidebarFilter(categories, topLevel, filter, colors, now) {
			const cutoff = getRecencyCutoff(filter.recency, now);
			const counts = {
				all: 0,
				warning: 0,
				ongoing: 0,
				done: 0
			};
			for (const category of categories) for (const ws of category.workspaces) {
				if (!isWorkspaceColorMatched(ws.workspaceId, category.key, filter.color, colors)) continue;
				for (const session of ws.sessions) if (session.updatedAt >= cutoff) {
					counts.all++;
					const attn = sessionAttention(session);
					if (attn === "warning") counts.warning++;
					else if (attn === "ongoing") counts.ongoing++;
					else if (attn === "done") counts.done++;
				}
			}
			for (const ws of topLevel) {
				if (!isWorkspaceColorMatched(ws.workspaceId, void 0, filter.color, colors)) continue;
				for (const session of ws.sessions) if (session.updatedAt >= cutoff) {
					counts.all++;
					const attn = sessionAttention(session);
					if (attn === "warning") counts.warning++;
					else if (attn === "ongoing") counts.ongoing++;
					else if (attn === "done") counts.done++;
				}
			}
			function filterWorkspace(ws, categoryKey) {
				if (!isWorkspaceColorMatched(ws.workspaceId, categoryKey, filter.color, colors)) return null;
				const matchedSessions = [];
				for (const session of ws.sessions) {
					if (session.updatedAt < cutoff) continue;
					if (filter.status !== "all") {
						if (sessionAttention(session) !== filter.status) continue;
					}
					matchedSessions.push(session);
				}
				if (matchedSessions.length === 0) return null;
				const { attention: _prevAttn, ...wsRest } = ws;
				const attention = aggregateWorkspaceAttention(matchedSessions);
				return {
					...wsRest,
					sessionCount: matchedSessions.length,
					expanded: true,
					sessions: matchedSessions,
					...attention === void 0 ? {} : { attention }
				};
			}
			const filteredCategories = [];
			for (const category of categories) {
				const matchedWorkspaces = [];
				for (const ws of category.workspaces) {
					const filteredWs = filterWorkspace(ws, category.key);
					if (filteredWs !== null) matchedWorkspaces.push(filteredWs);
				}
				if (matchedWorkspaces.length > 0) {
					const { attention: _prevAttn, ...categoryRest } = category;
					const attention = aggregateCategoryAttention(matchedWorkspaces);
					filteredCategories.push({
						...categoryRest,
						expanded: true,
						workspaces: matchedWorkspaces,
						...attention === void 0 ? {} : { attention }
					});
				}
			}
			const filteredTopLevel = [];
			for (const ws of topLevel) {
				const filteredWs = filterWorkspace(ws, void 0);
				if (filteredWs !== null) filteredTopLevel.push(filteredWs);
			}
			return {
				categories: filteredCategories,
				topLevel: filteredTopLevel,
				counts
			};
		}
		//#endregion
		//#region \0dsh-workspace-groups-inline-css:src/client/directory-browser.css.mjs
		var directory_browser_css_default = ".wgDirectoryDialog{width:min(680px,100vw - 32px)}.wgDirectoryBrowser{flex-direction:column;gap:10px;min-height:min(440px,60vh);display:flex}.wgDirectoryToolbar{justify-content:space-between;align-items:center;gap:8px;min-width:0;display:flex}.wgDirectoryToolbarActions{flex:none;align-items:center;gap:4px;display:flex}.wgDirectoryPathEdit{flex:1;align-items:center;gap:8px;min-width:0;display:flex}.wgDirectoryPathInput{box-sizing:border-box;min-width:0;height:32px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);font:inherit;border-radius:8px;flex:1;padding:0 10px}.wgDirectoryIconButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}.wgDirectoryIconButton:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.wgDirectoryIconButton:disabled{opacity:.5;cursor:default}.wgDirectoryIconButton:focus-visible,.wgDirectoryPathInput:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.wgDirectoryCrumbs{flex:1;align-items:center;gap:2px;min-width:0;display:flex;overflow-x:auto}.wgDirectoryCrumbPart{color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;display:inline-flex}.wgDirectoryCrumbPart button,.wgDirectoryNewFolder{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:4px 7px}.wgDirectoryCrumbPart button:hover:not(:disabled),.wgDirectoryNewFolder:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.wgDirectoryCrumbPart button:disabled{color:var(--dsw-alias-label-primary);cursor:default}.wgDirectoryList{flex-direction:column;gap:2px;min-height:220px;max-height:min(420px,48vh);display:flex;overflow-y:auto}.wgDirectoryRow{box-sizing:border-box;width:100%;min-height:34px;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:0;border-radius:8px;grid-template-columns:18px minmax(0,1fr) 14px;align-items:center;gap:8px;padding:4px 8px;display:grid}.wgDirectoryRow span{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.wgDirectoryRow:hover:not(:disabled),.wgDirectoryRowSelected{background:var(--dsw-alias-interactive-bg-hover)}.wgDirectoryRow:focus-visible,.wgDirectoryCrumbPart button:focus-visible,.wgDirectoryNewFolder:focus-visible,.wgDirectoryCreate input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.wgDirectoryStatus,.wgDirectoryError{font-size:12px;line-height:18px}.wgDirectoryStatus{color:var(--dsw-alias-label-tertiary)}.wgDirectoryError{color:var(--dsw-alias-state-error-primary);align-items:center;gap:8px;display:flex}.wgDirectoryError span{overflow-wrap:anywhere;flex:1;min-width:0}.wgDirectoryTruncated{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);border-radius:6px;align-items:center;gap:6px;padding:6px 10px;font-size:12px;line-height:18px;display:flex}.wgDirectoryBottomBar{justify-content:space-between;align-items:center;gap:8px;display:flex}.wgDirectoryNewFolder{align-self:flex-start}.wgDirectoryHiddenToggle{color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;align-items:center;gap:6px;font-size:12px;display:inline-flex}.wgDirectoryHiddenToggle input{cursor:pointer;margin:0}.wgDirectoryCreate{align-items:center;gap:8px;display:flex}.wgDirectoryCreate input{box-sizing:border-box;min-width:0;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;flex:1;padding:0 10px}@media (width<=560px){.wgDirectoryBrowser{min-height:52vh}.wgDirectoryCreate{flex-direction:column;align-items:stretch}.wgDirectoryCreate input{flex:none;width:100%}.wgDirectoryPathEdit{flex-direction:column;align-items:stretch}}";
		//#endregion
		//#region src/client/DirectoryBrowser.tsx
		function filterDirectoryEntries(entries, showHidden) {
			if (showHidden) return entries;
			return entries.filter((entry) => !entry.hidden && !entry.name.startsWith("."));
		}
		function formatCrumbs(crumbs = [], homePath, homeLabel = "Home") {
			return crumbs.map((crumb, index) => {
				const isHome = Boolean(homePath && crumb.path === homePath);
				let name = crumb.name;
				if (isHome) name = homeLabel;
				else if (index === 0) {
					if (!homePath || homePath === "/") name = homeLabel;
					else if (!name) name = "/";
				} else if (!name) name = "/";
				return {
					path: crumb.path,
					name,
					isHome
				};
			});
		}
		function resolveNewFolderTarget(selectedPath, listingPath) {
			return selectedPath ?? listingPath;
		}
		function isImeComposing(event) {
			return Boolean(event.nativeEvent?.isComposing || event.isComposing);
		}
		function failureText(reason) {
			return reason instanceof Error ? reason.message : String(reason);
		}
		function DirectoryBrowser({ open, busy, listDirectory, createDirectory, onPick, onClose, strings }) {
			const [listing, setListing] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [folderDraft, setFolderDraft] = (0, react.useState)(null);
			const [creating, setCreating] = (0, react.useState)(false);
			const [restoreNewFolderFocus, setRestoreNewFolderFocus] = (0, react.useState)(false);
			const [showHidden, setShowHidden] = (0, react.useState)(false);
			const [editingPath, setEditingPath] = (0, react.useState)(false);
			const [pathInput, setPathInput] = (0, react.useState)("");
			const requestSeq = (0, react.useRef)(0);
			const openGeneration = (0, react.useRef)(0);
			const controller = (0, react.useRef)(null);
			const currentPath = (0, react.useRef)(void 0);
			const pathInputRef = (0, react.useRef)(null);
			const newFolderInputRef = (0, react.useRef)(null);
			const newFolderBtnRef = (0, react.useRef)(null);
			const editPathBtnRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const style = document.createElement("style");
				style.setAttribute("data-plugin", "dsh-workspace-groups-directory-browser");
				style.textContent = directory_browser_css_default;
				document.head.append(style);
				return () => {
					style.remove();
				};
			}, []);
			const navigate = (0, react.useCallback)((path) => {
				controller.current?.abort();
				const nextController = new AbortController();
				controller.current = nextController;
				currentPath.current = path;
				const seq = ++requestSeq.current;
				const generation = openGeneration.current;
				setLoading(true);
				setError(null);
				setListing(null);
				setSelected(null);
				listDirectory(path, nextController.signal).then((next) => {
					if (seq !== requestSeq.current || generation !== openGeneration.current) return;
					setListing(next);
					setPathInput(next.path);
					setLoading(false);
				}, (reason) => {
					if (nextController.signal.aborted || seq !== requestSeq.current || generation !== openGeneration.current) return;
					setLoading(false);
					setError(failureText(reason));
				});
			}, [listDirectory]);
			(0, react.useEffect)(() => {
				openGeneration.current += 1;
				if (open) {
					setListing(null);
					setSelected(null);
					setFolderDraft(null);
					setError(null);
					setEditingPath(false);
					setPathInput("");
					navigate();
					return;
				}
				requestSeq.current += 1;
				controller.current?.abort();
				controller.current = null;
				setLoading(false);
				setCreating(false);
			}, [open, navigate]);
			(0, react.useEffect)(() => () => {
				requestSeq.current += 1;
				openGeneration.current += 1;
				controller.current?.abort();
			}, []);
			(0, react.useEffect)(() => {
				if (editingPath) {
					pathInputRef.current?.focus();
					pathInputRef.current?.select();
				}
			}, [editingPath]);
			(0, react.useEffect)(() => {
				if (folderDraft !== null) newFolderInputRef.current?.focus();
				if (folderDraft === null && restoreNewFolderFocus) {
					newFolderBtnRef.current?.focus();
					setRestoreNewFolderFocus(false);
				}
			}, [folderDraft, restoreNewFolderFocus]);
			const close = () => {
				if (busy || creating) return;
				requestSeq.current += 1;
				openGeneration.current += 1;
				controller.current?.abort();
				controller.current = null;
				onClose();
			};
			const createFolder = () => {
				const name = folderDraft?.trim() ?? "";
				const targetPath = resolveNewFolderTarget(selected?.path, listing?.path);
				if (targetPath === void 0 || name === "" || creating || busy) return;
				const generation = openGeneration.current;
				setCreating(true);
				setError(null);
				createDirectory(targetPath, name).then((createdPath) => {
					if (generation !== openGeneration.current) return;
					setCreating(false);
					setRestoreNewFolderFocus(true);
					setFolderDraft(null);
					setSelected(null);
					navigate(createdPath);
				}, (reason) => {
					if (generation !== openGeneration.current) return;
					setCreating(false);
					setError(failureText(reason));
				});
			};
			const handlePathSubmit = () => {
				const trimmed = pathInput.trim();
				if (trimmed !== "") {
					setEditingPath(false);
					navigate(trimmed);
					editPathBtnRef.current?.focus();
				}
			};
			const targetPath = selected?.path ?? listing?.path;
			const visibleEntries = filterDirectoryEntries(listing?.entries ?? [], showHidden);
			const formattedCrumbs = formatCrumbs(listing?.crumbs, listing?.home, strings.home);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open,
				onClose: close,
				closeLabel: strings.cancel,
				title: strings.title,
				className: "wgDirectoryDialog",
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled: busy || creating,
					onClick: close,
					children: strings.cancel
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					disabled: targetPath === void 0 || error !== null || loading || busy || creating,
					onClick: () => {
						if (targetPath !== void 0) onPick(targetPath);
					},
					children: strings.open
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wgDirectoryBrowser",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgDirectoryToolbar",
							children: [editingPath ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgDirectoryPathEdit",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: pathInputRef,
										className: "wgDirectoryPathInput",
										value: pathInput,
										placeholder: strings.pathPlaceholder ?? "Enter path…",
										disabled: busy || creating || loading,
										onChange: (e) => setPathInput(e.target.value),
										onKeyDown: (e) => {
											if (isImeComposing(e)) return;
											if (e.key === "Enter") {
												e.preventDefault();
												handlePathSubmit();
											} else if (e.key === "Escape") {
												setEditingPath(false);
												editPathBtnRef.current?.focus();
											}
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										disabled: busy || creating || loading || pathInput.trim() === "",
										onClick: handlePathSubmit,
										children: strings.go ?? "Go"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										disabled: busy || creating,
										onClick: () => {
											setEditingPath(false);
											editPathBtnRef.current?.focus();
										},
										children: strings.cancel
									})
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgDirectoryCrumbs",
								"aria-label": strings.title,
								children: formattedCrumbs.map((crumb, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "wgDirectoryCrumbPart",
									children: [index > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { size: 12 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: busy || creating || crumb.path === listing?.path,
										onClick: () => {
											navigate(crumb.path);
										},
										children: crumb.name
									})]
								}, crumb.path))
							}), !editingPath && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgDirectoryToolbarActions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									ref: editPathBtnRef,
									type: "button",
									className: "wgDirectoryIconButton",
									title: "Edit path",
									"aria-label": "Edit path",
									disabled: busy || creating || loading,
									onClick: () => {
										setPathInput(listing?.path ?? currentPath.current ?? "");
										setEditingPath(true);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgDirectoryIconButton",
									title: strings.refresh ?? "Refresh",
									"aria-label": strings.refresh ?? "Refresh",
									disabled: busy || creating || loading,
									onClick: () => {
										navigate(currentPath.current ?? listing?.path);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline14, { size: 14 })
								})]
							})]
						}),
						loading && listing === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgDirectoryStatus",
							role: "status",
							children: strings.loading
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgDirectoryError",
							role: "alert",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: error }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								disabled: loading || busy,
								onClick: () => {
									navigate(currentPath.current ?? listing?.path);
								},
								children: strings.retry
							})]
						}),
						listing !== null && listing.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgDirectoryTruncated",
							role: "status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: strings.truncated ?? "Listing truncated — too many directory entries" })]
						}),
						listing !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgDirectoryList",
							role: "listbox",
							"aria-label": listing.path,
							children: visibleEntries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "option",
								"aria-selected": selected?.path === entry.path,
								className: `wgDirectoryRow${selected?.path === entry.path ? " wgDirectoryRowSelected" : ""}`,
								disabled: busy || creating,
								onClick: () => {
									setSelected(entry);
								},
								onDoubleClick: () => {
									navigate(entry.path);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, { size: 16 }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: entry.name }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { size: 12 })
								]
							}, entry.path))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgDirectoryBottomBar",
							children: [listing !== null && folderDraft === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								ref: newFolderBtnRef,
								type: "button",
								className: "wgDirectoryNewFolder",
								disabled: busy || creating,
								onClick: () => {
									setFolderDraft("");
								},
								children: strings.newFolder
							}), listing !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "wgDirectoryHiddenToggle",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: showHidden,
									disabled: busy || creating,
									onChange: (e) => setShowHidden(e.target.checked)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: strings.showHidden ?? "Show hidden" })]
							})]
						}),
						folderDraft !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgDirectoryCreate",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: newFolderInputRef,
									value: folderDraft,
									"aria-label": strings.folderName,
									placeholder: strings.folderName,
									disabled: busy || creating,
									onChange: (event) => {
										setFolderDraft(event.target.value);
									},
									onKeyDown: (event) => {
										if (isImeComposing(event)) return;
										if (event.key === "Enter") {
											event.preventDefault();
											createFolder();
										} else if (event.key === "Escape") {
											setRestoreNewFolderFocus(true);
											setFolderDraft(null);
										}
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: busy || creating,
									onClick: () => {
										setRestoreNewFolderFocus(true);
										setFolderDraft(null);
									},
									children: strings.cancel
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: busy || creating || folderDraft.trim() === "",
									onClick: createFolder,
									children: strings.create
								})
							]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/overlay-core.ts
		/**
		* Pure overlay hygiene mutations for ManualGroups overlay management.
		* Kept free of React or runtime state bindings so both client UI actions
		* and unit tests share a single immutable implementation.
		*/
		function isTopLevelKey(key) {
			return key === null || key === void 0 || key === "__topLevel__";
		}
		/**
		* Remove a deleted group from the overlay:
		* - Removes matching category entries from `categories` and `categoryOrder`.
		* - Sets matching assignments to `null` (uncategorized), including orphan workspace IDs.
		* - Deletes the group's entry in `workspaceOrder`.
		* - For rule groups (when `originalRuleName` is supplied), updates `renamed` and `hidden`.
		*/
		function removeGroup(manual, groupName, options = {}) {
			const { originalRuleName } = options;
			const categories = (manual.categories ?? []).filter((name) => name !== groupName);
			const assignments = {};
			for (const [id, category] of Object.entries(manual.assignments ?? {})) if (category === groupName || originalRuleName !== void 0 && category === originalRuleName) assignments[id] = null;
			else assignments[id] = category;
			const workspaceOrder = {};
			for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) if (key !== groupName && (originalRuleName === void 0 || key !== originalRuleName)) workspaceOrder[key] = [...ids];
			const categoryOrder = manual.categoryOrder ? manual.categoryOrder.filter((name) => name !== groupName && (originalRuleName === void 0 || name !== originalRuleName)) : void 0;
			let renamed = manual.renamed ? { ...manual.renamed } : void 0;
			if (originalRuleName !== void 0 && renamed) delete renamed[originalRuleName];
			let hidden = manual.hidden ? [...manual.hidden] : void 0;
			if (originalRuleName !== void 0) {
				const hiddenSet = new Set(hidden ?? []);
				hiddenSet.add(originalRuleName);
				hidden = Array.from(hiddenSet);
			}
			let colors = manual.colors ? { ...manual.colors } : void 0;
			if (colors) {
				delete colors[groupName];
				if (originalRuleName !== void 0) delete colors[originalRuleName];
			}
			return {
				...manual,
				categories,
				assignments,
				workspaceOrder,
				...categoryOrder !== void 0 ? { categoryOrder } : {},
				...renamed !== void 0 ? { renamed } : {},
				...hidden !== void 0 ? { hidden } : {},
				...colors !== void 0 ? { colors } : {}
			};
		}
		/**
		* Remove all references to a deleted Workspace from assignments and all workspaceOrder arrays.
		*/
		function removeWorkspace(manual, workspaceId) {
			const assignments = {};
			for (const [id, category] of Object.entries(manual.assignments ?? {})) if (id !== workspaceId) assignments[id] = category;
			const workspaceOrder = {};
			for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) workspaceOrder[key] = ids.filter((id) => id !== workspaceId);
			let colors = manual.colors ? { ...manual.colors } : void 0;
			if (colors) delete colors[workspaceId];
			return {
				...manual,
				assignments,
				workspaceOrder,
				...colors !== void 0 ? { colors } : {}
			};
		}
		/**
		* Move a Workspace across groups or top-level, cleaning stale order references from all other order arrays.
		* Accepts positional arguments or a params object for parameters.
		*/
		function moveWorkspace(manual, params) {
			const { workspaceId, targetCategoryKey, beforeId, afterId, targetMembers } = params;
			const isTopLevel = isTopLevelKey(targetCategoryKey);
			const targetStorageKey = isTopLevel ? TOP_LEVEL_ORDER_KEY : targetCategoryKey;
			const assignmentValue = isTopLevel ? null : targetCategoryKey;
			const workspaceOrder = {};
			for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) workspaceOrder[key] = ids.filter((id) => id !== workspaceId);
			let targetOrder;
			if (targetMembers !== void 0) {
				const baseOrder = orderedWorkspaceIds(manual, targetStorageKey, targetMembers);
				if (afterId !== void 0) targetOrder = moveAfter(baseOrder, workspaceId, afterId);
				else if (beforeId !== void 0) targetOrder = moveBefore(baseOrder, workspaceId, beforeId);
				else targetOrder = moveAfter(baseOrder, workspaceId, void 0);
			} else {
				const existing = workspaceOrder[targetStorageKey] ?? [];
				if (afterId !== void 0) targetOrder = moveAfter(existing, workspaceId, afterId);
				else if (beforeId !== void 0) targetOrder = moveBefore(existing, workspaceId, beforeId);
				else targetOrder = moveAfter(existing, workspaceId, void 0);
			}
			workspaceOrder[targetStorageKey] = targetOrder;
			const assignments = {
				...manual.assignments ?? {},
				[workspaceId]: assignmentValue
			};
			return {
				...manual,
				assignments,
				workspaceOrder
			};
		}
		/**
		* Rename group references consistently across categories, categoryOrder, assignments, workspaceOrder, and renamed.
		*/
		function renameGroup(manual, oldName, newName, options = {}) {
			const { originalRuleName } = options;
			const categories = (manual.categories ?? []).map((name) => name === oldName ? newName : name);
			const categoryOrder = manual.categoryOrder ? manual.categoryOrder.map((name) => name === oldName ? newName : name) : void 0;
			const assignments = {};
			for (const [id, category] of Object.entries(manual.assignments ?? {})) if (category === oldName) assignments[id] = newName;
			else assignments[id] = category;
			const workspaceOrder = {};
			for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) {
				const targetKey = key === oldName ? newName : key;
				workspaceOrder[targetKey] = [...ids];
			}
			let renamed = manual.renamed ? { ...manual.renamed } : void 0;
			if (originalRuleName !== void 0) renamed = {
				...renamed,
				[originalRuleName]: newName
			};
			else if (renamed) {
				for (const [ruleKey, display] of Object.entries(renamed)) if (display === oldName) renamed[ruleKey] = newName;
			}
			let colors = manual.colors ? { ...manual.colors } : void 0;
			if (colors && colors[oldName] !== void 0) {
				colors = {
					...colors,
					[newName]: colors[oldName]
				};
				delete colors[oldName];
			}
			return {
				...manual,
				categories,
				assignments,
				workspaceOrder,
				...categoryOrder !== void 0 ? { categoryOrder } : {},
				...renamed !== void 0 ? { renamed } : {},
				...colors !== void 0 ? { colors } : {}
			};
		}
		/**
		* Set or clear the visual color tag for a group or workspace in the overlay.
		*/
		function setItemColor(manual, itemKey, color) {
			const colors = { ...manual.colors ?? {} };
			if (color === null || color === "") delete colors[itemKey];
			else colors[itemKey] = color;
			return {
				...manual,
				colors
			};
		}
		/** First five sessions, plus the selected session when it falls outside that window. */
		function visibleWorkspaceSessions(sessions, currentId, showAll) {
			if (showAll || sessions.length <= 5) return sessions;
			return sessions.filter((session, index) => index < 5 || session.id === currentId);
		}
		//#endregion
		//#region src/client/rows.tsx
		/**
		* Row components for the workspace-groups tree. Kept dependency-light: they
		* consume only React, primitives (StateDot/Menu/icons), and the shared CSS
		* string. Each row owns its hover actions menu; dialogs live in the browser
		* root so they survive row unmounts during collapse.
		*
		* Drag & drop: workspace rows are draggable sources; category rows (and
		* workspace rows, standing for their containing category) are drop targets.
		* The payload is a custom dataTransfer type so only in-plugin drags land.
		*/
		/** dataTransfer type carrying the dragged workspace id (in-plugin drags only). */
		const DND_WORKSPACE_TYPE = "application/x-dsh-workspace-groups";
		/** dataTransfer type carrying the dragged category key (group reorder). */
		const DND_CATEGORY_TYPE = "application/x-dsh-workspace-groups-category";
		/** Whether a drag carries any of the plugin's payloads (drop targets accept both). */
		function hasPluginDragType(types) {
			const list = Array.from(types);
			return list.includes("application/x-dsh-workspace-groups") || list.includes("application/x-dsh-workspace-groups-category");
		}
		/** Primary status dot state for a session row; idle viewed sessions have no dot. */
		function sessionDotState(node) {
			return sessionAttention(node);
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
		const COLOR_PRESETS = [
			"red",
			"orange",
			"yellow",
			"green",
			"cyan",
			"blue",
			"purple",
			"pink"
		];
		/** Flat portal menu: unlike nested submenus, Menu clamps this list to the viewport. */
		function ColorMenu({ t, color, onSelect }) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: () => {
					setOpen(false);
				},
				items: [{
					id: "color:none",
					label: t("color.reset")
				}, ...COLOR_PRESETS.map((preset) => ({
					id: `color:${preset}`,
					label: t(`color.${preset}`)
				}))],
				selectedId: `color:${color ?? "none"}`,
				onSelect: (id) => {
					setOpen(false);
					const selected = id.slice(6);
					onSelect(selected === "none" ? null : selected);
				},
				portal: true,
				compact: true,
				closeOnPointerLeave: true,
				align: "end",
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "wgIconButton",
					draggable: false,
					"data-wg-color-menu-trigger": true,
					"aria-label": t("color.title"),
					title: t("color.title"),
					onClick: (event) => {
						event.stopPropagation();
						setOpen((value) => !value);
					},
					onKeyDown: (event) => {
						event.stopPropagation();
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgCategoryIcon",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {}), color && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgColorDot",
							"data-color": color
						})]
					})
				})
			});
		}
		/**
		* One category folder row: toggle, rename/delete menu (every group — rule
		* groups via overlay renames/hides), draggable source for group reorder and
		* drop target for both workspace moves and group reorders.
		*/
		function CategoryRow({ node, t, onToggle, onExpandEntire, onCollapseEntire, onRename, onDelete, color, onSetColor, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartCategory, onMoveUp, onMoveDown, isFirst, isLast, canMoveUp, canMoveDown, "aria-level": ariaLevel, "aria-posinset": ariaPosinset, "aria-setsize": ariaSetsize }) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const count = node.workspaces.length;
			const manageable = onRename !== void 0 && onDelete !== void 0 || onExpandEntire !== void 0 || onCollapseEntire !== void 0;
			const handleKeyDown = (event) => {
				if (onToggle === void 0 || event.target !== event.currentTarget) return;
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				onToggle();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgCategoryRow${menuOpen ? " wgMenuOpen" : ""}${dropActive ? " wgDropTarget" : ""}${insertLine === "before" ? " wgInsertBefore" : insertLine === "after" ? " wgInsertAfter" : ""}`,
				role: "treeitem",
				tabIndex: 0,
				"aria-expanded": node.expanded,
				"aria-label": `${node.label} (${count})`,
				"aria-level": ariaLevel,
				"aria-posinset": ariaPosinset,
				"aria-setsize": ariaSetsize,
				"data-wg-category": node.key,
				onClick: onToggle,
				onKeyDown: onToggle === void 0 ? void 0 : handleKeyDown,
				onDragOver: onRowDragOver,
				onDragLeave: onRowDragLeave,
				onDrop: onRowDrop,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
						onClick: (event) => {
							if (!event.altKey) return;
							const toggleEntire = node.expanded ? onCollapseEntire : onExpandEntire;
							if (toggleEntire === void 0) return;
							event.stopPropagation();
							toggleEntire();
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFill14, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgCategoryIcon",
						"data-wg-row-icon": "group",
						children: [node.expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, {}), color && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgColorDot",
							"data-color": color
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryLabel",
						children: node.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryCount",
						children: count
					}),
					!node.expanded && node.attention !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgStatusSlot",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: node.attention })
					}),
					(manageable || onSetColor !== void 0 || onDragStartCategory !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowActions",
						children: [
							onDragStartCategory !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								role: "button",
								tabIndex: 0,
								className: "wgDragHandle",
								"data-wg-drag-handle": "category",
								draggable: true,
								"aria-label": t("group.reorder"),
								title: t("group.reorder"),
								onDragStart: onDragStartCategory,
								onClick: (e) => {
									e.stopPropagation();
								},
								onDoubleClick: (e) => {
									e.stopPropagation();
								},
								onKeyDown: (e) => {
									e.stopPropagation();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wgGripIcon",
									"aria-hidden": "true"
								})
							}),
							onSetColor !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ColorMenu, {
								t,
								color,
								onSelect: onSetColor
							}),
							manageable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								onClose: () => {
									setMenuOpen(false);
								},
								items: [
									...onExpandEntire !== void 0 ? [{
										id: "expandEntire",
										label: t("group.expandEntire")
									}] : [],
									...onCollapseEntire !== void 0 ? [{
										id: "collapseEntire",
										label: t("group.collapseEntire")
									}] : [],
									...onMoveUp !== void 0 ? [{
										id: "moveUp",
										label: t("group.moveUp"),
										disabled: canMoveUp === false || isFirst === true
									}] : [],
									...onMoveDown !== void 0 ? [{
										id: "moveDown",
										label: t("group.moveDown"),
										disabled: canMoveDown === false || isLast === true
									}] : [],
									...onRename !== void 0 ? [{
										id: "rename",
										label: t("group.rename"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {})
									}] : [],
									...onDelete !== void 0 ? [{
										id: "delete",
										label: t("group.delete"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}),
										danger: true
									}] : []
								],
								onSelect: (id) => {
									setMenuOpen(false);
									if (id === "expandEntire") onExpandEntire?.();
									if (id === "collapseEntire") onCollapseEntire?.();
									if (id === "moveUp") onMoveUp?.();
									if (id === "moveDown") onMoveDown?.();
									if (id === "rename") onRename?.();
									if (id === "delete") onDelete?.();
								},
								portal: true,
								closeOnPointerLeave: true,
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									draggable: false,
									"aria-label": `${t("group.actions")}: ${node.label}`,
									onClick: (e) => {
										e.stopPropagation();
										setMenuOpen((v) => !v);
									},
									onKeyDown: (e) => {
										e.stopPropagation();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutline16, {})
								})
							})
						]
					})
				]
			});
		}
		/** One workspace folder row inside a category: draggable source + drop target. */
		function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete, color, onSetColor, canMoveOut = false, onMoveOut, moveTargets, onMoveTo, onMoveUp, onMoveDown, onOpenFolder, onCopyPath, isFirst, isLast, canMoveUp, canMoveDown, flat = false, draggable = false, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onWorkspaceDragStart, "aria-level": ariaLevel, "aria-posinset": ariaPosinset, "aria-setsize": ariaSetsize }) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const menuItems = [
				...onMoveUp !== void 0 ? [{
					id: "moveUp",
					label: t("workspace.moveUp"),
					disabled: canMoveUp === false || isFirst === true
				}] : [],
				...onMoveDown !== void 0 ? [{
					id: "moveDown",
					label: t("workspace.moveDown"),
					disabled: canMoveDown === false || isLast === true
				}] : [],
				...moveTargets !== void 0 && onMoveTo !== void 0 ? [{
					id: "moveToGroup",
					label: t("workspace.moveToGroup"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, { size: 16 }),
					submenu: moveTargets.map((target) => ({
						id: `moveTo:${target.key}`,
						label: target.label,
						disabled: target.current
					}))
				}] : canMoveOut && onMoveOut !== void 0 ? [{
					id: "moveOut",
					label: t("workspace.moveOutOfGroup"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, { size: 16 })
				}] : [],
				...onOpenFolder !== void 0 ? [{
					id: "openFolder",
					label: t("workspace.openFolder"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, { size: 16 })
				}] : [],
				...onCopyPath !== void 0 ? [{
					id: "copyPath",
					label: t("workspace.copyPath"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 16 })
				}] : [],
				...onRename !== void 0 ? [{
					id: "rename",
					label: t("workspace.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {})
				}] : [],
				...onDelete !== void 0 ? [{
					id: "delete",
					label: t("workspace.delete"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}),
					danger: true
				}] : []
			];
			const onDragStart = (event) => {
				event.dataTransfer.setData(DND_WORKSPACE_TYPE, node.workspaceId);
				event.dataTransfer.effectAllowed = "move";
				onWorkspaceDragStart?.(node.workspaceId, event);
			};
			const handleKeyDown = (event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				onToggle?.();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgProjectRow${node.containsCurrent ? " wgProjectActive" : ""}${flat ? " wgProjectFlat" : ""}${menuOpen ? " wgMenuOpen" : ""}${dropActive ? " wgDropTarget" : ""}${insertLine === "before" ? " wgInsertBefore" : insertLine === "after" ? " wgInsertAfter" : ""}`,
				role: "treeitem",
				tabIndex: 0,
				"aria-expanded": node.expanded,
				"aria-label": node.label,
				"aria-level": ariaLevel,
				"aria-posinset": ariaPosinset,
				"aria-setsize": ariaSetsize,
				"data-wsid": node.workspaceId,
				onClick: onToggle,
				onKeyDown: onToggle === void 0 ? void 0 : handleKeyDown,
				onDragOver: onRowDragOver,
				onDragLeave: onRowDragLeave,
				onDrop: onRowDrop,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgWorkspaceDragSource",
						"data-wg-drag-source": "workspace",
						draggable,
						onDragStart: draggable ? onDragStart : void 0,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFill14, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "wgCategoryIcon",
								"data-wg-row-icon": "project",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutline16, {}), color && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wgColorDot",
									"data-color": color
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wgProjectLabel",
								title: node.path,
								children: node.label
							})
						]
					}),
					!node.expanded && node.attention !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgStatusSlot",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: node.attention })
					}),
					(menuItems.length > 0 || onSetColor !== void 0 || onNewSession !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowActions",
						children: [
							onSetColor !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ColorMenu, {
								t,
								color,
								onSelect: onSetColor
							}),
							menuItems.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								onClose: () => {
									setMenuOpen(false);
								},
								items: menuItems,
								onSelect: (id) => {
									setMenuOpen(false);
									if (id === "moveUp") onMoveUp?.();
									if (id === "moveDown") onMoveDown?.();
									if (id === "openFolder") onOpenFolder?.();
									if (id === "copyPath") onCopyPath?.();
									if (id === "moveOut") onMoveOut?.();
									if (id.startsWith("moveTo:")) onMoveTo?.(id.slice(7));
									if (id === "rename") onRename?.();
									if (id === "delete") onDelete?.();
								},
								portal: true,
								closeOnPointerLeave: true,
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									draggable: false,
									"aria-label": `${t("workspace.actions")}: ${node.label}`,
									onClick: (e) => {
										e.stopPropagation();
										setMenuOpen((v) => !v);
									},
									onKeyDown: (e) => {
										e.stopPropagation();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutline16, {})
								})
							}),
							onNewSession !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								draggable: false,
								"aria-label": `${t("session.new")} ${node.label}`,
								onClick: (e) => {
									e.stopPropagation();
									onNewSession();
								},
								onKeyDown: (e) => {
									e.stopPropagation();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, {})
							})
						]
					})
				]
			});
		}
		/** One session leaf row. */
		function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive, actionBusy = false, "aria-level": ariaLevel, "aria-posinset": ariaPosinset, "aria-setsize": ariaSetsize }) {
			const selected = node.id === currentId;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const dotState = sessionDotState(node);
			const menuItems = [
				...onRename !== void 0 ? [{
					id: "rename",
					label: t("session.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {})
				}] : [],
				...onFork !== void 0 ? [{
					id: "fork",
					label: t("session.fork"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, {}),
					disabled: actionBusy
				}] : [],
				...onArchive !== void 0 ? [{
					id: "archive",
					label: t("session.archive"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, { size: 16 }),
					disabled: actionBusy
				}] : []
			];
			const handleKeyDown = (event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				onOpen(node.id);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgSessionRow${selected ? " wgSelected" : ""}${menuOpen ? " wgMenuOpen" : ""}${node.matched === true ? " wgMatched" : ""}`,
				role: "treeitem",
				tabIndex: 0,
				"aria-selected": selected,
				"aria-current": selected ? "true" : void 0,
				"aria-label": node.title,
				"aria-level": ariaLevel,
				"aria-posinset": ariaPosinset,
				"aria-setsize": ariaSetsize,
				onClick: () => {
					onOpen(node.id);
				},
				onKeyDown: handleKeyDown,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgStatusSlot",
						children: dotState !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState })
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
					!node.blank && menuItems.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgRowActions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: menuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								if (id === "rename") onRename?.(node.id, node.title);
								if (id === "fork") onFork?.(node.id);
								if (id === "archive") onArchive?.(node.id);
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								"aria-label": `${t("session.actions")}: ${node.title}`,
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								onKeyDown: (e) => {
									e.stopPropagation();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutline16, {})
							})
						})
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-workspace-groups-inline-css:src/client/styles.css.mjs
		var styles_css_default = ".wgRoot{flex-direction:column;flex:1;min-height:0;display:flex}.wgSectionHeader{box-sizing:border-box;flex:none;align-items:center;gap:4px;height:36px;padding:0 8px;display:flex;overflow:hidden}.wgSectionLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:45%;color:var(--dsw-alias-label-tertiary,var(--dsw-fg-1,inherit));opacity:1;visibility:visible;flex:1;font-size:13px;font-weight:600;transition:max-width .18s,margin-right .18s,opacity .12s,transform .18s,visibility linear;overflow:hidden}.wgSectionLabelHidden{opacity:0;visibility:hidden;max-width:0;margin-right:-4px;transition-delay:0s,0s,0s,0s,.18s;transform:translate(-4px)}.wgHeaderActions{opacity:1;visibility:visible;flex:none;align-items:center;gap:4px;max-width:96px;transition:max-width .18s,opacity .12s,transform .18s,visibility linear;display:flex;overflow:hidden}.wgHeaderActionsHidden{opacity:0;visibility:hidden;pointer-events:none;max-width:0;transition-delay:0s,0s,0s,.18s;transform:translate(4px)}.wgIconButton{box-sizing:border-box;width:28px;height:28px;color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));cursor:pointer;background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;transition:background-color .12s,color .12s;display:inline-flex}.wgIconButton:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgIconButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:1px}.wgIconButton:disabled{opacity:.4;cursor:default}.wgSearch{box-sizing:border-box;background:0 0;border-radius:50%;flex:1;align-items:center;min-width:0;max-width:28px;height:28px;margin-left:auto;transition:max-width .18s,border-radius .18s,background-color .18s;display:flex}.wgSearchExpanded{border:1px solid var(--dsw-alias-border-l2,var(--dsw-border,#7f7f7f4d));border-radius:8px;max-width:100%;height:30px;padding:0 4px}.wgSearchInput{min-width:0;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));background:0 0;border:none;outline:none;flex:1;padding:0 4px;font-size:13px;line-height:18px}.wgSearchInput::placeholder{color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,#7f7f7fcc))}.wgSearchExpanded:focus-within{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:1px}.wgSearchExpanded .wgIconButton:focus-visible,.wgSearchInput:focus-visible{outline:none}.wgTreeBody{flex-direction:column;flex:1;min-height:0;padding:0 8px 8px;display:flex;overflow:hidden}.wgTreeControls{flex:none}.wgTreeScroller{flex:1;min-height:0;overflow-y:auto}.wgList{flex-direction:column;gap:2px;display:flex}.wgEmpty{text-align:center;color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,#7f7f7fcc));padding:16px 8px;font-size:13px}.wgCategoryRow{box-sizing:border-box;cursor:pointer;user-select:none;height:34px;color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));border-radius:8px;align-items:center;gap:6px;padding:0 8px;font-size:13px;font-weight:600;transition:background-color .12s,color .12s;display:flex;position:relative}.wgCategoryRow:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgCategoryRow:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:-2px}.wgCategoryRow.wgMenuOpen{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgCategoryRow:hover .wgRowActions,.wgCategoryRow:focus-within .wgRowActions,.wgCategoryRow.wgMenuOpen .wgRowActions{opacity:1}.wgDropTarget{background:var(--dsw-alias-state-business-tertiary,var(--dsw-bg-selected,#4a90d92e));outline:1px dashed var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:-1px}.wgInsertBefore:before,.wgInsertAfter:after{content:\"\";background:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));height:2px;box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9)) 25%, transparent);pointer-events:none;z-index:6;border-radius:1px;position:absolute;left:2px;right:2px}.wgInsertBefore:before{top:-1px}.wgInsertAfter:after{bottom:-1px}.wgChevron{width:14px;height:14px;color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,#7f7f7fcc));flex:none;justify-content:center;align-items:center;transition:transform .15s;display:inline-flex}.wgChevronOpen{transform:rotate(90deg)}.wgCategoryIcon{color:var(--dsw-alias-label-tertiary,var(--dsw-fg-2,inherit));flex:none;justify-content:center;align-items:center;display:inline-flex}.wgCategoryLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:inherit;flex:1;font-size:13px;font-weight:600;overflow:hidden}.wgCategoryCount{color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,#7f7f7fcc));flex:none;font-size:11px;font-weight:400}.wgProjectRow{box-sizing:border-box;cursor:pointer;user-select:none;height:34px;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));border-radius:8px;align-items:center;gap:6px;padding:0 8px 0 24px;transition:background-color .12s;display:flex;position:relative}.wgProjectFlat{padding-left:8px}.wgTopLevelArea{margin-top:2px;padding-bottom:10px}.wgTopLevelEmpty{border-radius:4px;height:14px;position:relative}.wgTopLevelEmptyLine{background:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));height:2px;box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9)) 25%, transparent);pointer-events:none;border-radius:1px;position:absolute;top:50%;left:2px;right:2px}.wgTopLevelEmptyActive{background:var(--dsw-alias-state-business-tertiary,var(--dsw-bg-selected,#4a90d92e))}[data-wg-category-drop-end],.wgCategoryDropEnd{box-sizing:border-box;border-radius:4px;height:8px;position:relative}.wgCategoryDropEndActive{height:18px}.wgCategoryDropEndLine{background:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));pointer-events:none;border-radius:1px;height:2px;position:absolute;top:50%;left:2px;right:2px}[data-wg-category-drop-end].wgDropTarget,.wgCategoryDropEnd.wgDropTarget{background:var(--dsw-alias-state-business-tertiary,var(--dsw-bg-selected,#4a90d92e));outline:1px dashed var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:-1px}[data-wg-category-drop-end].wgInsertAfter:after,[data-wg-category-drop-end].wgInsertBefore:before,.wgCategoryDropEnd.wgInsertAfter:after,.wgCategoryDropEnd.wgInsertBefore:before{content:\"\";background:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));height:2px;box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9)) 25%, transparent);pointer-events:none;z-index:6;border-radius:1px;position:absolute;top:50%;left:2px;right:2px}.wgProjectRow:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgProjectRow:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:-2px}.wgProjectRow.wgMenuOpen{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgProjectActive,.wgProjectActive .wgCategoryIcon{color:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9))}.wgProjectActive .wgProjectLabel{color:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));font-weight:600}.wgWorkspaceDragSource{flex:1;align-items:center;gap:6px;min-width:0;display:flex}.wgWorkspaceDragSource[draggable=true]{cursor:grab;-webkit-user-select:none;user-select:none;-webkit-user-drag:element}.wgWorkspaceDragSource[draggable=true]:active{cursor:grabbing}.wgProjectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));flex:1;font-size:13px;font-weight:500;overflow:hidden}.wgRowActions{opacity:0;flex:none;align-items:center;gap:2px;transition:opacity .12s;display:inline-flex}.wgRowActions .wgIconButton{width:24px;height:24px}.wgDragHandle,[data-wg-drag-handle=category]{box-sizing:border-box;width:28px;min-width:28px;height:28px;min-height:28px;color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,#7f7f7fcc));cursor:grab;-webkit-user-select:none;user-select:none;-webkit-user-drag:element;touch-action:none;background:0 0;border:none;border-radius:4px;flex:none;justify-content:center;align-items:center;padding:0;transition:background-color .12s,color .12s;display:inline-flex}.wgDragHandle:active,[data-wg-drag-handle=category]:active{cursor:grabbing}.wgDragHandle:hover,[data-wg-drag-handle=category]:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgDragHandle:focus-visible,[data-wg-drag-handle=category]:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:1px}.wgGripIcon{opacity:.7;background-image:radial-gradient(circle at 1.5px 1.5px,currentColor 1.2px,#0000 1.2px);background-repeat:repeat;background-size:5px 4.5px;width:8px;height:12px;display:inline-block}.wgDragHandle:hover .wgGripIcon,[data-wg-drag-handle=category]:hover .wgGripIcon,.wgProjectRow:hover .wgRowActions,.wgProjectRow:focus-within .wgRowActions,.wgProjectRow.wgMenuOpen .wgRowActions{opacity:1}.wgSessionRow{box-sizing:border-box;cursor:pointer;user-select:none;height:32px;color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));border-radius:8px;align-items:center;gap:6px;padding:0 8px 0 40px;transition:background-color .12s,color .12s;display:flex;position:relative}.wgSessionRow:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgSessionRow:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:-2px}.wgSessionRow.wgMenuOpen{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgSessionRow:hover .wgRowActions,.wgSessionRow:focus-within .wgRowActions,.wgSessionRow.wgMenuOpen .wgRowActions{opacity:1}.wgSelected{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-selected,#4a90d92e));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgSelected .wgSessionTitle{color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-weight:500}.wgStatusSlot{flex:none;justify-content:center;align-items:center;width:14px;height:14px;display:inline-flex}.wgSessionTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary,var(--dsw-fg-1,inherit));flex:1;font-size:13px;overflow:hidden}.wgSessionRow:hover .wgSessionTitle{color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgSessionTime{color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,#7f7f7fcc));flex:none;font-size:11px}.wgSessionToggle{box-sizing:border-box;align-items:center;height:28px;padding:0 8px 0 40px;display:flex}.wgSessionToggleBtn{color:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));cursor:pointer;background:0 0;border:none;border-radius:4px;padding:2px 6px;font-size:12px;font-weight:500;transition:background-color .12s}.wgSessionToggleBtn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgSessionToggleBtn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:1px}.wgVisuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.wgMatched{background:var(--dsw-alias-state-business-tertiary,var(--dsw-bg-selected,#4a90d92e))}.wgSessionSnippet{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,#7f7f7fcc));flex:1;font-size:11px;overflow:hidden}.wgSearchStatus{color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,#7f7f7fcc));text-align:center;padding:8px 12px;font-size:12px;line-height:18px}.wgManualError{color:var(--dsw-alias-state-error-primary,var(--dsw-fg-1,inherit));text-align:left;word-break:break-word}.wgRail{flex-direction:column;align-items:center;gap:4px;padding:8px 0;display:flex}.wgRail .wgIconButton{width:36px;height:36px;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgAddError{color:var(--dsw-alias-state-error-primary,var(--dsw-fg-1,inherit));white-space:pre-wrap;word-break:break-word;max-height:200px;font-size:12px;line-height:18px;overflow-y:auto}.wgRenameInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,var(--dsw-border,#7f7f7f4d));background:var(--dsw-alias-bg-base,var(--dsw-bg-1,transparent));width:100%;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));border-radius:8px;outline:none;padding:6px 10px;font-size:13px;line-height:20px;transition:border-color .12s}.wgRenameInput:focus{border-color:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9))}.wgRenameInput:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:-1px}@media (hover:none),(pointer:coarse){.wgRowActions,.wgDragHandle,[data-wg-drag-handle=category]{opacity:1}}.wgCategoryIcon{justify-content:center;align-items:center;display:inline-flex;position:relative}.wgColorDot{width:7px;height:7px;box-shadow:0 0 0 1.5px var(--dsw-bg-1,#1e1e1e);border-radius:50%;flex:none;display:inline-block;position:absolute;bottom:-1px;right:-2px}.wgColorDot[data-color=red]{background-color:#ef4444}.wgColorDot[data-color=orange]{background-color:#f97316}.wgColorDot[data-color=yellow]{background-color:#eab308}.wgColorDot[data-color=green]{background-color:#22c55e}.wgColorDot[data-color=cyan]{background-color:#06b6d4}.wgColorDot[data-color=blue]{background-color:#3b82f6}.wgColorDot[data-color=purple]{background-color:#a855f7}.wgColorDot[data-color=pink]{background-color:#ec4899}@media (prefers-reduced-motion:reduce){.wgSectionLabel,.wgHeaderActions,.wgSearch,.wgIconButton,.wgDragHandle,[data-wg-drag-handle=category],.wgCategoryRow,.wgProjectRow,.wgSessionRow,.wgChevron,.wgRowActions,.wgRenameInput,.wgSessionToggleBtn,.wgStatusScopeBtn,.wgFilterSelectBtn,.wgFilterResetBtn{transition:none!important;animation:none!important}}.wgFilterBar{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-interactive-border,var(--dsw-border-1,#7f7f7f33));background:var(--dsw-alias-interactive-bg-secondary,var(--dsw-bg-2,transparent));align-items:center;gap:4px;padding:6px 8px;display:flex}.wgStatusScopeBar{scrollbar-width:none;flex:auto;align-items:center;gap:4px;min-width:0;display:flex;overflow-x:auto}.wgStatusScopeBar::-webkit-scrollbar{display:none}.wgStatusScopeBtn{box-sizing:border-box;color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));cursor:pointer;white-space:nowrap;background:0 0;border:1px solid #0000;border-radius:4px;align-items:center;gap:4px;padding:3px 8px;font-size:12px;font-weight:500;transition:background-color .12s,color .12s,border-color .12s;display:inline-flex}.wgStatusScopeBtn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgStatusScopeBtn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:1px}.wgStatusScopeBtnActive{background:var(--dsw-alias-interactive-bg-active,#7f7f7f33);color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));border-color:var(--dsw-alias-interactive-border,var(--dsw-border-1,#7f7f7f4d));font-weight:600}.wgCountBadge{box-sizing:border-box;background:var(--dsw-alias-interactive-bg-hover,#7f7f7f26);border-radius:8px;justify-content:center;align-items:center;min-width:16px;height:16px;padding:0 4px;font-size:11px;line-height:1;display:inline-flex}.wgFilterSelectBtn{box-sizing:border-box;border:1px solid var(--dsw-alias-interactive-border,var(--dsw-border-1,#7f7f7f33));color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));cursor:pointer;white-space:nowrap;background:0 0;border-radius:4px;flex:none;align-items:center;gap:4px;padding:2px 8px;font-size:11px;transition:background-color .12s,border-color .12s;display:inline-flex}.wgFilterSelectBtn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgFilterSelectBtn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));outline-offset:1px}.wgFilterSelectBtnActive{border-color:var(--dsw-alias-state-business-primary,var(--dsw-accent,#4a90d9));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-weight:600}.wgFilterColorDot{border-radius:50%;flex:none;width:8px;height:8px;display:inline-block}.wgFilterColorDot[data-color=red]{background-color:#ef4444}.wgFilterColorDot[data-color=orange]{background-color:#f97316}.wgFilterColorDot[data-color=yellow]{background-color:#eab308}.wgFilterColorDot[data-color=green]{background-color:#22c55e}.wgFilterColorDot[data-color=cyan]{background-color:#06b6d4}.wgFilterColorDot[data-color=blue]{background-color:#3b82f6}.wgFilterColorDot[data-color=purple]{background-color:#a855f7}.wgFilterColorDot[data-color=pink]{background-color:#ec4899}.wgFilterSummary{box-sizing:border-box;background:var(--dsw-alias-interactive-bg-secondary,#7f7f7f14);flex-wrap:wrap;align-items:center;gap:4px;padding:4px 8px;font-size:11px;display:flex}.wgFilterSummaryLabel{color:var(--dsw-alias-label-tertiary,var(--dsw-fg-3,inherit));font-weight:500}.wgFilterChip{background:var(--dsw-alias-interactive-bg-hover,#7f7f7f2e);color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));border-radius:3px;align-items:center;gap:4px;padding:1px 6px;font-size:11px;display:inline-flex}.wgFilterResetBtn{margin-left:auto}.wgEmptyReset{margin:8px auto 0}@media (pointer:coarse){.wgStatusScopeBtn{padding:6px 10px;font-size:13px}.wgFilterSelectBtn{padding:5px 10px;font-size:12px}}";
		//#endregion
		//#region src/client/GroupsBrowser.tsx
		/**
		* The workspace-groups browsing region filling the sidebar shell's
		* `sidebar.workspaces` hole: section header (title + right-aligned search +
		* tree controls + new-group + add workspace), the three-level tree (category
		* → workspace → session), group management dialogs, and the workspace/session dialogs. Wide
		* state renders the full browser; rail state renders the two region icons
		* (search / add workspace) as 36px controls on the shell's shared rail entry
		* path, each requesting expansion through the owner share.
		*
		* Data: workspaces/sessions via the framework global hooks; grouping config
		* via the host half's `/workspace-groups/config` route (refetched on mount).
		* Runtime group management (create/rename/delete any group, drag workspaces
		* between groups and into position, drag groups into position) persists
		* through `PUT /workspace-groups/manual`; the sidecar YAML is never rewritten
		* (rule-group rename/delete ride the overlay `renamed`/`hidden` maps).
		*/
		const SEARCH_DEBOUNCE_MS = 250;
		const SEARCH_QUERY_MAX_CODE_UNITS = 500;
		const EMPTY_FILTER_COUNTS = {
			all: 0,
			warning: 0,
			ongoing: 0,
			done: 0
		};
		const EMPTY_MANUAL = {
			categories: [],
			assignments: {},
			categoryOrder: [],
			workspaceOrder: {},
			renamed: {},
			hidden: [],
			colors: {}
		};
		/** Materialize optional overlay fields so every update is a plain object edit. */
		function normalizeManual(manual) {
			return {
				categories: manual.categories,
				assignments: manual.assignments,
				categoryOrder: manual.categoryOrder ?? [],
				workspaceOrder: manual.workspaceOrder ?? {},
				renamed: manual.renamed ?? {},
				hidden: manual.hidden ?? [],
				colors: manual.colors ?? {}
			};
		}
		function sanitizeSearchQuery(value) {
			const withoutNul = value.replaceAll("\0", "");
			if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
			return withoutNul.slice(0, SEARCH_QUERY_MAX_CODE_UNITS);
		}
		/** Light runtime guard for the manual overlay attached to the config fetch. */
		function isManualGroups(value) {
			if (typeof value !== "object" || value === null) return false;
			const candidate = value;
			return Array.isArray(candidate.categories) && typeof candidate.assignments === "object" && candidate.assignments !== null;
		}
		/** Minimal fetch of the grouping config + runtime overlay (no-cache revalidation). */
		async function fetchGroupsConfig() {
			const response = await fetch("/workspace-groups/config", { cache: "no-cache" });
			if (!response.ok) throw new Error(`config request failed: ${response.status}`);
			const body = await response.json();
			const config = Array.isArray(body.categories) ? body : { categories: [] };
			const etag = response.headers.get("etag") || response.headers.get("ETag") || "";
			const revision = typeof body.revision === "string" && body.revision !== "" ? body.revision : etag.replace(/^W\/"|"$/g, "");
			return {
				config,
				manual: isManualGroups(body.manual) ? normalizeManual(body.manual) : EMPTY_MANUAL,
				revision
			};
		}
		var SaveConflictError = class extends Error {
			constructor(message = "conflict") {
				super(message);
				this.name = "SaveConflictError";
			}
		};
		function isConflictError(reason) {
			return reason instanceof SaveConflictError || reason instanceof Error && (reason.name === "SaveConflictError" || reason.message === "conflict" || reason.status === 409);
		}
		/** Persist the whole runtime overlay (idempotent; the host validates + writes). */
		async function saveManualOverlay(manual, expectedRevision) {
			const response = await fetch("/workspace-groups/manual", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					expectedRevision,
					manual
				})
			});
			if (response.status === 409) throw new SaveConflictError();
			if (!response.ok) {
				let message = `manual save failed: ${response.status}`;
				try {
					const text = await response.text();
					if (text !== "") message = text;
				} catch {}
				throw new Error(message);
			}
			const body = await response.json();
			const etag = response.headers.get("etag") || response.headers.get("ETag") || "";
			return { revision: typeof body.revision === "string" && body.revision !== "" ? body.revision : etag.replace(/^W\/"|"$/g, "") };
		}
		function SidebarFilterMenu({ filter, onChange, onReset, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: () => {
					setOpen(false);
				},
				items: [
					{
						type: "label",
						id: "color-label",
						text: t("color.title")
					},
					{
						id: "color:none",
						label: t("color.reset")
					},
					...COLOR_PRESETS.map((color) => ({
						id: `color:${color}`,
						label: t(`color.${color}`),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgFilterColorDot",
							"data-color": color
						})
					})),
					{
						type: "separator",
						id: "filter-separator"
					},
					{
						type: "label",
						id: "recency-label",
						text: t("filter.recency")
					},
					{
						id: "recency:all",
						label: t("filter.recency.all")
					},
					{
						id: "recency:24h",
						label: t("filter.recency.24h")
					},
					{
						id: "recency:7d",
						label: t("filter.recency.7d")
					},
					{
						id: "recency:30d",
						label: t("filter.recency.30d")
					}
				],
				footer: [{
					id: "filter:reset",
					label: t("filter.reset")
				}],
				selectedIds: [`color:${filter.color ?? "none"}`, `recency:${filter.recency}`],
				onSelect: (id) => {
					if (id === "filter:reset") onReset();
					else if (id.startsWith("color:")) {
						const color = id.slice(6);
						onChange({
							...filter,
							color: color === "none" ? null : color
						});
					} else if (id.startsWith("recency:")) onChange({
						...filter,
						recency: id.slice(8)
					});
				},
				portal: true,
				compact: true,
				closeOnPointerLeave: true,
				align: "end",
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: `wgFilterSelectBtn${filter.color !== null || filter.recency !== "all" ? " wgFilterSelectBtnActive" : ""}`,
					"aria-label": t("filter.title"),
					"aria-expanded": open,
					onClick: (event) => {
						event.stopPropagation();
						setOpen((value) => !value);
					},
					children: t("filter.title")
				})
			});
		}
		/**
		* Render the browsing region.
		* @param props - composed slot props (shell owner share + store + injected actions).
		* @returns the region element tree.
		*/
		function GroupsBrowser({ wide, expandSidebar, useSessions, useWorkspaces, useStore, actions, startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, listDirectory, createDirectory, searchSessions, searchResultLimit, t }) {
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
			const [manual, setManual] = (0, react.useState)(EMPTY_MANUAL);
			const [revision, setRevision] = (0, react.useState)("");
			const [configError, setConfigError] = (0, react.useState)(null);
			const [conflictError, setConflictError] = (0, react.useState)(false);
			const reloadConfig = () => {
				setConfigError(null);
				return fetchGroupsConfig().then(({ config: nextConfig, manual: nextManual, revision: nextRevision }) => {
					setConfig(nextConfig);
					setManual(nextManual);
					setRevision(nextRevision);
					return {
						config: nextConfig,
						manual: nextManual,
						revision: nextRevision
					};
				}).catch((reason) => {
					setConfigError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			(0, react.useEffect)(() => {
				reloadConfig();
			}, []);
			const [manualError, setManualError] = (0, react.useState)(null);
			const [manualSaving, setManualSaving] = (0, react.useState)(false);
			const workspaces = useWorkspaces((state) => state.items);
			const workspacePhase = useWorkspaces((state) => state.phase);
			const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
			const categoryExpansion = useStore((s) => s.categoryExpansion);
			const workspaceExpansion = useStore((s) => s.workspaceExpansion);
			const list = useSessions((s) => s);
			const current = list.current;
			const now = Date.now();
			const currentWorkspaceKey = current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(current))?.workspaceId;
			(0, react.useEffect)(() => {
				if (current === void 0 || currentWorkspaceKey === void 0) return;
				const category = categoriesForCurrent(config, workspaces, current, manual);
				if (category !== void 0 && !Object.hasOwn(categoryExpansion, category)) actions.setCategoryExpanded(category, true);
				if (!Object.hasOwn(workspaceExpansion, currentWorkspaceKey)) actions.setWorkspaceExpanded(currentWorkspaceKey, true);
			}, [
				current,
				currentWorkspaceKey,
				config,
				workspaces,
				manual,
				categoryExpansion,
				workspaceExpansion,
				actions
			]);
			(0, react.useEffect)(() => {
				if (workspacePhase !== "ready") return;
				actions.retainKeys(displayCategoryKeys(config, manual), workspaces.map((w) => w.workspaceId));
			}, [
				actions,
				config,
				manual,
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
			const [filter, setFilter] = (0, react.useState)(DEFAULT_SIDEBAR_FILTER);
			const isFilterActive = sidebarFilterActive(filter);
			const [filterCategoryExpansion, setFilterCategoryExpansion] = (0, react.useState)({});
			const [filterWorkspaceExpansion, setFilterWorkspaceExpansion] = (0, react.useState)({});
			const [searchCounts, setSearchCounts] = (0, react.useState)(null);
			const reportSearchCounts = (0, react.useCallback)((next) => {
				setSearchCounts((previous) => previous !== null && previous.all === next.all && previous.warning === next.warning && previous.ongoing === next.ongoing && previous.done === next.done ? previous : next);
			}, []);
			const resetFilter = (0, react.useCallback)(() => {
				setFilter(DEFAULT_SIDEBAR_FILTER);
				setFilterCategoryExpansion({});
				setFilterWorkspaceExpansion({});
			}, []);
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
					setSearchCounts(null);
					return;
				}
				const controller = new AbortController();
				setRemoteSearch({
					query: normalizedQuery,
					status: "loading",
					items: [],
					hasMore: false
				});
				setSearchCounts(null);
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
			const allCategoryKeys = (0, react.useMemo)(() => displayCategoryKeys(config, manual), [config, manual]);
			const allWorkspaceIds = (0, react.useMemo)(() => workspaces.map((w) => w.workspaceId), [workspaces]);
			const fullIdleGroups = (0, react.useMemo)(() => deriveGroups(list, workspaces, archivedSessionIds, config, {
				expandedCategories: allCategoryKeys,
				expandedWorkspaces: allWorkspaceIds
			}, manual), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				manual,
				allCategoryKeys,
				allWorkspaceIds
			]);
			const fullIdleTopLevel = (0, react.useMemo)(() => deriveTopLevel(list, workspaces, archivedSessionIds, config, {
				expandedCategories: allCategoryKeys,
				expandedWorkspaces: allWorkspaceIds
			}, manual), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				manual,
				allCategoryKeys,
				allWorkspaceIds
			]);
			const filterResult = (0, react.useMemo)(() => applySidebarFilter(fullIdleGroups, fullIdleTopLevel, filter, manual.colors, now), [
				fullIdleGroups,
				fullIdleTopLevel,
				filter,
				manual.colors,
				now
			]);
			const [dragging, setDragging] = (0, react.useState)(null);
			const groups = (0, react.useMemo)(() => deriveGroups(list, workspaces, archivedSessionIds, config, {
				expandedCategories,
				expandedWorkspaces
			}, manual), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				manual,
				expandedCategories,
				expandedWorkspaces
			]);
			const topLevel = (0, react.useMemo)(() => deriveTopLevel(list, workspaces, archivedSessionIds, config, {
				expandedCategories,
				expandedWorkspaces
			}, manual), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				manual,
				expandedCategories,
				expandedWorkspaces
			]);
			const filteredGroups = (0, react.useMemo)(() => filterResult.categories.map((category) => ({
				...category,
				expanded: filterCategoryExpansion[category.key] ?? categoryExpansion[category.key] ?? false,
				workspaces: category.workspaces.map((workspace) => ({
					...workspace,
					expanded: filterWorkspaceExpansion[workspace.workspaceId] ?? workspaceExpansion[workspace.workspaceId] ?? false
				}))
			})), [
				filterResult.categories,
				filterCategoryExpansion,
				filterWorkspaceExpansion,
				categoryExpansion,
				workspaceExpansion
			]);
			const filteredTopLevel = (0, react.useMemo)(() => filterResult.topLevel.map((workspace) => ({
				...workspace,
				expanded: filterWorkspaceExpansion[workspace.workspaceId] ?? workspaceExpansion[workspace.workspaceId] ?? false
			})), [
				filterResult.topLevel,
				filterWorkspaceExpansion,
				workspaceExpansion
			]);
			const displayGroups = isFilterActive ? filteredGroups : groups;
			const displayTopLevel = isFilterActive ? filteredTopLevel : topLevel;
			const activeCounts = normalizedQuery === "" ? filterResult.counts : searchCounts ?? EMPTY_FILTER_COUNTS;
			const [headerMenuOpen, setHeaderMenuOpen] = (0, react.useState)(false);
			const setTreeExpanded = (0, react.useCallback)((categoriesExpanded, workspacesExpanded) => {
				const categoryKeys = isFilterActive ? displayGroups.map((category) => category.key) : allCategoryKeys;
				const workspaceKeys = isFilterActive ? [...displayGroups.flatMap((category) => category.workspaces.map((workspace) => workspace.workspaceId)), ...displayTopLevel.map((workspace) => workspace.workspaceId)] : allWorkspaceIds;
				if (isFilterActive) {
					setFilterCategoryExpansion((previous) => ({
						...previous,
						...Object.fromEntries(categoryKeys.map((key) => [key, categoriesExpanded]))
					}));
					setFilterWorkspaceExpansion((previous) => ({
						...previous,
						...Object.fromEntries(workspaceKeys.map((key) => [key, workspacesExpanded]))
					}));
					return;
				}
				actions.setCategoriesExpanded(categoryKeys, categoriesExpanded);
				actions.setWorkspacesExpanded(workspaceKeys, workspacesExpanded);
			}, [
				actions,
				allCategoryKeys,
				allWorkspaceIds,
				displayGroups,
				displayTopLevel,
				isFilterActive
			]);
			const setCategoryTreeExpanded = (0, react.useCallback)((category, expanded) => {
				const workspaceKeys = category.workspaces.map((workspace) => workspace.workspaceId);
				if (isFilterActive) {
					setFilterCategoryExpansion((previous) => ({
						...previous,
						[category.key]: expanded
					}));
					setFilterWorkspaceExpansion((previous) => ({
						...previous,
						...Object.fromEntries(workspaceKeys.map((key) => [key, expanded]))
					}));
					return;
				}
				actions.setCategoriesExpanded([category.key], expanded);
				actions.setWorkspacesExpanded(workspaceKeys, expanded);
			}, [actions, isFilterActive]);
			const topLevelDropActive = dragging === "workspace" && topLevel.length === 0;
			const moveTargetsFor = (workspace) => {
				const currentKey = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
				return [{
					key: UNCATEGORIZED_KEY,
					label: t("section.topLevel"),
					current: currentKey === void 0
				}, ...displayCategoryKeys(config, manual).map((key) => ({
					key,
					label: key,
					current: currentKey === key
				}))];
			};
			const topLevelRef = {
				kind: "topLevel",
				key: UNCATEGORIZED_KEY
			};
			const [adding, setAdding] = (0, react.useState)(false);
			const [directoryOpen, setDirectoryOpen] = (0, react.useState)(false);
			const [addError, setAddError] = (0, react.useState)(null);
			const [addErrorOpen, setAddErrorOpen] = (0, react.useState)(false);
			const adoptDirectory = (path) => {
				if (adding) return;
				setAdding(true);
				setAddError(null);
				setAddErrorOpen(false);
				createWorkspace({ path }).then((workspace) => {
					setDirectoryOpen(false);
					startSession(workspace.workspaceId);
				}).catch((reason) => {
					setDirectoryOpen(false);
					setAddError(reason instanceof Error ? reason.message : String(reason));
					setAddErrorOpen(true);
				}).finally(() => {
					setAdding(false);
				});
			};
			const addWorkspace = () => {
				if (adding) return;
				setAddError(null);
				setAddErrorOpen(false);
				setDirectoryOpen(true);
			};
			const [renameTarget, setRenameTarget] = (0, react.useState)(null);
			const [renameDraft, setRenameDraft] = (0, react.useState)("");
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [renameError, setRenameError] = (0, react.useState)(null);
			const renameGeneration = (0, react.useRef)(0);
			const renameTrimmed = renameDraft.trim();
			const renameDuplicate = renameTarget !== null && renameTrimmed !== "" && renameTrimmed !== renameTarget.currentTitle && workspaces.some((w) => w.title === renameTrimmed);
			const renameBlocked = renaming || renameTrimmed === "" || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate;
			const confirmRename = () => {
				if (renameBlocked || renameTarget === null) return;
				const generation = ++renameGeneration.current;
				const targetId = renameTarget.workspaceId;
				setRenaming(true);
				setRenameError(null);
				renameWorkspace(targetId, renameTrimmed).then(() => {
					if (generation !== renameGeneration.current) return;
					setRenaming(false);
					setRenameTarget(null);
				}).catch((reason) => {
					if (generation !== renameGeneration.current) return;
					setRenaming(false);
					setRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [deleteError, setDeleteError] = (0, react.useState)(null);
			const deleteGeneration = (0, react.useRef)(0);
			const confirmDelete = () => {
				if (deleting || deleteTarget === null) return;
				const generation = ++deleteGeneration.current;
				const targetId = deleteTarget.workspaceId;
				setDeleting(true);
				setDeleteError(null);
				deleteWorkspace(targetId).then(async () => {
					if (generation !== deleteGeneration.current) return;
					const nextManual = normalizeManual(removeWorkspace(manual, targetId));
					const res = await saveManualOverlay(nextManual, revision);
					if (generation !== deleteGeneration.current) return;
					setManual(nextManual);
					setRevision(res.revision);
					setManualError(null);
					setConflictError(false);
					setDeleting(false);
					setDeleteTarget(null);
				}).catch((reason) => {
					if (generation !== deleteGeneration.current) return;
					setDeleting(false);
					if (isConflictError(reason)) {
						setConflictError(true);
						setDeleteTarget(null);
						reloadConfig();
					} else setDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [sessionRenameTarget, setSessionRenameTarget] = (0, react.useState)(null);
			const [sessionRenameDraft, setSessionRenameDraft] = (0, react.useState)("");
			const [sessionRenaming, setSessionRenaming] = (0, react.useState)(false);
			const [sessionRenameError, setSessionRenameError] = (0, react.useState)(null);
			const sessionRenameGeneration = (0, react.useRef)(0);
			const [sessionActionError, setSessionActionError] = (0, react.useState)(null);
			const [sessionActionBusy, setSessionActionBusy] = (0, react.useState)(false);
			const sessionRenameTrimmed = sessionRenameDraft.trim();
			const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === "" || sessionRenameTarget === null;
			const confirmSessionRename = () => {
				if (sessionRenameBlocked || sessionRenameTarget === null) return;
				const generation = ++sessionRenameGeneration.current;
				const targetId = sessionRenameTarget.sessionId;
				setSessionRenaming(true);
				setSessionRenameError(null);
				renameSession(targetId, sessionRenameTrimmed).then(() => {
					if (generation !== sessionRenameGeneration.current) return;
					setSessionRenaming(false);
					setSessionRenameTarget(null);
				}).catch((reason) => {
					if (generation !== sessionRenameGeneration.current) return;
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
			const onSessionFork = (sessionId) => {
				if (sessionActionBusy) return;
				setSessionActionBusy(true);
				setSessionActionError(null);
				forkSession(sessionId).catch((reason) => {
					setSessionActionError(`${t("session.forkError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				}).finally(() => {
					setSessionActionBusy(false);
				});
			};
			const onSessionArchive = (sessionId) => {
				if (sessionActionBusy) return;
				setSessionActionBusy(true);
				setSessionActionError(null);
				archiveSession(sessionId).catch((reason) => {
					setSessionActionError(`${t("session.archiveError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				}).finally(() => {
					setSessionActionBusy(false);
				});
			};
			const [groupDialog, setGroupDialog] = (0, react.useState)(null);
			const [groupDraft, setGroupDraft] = (0, react.useState)("");
			const [groupError, setGroupError] = (0, react.useState)(null);
			const [groupBusy, setGroupBusy] = (0, react.useState)(false);
			const [groupDeleteTarget, setGroupDeleteTarget] = (0, react.useState)(null);
			const [groupDeleting, setGroupDeleting] = (0, react.useState)(false);
			const [groupDeleteError, setGroupDeleteError] = (0, react.useState)(null);
			const groupGeneration = (0, react.useRef)(0);
			const groupDeleteGeneration = (0, react.useRef)(0);
			const takenNames = (0, react.useMemo)(() => takenCategoryNames(config, manual), [config, manual]);
			const groupTrimmed = groupDraft.trim();
			const groupNameIssue = groupDialog !== null && groupTrimmed !== "" ? groupTrimmed === "未分类" ? t("group.nameReserved") : groupDialog.mode === "rename" && groupTrimmed === groupDialog.from ? null : takenNames.has(groupTrimmed) ? t("group.nameDuplicate") : null : null;
			const groupBlocked = groupBusy || groupTrimmed === "" || groupNameIssue !== null || groupDialog !== null && groupDialog.mode === "rename" && groupTrimmed === groupDialog.from;
			const confirmGroupDialog = () => {
				if (groupBlocked || groupDialog === null) return;
				const name = groupTrimmed;
				const from = groupDialog.mode === "rename" ? groupDialog.from : void 0;
				const renaming = groupDialog.mode === "rename" && from !== name;
				let next;
				if (groupDialog.mode === "create") next = {
					...manual,
					categories: [...manual.categories, name]
				};
				else {
					const originalRule = from !== void 0 ? originalRuleNameForDisplay(config.categories, manual, from) : void 0;
					next = normalizeManual(renameGroup(manual, from ?? "", name, originalRule === void 0 ? {} : { originalRuleName: originalRule }));
				}
				const generation = ++groupGeneration.current;
				setGroupBusy(true);
				setGroupError(null);
				saveManualOverlay(next, revision).then(({ revision: nextRevision }) => {
					if (generation !== groupGeneration.current) return;
					setManual(next);
					setRevision(nextRevision);
					setManualError(null);
					setConflictError(false);
					setGroupBusy(false);
					setGroupDialog(null);
					setGroupDraft("");
					if (renaming) actions.setCategoryExpanded(name, true);
				}).catch((reason) => {
					if (generation !== groupGeneration.current) return;
					setGroupBusy(false);
					if (isConflictError(reason)) {
						setConflictError(true);
						setGroupDialog(null);
						reloadConfig();
					} else setGroupError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const confirmGroupDelete = () => {
				if (groupDeleting || groupDeleteTarget === null) return;
				const name = groupDeleteTarget;
				const originalRule = originalRuleNameForDisplay(config.categories, manual, name);
				const next = normalizeManual(removeGroup(manual, name, originalRule === void 0 ? {} : { originalRuleName: originalRule }));
				const generation = ++groupDeleteGeneration.current;
				setGroupDeleting(true);
				setGroupDeleteError(null);
				saveManualOverlay(next, revision).then(({ revision: nextRevision }) => {
					if (generation !== groupDeleteGeneration.current) return;
					setManual(next);
					setRevision(nextRevision);
					setManualError(null);
					setConflictError(false);
					setGroupDeleting(false);
					setGroupDeleteTarget(null);
				}).catch((reason) => {
					if (generation !== groupDeleteGeneration.current) return;
					setGroupDeleting(false);
					if (isConflictError(reason)) {
						setConflictError(true);
						setGroupDeleteTarget(null);
						reloadConfig();
					} else setGroupDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [dragIndicator, setDragIndicator] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				const clear = () => {
					setDragIndicator(null);
					setDragging(null);
				};
				document.addEventListener("dragend", clear);
				return () => {
					document.removeEventListener("dragend", clear);
				};
			}, []);
			/** Move a workspace into a category (or reorder inside it when `beforeWorkspaceId`/`afterWorkspaceId`). */
			const moveWorkspaceTo = async (workspaceId, categoryKey, beforeWorkspaceId, afterWorkspaceId) => {
				if (manualSaving) return;
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return;
				const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title);
				const targetKey = categoryKey === UNCATEGORIZED_KEY ? void 0 : categoryKey;
				if (currentKey === targetKey && beforeWorkspaceId === void 0 && afterWorkspaceId === void 0) return;
				const targetMembers = workspaces.filter((w) => w.workspaceId === workspaceId || resolveCategory(config, manual, w.workspaceId, w.path, w.title) === targetKey).map((w) => w.workspaceId);
				setManualSaving(true);
				try {
					const next = normalizeManual(moveWorkspace(manual, {
						workspaceId,
						targetCategoryKey: targetKey ?? null,
						beforeId: beforeWorkspaceId,
						afterId: afterWorkspaceId,
						targetMembers
					}));
					const { revision: nextRevision } = await saveManualOverlay(next, revision);
					setManual(next);
					setRevision(nextRevision);
					setManualError(null);
					setConflictError(false);
					if (categoryKey !== UNCATEGORIZED_KEY) actions.setCategoryExpanded(categoryKey, true);
				} catch (reason) {
					if (isConflictError(reason)) {
						setConflictError(true);
						reloadConfig();
					} else setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			/** Reorder groups: move `draggedKey` before `beforeKey` or after `afterKey` (uncategorized target = append). */
			const moveCategory = async (draggedKey, beforeKey, afterKey) => {
				if (manualSaving || draggedKey === beforeKey || draggedKey === afterKey) return;
				setManualSaving(true);
				try {
					const order = displayCategoryKeys(config, manual);
					const categoryOrder = afterKey !== void 0 ? moveAfter(order, draggedKey, afterKey) : moveBefore(order, draggedKey, beforeKey);
					const next = {
						...manual,
						categoryOrder
					};
					const { revision: nextRevision } = await saveManualOverlay(next, revision);
					setManual(next);
					setRevision(nextRevision);
					setManualError(null);
					setConflictError(false);
				} catch (reason) {
					if (isConflictError(reason)) {
						setConflictError(true);
						reloadConfig();
					} else setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			/**
			* Drop on a row. The insertion point is re-derived from the drop event's
			* position (top half = before, bottom half = after), so it always matches
			* the indicator the user last saw — even when dragover and drop arrive in
			* the same tick.
			*/
			const onDropRow = (categoryKey, row) => (event) => {
				event.preventDefault();
				event.stopPropagation();
				setDragIndicator(null);
				setDragging(null);
				const draggedCategory = event.dataTransfer.getData(DND_CATEGORY_TYPE);
				if (draggedCategory !== "") {
					const rect = event.currentTarget.getBoundingClientRect();
					const before = event.clientY < rect.top + rect.height / 2;
					const beforeKey = row.kind === "category" && before ? row.key : void 0;
					const afterKey = row.kind === "category" && !before ? row.key : void 0;
					moveCategory(draggedCategory, beforeKey, afterKey);
					return;
				}
				const workspaceId = event.dataTransfer.getData("application/x-dsh-workspace-groups") || event.dataTransfer.getData("text/plain");
				if (workspaceId === "") return;
				if (row.kind === "topLevel") {
					const rect = event.currentTarget.getBoundingClientRect();
					const before = event.clientY < rect.top + rect.height / 2;
					const specificKey = row.key === UNCATEGORIZED_KEY ? void 0 : row.key;
					moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY, before ? specificKey : void 0, !before ? specificKey : void 0);
					return;
				}
				const rect = event.currentTarget.getBoundingClientRect();
				const before = event.clientY < rect.top + rect.height / 2;
				const beforeWsid = row.kind === "workspace" && before ? row.key : void 0;
				const afterWsid = row.kind === "workspace" && !before ? row.key : void 0;
				moveWorkspaceTo(workspaceId, categoryKey, beforeWsid, afterWsid);
			};
			const onDragOverRow = (row) => (event) => {
				if (!hasPluginDragType(event.dataTransfer.types)) return;
				const draggingCategory = Array.from(event.dataTransfer.types).includes(DND_CATEGORY_TYPE);
				if (draggingCategory && row.kind !== "category") return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = "move";
				const rect = event.currentTarget.getBoundingClientRect();
				const before = event.clientY < rect.top + rect.height / 2;
				if (draggingCategory || row.kind === "workspace" || row.kind === "topLevel") setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === before ? prev : {
					mode: "line",
					row,
					before
				});
				else setDragIndicator((prev) => prev?.mode === "into" && prev.categoryKey === row.key ? prev : {
					mode: "into",
					categoryKey: row.key
				});
			};
			const onDragLeaveRow = (event) => {
				if (event.currentTarget.contains(event.relatedTarget)) return;
				setDragIndicator(null);
			};
			/**
			* Drag over the TOP-LEVEL AREA's blank space (not on a row — rows stop
			* propagation). An insertion line shows the landing spot: empty top level →
			* a standalone line under the last group; non-empty → a line below the last
			* top-level row (end of the list).
			*/
			const onDragOverTopLevelArea = (event) => {
				if (!hasPluginDragType(event.dataTransfer.types)) return;
				if (Array.from(event.dataTransfer.types).includes("application/x-dsh-workspace-groups-category")) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = "move";
				const last = topLevel.length > 0 ? topLevel[topLevel.length - 1] : void 0;
				if (last !== void 0) setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === "topLevel" && prev.row.key === last.workspaceId && prev.before === false ? prev : {
					mode: "line",
					row: {
						kind: "topLevel",
						key: last.workspaceId
					},
					before: false
				});
				else setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === "topLevel" && prev.row.key === topLevelRef.key && prev.before === false ? prev : {
					mode: "line",
					row: topLevelRef,
					before: false
				});
			};
			const onDragStartWorkspace = (_workspaceId, _event) => {
				setDragging("workspace");
			};
			const onDragStartCategory = (categoryKey) => (event) => {
				event.dataTransfer.setData(DND_CATEGORY_TYPE, categoryKey);
				event.dataTransfer.effectAllowed = "move";
				setDragging("category");
			};
			const onDragOverCategoryEnd = (event) => {
				if (!hasPluginDragType(event.dataTransfer.types)) return;
				if (!Array.from(event.dataTransfer.types).includes("application/x-dsh-workspace-groups-category") || groups.length === 0) return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = "move";
				const lastGroup = groups[groups.length - 1];
				if (lastGroup !== void 0) setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === "category" && prev.row.key === lastGroup.key && prev.before === false ? prev : {
					mode: "line",
					row: {
						kind: "category",
						key: lastGroup.key
					},
					before: false
				});
			};
			const onDropCategoryEnd = (event) => {
				event.preventDefault();
				event.stopPropagation();
				setDragIndicator(null);
				setDragging(null);
				const draggedCategory = event.dataTransfer.getData(DND_CATEGORY_TYPE);
				if (draggedCategory !== "" && groups.length > 0) {
					const lastGroup = groups[groups.length - 1];
					if (lastGroup !== void 0 && draggedCategory !== lastGroup.key) moveCategory(draggedCategory, void 0, lastGroup.key);
				}
			};
			const moveCategoryUp = (key) => {
				const keys = displayCategoryKeys(config, manual);
				const index = keys.indexOf(key);
				if (index <= 0) return;
				const beforeKey = keys[index - 1];
				moveCategory(key, beforeKey, void 0);
			};
			const moveCategoryDown = (key) => {
				const keys = displayCategoryKeys(config, manual);
				const index = keys.indexOf(key);
				if (index === -1 || index >= keys.length - 1) return;
				const afterKey = keys[index + 1];
				moveCategory(key, void 0, afterKey);
			};
			const moveWorkspaceUp = (workspaceId) => {
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return;
				const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title);
				const targetKey = currentKey ?? UNCATEGORIZED_KEY;
				const members = workspaces.filter((w) => currentKey === void 0 ? resolveCategory(config, manual, w.workspaceId, w.path, w.title) === void 0 : resolveCategory(config, manual, w.workspaceId, w.path, w.title) === currentKey).map((w) => w.workspaceId);
				const ordered = orderedWorkspaceIds(manual, currentKey ?? "__topLevel__", members);
				const index = ordered.indexOf(workspaceId);
				if (index <= 0) return;
				const beforeId = ordered[index - 1];
				moveWorkspaceTo(workspaceId, targetKey, beforeId, void 0);
			};
			const moveWorkspaceDown = (workspaceId) => {
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return;
				const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title);
				const targetKey = currentKey ?? UNCATEGORIZED_KEY;
				const members = workspaces.filter((w) => currentKey === void 0 ? resolveCategory(config, manual, w.workspaceId, w.path, w.title) === void 0 : resolveCategory(config, manual, w.workspaceId, w.path, w.title) === currentKey).map((w) => w.workspaceId);
				const ordered = orderedWorkspaceIds(manual, currentKey ?? "__topLevel__", members);
				const index = ordered.indexOf(workspaceId);
				if (index === -1 || index >= ordered.length - 1) return;
				const afterId = ordered[index + 1];
				moveWorkspaceTo(workspaceId, targetKey, void 0, afterId);
			};
			const onOpenPath = (path) => {
				setManualError("Open folder natively is not supported by the current connection");
			};
			const [pathCopiedToast, setPathCopiedToast] = (0, react.useState)(null);
			const onCopyPath = (pathText) => {
				if (navigator.clipboard?.writeText) navigator.clipboard.writeText(pathText).then(() => {
					setPathCopiedToast(t("workspace.pathCopied"));
					setTimeout(() => {
						setPathCopiedToast(null);
					}, 2e3);
				}).catch((reason) => {
					setManualError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const onSetItemColor = async (itemKey, color) => {
				if (manualSaving) return;
				setManualSaving(true);
				try {
					const next = normalizeManual(setItemColor(manual, itemKey, color));
					const { revision: nextRevision } = await saveManualOverlay(next, revision);
					setManual(next);
					setRevision(nextRevision);
					setManualError(null);
					setConflictError(false);
				} catch (reason) {
					if (isConflictError(reason)) {
						setConflictError(true);
						reloadConfig();
					} else setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgRoot${wide ? "" : " wgRail"}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgSectionHeader",
						children: [
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `wgSectionLabel${searchExpanded ? " wgSectionLabelHidden" : ""}`,
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
										"aria-label": t("search.placeholder"),
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `wgHeaderActions${wide && searchExpanded ? " wgHeaderActionsHidden" : ""}`,
								children: [
									wide && normalizedQuery === "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
										open: headerMenuOpen,
										onClose: () => {
											setHeaderMenuOpen(false);
										},
										items: [
											{
												type: "label",
												id: "tree-actions-title",
												text: t("tree.actions")
											},
											{
												id: "collapseAll",
												label: t("tree.collapseAll")
											},
											{
												id: "expandGroups",
												label: t("tree.expandGroups")
											},
											{
												id: "expandAll",
												label: t("tree.expandAll")
											}
										],
										onSelect: (id) => {
											setHeaderMenuOpen(false);
											if (id === "collapseAll") setTreeExpanded(false, false);
											if (id === "expandGroups") setTreeExpanded(true, false);
											if (id === "expandAll") setTreeExpanded(true, true);
										},
										portal: true,
										closeOnPointerLeave: true,
										anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("tree.actions"),
											side: "bottom",
											delayMs: 500,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "wgIconButton",
												"aria-label": t("tree.actions"),
												onClick: () => {
													setHeaderMenuOpen((v) => !v);
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutline16, { size: 16 })
											})
										})
									}),
									wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: t("group.create"),
										side: "bottom",
										delayMs: 500,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "wgIconButton",
											"aria-label": t("group.create"),
											onClick: () => {
												setGroupDraft("");
												setGroupError(null);
												setGroupDialog({ mode: "create" });
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, { size: 16 })
										})
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
					wide && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgTreeBody",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgTreeControls",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgFilterBar",
								role: "toolbar",
								"aria-label": t("filter.statusScope"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgStatusScopeBar",
									role: "group",
									"aria-label": t("filter.statusScope"),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											"aria-pressed": filter.status === "all",
											className: `wgStatusScopeBtn${filter.status === "all" ? " wgStatusScopeBtnActive" : ""}`,
											onClick: () => {
												setFilter((prev) => ({
													...prev,
													status: "all"
												}));
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("filter.all") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgCountBadge",
												children: activeCounts.all
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											"aria-pressed": filter.status === "warning",
											className: `wgStatusScopeBtn${filter.status === "warning" ? " wgStatusScopeBtnActive" : ""}`,
											onClick: () => {
												setFilter((prev) => ({
													...prev,
													status: "warning"
												}));
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("filter.attention") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgCountBadge",
												children: activeCounts.warning
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											"aria-pressed": filter.status === "ongoing",
											className: `wgStatusScopeBtn${filter.status === "ongoing" ? " wgStatusScopeBtnActive" : ""}`,
											onClick: () => {
												setFilter((prev) => ({
													...prev,
													status: "ongoing"
												}));
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("filter.running") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgCountBadge",
												children: activeCounts.ongoing
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											"aria-pressed": filter.status === "done",
											className: `wgStatusScopeBtn${filter.status === "done" ? " wgStatusScopeBtnActive" : ""}`,
											onClick: () => {
												setFilter((prev) => ({
													...prev,
													status: "done"
												}));
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("filter.new") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgCountBadge",
												children: activeCounts.done
											})]
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SidebarFilterMenu, {
									filter,
									onChange: setFilter,
									onReset: resetFilter,
									t
								})]
							}), isFilterActive && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgFilterSummary",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "wgFilterSummaryLabel",
										children: [t("filter.summary"), ":"]
									}),
									filter.color !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "wgFilterChip",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wgFilterColorDot",
											"data-color": filter.color
										}), t(`color.${filter.color}`)]
									}),
									filter.recency !== "all" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgFilterChip",
										children: t(`filter.recency.${filter.recency}`)
									}),
									filter.status !== "all" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgFilterChip",
										children: filter.status === "warning" ? t("filter.attention") : filter.status === "ongoing" ? t("filter.running") : t("filter.new")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wgSessionToggleBtn wgFilterResetBtn",
										onClick: resetFilter,
										children: t("filter.reset")
									})
								]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgTreeScroller",
							children: [
								configError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wgSearchStatus",
									role: "status",
									children: t("configUnavailable")
								}),
								pathCopiedToast !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wgSearchStatus",
									role: "status",
									children: pathCopiedToast
								}),
								conflictError && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgSearchStatus wgManualError",
									role: "alert",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("manual.conflictError") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										onClick: () => {
											reloadConfig();
											setConflictError(false);
										},
										children: t("retry")
									})]
								}),
								manualError !== null && !conflictError && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgSearchStatus wgManualError",
									role: "alert",
									children: [
										t("manual.saveError"),
										": ",
										manualError
									]
								}),
								normalizedQuery !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchBody, {
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
									manual,
									t,
									startSession,
									filter,
									onCountsChange: reportSearchCounts,
									...isFilterActive ? { onResetFilter: resetFilter } : {},
									onWorkspaceRename: (workspaceId, title) => {
										setRenameTarget({
											workspaceId,
											currentTitle: title
										});
										setRenameDraft(title);
										setRenameError(null);
									},
									onWorkspaceDelete: (workspaceId, title) => {
										setDeleteTarget({
											workspaceId,
											title
										});
										setDeleteError(null);
									},
									onSessionRename,
									onSessionFork,
									onSessionArchive,
									sessionActionBusy
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgList",
									role: "tree",
									"aria-label": t("section.workspaces"),
									children: [
										displayGroups.length === 0 && displayTopLevel.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wgEmpty",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: workspacePhase === "ready" ? t("empty.noWorkspaces") : t("empty.none") }), isFilterActive && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "wgSessionToggleBtn wgFilterResetBtn wgEmptyReset",
												onClick: resetFilter,
												children: t("filter.reset")
											})]
										}),
										displayGroups.map((category, idx) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategorySection, {
											category,
											categoryIndex: idx,
											totalRootItems: displayGroups.length + displayTopLevel.length,
											current,
											now,
											t,
											dragIndicator,
											onDragOverRow,
											onDragLeaveRow,
											onDropRow,
											onDragStartCategory: onDragStartCategory(category.key),
											onDragStartWorkspace,
											onToggleCategory: () => {
												if (isFilterActive) setFilterCategoryExpansion((previous) => ({
													...previous,
													[category.key]: !category.expanded
												}));
												else actions.setCategoryExpanded(category.key, !category.expanded);
											},
											onExpandEntire: () => {
												setCategoryTreeExpanded(category, true);
											},
											onCollapseEntire: () => {
												setCategoryTreeExpanded(category, false);
											},
											onToggleWorkspace: (key) => {
												if (isFilterActive) {
													const expanded = category.workspaces.find((workspace) => workspace.workspaceId === key)?.expanded ?? false;
													setFilterWorkspaceExpansion((previous) => ({
														...previous,
														[key]: !expanded
													}));
												} else actions.setWorkspaceExpanded(key, !workspaceExpansion[key]);
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
											onFork: onSessionFork,
											sessionActionBusy,
											onGroupRename: () => {
												setGroupDraft(category.key);
												setGroupError(null);
												setGroupDialog({
													mode: "rename",
													from: category.key
												});
											},
											onGroupDelete: () => {
												setGroupDeleteTarget(category.key);
												setGroupDeleteError(null);
											},
											onMoveOut: (workspaceId) => {
												moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY);
											},
											onMoveTo: (workspaceId, categoryKey) => {
												moveWorkspaceTo(workspaceId, categoryKey);
											},
											onMoveGroupUp: moveCategoryUp,
											onMoveGroupDown: moveCategoryDown,
											onMoveWorkspaceUp: moveWorkspaceUp,
											onMoveWorkspaceDown: moveWorkspaceDown,
											onOpenFolder: onOpenPath,
											onCopyPath,
											isFirstGroup: idx === 0,
											isLastGroup: idx === displayGroups.length - 1,
											moveTargetsFor: (workspaceId) => {
												const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
												return workspace === void 0 ? [] : moveTargetsFor(workspace);
											},
											canMoveOut: (workspaceId) => {
												const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
												return workspace !== void 0 && resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title) !== void 0;
											},
											manual,
											onSetItemColor
										}, category.key)),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: dragging === "category" ? "wgCategoryDropEnd wgCategoryDropEndActive" : "wgCategoryDropEnd",
											"data-wg-category-drop-end": true,
											onDragOver: onDragOverCategoryEnd,
											onDragLeave: onDragLeaveRow,
											onDrop: onDropCategoryEnd,
											children: dragging === "category" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wgCategoryDropEndLine" })
										}),
										(displayTopLevel.length > 0 || topLevelDropActive) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TopLevelSection, {
											topLevel: displayTopLevel,
											totalGroups: displayGroups.length,
											totalRootItems: displayGroups.length + displayTopLevel.length,
											current,
											now,
											t,
											dragging: dragging === "workspace",
											dragIndicator,
											topLevelRef,
											onDragOverRow,
											onDragOverTopLevelArea,
											onDragLeaveRow,
											onDropRow,
											onDragStartWorkspace,
											onToggleWorkspace: (key) => {
												if (isFilterActive) {
													const expanded = displayTopLevel.find((workspace) => workspace.workspaceId === key)?.expanded ?? false;
													setFilterWorkspaceExpansion((previous) => ({
														...previous,
														[key]: !expanded
													}));
												} else actions.setWorkspaceExpanded(key, !workspaceExpansion[key]);
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
											onFork: onSessionFork,
											sessionActionBusy,
											onMoveTo: (workspaceId, categoryKey) => {
												moveWorkspaceTo(workspaceId, categoryKey);
											},
											moveTargetsFor: (workspaceId) => {
												const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
												return workspace === void 0 ? [] : moveTargetsFor(workspace);
											},
											onMoveWorkspaceUp: moveWorkspaceUp,
											onMoveWorkspaceDown: moveWorkspaceDown,
											onOpenFolder: onOpenPath,
											onCopyPath,
											manual,
											onSetItemColor
										})
									]
								})
							]
						})]
					}),
					wide && sessionActionError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgSearchStatus wgManualError",
						role: "alert",
						children: [sessionActionError, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setSessionActionError(null);
							},
							children: t("close")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: groupDialog !== null,
						onClose: () => {
							if (!groupBusy) {
								groupGeneration.current += 1;
								setGroupDialog(null);
								setGroupError(null);
							}
						},
						closeLabel: t("close"),
						title: groupDialog?.mode === "rename" ? t("group.renameTitle") : t("group.createTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: groupBusy,
							onClick: () => {
								groupGeneration.current += 1;
								setGroupDialog(null);
								setGroupError(null);
							},
							children: t("group.createCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: groupBlocked,
							onClick: confirmGroupDialog,
							children: groupBusy ? groupDialog?.mode === "rename" ? t("group.renaming") : t("group.creating") : groupDialog?.mode === "rename" ? t("group.renameConfirm") : t("group.createConfirm")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "wgRenameInput",
								value: groupDraft,
								"aria-label": t("group.createPlaceholder"),
								placeholder: t("group.createPlaceholder"),
								autoFocus: true,
								disabled: groupBusy,
								onChange: (e) => {
									setGroupDraft(e.target.value);
									setGroupError(null);
								},
								onKeyDown: (e) => {
									if (e.key === "Enter") confirmGroupDialog();
								}
							}),
							groupNameIssue !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgAddError",
								role: "alert",
								children: groupNameIssue
							}),
							groupError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgAddError",
								role: "alert",
								children: groupError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: groupDeleteTarget !== null,
						onClose: () => {
							if (!groupDeleting) {
								groupDeleteGeneration.current += 1;
								setGroupDeleteTarget(null);
								setGroupDeleteError(null);
							}
						},
						closeLabel: t("close"),
						title: t("group.deleteTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: groupDeleting,
							onClick: () => {
								groupDeleteGeneration.current += 1;
								setGroupDeleteTarget(null);
								setGroupDeleteError(null);
							},
							children: t("group.deleteCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: groupDeleting,
							onClick: confirmGroupDelete,
							children: groupDeleting ? t("group.deleting") : t("group.delete")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							children: t("group.deleteConfirm")
						}), groupDeleteError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: groupDeleteError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: renameTarget !== null,
						onClose: () => {
							if (!renaming) {
								renameGeneration.current += 1;
								setRenameTarget(null);
								setRenameError(null);
							}
						},
						closeLabel: t("close"),
						title: t("workspace.renameTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: renaming,
							onClick: () => {
								renameGeneration.current += 1;
								setRenameTarget(null);
								setRenameError(null);
							},
							children: t("workspace.renameCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: renameBlocked,
							onClick: confirmRename,
							children: renaming ? t("workspace.renaming") : t("workspace.renameConfirm")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "wgRenameInput",
								value: renameDraft,
								"aria-label": t("workspace.renamePlaceholder"),
								autoFocus: true,
								disabled: renaming,
								onChange: (e) => {
									setRenameDraft(e.target.value);
								},
								onKeyDown: (e) => {
									if (e.key === "Enter") confirmRename();
								}
							}),
							renameDuplicate && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgAddError",
								role: "alert",
								children: t("workspace.nameDuplicate")
							}),
							renameError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgAddError",
								role: "alert",
								children: renameError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== null,
						onClose: () => {
							if (!deleting) {
								deleteGeneration.current += 1;
								setDeleteTarget(null);
								setDeleteError(null);
							}
						},
						closeLabel: t("close"),
						title: t("workspace.deleteTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: () => {
								deleteGeneration.current += 1;
								setDeleteTarget(null);
								setDeleteError(null);
							},
							children: t("workspace.deleteCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: confirmDelete,
							children: deleting ? t("workspace.deleting") : t("workspace.delete")
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
							if (!sessionRenaming) {
								sessionRenameGeneration.current += 1;
								setSessionRenameTarget(null);
								setSessionRenameError(null);
							}
						},
						closeLabel: t("close"),
						title: t("session.renameTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: sessionRenaming,
							onClick: () => {
								sessionRenameGeneration.current += 1;
								setSessionRenameTarget(null);
								setSessionRenameError(null);
							},
							children: t("session.renameCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: sessionRenameBlocked,
							onClick: confirmSessionRename,
							children: sessionRenaming ? t("session.renaming") : t("session.renameConfirm")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "wgRenameInput",
							value: sessionRenameDraft,
							"aria-label": t("session.renamePlaceholder"),
							autoFocus: true,
							disabled: sessionRenaming,
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DirectoryBrowser, {
						open: directoryOpen,
						busy: adding,
						listDirectory,
						createDirectory,
						onPick: adoptDirectory,
						onClose: () => {
							if (!adding) setDirectoryOpen(false);
						},
						strings: {
							title: t("directory.title"),
							home: t("directory.home"),
							newFolder: t("directory.newFolder"),
							folderName: t("directory.folderName"),
							create: t("directory.create"),
							cancel: t("directory.cancel"),
							open: t("directory.open"),
							loading: t("directory.loading"),
							retry: t("directory.retry"),
							showHidden: t("directory.showHidden"),
							truncated: t("directory.truncated"),
							pathPlaceholder: t("directory.pathPlaceholder"),
							go: t("directory.go"),
							refresh: t("directory.refresh")
						}
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
		function categoriesForCurrent(config, workspaces, current, manual) {
			const workspace = workspaces.find((w) => w.sessionIds.includes(current));
			if (workspace === void 0) return void 0;
			return resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
		}
		/**
		* Roving focus listener for tree navigation via ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End.
		*/
		function handleTreeKeyDown(event) {
			if (![
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight",
				"Home",
				"End"
			].includes(event.key)) return;
			const targetTag = event.target.tagName;
			if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") return;
			const tree = event.currentTarget;
			const items = Array.from(tree.querySelectorAll("[role=\"treeitem\"]"));
			if (items.length === 0) return;
			const targetItem = event.target.closest("[role=\"treeitem\"]");
			if (!targetItem || !items.includes(targetItem)) return;
			const currentIndex = items.indexOf(targetItem);
			let nextIndex;
			switch (event.key) {
				case "ArrowDown":
					nextIndex = Math.min(items.length - 1, currentIndex + 1);
					break;
				case "ArrowUp":
					nextIndex = Math.max(0, currentIndex - 1);
					break;
				case "Home":
					nextIndex = 0;
					break;
				case "End":
					nextIndex = items.length - 1;
					break;
				case "ArrowRight": {
					const expanded = targetItem.getAttribute("aria-expanded");
					if (expanded === "false") {
						event.preventDefault();
						targetItem.click();
						return;
					} else if (expanded === "true") {
						if (currentIndex + 1 < items.length) nextIndex = currentIndex + 1;
					}
					break;
				}
				case "ArrowLeft": if (targetItem.getAttribute("aria-expanded") === "true") {
					event.preventDefault();
					targetItem.click();
					return;
				} else {
					const currentLevel = parseInt(targetItem.getAttribute("aria-level") || "1", 10);
					if (currentLevel > 1) {
						for (let i = currentIndex - 1; i >= 0; i--) if (parseInt(items[i].getAttribute("aria-level") || "1", 10) === currentLevel - 1) {
							nextIndex = i;
							break;
						}
					}
				}
			}
			if (nextIndex !== void 0 && nextIndex !== currentIndex) {
				event.preventDefault();
				const nextItem = items[nextIndex];
				items.forEach((item) => {
					if (item === nextItem) item.setAttribute("tabindex", "0");
					else item.setAttribute("tabindex", "-1");
				});
				nextItem.focus();
			}
		}
		function handleTreeFocus(event) {
			const targetItem = event.target.closest("[role=\"treeitem\"]");
			if (!targetItem) return;
			event.currentTarget.querySelectorAll("[role=\"treeitem\"]").forEach((item) => {
				if (item === targetItem) item.setAttribute("tabindex", "0");
				else item.setAttribute("tabindex", "-1");
			});
		}
		/** Shared limited session list for grouped and top-level workspaces. */
		function WorkspaceSessions({ sessions, current, now, t, ariaLevel, onOpen, onSessionRename, onSessionArchive, onFork, sessionActionBusy }) {
			const [showAll, setShowAll] = (0, react.useState)(false);
			const visible = visibleWorkspaceSessions(sessions, current, showAll);
			const hasToggle = sessions.length > 5;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [visible.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
				node: session,
				currentId: current,
				now,
				t,
				"aria-level": ariaLevel,
				"aria-posinset": sessions.indexOf(session) + 1,
				"aria-setsize": sessions.length,
				onOpen,
				onRename: onSessionRename,
				onFork,
				onArchive: onSessionArchive,
				actionBusy: sessionActionBusy
			}, session.id)), hasToggle && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wgSessionToggle",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "wgSessionToggleBtn",
					onClick: () => {
						setShowAll((prev) => !prev);
					},
					children: showAll ? t("collapse") : t("expandMore")
				})
			})] });
		}
		/** One category section: header row + expanded workspace folders. */
		function CategorySection({ category, categoryIndex, totalRootItems, current, now, t, dragIndicator, onDragOverRow, onDragLeaveRow, onDropRow, onDragStartCategory, onDragStartWorkspace, onToggleCategory, onExpandEntire, onCollapseEntire, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, sessionActionBusy, onGroupRename, onGroupDelete, onMoveOut, onMoveTo, moveTargetsFor, canMoveOut, onMoveGroupUp, onMoveGroupDown, onMoveWorkspaceUp, onMoveWorkspaceDown, onOpenFolder, onCopyPath, isFirstGroup, isLastGroup, manual, onSetItemColor }) {
			const categoryLine = dragIndicator?.mode === "line" && dragIndicator.row.kind === "category" && dragIndicator.row.key === category.key ? dragIndicator.before ? "before" : "after" : void 0;
			const categoryInto = dragIndicator?.mode === "into" && dragIndicator.categoryKey === category.key;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "group",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryRow, {
					node: category,
					t,
					"aria-level": 1,
					"aria-posinset": categoryIndex + 1,
					"aria-setsize": totalRootItems,
					onToggle: onToggleCategory,
					onExpandEntire,
					onCollapseEntire,
					onRename: onGroupRename,
					onDelete: onGroupDelete,
					color: manual.colors?.[category.key],
					onSetColor: (color) => {
						onSetItemColor(category.key, color);
					},
					onDragStartCategory,
					onMoveUp: () => {
						onMoveGroupUp(category.key);
					},
					onMoveDown: () => {
						onMoveGroupDown(category.key);
					},
					isFirst: isFirstGroup,
					isLast: isLastGroup,
					canMoveUp: !isFirstGroup,
					canMoveDown: !isLastGroup,
					dropActive: categoryInto,
					...categoryLine !== void 0 ? { insertLine: categoryLine } : {},
					onRowDragOver: onDragOverRow({
						kind: "category",
						key: category.key
					}),
					onRowDragLeave: onDragLeaveRow,
					onRowDrop: onDropRow(category.key, {
						kind: "category",
						key: category.key
					})
				}), category.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					role: "group",
					children: category.workspaces.map((workspace, idx) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
							node: workspace,
							t,
							"aria-level": 2,
							"aria-posinset": idx + 1,
							"aria-setsize": category.workspaces.length,
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
							},
							color: manual.colors?.[workspace.workspaceId],
							onSetColor: (color) => {
								onSetItemColor(workspace.workspaceId, color);
							},
							canMoveOut: canMoveOut(workspace.workspaceId),
							onMoveOut: () => {
								onMoveOut(workspace.workspaceId);
							},
							moveTargets: moveTargetsFor(workspace.workspaceId),
							onMoveTo: (categoryKey) => {
								onMoveTo(workspace.workspaceId, categoryKey);
							},
							onMoveUp: () => {
								onMoveWorkspaceUp(workspace.workspaceId);
							},
							onMoveDown: () => {
								onMoveWorkspaceDown(workspace.workspaceId);
							},
							onOpenFolder: () => {
								onOpenFolder(workspace.path);
							},
							onCopyPath: () => {
								onCopyPath(workspace.path);
							},
							isFirst: idx === 0,
							isLast: idx === category.workspaces.length - 1,
							canMoveUp: idx > 0,
							canMoveDown: idx < category.workspaces.length - 1,
							dropActive: false,
							...dragIndicator?.mode === "line" && dragIndicator.row.kind === "workspace" && dragIndicator.row.key === workspace.workspaceId ? { insertLine: dragIndicator.before ? "before" : "after" } : {},
							onRowDragOver: onDragOverRow({
								kind: "workspace",
								key: workspace.workspaceId
							}),
							onRowDragLeave: onDragLeaveRow,
							onRowDrop: onDropRow(category.key, {
								kind: "workspace",
								key: workspace.workspaceId
							}),
							draggable: true,
							onWorkspaceDragStart: onDragStartWorkspace
						}), workspace.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceSessions, {
							sessions: workspace.sessions,
							current,
							now,
							t,
							ariaLevel: 3,
							onOpen,
							onSessionRename,
							onSessionArchive,
							onFork,
							sessionActionBusy
						})]
					}, workspace.workspaceId))
				})]
			});
		}
		/**
		* Top-level (ungrouped) workspace rows rendered after the group folders. While
		* a project drag is in progress the WHOLE top-level area is the move-out
		* landing spot, shown with an insertion LINE (not a highlight box):
		* - a top-level row reorders before/after it (line above/below, like a group);
		* - the blank space below the last row appends to the end (line below the
		*   last row);
		* - an empty top level shows a standalone line under the last group folder.
		*/
		function TopLevelSection({ topLevel, totalGroups, totalRootItems, current, now, t, dragging, dragIndicator, topLevelRef, onDragOverRow, onDragOverTopLevelArea, onDragLeaveRow, onDropRow, onDragStartWorkspace, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, sessionActionBusy, onMoveTo, moveTargetsFor, onMoveWorkspaceUp, onMoveWorkspaceDown, onOpenFolder, onCopyPath, manual, onSetItemColor }) {
			const emptyLineActive = dragIndicator?.mode === "line" && dragIndicator.row.kind === "topLevel" && dragIndicator.row.key === topLevelRef.key;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "group",
				"aria-label": t("section.topLevel"),
				className: "wgTopLevelArea",
				onDragOver: onDragOverTopLevelArea,
				onDragLeave: onDragLeaveRow,
				onDrop: onDropRow(UNCATEGORIZED_KEY, topLevelRef),
				children: [topLevel.length === 0 && dragging && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `wgTopLevelEmpty${emptyLineActive ? " wgTopLevelEmptyActive" : ""}`,
					role: "treeitem",
					onDragOver: onDragOverRow(topLevelRef),
					onDragLeave: onDragLeaveRow,
					onDrop: onDropRow(UNCATEGORIZED_KEY, topLevelRef),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wgTopLevelEmptyLine" })
				}), topLevel.map((workspace, idx) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "group",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
						node: workspace,
						t,
						flat: true,
						"aria-level": 1,
						"aria-posinset": totalGroups + idx + 1,
						"aria-setsize": totalRootItems,
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
						},
						color: manual.colors?.[workspace.workspaceId],
						onSetColor: (color) => {
							onSetItemColor(workspace.workspaceId, color);
						},
						moveTargets: moveTargetsFor(workspace.workspaceId),
						onMoveTo: (categoryKey) => {
							onMoveTo(workspace.workspaceId, categoryKey);
						},
						...dragIndicator?.mode === "line" && dragIndicator.row.kind === "topLevel" && dragIndicator.row.key === workspace.workspaceId ? { insertLine: dragIndicator.before ? "before" : "after" } : {},
						onRowDragOver: onDragOverRow({
							kind: "topLevel",
							key: workspace.workspaceId
						}),
						onRowDragLeave: onDragLeaveRow,
						onRowDrop: onDropRow(UNCATEGORIZED_KEY, {
							kind: "topLevel",
							key: workspace.workspaceId
						}),
						draggable: true,
						onWorkspaceDragStart: onDragStartWorkspace
					}), workspace.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceSessions, {
						sessions: workspace.sessions,
						current,
						now,
						t,
						ariaLevel: 2,
						onOpen,
						onSessionRename,
						onSessionArchive,
						onFork,
						sessionActionBusy
					})]
				}, workspace.workspaceId))]
			});
		}
		/**
		* Search body rendered as a three-level tree pruned to matched branches:
		* category folder → workspace folder → matched session row. Reuses the same row components as
		* the idle tree, so search keeps the same folder hierarchy the user is used to.
		*/
		function SearchBody({ list, workspaces, config, archivedSessionIds, query, remote, resultLimit, current, now, open, manual, t, startSession, filter, onCountsChange, onResetFilter, onWorkspaceRename, onWorkspaceDelete, onSessionRename, onSessionFork, onSessionArchive, sessionActionBusy }) {
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
			const searchTree = (0, react.useMemo)(() => deriveSearchGroups(list, workspaces, config, matches.matchedIds, archivedSessionIds, manual, matches.snippetsBySession), [
				list,
				workspaces,
				config,
				matches,
				archivedSessionIds,
				manual
			]);
			const filteredSearch = (0, react.useMemo)(() => applySidebarFilter(searchTree.categories, searchTree.topLevel, filter, manual.colors, now), [
				searchTree,
				filter,
				manual.colors,
				now
			]);
			(0, react.useEffect)(() => {
				onCountsChange?.(filteredSearch.counts);
			}, [filteredSearch.counts, onCountsChange]);
			const groups = filteredSearch.categories;
			const searchTopLevel = filteredSearch.topLevel;
			const pending = currentRemote.status === "loading";
			const failed = currentRemote.status === "error";
			const totalRootItems = groups.length + searchTopLevel.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wgList",
				role: "tree",
				"aria-label": t("search.results.aria"),
				onKeyDown: handleTreeKeyDown,
				onFocusCapture: handleTreeFocus,
				children: [
					groups.map((category, idx) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryRow, {
							node: category,
							t,
							"aria-level": 1,
							"aria-posinset": idx + 1,
							"aria-setsize": totalRootItems
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							children: category.workspaces.map((workspace, wIdx) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								role: "group",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
									node: workspace,
									t,
									"aria-level": 2,
									"aria-posinset": wIdx + 1,
									"aria-setsize": category.workspaces.length,
									onNewSession: () => {
										startSession(workspace.workspaceId);
									},
									onRename: () => {
										onWorkspaceRename(workspace.workspaceId, workspace.label);
									},
									onDelete: () => {
										onWorkspaceDelete(workspace.workspaceId, workspace.label);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceSessions, {
									sessions: workspace.sessions,
									current,
									now,
									t,
									ariaLevel: 3,
									onOpen: open,
									onSessionRename,
									onSessionArchive,
									onFork: onSessionFork,
									sessionActionBusy
								})]
							}, workspace.workspaceId))
						})]
					}, category.key)),
					searchTopLevel.map((workspace, tIdx) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
							node: workspace,
							t,
							flat: true,
							"aria-level": 1,
							"aria-posinset": groups.length + tIdx + 1,
							"aria-setsize": totalRootItems,
							onNewSession: () => {
								startSession(workspace.workspaceId);
							},
							onRename: () => {
								onWorkspaceRename(workspace.workspaceId, workspace.label);
							},
							onDelete: () => {
								onWorkspaceDelete(workspace.workspaceId, workspace.label);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceSessions, {
							sessions: workspace.sessions,
							current,
							now,
							t,
							ariaLevel: 2,
							onOpen: open,
							onSessionRename,
							onSessionArchive,
							onFork: onSessionFork,
							sessionActionBusy
						})]
					}, workspace.workspaceId)),
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
					!pending && groups.length === 0 && searchTopLevel.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgEmpty",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("search.noMatches") }), onResetFilter && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "wgSessionToggleBtn wgFilterResetBtn wgEmptyReset",
							onClick: onResetFilter,
							children: t("filter.reset")
						})]
					}),
					matches.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						children: t("search.hasMore")
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales/en.ts
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
			"workspace.actionError": "Workspace action failed",
			"workspace.nameDuplicate": "A workspace with this name already exists",
			"workspace.actions": "Workspace actions",
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
			"workspace.moveOutOfGroup": "Move out of group",
			"workspace.moveToGroup": "Move to group",
			"workspace.moveUp": "Move up",
			"workspace.moveDown": "Move down",
			"workspace.openFolder": "Open folder",
			"workspace.copyPath": "Copy path",
			"workspace.pathCopied": "Path copied",
			"directory.title": "Select Workspace Directory",
			"directory.home": "Home",
			"directory.newFolder": "New folder",
			"directory.folderName": "Folder name",
			"directory.create": "Create",
			"directory.cancel": "Cancel",
			"directory.open": "Open",
			"directory.loading": "Loading…",
			"directory.retry": "Retry",
			"directory.showHidden": "Show hidden folders",
			"directory.truncated": "Too many folders; only the beginning is shown.",
			"directory.pathPlaceholder": "Enter an absolute path…",
			"directory.go": "Go",
			"directory.refresh": "Refresh",
			"group.create": "New group",
			"group.createTitle": "New group",
			"group.createPlaceholder": "Group name",
			"group.createConfirm": "Create",
			"group.createCancel": "Cancel",
			"group.creating": "Creating…",
			"group.renaming": "Renaming…",
			"group.deleting": "Deleting…",
			"group.actions": "Group actions",
			"group.reorder": "Reorder group",
			"group.rename": "Rename group",
			"group.renameTitle": "Rename group",
			"group.renameConfirm": "Rename",
			"group.delete": "Delete group",
			"group.deleteTitle": "Delete group",
			"group.deleteConfirm": "Deleting removes this group; every project inside it moves to the top level (ungrouped). Delete?",
			"group.deleteCancel": "Cancel delete",
			"group.nameDuplicate": "A group with this name already exists",
			"group.nameReserved": "This name is not available",
			"group.moveUp": "Move up",
			"group.moveDown": "Move down",
			"color.title": "Color",
			"color.reset": "Default",
			"color.red": "Red",
			"color.orange": "Orange",
			"color.yellow": "Yellow",
			"color.green": "Green",
			"color.cyan": "Cyan",
			"color.blue": "Blue",
			"color.purple": "Purple",
			"color.pink": "Pink",
			"filter.title": "Filter",
			"filter.statusScope": "Filter status",
			"filter.all": "All",
			"filter.attention": "Needs attention",
			"filter.running": "Running",
			"filter.new": "New",
			"filter.recency": "Recency",
			"filter.recency.all": "Any time",
			"filter.recency.24h": "Past 24 hours",
			"filter.recency.7d": "Past 7 days",
			"filter.recency.30d": "Past 30 days",
			"filter.reset": "Reset filters",
			"filter.summary": "Active filters",
			"section.topLevel": "Top-level projects",
			"manual.saveError": "Could not save group changes",
			"manual.conflictError": "Group state updated elsewhere",
			"session.new": "New Session",
			"session.actions": "Session actions",
			"session.rename": "Rename session",
			"session.archive": "Archive",
			"session.archiveError": "Could not archive session",
			"session.fork": "Fork",
			"session.forkError": "Could not fork session",
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
			newSession: "New Session",
			"tree.actions": "Tree actions",
			"tree.collapseAll": "Collapse all",
			"tree.expandGroups": "Expand groups only",
			"tree.expandAll": "Expand all",
			"group.expandEntire": "Expand entire group",
			"group.collapseEntire": "Collapse entire group"
		};
		//#endregion
		//#region src/client/locales/zh.ts
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
			"workspace.actionError": "工作区操作失败",
			"workspace.nameDuplicate": "已存在同名工作区",
			"workspace.actions": "工作区操作",
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
			"workspace.moveOutOfGroup": "移出分组",
			"workspace.moveToGroup": "移动到分组",
			"workspace.moveUp": "上移",
			"workspace.moveDown": "下移",
			"workspace.openFolder": "打开文件夹",
			"workspace.copyPath": "复制路径",
			"workspace.pathCopied": "路径已复制",
			"directory.title": "选择工作区目录",
			"directory.home": "主目录",
			"directory.newFolder": "新建文件夹",
			"directory.folderName": "文件夹名称",
			"directory.create": "创建",
			"directory.cancel": "取消",
			"directory.open": "打开",
			"directory.loading": "加载中…",
			"directory.retry": "重试",
			"directory.showHidden": "显示隐藏文件夹",
			"directory.truncated": "文件夹过多，仅显示开头部分。",
			"directory.pathPlaceholder": "输入绝对路径…",
			"directory.go": "前往",
			"directory.refresh": "刷新",
			"group.create": "新建分组",
			"group.createTitle": "新建分组",
			"group.createPlaceholder": "分组名称",
			"group.createConfirm": "创建",
			"group.createCancel": "取消",
			"group.creating": "正在创建…",
			"group.renaming": "正在重命名…",
			"group.deleting": "正在删除…",
			"group.actions": "分组操作",
			"group.reorder": "调整分组顺序",
			"group.rename": "重命名分组",
			"group.renameTitle": "重命名分组",
			"group.renameConfirm": "重命名",
			"group.delete": "删除分组",
			"group.deleteTitle": "删除分组",
			"group.deleteConfirm": "删除后，该分组内的所有项目将移到顶层（不归组）。确定删除？",
			"group.deleteCancel": "取消删除",
			"group.nameDuplicate": "已存在同名分组",
			"group.nameReserved": "该名称不可用",
			"group.moveUp": "上移",
			"group.moveDown": "下移",
			"color.title": "颜色",
			"color.reset": "默认",
			"color.red": "红色",
			"color.orange": "橙色",
			"color.yellow": "黄色",
			"color.green": "绿色",
			"color.cyan": "青色",
			"color.blue": "蓝色",
			"color.purple": "紫色",
			"color.pink": "粉色",
			"filter.title": "筛选",
			"filter.statusScope": "按状态筛选",
			"filter.all": "全部",
			"filter.attention": "需要处理",
			"filter.running": "运行中",
			"filter.new": "新结果",
			"filter.recency": "时间范围",
			"filter.recency.all": "任意时间",
			"filter.recency.24h": "最近 24 小时",
			"filter.recency.7d": "最近 7 天",
			"filter.recency.30d": "最近 30 天",
			"filter.reset": "重置筛选",
			"filter.summary": "已用筛选",
			"section.topLevel": "顶层项目",
			"manual.saveError": "分组变更保存失败",
			"manual.conflictError": "分组配置已被外部修改",
			"session.new": "新建会话",
			"session.actions": "会话操作",
			"session.rename": "重命名会话",
			"session.archive": "归档",
			"session.archiveError": "无法归档会话",
			"session.fork": "派生",
			"session.forkError": "无法派生会话",
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
			newSession: "新建会话",
			"tree.actions": "树层操作",
			"tree.collapseAll": "折叠全部",
			"tree.expandGroups": "仅展开分组",
			"tree.expandAll": "展开全部",
			"group.expandEntire": "展开整个分组",
			"group.collapseEntire": "折叠整个分组"
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
				en,
				zh
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
				forkSession: async (sessionId) => {
					const childId = await ctx.sessions.fork({
						sessionId,
						increaseTitle: true
					});
					ctx.sessions.open(childId);
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
				listDirectory: (path, signal) => ctx.workspaces.listDirectory(path, signal),
				createDirectory: (path, name) => ctx.workspaces.createDirectory(path, name),
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
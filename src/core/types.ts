/**
 * Shared config types for dsh-workspace-groups. Pure types (zero runtime
 * deps) so both halves — the node half (sidecar YAML reading) and the
 * browser half (tree derivation) — compile against the same contract.
 */

/** One classification rule: any rule that matches places the workspace in the category. */
export interface GroupRule {
  /** Absolute path prefix match (normalized, case-sensitive). */
  pathPrefix?: string
  /** Case-insensitive substring match against the workspace display title. */
  nameContains?: string
  /** Case-insensitive substring match against the workspace directory basename. */
  basenameContains?: string
  /** Exact absolute path match (normalized). */
  pathExact?: string
}

/** One category folder in the sidebar tree. */
export interface GroupCategory {
  /** Display label of the category folder. */
  name: string
  /** Rules; a workspace is classified here when ANY rule matches. */
  rules: GroupRule[]
}

/** The full sidecar configuration (mirrors workspace-groups.yaml). */
export interface GroupsConfig {
  /** Category folders, in render order. First match wins. */
  categories: GroupCategory[]
  /**
   * Runtime grouping overlay (manual groups + per-workspace overrides).
   * Optional: the YAML file itself never carries it — the host GET route
   * merges it from `workspace-groups.manual.json`, and the browser PUT route
   * replaces it whole.
   */
  manual?: ManualGroups
}

/**
 * Runtime-managed grouping overlay: groups created in the sidebar UI plus
 * per-workspace category overrides and user-controlled ordering. Owned by the
 * plugin (JSON sidecar, `$DSH_HOME/workspace-groups.manual.json`), never
 * written back into the operator YAML.
 *
 * All new fields are optional for backward compatibility (files written by
 * older plugin versions keep working); rendering falls back to sensible
 * defaults when they are absent.
 */
export interface ManualGroups {
  /**
   * Manually created category folder names. These have no rules — they render
   * even while empty (a new group appears before anything is dragged into
   * it) and hold only workspaces assigned to them.
   */
  categories: string[]
  /**
   * Per-workspace category override, keyed by workspace id. Value is a
   * category display name (rule or manual), or `null` to force the workspace
   * into the uncategorized bucket even when a rule would match. An absent
   * key means "classify by rules".
   */
  assignments: Record<string, string | null>
  /**
   * Display order of all category keys (rule display names + manual names).
   * The uncategorized bucket is never listed — it always renders last.
   * Absent = rule categories first (YAML order), manual groups appended in
   * creation order.
   */
  categoryOrder?: string[]
  /**
   * Per-category ordered workspace ids (user drag-reorder within a group).
   * Keyed by category display name; absent key = host registration order.
   */
  workspaceOrder?: Record<string, string[]>
  /**
   * Rule category rename overrides: original YAML rule category name →
   * display name (UI rename of a rule group). Rules still classify by the
   * original name; only the rendered label/keys change.
   */
  renamed?: Record<string, string>
  /**
   * Rule category original names hidden by a UI delete. Hidden rules are
   * inert: workspaces matching them become top-level (ungrouped).
   */
  hidden?: string[]
  /**
   * Optional color tags/badges keyed by category name or workspace id.
   * Value is a color preset identifier or CSS color string (or null/absent to clear).
   */
  colors?: Record<string, string | null>
}

/** Allowed shared sidebar color-filter presets. */
export const FILTER_COLOR_PRESETS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const

export type ColorPreset = typeof FILTER_COLOR_PRESETS[number]
export type StatusScope = 'all' | 'warning' | 'ongoing' | 'done'
export type RecencyScope = 'all' | '24h' | '7d' | '30d'

/** Profile-level sidebar filter shared across browser clients. */
export interface SidebarFilterPreferences {
  status: StatusScope
  recency: RecencyScope
  color: ColorPreset | null
}

export const DEFAULT_SIDEBAR_FILTER: SidebarFilterPreferences = {
  status: 'all',
  recency: 'all',
  color: null,
}

/** Whether an untrusted value satisfies the complete persisted filter contract. */
export function isSidebarFilterPreferences(raw: unknown): raw is SidebarFilterPreferences {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const value = raw as Record<string, unknown>
  if (Object.keys(value).length !== 3 || !Object.hasOwn(value, 'status') || !Object.hasOwn(value, 'recency') || !Object.hasOwn(value, 'color')) return false
  return ['all', 'warning', 'ongoing', 'done'].includes(value.status as string)
    && ['all', '24h', '7d', '30d'].includes(value.recency as string)
    && (value.color === null || FILTER_COLOR_PRESETS.includes(value.color as ColorPreset))
}

/** Fail closed to defaults when a settings response violates the filter contract. */
export function parseSidebarFilterPreferences(raw: unknown): SidebarFilterPreferences {
  return isSidebarFilterPreferences(raw)
    ? { status: raw.status, recency: raw.recency, color: raw.color }
    : { ...DEFAULT_SIDEBAR_FILTER }
}

/**
 * Legacy persisted label of the former fallback bucket. It is accepted only
 * for backward compatibility; the current UI renders ungrouped workspaces as
 * top-level rows and never exposes this value as primary copy.
 */
export const LEGACY_UNCATEGORIZED_LABEL = '\u672A\u5206\u7C7B'

/** @deprecated Use LEGACY_UNCATEGORIZED_LABEL for compatibility checks only. */
export const UNCATEGORIZED_LABEL = LEGACY_UNCATEGORIZED_LABEL

/**
 * Reserved key under `workspaceOrder` holding the manual order of TOP-LEVEL
 * (ungrouped) project rows. Distinct from any real group display name (a group
 * may not be named this), so it can never collide; the top-level list's order
 * is preserved exactly like a group's, and top-level rows can be reordered by
 * dragging.
 */
export const TOP_LEVEL_ORDER_KEY = '__topLevel__'

/** Normalize separators and trailing slashes while preserving filesystem roots. */
export function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  if (/^\/+$/u.test(normalized)) return '/'
  if (/^[A-Za-z]:\/+$/u.test(normalized)) return `${normalized.slice(0, 2)}/`
  return normalized.replace(/\/+$/u, '')
}

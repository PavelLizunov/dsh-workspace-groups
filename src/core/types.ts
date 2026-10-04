/**
 * Shared config types for dsh-workspace-groups. Pure types (zero runtime
 * deps) so both halves — the node half (sidecar YAML reading) and the
 * browser half (tree derivation) — compile against the same contract.
 */

import type { FolderIconId } from './icons.ts'

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
   * Optional color tags/badges keyed by category name, workspace id, or session id.
   * Value is a color preset identifier or CSS color string (or null/absent to clear).
   */
  colors?: Record<string, string | null>
  /** Separate namespaces prevent a group name from colliding with a workspace id. */
  groupIcons?: Record<string, FolderIconId>
  workspaceIcons?: Record<string, FolderIconId>
  /**
   * Pinned session ids per workspace, keyed by workspace id.
   * Pinned sessions render at the top of their workspace in this order.
   */
  pinnedSessions?: Record<string, string[]>
}

/** Allowed shared sidebar color-filter presets. */
export const FILTER_COLOR_PRESETS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const

export type ColorPreset = typeof FILTER_COLOR_PRESETS[number]
export type StatusScope = 'all' | 'warning' | 'ongoing' | 'done'
export const QUICK_RECENCY_SCOPES = ['all', '1h', '3h', '24h', '7d', '30d', '90d'] as const
export type RecencyScope = typeof QUICK_RECENCY_SCOPES[number] | 'custom'
export interface DateRange { from: number; to: number }
export function isDateRange(value: unknown): value is DateRange {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const range = value as Record<string, unknown>
  return Object.keys(range).every(key => key === 'from' || key === 'to')
    && Number.isSafeInteger(range.from) && Number.isSafeInteger(range.to)
    && (range.from as number) >= 0 && (range.to as number) <= 8.64e15
    && (range.from as number) < (range.to as number)
}

/** Profile-level sidebar filter shared across browser clients. */
export interface SidebarFilterPreferences {
  status: StatusScope
  recency: RecencyScope
  /** Custom interval: inclusive start, exclusive end, persisted as absolute instants. */
  dateRange?: DateRange
  color: ColorPreset | null
  /** Empty string means every project. A missing field in older settings means the same. */
  workspaceId: string
  /** Empty means all groups; the reserved top-level key selects ungrouped workspaces. */
  groupKey: string
}

export const DEFAULT_SIDEBAR_FILTER: SidebarFilterPreferences = {
  status: 'all',
  recency: 'all',
  color: null,
  workspaceId: '',
  groupKey: '',
}

/** Whether an untrusted value satisfies the complete persisted filter contract. */
export function isSidebarFilterPreferences(raw: unknown): raw is Omit<SidebarFilterPreferences, 'workspaceId' | 'groupKey'> & { workspaceId?: string; groupKey?: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const value = raw as Record<string, unknown>
  const keys = Object.keys(value)
  if (!Object.hasOwn(value, 'status') || !Object.hasOwn(value, 'recency') || !Object.hasOwn(value, 'color')) return false
  if (keys.some(key => key !== 'status' && key !== 'recency' && key !== 'color' && key !== 'workspaceId' && key !== 'groupKey' && key !== 'dateRange')) return false
  return ['all', 'warning', 'ongoing', 'done'].includes(value.status as string)
    && [...QUICK_RECENCY_SCOPES, 'custom'].includes(value.recency as RecencyScope)
    && (value.recency === 'custom' ? isDateRange(value.dateRange) : !Object.hasOwn(value, 'dateRange') || value.dateRange === null || isDateRange(value.dateRange))
    && (value.color === null || FILTER_COLOR_PRESETS.includes(value.color as ColorPreset))
    && (!Object.hasOwn(value, 'workspaceId') || (typeof value.workspaceId === 'string' && value.workspaceId.length <= 512))
    && (!Object.hasOwn(value, 'groupKey') || (typeof value.groupKey === 'string' && value.groupKey.length <= 512))
}

/** Fail closed to defaults when a settings response violates the filter contract. */
export function parseSidebarFilterPreferences(raw: unknown): SidebarFilterPreferences {
  if (!isSidebarFilterPreferences(raw)) return { ...DEFAULT_SIDEBAR_FILTER }
  return {
    status: raw.status,
    recency: raw.recency,
    color: raw.color,
    workspaceId: raw.workspaceId ?? '',
    groupKey: raw.groupKey ?? '',
    ...(raw.recency === 'custom' ? { dateRange: raw.dateRange! } : {}),
  }
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

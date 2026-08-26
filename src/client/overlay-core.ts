/**
 * Pure overlay hygiene mutations for ManualGroups overlay management.
 * Kept free of React or runtime state bindings so both client UI actions
 * and unit tests share a single immutable implementation.
 */

import { moveAfter, moveBefore, orderedWorkspaceIds } from '../core/matcher.ts'
import { TOP_LEVEL_ORDER_KEY, type ManualGroups } from '../core/types.ts'

export interface MoveWorkspaceParams {
  workspaceId: string
  targetCategoryKey: string | null
  beforeId?: string | undefined
  afterId?: string | undefined
  targetMembers?: readonly string[] | undefined
}

export interface RemoveGroupOptions {
  originalRuleName?: string
}

export interface RenameGroupOptions {
  originalRuleName?: string
}

function isTopLevelKey(key: string | null | undefined): boolean {
  return key === null || key === undefined || key === TOP_LEVEL_ORDER_KEY
}

/**
 * Remove a deleted group from the overlay:
 * - Removes matching category entries from `categories` and `categoryOrder`.
 * - Sets matching assignments to `null` (uncategorized), including orphan workspace IDs.
 * - Deletes the group's entry in `workspaceOrder`.
 * - For rule groups (when `originalRuleName` is supplied), updates `renamed` and `hidden`.
 */
export function removeGroup(
  manual: ManualGroups,
  groupName: string,
  options: RemoveGroupOptions = {},
): ManualGroups {
  const { originalRuleName } = options
  const categories = (manual.categories ?? []).filter(name => name !== groupName)

  const assignments: Record<string, string | null> = {}
  for (const [id, category] of Object.entries(manual.assignments ?? {})) {
    if (category === groupName || (originalRuleName !== undefined && category === originalRuleName)) {
      assignments[id] = null
    } else {
      assignments[id] = category
    }
  }

  const workspaceOrder: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) {
    if (key !== groupName && (originalRuleName === undefined || key !== originalRuleName)) {
      workspaceOrder[key] = [...ids]
    }
  }

  const categoryOrder = manual.categoryOrder
    ? manual.categoryOrder.filter(name => name !== groupName && (originalRuleName === undefined || name !== originalRuleName))
    : undefined

  let renamed = manual.renamed ? { ...manual.renamed } : undefined
  if (originalRuleName !== undefined && renamed) {
    delete renamed[originalRuleName]
  }

  let hidden: string[] | undefined = manual.hidden ? [...manual.hidden] : undefined
  if (originalRuleName !== undefined) {
    const hiddenSet = new Set(hidden ?? [])
    hiddenSet.add(originalRuleName)
    hidden = Array.from(hiddenSet)
  }

  return {
    ...manual,
    categories,
    assignments,
    workspaceOrder,
    ...(categoryOrder !== undefined ? { categoryOrder } : {}),
    ...(renamed !== undefined ? { renamed } : {}),
    ...(hidden !== undefined ? { hidden } : {}),
  }
}

/**
 * Remove all references to a deleted Workspace from assignments and all workspaceOrder arrays.
 */
export function removeWorkspace(
  manual: ManualGroups,
  workspaceId: string,
): ManualGroups {
  const assignments: Record<string, string | null> = {}
  for (const [id, category] of Object.entries(manual.assignments ?? {})) {
    if (id !== workspaceId) {
      assignments[id] = category
    }
  }

  const workspaceOrder: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) {
    workspaceOrder[key] = ids.filter(id => id !== workspaceId)
  }

  return {
    ...manual,
    assignments,
    workspaceOrder,
  }
}

/**
 * Move a Workspace across groups or top-level, cleaning stale order references from all other order arrays.
 * Accepts positional arguments or a params object for parameters.
 */
export function moveWorkspace(
  manual: ManualGroups,
  params: MoveWorkspaceParams,
): ManualGroups {
  const { workspaceId, targetCategoryKey, beforeId, afterId, targetMembers } = params

  const isTopLevel = isTopLevelKey(targetCategoryKey)
  const targetStorageKey = isTopLevel ? TOP_LEVEL_ORDER_KEY : targetCategoryKey!
  const assignmentValue = isTopLevel ? null : targetCategoryKey

  // Clean workspaceId from ALL existing workspaceOrder arrays to eliminate stale order references
  const workspaceOrder: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) {
    workspaceOrder[key] = ids.filter(id => id !== workspaceId)
  }

  // Calculate order in target bucket
  let targetOrder: string[]
  if (targetMembers !== undefined) {
    const baseOrder = orderedWorkspaceIds(manual, targetStorageKey, targetMembers)
    if (afterId !== undefined) {
      targetOrder = moveAfter(baseOrder, workspaceId, afterId)
    } else if (beforeId !== undefined) {
      targetOrder = moveBefore(baseOrder, workspaceId, beforeId)
    } else {
      targetOrder = moveAfter(baseOrder, workspaceId, undefined)
    }
  } else {
    const existing = workspaceOrder[targetStorageKey] ?? []
    if (afterId !== undefined) {
      targetOrder = moveAfter(existing, workspaceId, afterId)
    } else if (beforeId !== undefined) {
      targetOrder = moveBefore(existing, workspaceId, beforeId)
    } else {
      targetOrder = moveAfter(existing, workspaceId, undefined)
    }
  }

  workspaceOrder[targetStorageKey] = targetOrder

  const assignments = {
    ...(manual.assignments ?? {}),
    [workspaceId]: assignmentValue,
  }

  return {
    ...manual,
    assignments,
    workspaceOrder,
  }
}

/**
 * Rename group references consistently across categories, categoryOrder, assignments, workspaceOrder, and renamed.
 */
export function renameGroup(
  manual: ManualGroups,
  oldName: string,
  newName: string,
  options: RenameGroupOptions = {},
): ManualGroups {
  const { originalRuleName } = options

  const categories = (manual.categories ?? []).map(name => (name === oldName ? newName : name))

  const categoryOrder = manual.categoryOrder
    ? manual.categoryOrder.map(name => (name === oldName ? newName : name))
    : undefined

  const assignments: Record<string, string | null> = {}
  for (const [id, category] of Object.entries(manual.assignments ?? {})) {
    if (category === oldName) {
      assignments[id] = newName
    } else {
      assignments[id] = category
    }
  }

  const workspaceOrder: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) {
    const targetKey = key === oldName ? newName : key
    workspaceOrder[targetKey] = [...ids]
  }

  let renamed = manual.renamed ? { ...manual.renamed } : undefined
  if (originalRuleName !== undefined) {
    renamed = { ...renamed, [originalRuleName]: newName }
  } else if (renamed) {
    for (const [ruleKey, display] of Object.entries(renamed)) {
      if (display === oldName) {
        renamed[ruleKey] = newName
      }
    }
  }

  return {
    ...manual,
    categories,
    assignments,
    workspaceOrder,
    ...(categoryOrder !== undefined ? { categoryOrder } : {}),
    ...(renamed !== undefined ? { renamed } : {}),
  }
}

/**
 * Pure classification logic: decides which category a workspace belongs to.
 * Shared by the host half (validation) and the client half (tree derivation),
 * so the rule semantics can never drift between the config surface and the
 * rendered tree.
 */
import { normalizePath, type GroupCategory, type GroupRule } from './types.ts'

/** One rule match against a workspace's path and title. */
function ruleMatches(rule: GroupRule, path: string, title: string): boolean {
  const normalized = normalizePath(path)
  if (rule.pathPrefix !== undefined && normalized.startsWith(normalizePath(rule.pathPrefix))) return true
  if (rule.pathExact !== undefined && normalized === normalizePath(rule.pathExact)) return true
  if (rule.nameContains !== undefined && title.toLowerCase().includes(rule.nameContains.toLowerCase())) return true
  if (rule.basenameContains !== undefined) {
    const base = path.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? ''
    if (base.toLowerCase().includes(rule.basenameContains.toLowerCase())) return true
  }
  return false
}

/**
 * Classify a workspace into its category.
 * @param categories - configured categories, in render order.
 * @param path - workspace canonical directory path.
 * @param title - workspace display title.
 * @returns the matching category, or undefined when no rule matches.
 */
export function classify(categories: readonly GroupCategory[], path: string, title: string): GroupCategory | undefined {
  for (const category of categories) {
    if (category.rules.some(rule => ruleMatches(rule, path, title))) return category
  }
  return undefined
}

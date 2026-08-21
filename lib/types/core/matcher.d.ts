/**
 * Pure classification logic: decides which category a workspace belongs to.
 * Shared by the host half (validation) and the client half (tree derivation),
 * so the rule semantics can never drift between the config surface and the
 * rendered tree.
 */
import { type GroupCategory } from './types.ts';
/**
 * Classify a workspace into its category.
 * @param categories - configured categories, in render order.
 * @param path - workspace canonical directory path.
 * @param title - workspace display title.
 * @returns the matching category, or undefined when no rule matches.
 */
export declare function classify(categories: readonly GroupCategory[], path: string, title: string): GroupCategory | undefined;

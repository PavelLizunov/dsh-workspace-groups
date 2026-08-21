/**
 * Shared config types for dsh-workspace-groups. Pure types (zero runtime
 * deps) so both halves — the node half (sidecar YAML reading) and the
 * browser half (tree derivation) — compile against the same contract.
 */
/** One classification rule: any rule that matches places the workspace in the category. */
export interface GroupRule {
    /** Absolute path prefix match (normalized, case-sensitive). */
    pathPrefix?: string;
    /** Case-insensitive substring match against the workspace display title. */
    nameContains?: string;
    /** Case-insensitive substring match against the workspace directory basename. */
    basenameContains?: string;
    /** Exact absolute path match (normalized). */
    pathExact?: string;
}
/** One category folder in the sidebar tree. */
export interface GroupCategory {
    /** Display label of the category folder. */
    name: string;
    /** Rules; a workspace is classified here when ANY rule matches. */
    rules: GroupRule[];
}
/** The full sidecar configuration (mirrors workspace-groups.yaml). */
export interface GroupsConfig {
    /** Category folders, in render order. First match wins. */
    categories: GroupCategory[];
}
/** The label of the fallback bucket for unmatched workspaces. */
export declare const UNCATEGORIZED_LABEL = "\u672A\u5206\u7C7B";
/** Normalize a path for prefix matching: trailing slashes stripped. */
export declare function normalizePath(path: string): string;

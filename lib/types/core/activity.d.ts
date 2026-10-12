/** Latest durable conversation activity, independent of native prompt-only updatedAt. */
export declare const ACTIVITY_PROJECTION_KEY = "workspaceGroupsActivityAt";
export declare function readActivityAt(values: unknown): number | undefined;
export declare function sessionActivityAt(summary: {
    updatedAt: number;
    projectionValues?: unknown;
}): number;
export declare function applyActivityAt(state: number, event: {
    type: string;
    time?: number;
    data?: unknown;
}): number;

import { z } from 'zod';
import { applyActivityAt } from './core/activity.js';
import type { GroupsContext } from './context-types.js';
export declare const workspaceGroupsActivityProjectionDefinition: {
    key: string;
    stateSchema: z.ZodNumber;
    init: (header: {
        createdAt: number;
    }) => number;
    apply: typeof applyActivityAt;
    wire: {
        viewSchema: z.ZodNumber;
        view: (state: number) => number;
    };
    stateVersion: number;
};
/** Recover missing cold-list values through official observations, without resuming Agents. */
export declare function registerActivityRoute(ctx: GroupsContext): void;

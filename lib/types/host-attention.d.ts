import { z } from 'zod';
import { type WorkspaceGroupsAttentionProjection } from './core/attention.js';
export declare const attentionProjectionSchema: z.ZodObject<{
    reason: z.ZodNullable<z.ZodEnum<{
        "awaiting-user": "awaiting-user";
        error: "error";
        interrupted: "interrupted";
        "max-tokens": "max-tokens";
    }>>;
}, z.core.$strip>;
export declare const workspaceGroupsAttentionProjectionDefinition: {
    key: string;
    stateSchema: z.ZodObject<{
        reason: z.ZodNullable<z.ZodEnum<{
            "awaiting-user": "awaiting-user";
            error: "error";
            interrupted: "interrupted";
            "max-tokens": "max-tokens";
        }>>;
    }, z.core.$strip>;
    init: () => WorkspaceGroupsAttentionProjection;
    apply: (state: WorkspaceGroupsAttentionProjection, event: {
        type: string;
        data?: unknown;
    }) => WorkspaceGroupsAttentionProjection;
    wire: {
        viewSchema: z.ZodObject<{
            reason: z.ZodNullable<z.ZodEnum<{
                "awaiting-user": "awaiting-user";
                error: "error";
                interrupted: "interrupted";
                "max-tokens": "max-tokens";
            }>>;
        }, z.core.$strip>;
        view: (state: WorkspaceGroupsAttentionProjection) => WorkspaceGroupsAttentionProjection;
    };
    stateVersion: number;
};

import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
/** Reveal an opened conversation through the existing mobile shell control. */
export declare function revealMobileConversation(): void;
/** Keep one native navigation pending; close only after actual selection. */
export declare function createSessionStarter(openWorkspace: (workspaceId: WorkspaceId, beforeOpen: () => void) => Promise<void>, fallback: (workspaceId?: WorkspaceId) => void, reportError: (message: string | null) => void, reveal?: () => void): (workspaceId?: WorkspaceId) => void;

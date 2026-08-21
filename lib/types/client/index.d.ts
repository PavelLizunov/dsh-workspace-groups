/**
 * dsh-workspace-groups client half: registers the three-level grouped
 * workspace browser into the `sidebar.workspaces` slot, shadowing the
 * official ui-workspace browser.
 *
 * Shadowing mechanics (SlotCore semantics):
 * - `sidebar.workspaces` is a `single`/`root` slot. The official browser
 *   registers at priority 0; this entry registers at priority -1, and the
 *   single-cell shadow rule makes the LOWEST priority the winner — the
 *   sidebar renders this browser instead of the official one.
 * - This entry deliberately declares NO child slots: the official entry
 *   already declared `sidebar.workspaces.directoryFlow` (a second declaration
 *   of an occupied child key throws). Add Workspace is therefore self-
 *   contained — `ctx.workspaces.pickDirectory()` + `create()`, no hole.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type WorkspaceGroupsKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The workspace-groups browsing region copy. */
        workspaceGroups: WorkspaceGroupsKey;
    }
}
/** Required services (cordis fiber inject). */
export declare const inject: string[];
/**
 * Register the grouped browser once the sidebar slot declaration is on the
 * ledger. Inject factory returns plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;

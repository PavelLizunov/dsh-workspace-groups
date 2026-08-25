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
 *   of an occupied child key throws). This plugin owns its in-app browse dialog
 *   while reusing the official workspace service APIs (`listDirectory`,
 *   `createDirectory`, `create`), without claiming the official child hole.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { GroupsBrowserInjected } from './contract.ts'
import { createGroupsViewStore } from './stores.ts'
import { GroupsBrowser } from './GroupsBrowser.tsx'
import { en, zh, type WorkspaceGroupsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace-groups browsing region copy. */
    workspaceGroups: WorkspaceGroupsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'workspaceGroups'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'connection']

/**
 * Register the grouped browser once the sidebar slot declaration is on the
 * ledger. Inject factory returns plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-workspace-groups: dictionaries')

  const searchSessions: GroupsBrowserInjected['searchSessions'] = async (query, signal) => {
    const result = await ctx.sessions.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  const browserInjected = (): GroupsBrowserInjected => ({
    startSession: (workspaceId) => { ctx.workspaces.startSession(workspaceId) },
    open: (sessionId) => { ctx.sessions.open(sessionId) },
    searchSessions,
    searchResultLimit: ctx.sessions.searchResultLimit,
    renameSession: async (sessionId, title) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const result = await session.rename(title)
      if (!result.ok) throw new Error(result.error.message)
    },
    forkSession: (sessionId) => {
      ctx.sessions.fork({ sessionId, increaseTitle: true })
        .then((childId) => { ctx.sessions.open(childId) })
        .catch(() => {})
    },
    renameWorkspace: async (workspaceId, title) => { await ctx.workspaces.rename(workspaceId, title) },
    deleteWorkspace: async (workspaceId) => { await ctx.workspaces.delete(workspaceId) },
    insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
      await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId)
    },
    archiveSession: async (sessionId) => { await ctx.workspaces.archiveSession(sessionId) },
    insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
      await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    },
    createWorkspace: input => ctx.workspaces.create(input),
    listDirectory: (path, signal) => ctx.workspaces.listDirectory(path, signal),
    createDirectory: (path, name) => ctx.workspaces.createDirectory(path, name),
    hooks: {
      hostDescription: (ctx.get('connection') as ConnectionHandle).hostDescription,
    },
  })

  // priority: -1 — lower than the official browser's default 0, so the
  // single-slot shadow rule elects this entry. No children declaration: the
  // official entry already owns `sidebar.workspaces.directoryFlow`.
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces',
      priority: -1,
      store: createGroupsViewStore(),
      inject: browserInjected,
      locale: NS,
      registrant: 'dsh-workspace-groups',
    },
    GroupsBrowser,
  ))
}

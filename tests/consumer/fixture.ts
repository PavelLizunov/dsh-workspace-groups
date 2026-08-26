/**
 * Consumer fixture: verifies that a consumer TypeScript project can import
 * both host and client entries of dsh-workspace-groups with clean types,
 * zero broken .ts imports in declarations, and compatible contracts.
 */
import type { apply as applyHost, inject as injectHost, name as nameHost } from 'dsh-workspace-groups'
import type { apply as applyClient, inject as injectClient } from 'dsh-workspace-groups/client'
import type { GroupsContext } from '../../lib/types/context-types.js'

export type HostApply = typeof applyHost
export type HostInject = typeof injectHost
export type HostName = typeof nameHost
export type ClientApply = typeof applyClient
export type ClientInject = typeof injectClient
export type { GroupsContext }

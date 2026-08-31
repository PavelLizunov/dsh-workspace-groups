import { z } from 'zod'
import {
  ATTENTION_PROJECTION_KEY,
  EMPTY_ATTENTION_PROJECTION,
  requestsSddApproval,
  type WorkspaceGroupsAttentionProjection,
} from './core/attention.ts'

export const attentionProjectionSchema = z.object({
  reason: z.enum(['awaiting-user', 'error', 'interrupted', 'max-tokens']).nullable(),
})

export const workspaceGroupsAttentionProjectionDefinition = {
  key: ATTENTION_PROJECTION_KEY,
  stateSchema: attentionProjectionSchema,
  init: (): WorkspaceGroupsAttentionProjection => EMPTY_ATTENTION_PROJECTION,
  apply: (
    state: WorkspaceGroupsAttentionProjection,
    event: { type: string; data?: unknown },
  ): WorkspaceGroupsAttentionProjection => {
    switch (event.type) {
      case 'turn/start': {
        if (state.reason === null) return state
        return EMPTY_ATTENTION_PROJECTION
      }
      case 'assistant/message': {
        const data = event.data as { message?: { content?: readonly unknown[] } } | undefined
        const content = Array.isArray(data?.message?.content) ? data.message.content : []
        if (requestsSddApproval(content)) {
          if (state.reason === 'awaiting-user') return state
          return { reason: 'awaiting-user' }
        }
        return state
      }
      case 'turn/end': {
        const data = event.data as { reason?: { kind?: unknown } } | undefined
        const reason = data?.reason?.kind
        if (reason === 'error' || reason === 'interrupted' || reason === 'max-tokens') {
          if (state.reason === reason) return state
          return { reason }
        }
        if (state.reason === 'awaiting-user') return state
        if (state.reason === null) return state
        return EMPTY_ATTENTION_PROJECTION
      }
      default:
        return state
    }
  },
  wire: {
    viewSchema: attentionProjectionSchema,
    view: (state: WorkspaceGroupsAttentionProjection): WorkspaceGroupsAttentionProjection => state,
  },
  stateVersion: 1,
}

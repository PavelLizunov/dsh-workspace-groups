/** Client-visible incremental attention folded from durable session events. */
export const ATTENTION_PROJECTION_KEY = 'workspaceGroupsAttention'

export type SessionAttentionReason = 'awaiting-user' | 'error' | 'interrupted' | 'max-tokens' | null

export interface WorkspaceGroupsAttentionProjection {
  reason: SessionAttentionReason
}

export const EMPTY_ATTENTION_PROJECTION: WorkspaceGroupsAttentionProjection = { reason: null }

/** Exact approval footer emitted by the local SDD skill (Markdown emphasis is ignored). */
export function requestsSddApproval(content: readonly unknown[]): boolean {
  let text = ''
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const candidate = block as { type?: unknown; text?: unknown }
    if (candidate.type === 'text' && typeof candidate.text === 'string') text += candidate.text
  }
  return text.replaceAll('**', '').trimEnd().endsWith('Ответьте: Утвердить / Доработать')
}

/** Read the plugin projection from an untrusted SessionSummary projection map. */
export function readAttentionProjection(values: unknown): WorkspaceGroupsAttentionProjection {
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return EMPTY_ATTENTION_PROJECTION
  const projection = (values as Record<string, unknown>)[ATTENTION_PROJECTION_KEY]
  if (typeof projection !== 'object' || projection === null || Array.isArray(projection)) return EMPTY_ATTENTION_PROJECTION
  const reason = (projection as { reason?: unknown }).reason
  return reason === null || reason === 'awaiting-user' || reason === 'error' || reason === 'interrupted' || reason === 'max-tokens'
    ? projection as WorkspaceGroupsAttentionProjection
    : EMPTY_ATTENTION_PROJECTION
}

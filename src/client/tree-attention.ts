/**
 * Attention derivation and aggregation for sessions, workspaces, and categories.
 * Priority hierarchy: error > warning > ongoing > done.
 */
import type { PendingInteractionStatus } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionAttentionReason } from '../core/attention.ts'

export type AttentionState = 'error' | 'warning' | 'ongoing' | 'done'

/** Minimal fields needed to derive a session's attention badge. */
export interface SessionAttentionInput {
  pendingInteraction?: PendingInteractionStatus
  running: boolean
  runningSubagentCount: number
  completed: boolean
  projectionReason?: SessionAttentionReason
}

/** Minimal fields needed to aggregate a workspace's attention badge. */
export interface WorkspaceAttentionInput {
  attention?: AttentionState
}

/** Derive the attention state for a single session node. */
export function sessionAttention(
  node: SessionAttentionInput,
): AttentionState | undefined {
  if (
    node.projectionReason === 'error' ||
    node.projectionReason === 'interrupted' ||
    node.projectionReason === 'max-tokens'
  ) {
    return 'error'
  }
  if (
    node.pendingInteraction === 'approval' ||
    node.pendingInteraction === 'plan-review' ||
    node.pendingInteraction === 'question' ||
    node.projectionReason === 'awaiting-user'
  ) {
    return 'warning'
  }
  if (node.running || node.runningSubagentCount > 0) return 'ongoing'
  return node.completed ? 'done' : undefined
}

/** Aggregate attention state across session nodes with priority error > warning > ongoing > done. */
export function aggregateAttention(nodes: readonly SessionAttentionInput[]): AttentionState | undefined {
  let hasWarning = false
  let hasOngoing = false
  let hasDone = false
  for (const node of nodes) {
    const state = sessionAttention(node)
    if (state === 'error') return 'error'
    if (state === 'warning') hasWarning = true
    else if (state === 'ongoing') hasOngoing = true
    else if (state === 'done') hasDone = true
  }
  if (hasWarning) return 'warning'
  if (hasOngoing) return 'ongoing'
  if (hasDone) return 'done'
  return undefined
}

/** Aggregate category attention across member workspace nodes with priority error > warning > ongoing > done. */
export function aggregateCategoryAttention(workspaces: readonly WorkspaceAttentionInput[]): AttentionState | undefined {
  let hasWarning = false
  let hasOngoing = false
  let hasDone = false
  for (const ws of workspaces) {
    if (ws.attention === 'error') return 'error'
    if (ws.attention === 'warning') hasWarning = true
    else if (ws.attention === 'ongoing') hasOngoing = true
    else if (ws.attention === 'done') hasDone = true
  }
  if (hasWarning) return 'warning'
  if (hasOngoing) return 'ongoing'
  if (hasDone) return 'done'
  return undefined
}

import { describe, expect, it } from 'vitest'
import {
  ATTENTION_PROJECTION_KEY,
  EMPTY_ATTENTION_PROJECTION,
  readAttentionProjection,
  requestsSddApproval,
} from '../src/core/attention.ts'
import {
  attentionProjectionSchema,
  workspaceGroupsAttentionProjectionDefinition,
} from '../src/host-attention.ts'

describe('session attention contract', () => {
  it('recognizes only the exact SDD approval footer', () => {
    expect(requestsSddApproval([{ type: 'text', text: '# Spec\n\nОтветьте: **Утвердить / Доработать**' }])).toBe(true)
    expect(requestsSddApproval([{ type: 'text', text: 'Можно утвердить?' }])).toBe(false)
    expect(requestsSddApproval([{ type: 'reasoning', text: 'Ответьте: Утвердить / Доработать' }])).toBe(false)
  })

  it('reads a valid projection and fails closed otherwise', () => {
    const projection = { reason: 'interrupted' as const }
    expect(readAttentionProjection({ [ATTENTION_PROJECTION_KEY]: projection })).toBe(projection)
    expect(readAttentionProjection({ [ATTENTION_PROJECTION_KEY]: { reason: 'unknown' } })).toBe(EMPTY_ATTENTION_PROJECTION)
    expect(readAttentionProjection(undefined)).toBe(EMPTY_ATTENTION_PROJECTION)
  })
})

describe('workspaceGroupsAttention projection definition', () => {
  const def = workspaceGroupsAttentionProjectionDefinition

  it('has correct metadata, schemas, init, and wire view', () => {
    expect(def.key).toBe('workspaceGroupsAttention')
    expect(def.stateVersion).toBe(1)
    expect(def.init()).toEqual({ reason: null })
    expect(def.wire.view(def.init())).toEqual({ reason: null })

    expect(attentionProjectionSchema.safeParse({ reason: null }).success).toBe(true)
    expect(attentionProjectionSchema.safeParse({ reason: 'awaiting-user' }).success).toBe(true)
    expect(attentionProjectionSchema.safeParse({ reason: 'error' }).success).toBe(true)
    expect(attentionProjectionSchema.safeParse({ reason: 'interrupted' }).success).toBe(true)
    expect(attentionProjectionSchema.safeParse({ reason: 'max-tokens' }).success).toBe(true)
    expect(attentionProjectionSchema.safeParse({ reason: 'invalid' }).success).toBe(false)
  })

  it('returns exact same state reference on unrelated events', () => {
    const initial = def.init()
    const result1 = def.apply(initial, { type: 'user/message' })
    expect(result1).toBe(initial)

    const result2 = def.apply(initial, { type: 'tool/call' })
    expect(result2).toBe(initial)

    const awaitingState = { reason: 'awaiting-user' as const }
    const result3 = def.apply(awaitingState, { type: 'session/title' })
    expect(result3).toBe(awaitingState)
  })

  it('sets awaiting-user only when requestsSddApproval is true', () => {
    const initial = def.init()

    // assistant/message without SDD approval -> no change (same reference)
    const noSdd = def.apply(initial, {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'Hello world' }] } },
    })
    expect(noSdd).toBe(initial)

    // assistant/message with SDD approval -> sets awaiting-user
    const withSdd = def.apply(initial, {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'Ответьте: Утвердить / Доработать' }] } },
    })
    expect(withSdd).toEqual({ reason: 'awaiting-user' })

    // repeating SDD message when already awaiting-user returns same reference
    const repeatSdd = def.apply(withSdd, {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'Ответьте: Утвердить / Доработать' }] } },
    })
    expect(repeatSdd).toBe(withSdd)
  })

  it('handles turn/end reasons error, interrupted, max-tokens', () => {
    const initial = def.init()

    const err = def.apply(initial, { type: 'turn/end', data: { reason: { kind: 'error' } } })
    expect(err).toEqual({ reason: 'error' })

    const interrupted = def.apply(initial, { type: 'turn/end', data: { reason: { kind: 'interrupted' } } })
    expect(interrupted).toEqual({ reason: 'interrupted' })

    const maxTokens = def.apply(initial, { type: 'turn/end', data: { reason: { kind: 'max-tokens' } } })
    expect(maxTokens).toEqual({ reason: 'max-tokens' })

    // repeating same turn/end reason returns same reference
    expect(def.apply(err, { type: 'turn/end', data: { reason: { kind: 'error' } } })).toBe(err)
  })

  it('preserves awaiting-user on normal completed turn/end', () => {
    const awaitingState = { reason: 'awaiting-user' as const }

    const afterCompleted = def.apply(awaitingState, { type: 'turn/end', data: { reason: { kind: 'completed' } } })
    expect(afterCompleted).toBe(awaitingState)

    const afterNoReason = def.apply(awaitingState, { type: 'turn/end' })
    expect(afterNoReason).toBe(awaitingState)
  })

  it('clears reason to null on normal turn/end when reason was error/interrupted/max-tokens', () => {
    const errState = { reason: 'error' as const }
    const afterCompleted = def.apply(errState, { type: 'turn/end', data: { reason: { kind: 'completed' } } })
    expect(afterCompleted).toEqual({ reason: null })
  })

  it('clears prior reason on turn/start', () => {
    const awaitingState = { reason: 'awaiting-user' as const }
    const errState = { reason: 'error' as const }
    const initial = def.init()

    expect(def.apply(awaitingState, { type: 'turn/start' })).toEqual({ reason: null })
    expect(def.apply(errState, { type: 'turn/start' })).toEqual({ reason: null })

    // turn/start when already null returns same reference
    expect(def.apply(initial, { type: 'turn/start' })).toBe(initial)
  })
})

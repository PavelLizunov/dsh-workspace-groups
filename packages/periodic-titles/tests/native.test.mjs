import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import Projections from '@deepseek-ai/dsh-session-projection'
import Titles from '@deepseek-ai/dsh-session-title'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as periodic from '../lib/index.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
const config = { everyMessages: 5, targetWords: 5, targetCjkCharacters: 12, maxInputBytes: 2048, maxOutputTokens: 64, timeoutMs: 1000, provider: 'test', model: 'stub' }

test('native title service protects a manual rename racing with auxiliary completion', async () => {
  const ctx = new Context()
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const began = new Promise(resolve => { started = resolve })
  ctx.provide('llm', { async *stream() {
    started(); await gate
    yield { type: 'text-delta', index: 0, text: 'Автоматическое название' }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } })
  ctx.plugin(SessionStore)
  ctx.plugin(Projections)
  ctx.plugin(Titles, { fallbackMaxWords: 5, fallbackMaxBytes: 80, maxTitleBytes: 120 })
  ctx.plugin(periodic, config)
  await flush()
  try {
    const session = ctx.sessions.create()
    session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Настройка домашнего сервера и резервных копий' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    await flush()
    const refresh = ctx.sessionTitle.refresh(session).catch(error => error)
    await began
    ctx.sessionTitle.rename(session, 'Моё ручное название')
    release()
    assert(await refresh instanceof Error)
    assert.equal(ctx.sessionTitle.get(session).title, 'Моё ручное название')
    assert.equal(ctx.sessionTitle.get(session).source.kind, 'user')
  } finally {
    release()
    await ctx.fiber.dispose()
  }
})

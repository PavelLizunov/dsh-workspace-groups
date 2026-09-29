import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

const config = { everyMessages: 5, targetWords: 5, targetCjkCharacters: 12, maxInputBytes: 2048, maxOutputTokens: 64, timeoutMs: 1000 }
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness() {
  let provider, listener, dispose, calls = 0
  const events = []
  let title = { title: 'Исходная тема', source: { kind: 'provider' }, messageSeqs: [1] }
  const session = { id: 's1', header: {}, snapshotEvents: () => events, append: (type, data) => events.push({ type, data, seq: events.length + 1 }) }
  const ctx = {
    sessionTitle: {
      register: value => { provider = value }, get: () => title,
      refresh: async (s, signal) => {
        const messages = events.filter(e => e.type === 'user/message').map(e => ({ seq: e.seq, text: e.data.content[0].text }))
        const result = await provider.generate({ session: s, messages, signal, route: { provider: 'test', model: 'stub' } })
        signal.throwIfAborted()
        title = { ...result, source: { kind: 'provider' } }
      },
    },
    sessions: { get: () => session },
    llm: { async *stream() { calls++; yield { type: 'text-delta', index: 0, text: 'Иконки и названия сессий' }; yield { type: 'finish', reason: { kind: 'stop' } } } },
    on: (event, cb) => { if (event === 'session/event') listener = cb }, effect: cb => { dispose = cb() }, logger: { warn: () => {} },
  }
  apply(ctx, config)
  return {
    ctx, session, events, get provider() { return provider }, get title() { return title }, get calls() { return calls },
    rename: () => { title = { ...title, source: { kind: 'user' } } },
    add: text => session.append('user/message', { source: { kind: 'user' }, content: [{ type: 'text', text }] }),
    emit: event => listener(session, event),
    end: async (kind = 'completed') => { listener(session, { type: 'turn/end', data: { reason: { kind } } }); await flush() },
    dispose: () => dispose(),
  }
}
test('native helper generates only when interval is due, excludes confirmations and retains attribution', async () => {
  const h = harness()
  assert.equal(h.provider.automatic, 'first-prompt')
  h.add('Исходная задача')
  for (let i = 0; i < 4; i++) h.add(`Новая содержательная задача ${i}`)
  await h.end(); assert.equal(h.calls, 0)
  h.add('Да'); await h.end(); assert.equal(h.calls, 0)
  h.add('Выбор значков для папок'); await h.end(); assert.equal(h.calls, 1)
  assert.equal(h.title.title, 'Иконки и названия сессий')
  assert.equal(h.events.filter(e => e.type === 'session/title-llm-request').length, 1)
  assert.equal(h.title.model.provider, 'test')
  await h.end(); assert.equal(h.calls, 1)
  h.rename()
  for (let i = 0; i < 6; i++) h.add(`Еще задача ${i}`)
  await h.end(); assert.equal(h.calls, 1)
  await h.dispose()
})
test('failed turns and subagents never trigger periodic generation', async () => {
  const h = harness()
  for (let i = 0; i < 7; i++) h.add(`Новая задача ${i}`)
  await h.end('interrupted'); assert.equal(h.calls, 0)
  h.session.header.origin = 'subagent'
  await h.end(); assert.equal(h.calls, 0)
  await h.dispose()
})
test('a failed auxiliary request retains the title and is not retried on the same turn', async () => {
  const h = harness(); let attempts = 0
  h.ctx.llm.stream = async function* () { attempts++; throw new Error('offline') }
  for (let i = 0; i < 7; i++) h.add(`Новая задача ${i}`)
  await h.end(); await h.end()
  assert.equal(attempts, 1); assert.equal(h.title.title, 'Исходная тема')
  h.add('Следующая содержательная задача'); await h.end(); assert.equal(attempts, 2)
  await h.dispose()
})
test('new turn supersedes a queued end-of-turn check before it can dispatch', async () => {
  const h = harness()
  for (let i = 0; i < 7; i++) h.add(`Новая задача ${i}`)
  h.emit({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
  h.emit({ type: 'turn/start' })
  await flush()
  assert.equal(h.calls, 0)
  await h.dispose()
})
test('new input cancels an in-flight periodic title even when the stream ignores cancellation', async () => {
  const h = harness(); let release, signal
  const wait = new Promise(resolve => { release = resolve })
  h.ctx.llm.stream = async function* (options) {
    signal = options.signal
    await wait
    yield { type: 'text-delta', index: 0, text: 'Устаревшее название' }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
  for (let i = 0; i < 7; i++) h.add(`Новая задача ${i}`)
  await h.end()
  h.emit({ type: 'turn/start' })
  assert.equal(signal.aborted, true)
  release(); await flush()
  assert.equal(h.title.title, 'Исходная тема')
  await h.dispose()
})
test('disposal prevents queued requests and rejects incomplete config', async () => {
  const h = harness()
  for (let i = 0; i < 7; i++) h.add(`Новая задача ${i}`)
  await h.dispose(); await h.end(); assert.equal(h.calls, 0)
  assert.throws(() => apply(h.ctx, { ...config, everyMessages: 0 }), /everyMessages/)
})

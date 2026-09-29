import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSubstantive, humanMessages, titleDue, selectTitleMessages, titleInputBytes } from '../lib/policy.js'

const message = (seq, text = `Настроить сервер ${seq}`) => ({ seq, text })
const title = (seqs, kind = 'provider') => ({ title: 'Настройка сервера', messageSeqs: seqs, source: { kind }, eventSeq: 100, updatedAt: 1 })

test('exact confirmations do not count but short topics do', () => {
  for (const text of ['Да!', ' Продолжай. ', 'OK', 'go ahead', '']) assert.equal(isSubstantive(text), false)
  for (const text of ['DNS', 'GPU', 'Нет доступа к серверу', 'Да, теперь добавь иконки']) assert.equal(isSubstantive(text), true)
})
test('only human text messages count', () => {
  const event = (seq, kind, text) => ({ type: 'user/message', seq, data: { source: { kind }, content: [{ type: 'text', text }] } })
  assert.deepEqual(humanMessages([event(1, 'user', 'DNS'), event(2, 'tool', 'Something'), event(3, 'user', 'да'), { type: 'turn/end' }]), [message(1, 'DNS')])
})
test('manual titles stay pinned; periodic cadence reconstructs from native title source seqs', () => {
  const messages = Array.from({ length: 7 }, (_, i) => message(i + 1))
  assert.equal(titleDue(messages, title([1, 2]), 5), true)
  assert.equal(titleDue(messages.slice(0, 6), title([1, 2]), 5), false)
  assert.equal(titleDue(messages, title([], 'user'), 5), false)
  assert.equal(titleDue(messages, title([1], 'fallback'), 5), true)
  assert.equal(titleDue([], undefined, 5), false)
})
test('bounded exact input handles long histories without inventing source text', () => {
  const messages = [message(1, 'Начальная задача'), message(2, 'x'.repeat(2000)), message(3, 'Текущая задача')]
  const selected = selectTitleMessages(messages, 300)
  assert.deepEqual(selected, [messages[0], messages[2]])
  assert(titleInputBytes(selected) <= 300)
  assert.deepEqual(selectTitleMessages([...messages, message(4, 'z'.repeat(2000))], 300), [])
  assert.deepEqual(selectTitleMessages([message(1, 'да')], 300), [])
})

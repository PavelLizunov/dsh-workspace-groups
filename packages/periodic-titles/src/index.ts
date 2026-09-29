import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type { Session } from '@deepseek-ai/dsh-session'
import { SessionTitleProviderId } from '@deepseek-ai/dsh-session-title'
import { generateSessionTitleWithLlm, resolveSessionTitleLlmConfig, SessionTitleLlmConfigFields, type SessionTitleLlmConfig } from '@deepseek-ai/dsh-session-title-llm'
import { humanMessages, selectTitleMessages, titleDue } from './policy.js'

export const name = 'dsh-periodic-session-titles'
export const inject = ['sessionTitle', 'llm', 'sessions']
export interface Config extends SessionTitleLlmConfig { everyMessages: number }
export const Config = Schema.object({
  ...SessionTitleLlmConfigFields,
  everyMessages: Schema.number().step(1).min(1).default(5),
})

/** Separate provider so loading the sidebar never replaces the configured title strategy. */
export function apply(ctx: Context, config: Config): void {
  const { everyMessages, ...llmConfig } = config
  if (!Number.isSafeInteger(everyMessages) || everyMessages < 1) throw new Error('everyMessages must be a positive integer')
  const resolved = resolveSessionTitleLlmConfig(llmConfig)
  const id = SessionTitleProviderId(name)
  const attempted = new WeakMap<Session, number>()
  const active = new WeakSet<Session>()
  const controllers = new Map<Session, AbortController>()
  const inputRevision = new WeakMap<Session, number>()
  const lifetime = new AbortController()
  const pending = new Set<Promise<unknown>>()

  ctx.sessionTitle.register({
    id,
    automatic: 'first-prompt',
    async generate(request) {
      const latest = request.messages.at(-1)?.seq
      if (latest !== undefined) attempted.set(request.session, latest)
      // Subagents get no auxiliary request; their existing fallback remains intact.
      if (request.session.header.origin === 'subagent') throw new Error('automatic semantic titles exclude subagents')
      const selected = selectTitleMessages(request.messages, resolved.maxInputBytes)
      if (selected.length === 0) throw new Error('no substantive title input fits the configured byte budget')
      active.add(request.session)
      try {
        return await generateSessionTitleWithLlm(ctx, resolved, request, selected, id)
      } finally {
        active.delete(request.session)
      }
    },
  })

  ctx.on('session/event', (session, event) => {
    if (event.type === 'user/message' || event.type === 'turn/start') {
      inputRevision.set(session, (inputRevision.get(session) ?? 0) + 1)
      controllers.get(session)?.abort(new Error('new input superseded periodic title refresh'))
      return
    }
    if (event.type !== 'turn/end' || event.data.reason.kind !== 'completed' || session.header.origin === 'subagent') return
    const revision = inputRevision.get(session)
    const run = Promise.resolve().then(async () => {
      if (lifetime.signal.aborted || inputRevision.get(session) !== revision || controllers.has(session) || active.has(session) || ctx.sessions.get(session.id) !== session) return
      const messages = humanMessages(session.snapshotEvents())
      const latest = messages.at(-1)?.seq
      if (latest === undefined || attempted.get(session) === latest || !titleDue(messages, ctx.sessionTitle.get(session), everyMessages)) return
      attempted.set(session, latest)
      const controller = new AbortController()
      controllers.set(session, controller)
      try {
        // Native refresh preserves provider attribution, normalization and rename-race cancellation.
        await ctx.sessionTitle.refresh(session, AbortSignal.any([lifetime.signal, controller.signal]))
      } catch (error) {
        if (!lifetime.signal.aborted && !controller.signal.aborted) ctx.logger.warn(`periodic title kept previous value: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        if (controllers.get(session) === controller) controllers.delete(session)
      }
    }).catch(error => {
      if (!lifetime.signal.aborted) ctx.logger.warn(`periodic title check failed: ${error instanceof Error ? error.message : String(error)}`)
    })
    pending.add(run)
    void run.then(() => { pending.delete(run) })
  })
  ctx.on('session/disposed', session => {
    controllers.get(session)?.abort(new Error('session disposed'))
    controllers.delete(session)
  })
  ctx.effect(() => async () => {
    lifetime.abort(new Error('periodic titles disposed'))
    await Promise.allSettled(pending)
  }, 'periodic titles: cancel and drain refreshes')
}

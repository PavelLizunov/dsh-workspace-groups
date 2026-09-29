# Periodic semantic session titles

Optional Cordis plugin for **DSH 0.2.0-rc.1**. Generates a concise title in the conversation's language using the native title service and shared LLM helper, then revisits it after five new substantive human messages at a successfully completed turn boundary.

## Behavior

- A fresh session gets its first semantic title through DSH's first-prompt scheduling. Existing or forked sessions are evaluated on their next completed turn, not scanned or renamed in bulk.
- Subsequent updates are due after `everyMessages` new substantive messages since the source messages of the last generated title. Exact confirmations such as `да`, `ok`, and `продолжай` do not count; short topic names such as `DNS` do.
- A manual rename pins the title. This plugin never automatically unpins it. The native service protects against in-flight rename races.
- Input is a bounded selection of exact human messages, newest first for budgeting and then restored to chronological order. Older messages, including the original topic, are included when they fit. Oversized individual messages are skipped; if the newest substantive message cannot fit, the old title remains. Assistant answers are not included.
- No auxiliary call is made for subagents or unsuccessful turns by the periodic scheduler. The native first-prompt scheduler can invoke the provider for a fresh subagent, but it rejects before an LLM call.
- Requests use the session's logged route by default. No main-chat model or credential settings are changed. Each actual title generation makes a separate bounded LLM call.
- Failures preserve the current title and are not retried on the same input during the current plugin lifetime. A later substantive message permits another attempt. Successful cadence reconstructs from durable title events after restart; failed-attempt deduplication is in-memory.
- New input, session disposal and plugin disposal cancel periodic refreshes. There is no timer, persisted-log scan, or custom session storage.

## Installation and activation

This companion is independent of the sidebar's 0.1.5 build and is **not activated by installing workspace-groups**. Build and pack it with published dependencies:

```sh
npm ci --ignore-scripts
npm run verify
npm pack
```

Install the resulting package using the normal DSH plugin/package workflow for the target profile. Configure one user-owned profile row and disable the existing first-prompt/all-prompts title provider in the same approved activation. DSH permits only one registered title provider; this plugin fails rather than silently replacing a competing provider.

Example plugin row (not a shipped preset):

```yaml
- id: periodic-session-titles
  name: dsh-periodic-session-titles
  config:
    everyMessages: 5
    targetWords: 5
    targetCjkCharacters: 12
    maxInputBytes: 16384
    maxOutputTokens: 128
    timeoutMs: 60000
```

`provider` and `model` are optional and must be supplied together if an explicit auxiliary route is wanted. Without both, DSH inherits the current logged main-request route. Keep the native `session-title` service and its limits enabled. Do not mount another title provider alongside this one.

Activation is separate from source delivery. Obtain approval for profile changes and preserve active sessions; no server restart is performed by this package or its verification scripts.

## Verification

`npm run verify` compiles against pinned published 0.2.0-rc.1 contracts and runs deterministic tests without network model requests. Tests cover cadence, exact-confirmation exclusions, byte budgets, source attribution, unsuccessful turns, subagent exclusion, failure retention and cancellation. Mock-based checks are not proof of live provider availability or title quality.

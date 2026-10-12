# Session activity time for sidebar recency

## Result and scope
- Recency and row age use the latest durable human prompt, assistant message, or turn end, with native updatedAt (creation/prompt) as a floor. Last hour is a rolling 60 minutes in absolute epoch time; Europe/Moscow does not shift the cutoff. Calendar ranges retain existing browser-local boundaries.
- Plugin-owned projection and an authenticated bounded read route recover timestamps for cold sessions whose listing has no checkpoint for the new projection. Use official sessionQuery observations; never activate agents, rewrite event logs, or scan storage paths in production.
- Preserve native summary.updatedAt for cleanup eligibility/error acknowledgments, all preferences, groups/order/colors, drafts, attention/retention, and new-session handlers. No core changes, service restart, profile reload, or live deployment authorized by this task record.

## Evidence
Installed 0.2.0-rc.2 list computes max(createdAt,lastPromptAt), ignoring assistant responses and turn completion. Both live and cold listings only expose already materialized/cached projection cells; adding a projection alone cannot recover unopened history. Official observeSession supports cold replay without agent activation.
Durable events in this conversation show a completed turn on 2026-10-04: prompt 18:57:34, assistant answer 20:06:17, end 20:06:18 Europe/Moscow. The 69-minute gap demonstrates the exclusion mechanism; it is not identification of the user's specific missing session.

## Acceptance and limits
Build canonical pinned 0.1.5-rc.2 artifacts; make one direct replay/filter observation using the recorded long turn. No broad test campaign. Live 0.2.0-rc.2 compatibility and browser behavior remain unverified until separately authorized activation. One request reads at most 32 visible ordinary session IDs sequentially, disposes every observation, and reports per-session read failures; client falls back to native time when recovery is unavailable.

## Status and verification
- Implemented separate workspaceGroupsActivityAt projection, cold recovery route, client recovery and shared effective activity helper for tree rows/filtering/search order. Native summary.updatedAt stays unchanged, so cleanup and error revisions keep their existing behavior.
- Canonical pnpm build completed with exit 0 (declarations and Host/Client bundles). Two initial builds exposed projection-map typing errors; fixed through structural assignment without new dependencies or platform type stubs.
- One direct replay of durable events through seq 5448: native prompt time 1791129454617 is outside the last hour at turn end 1791133578273; folded activity equals the end and is inside the last hour. This is replay/logic evidence, not live browser or route acceptance.
- README EN/RU/ZH updated and scoped whitespace check passed. Prose delivery gate: factual grounding/claims PASS; mechanism and flow PASS. No visual redesign; activity loading/fallback banners are NOT VERIFIED interactively.
- No new tests or test campaign run. Cold route integration, actual missing-session correlation, live 0.2.0-rc.2 compatibility and browser behavior remain unverified. No live/profile files changed, reload or restart performed. Deployment remains a separate authorization gate.

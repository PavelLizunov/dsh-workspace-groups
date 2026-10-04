# Deploy GitHub sidebar enhancements — 2026-10-04

## Approved outcome
Install repository-backed enhancements absent from the currently served sidebar. User explicitly authorized deployment and a necessary restart, then asked to continue. Prefer native leaf hot replacement; reserve single-use restart permission for necessity only. No unrelated plugin/core/provider/auth changes.

## Live reconciliation
GitHub origin/task/group-workspace-filters and local HEAD both 0d7caed585cebd896c1fd861793aaf5701262b58. Canonical source targets 0.1.5; active release pointer is v020-rc2 and active profile web-015. Actual active entry is workspace-groups-topics, versioned extension topic-icons-20261001T005403Z, not the installed node_modules package. Missing later features include combined icon/color editor, collapse-all header button, icon-labelled group/workspace filters and decorative icon click behavior. Preserve existing attention, session retention, topic icons, manual metadata, preferences and periodic title extension.

## Plan / invariants
Use committed scripts/prepare-020.mjs with existing workspace-groups-topics settings namespace, pinned published 0.2 compatibility dependencies, and native installed rc2 loader validation. Build in isolated staging. Publish a new versioned extension, backup narrow profile/artifacts/overlay, and update only active entry path. Do not rematerialize profile dependency graph (unrelated tarball drift). Use native profile watcher only after isolated lifecycle proof. Check runtime identity before/after. Restart only if necessary, after warning; no implicit second restart.

## Verification / acceptance
Canonical verify; compatibility source/declaration/build, relevant tests and actual module loader; installed rc2 lifecycle isolation. Hash actual served JS against candidate (allow only native map footer), check authenticated config/preferences and real same-host browser dropdown/icon/editor/collapse interactions without opening or interrupting sessions. Preserve user's filter/icon/color state. Check errors against baseline. Record immutable artifact hashes, backup and results here. Commit/push task-owned record on dedicated branch.

## Known uncertainty
Tool browser cannot connect to host loopback; existing same-host Playwright/Chromium is available. Authentication must use native trusted request contract, not bypass/disable gates. Service runtime PID changed externally during read-only preflight from 2300021 to 2352031; no restart was performed by this agent. Record current baseline before activation. Compatibility with rc2 requires executed proof, not directory naming or old reports.

## Pre-existing live limitation
Authenticated same-host baseline returns HTTP 200 but shell displays `Failed to load plugins: dsh-codex-auth pending (waiting for service: settingsScope)` and raises `Cannot read properties of undefined (reading sessionId)`. Sidebar DOM is absent before deployment. Do not modify auth/core to hide the blocker; actual UI acceptance cannot be claimed until the separate shell issue is resolved.

## Activation checkpoint / restart handoff
New extension installed at /var/lib/dsh/.dsh-releases/v020-rc2/profile/extensions/github-enhancements-20261004T113000Z/workspace-groups; backup and receipt in .staging/deploy-github-20261004-v2. Only two active entry paths changed (insertion plus native settings override). Exact rc2 dependencies/build/typecheck, actual rc2 client module loader and native lifecycle verification passed. No hot watcher activated new entry: served rev remained 952a34e14ff1 with old @deepseek-ai injection names. One authorized restart is now necessary; user warned. systemd service Restart=always, MainPID 2352013, wrapper audited and same UID; sudo is unavailable under no-new-privileges. Use scoped TERM of audited wrapper, allowing systemd to restart exact existing service, not a replacement server. After resume: verify new PID/start time; run same-host browser probe and served verification with writable XDG paths. Do not restart a second time without fresh permission. Secrets stay only in staging private launch/state files.

## Progress
Canonical pnpm verify passed: 336 tests passed, 9 existing skips, loader and consumer checks passed. Compatible preparation created in .staging/deploy-github-20261004; live profile unchanged. First compatibility typecheck caught unadapted ScopeFilter icon names introduced after the older adapter. Scope minimally expanded to update prepare-020 icon adaptation and add a regression test; no canonical UI behavior changes.

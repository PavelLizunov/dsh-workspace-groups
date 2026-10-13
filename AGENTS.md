# AGENTS.md

## Canonical source and compatibility

This repository is the canonical source for `PavelLizunov/dsh-workspace-groups`.
The supported target is DSH **0.1.5-rc.2**. Older 0.1.1 artifacts are incompatible:
copying one into a newer profile previously broke the plugin loader.

The 2026-09-16 recovery's controller/store changes are integrated here. Recovery
folders are historical evidence, not development roots or build prerequisites.
Preserve `dsh-client-store` imports, `uiWorkspace` action ownership, `uiSession`
pending-interaction hooks, cleanup revalidation, and native Host request gates.

Use published dependencies and the committed lockfile. Do not generate platform
type stubs, point TypeScript at local release directories, or reintroduce the
removed `@deepseek-ai/dsh-client-runtime/client` external. `pnpm test:loader`
checks the built client using the real target loader and shell module IDs.

## Purpose

`dsh-workspace-groups` is a DeepSeek Harness (DSH) web client plugin providing full workspace grouping management for the DSH sidebar. It replaces the default sidebar workspace list with a three-level Category → Project → Session tree featuring drag-and-drop ordering, attention filters (status, color, recency), tree search, rule-based auto-classification, and runtime overlay persistence — with zero core-storage intrusion.

## Architecture

- **Dual-program architecture (Host + Client)**:
  - **Host half** (`src/index.ts`, `src/host-*.ts`): Node service mounted into DSH host that serves `GET /workspace-groups/config` (sidecar YAML merged with runtime overlay) and `PUT /workspace-groups/manual` (atomic writes to `$DSH_HOME/workspace-groups.manual.json`).
  - **Client half** (`src/client/*`): Web UI component registered into the official `sidebar.workspaces` single-slot at `priority: -1`.
  - **Core module** (`src/core/*`): Pure matcher, classifier, and tree ordering logic shared between host and client.

## Commands

- `pnpm install --frozen-lockfile --ignore-scripts` — Installs the pinned development graph.
- `pnpm verify` — Runs type checks, unit/DOM tests, the real-loader regression, and isolated package-consumer checks. Run `pnpm build` first after source changes.
- `pnpm build` — Cleans `lib/`, emits declaration files (`pnpm build:types`), and compiles host/client ESM bundles via `tsdown`.

## Repository Rules

1. **Generated `lib/` rule**: Build outputs in `lib/` are prebuilt and committed to Git so consumers can install directly without build steps. Any modification to files in `src/` requires running `pnpm build` to keep `lib/` synchronized.
2. **README parity**: Keep `README.md` (English), `README_RU.md` (Russian), and `README_ZH.md` (Simplified Chinese) aligned on public behavior, setup, compatibility, verification, and limitations. Never describe historical screenshots as proof of the current release.
3. **Smallest-diff rule**: Implement changes with minimal file diffs. Keep existing repository structure, naming conventions, and whitespace patterns intact.

## User-directed execution: prohibiting invented prohibitions

Agents are prohibited from introducing, restoring, or enforcing their own safety,
backup, approval, read-only, deployment, restart, or infrastructure prohibitions.
Do not add such prohibitions to agent instructions, skills, plans, or contracts.
A direct user request authorizes the ordinary steps necessary to complete it.
Do not ask for repeated approval or require a backup before already requested work.
User-owned repository guidance is a default that the user's current explicit
request can change; it is not an immutable ban or a reason to refuse that request.
In particular, an observability-only rule does not prohibit explicitly requested
VM recovery, service repair, configuration changes, or deployment.
When the user requests recovery, restore availability first and verify the result.
Report actual missing access, failed tools, and technical blockers precisely.
Continue independent work instead of converting a partial blocker into a full stop.
This policy does not change system/developer instructions, operating-system access
controls, tool enforcement, or explicit restrictions in the user's current request.
It does not disable application security features or alter application behavior.

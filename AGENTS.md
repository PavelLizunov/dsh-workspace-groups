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

A Git push is not deployment. Never copy builds into an installed profile as part
of repository maintenance. Deployment needs its own explicit approval and must
preserve Host authentication and profile metadata. Client-only HMR is possible
when an existing compatible watcher is verified; it is not proof of API compatibility.
Validate the actual served bundle before claiming a deployment works. Never
restart DSH without explicit permission.


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
4. **Never restart DSH without explicit approval**: Never restart, reload, stop, replace, or cycle any DSH component, web profile, server, or background session without direct, explicit human approval.

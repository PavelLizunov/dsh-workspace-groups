# AGENTS.md

## Purpose

`dsh-workspace-groups` is a DeepSeek Harness (DSH) web client plugin providing full workspace grouping management for the DSH sidebar. It replaces the default sidebar workspace list with a three-level Category → Project → Session tree featuring drag-and-drop ordering, attention filters (status, color, recency), tree search, rule-based auto-classification, and runtime overlay persistence — with zero core-storage intrusion.

## Architecture

- **Dual-program architecture (Host + Client)**:
  - **Host half** (`src/index.ts`, `src/host-*.ts`): Node service mounted into DSH host that serves `GET /workspace-groups/config` (sidecar YAML merged with runtime overlay) and `PUT /workspace-groups/manual` (atomic writes to `$DSH_HOME/workspace-groups.manual.json`).
  - **Client half** (`src/client/*`): Web UI component registered into the official `sidebar.workspaces` single-slot at `priority: -1`.
  - **Core module** (`src/core/*`): Pure matcher, classifier, and tree ordering logic shared between host and client.

## Commands

- `pnpm verify` — Runs type checks (`pnpm typecheck`), unit tests (`pnpm test`), and consumer package integration checks (`pnpm test:consumer`).
- `pnpm build` — Cleans `lib/`, emits declaration files (`pnpm build:types`), and compiles host/client ESM bundles via `tsdown`.

## Repository Rules

1. **Generated `lib/` rule**: Build outputs in `lib/` are prebuilt and committed to Git so consumers can install directly without build steps. Any modification to files in `src/` requires running `pnpm build` to keep `lib/` synchronized.
2. **Bilingual README rule**: `README.md` (English) and `README_ZH.md` (Simplified Chinese) must be kept strictly aligned whenever public documentation, features, installation instructions, or configuration options are updated.
3. **Smallest-diff rule**: Implement changes with minimal file diffs. Keep existing repository structure, naming conventions, and whitespace patterns intact.
4. **Never restart DSH without explicit approval**: Never restart, reload, stop, replace, or cycle any DSH component, web profile, server, or background session without direct, explicit human approval.

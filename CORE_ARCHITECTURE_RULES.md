# Core Mechanics and Architecture Rules

This document is normative for new and touched code in `dsh-workspace-groups`.
Specs, lead decisions, Gemini assignments, reviews, and implementation changes
must preserve these rules. A deviation requires an approved Micro-Spec amendment
before code changes.

Known baseline debt is tracked in `DEVELOPMENT_PLAN.md` and `AUDIT.md`. Unrelated
changes must not worsen it. A change touching a non-compliant area must either
make that area compliant or record a temporary exception with an owner, linked
task, removal condition, and approved amendment. Existing debt does not permit
new debt elsewhere.

## 1. Purpose and Boundary

`dsh-workspace-groups` is a presentation and overlay plugin for the DSH Web
sidebar. It is not a second Workspace manager, Session manager, filesystem
manager, or persistence platform.

The plugin may:

- classify existing DSH Workspaces into display Groups;
- store manual grouping, display ordering, rule rename/hide overrides;
- derive Group → Workspace → Session presentation nodes from DSH snapshots;
- store plugin-local expansion and view preferences;
- invoke official DSH actions for Workspace, Session, and directory operations.

The plugin must not:

- move, rename, copy, or delete project directories;
- write DSH Workspace or Session storage directly;
- duplicate DSH Workspace/Session entities in plugin persistence;
- invent a parallel action, event, DI, or persistence framework;
- treat rendered React nodes as the source of business truth.

## 2. Entity Ownership

| Concept | Owner | Persistence | Rule |
|---|---|---|---|
| Workspace | DSH | Official Workspace storage | Reference only by `WorkspaceId`; never copy the entity into overlay. |
| Session | DSH | Official Session storage | Reference only by `SessionId`; operations use official APIs. |
| Filesystem directory | Host OS / DSH directory API | Filesystem | Client performs no filesystem I/O and constructs no target paths. It may normalize for comparison and request explicitly supported Host operations such as `createDirectory`; rename/move/copy/delete stay forbidden without an approved Host contract. |
| Rule Group | Operator YAML | `workspace-groups.yaml` | Stable origin identity is the original YAML name; display key may be renamed. Rules are read-only to the Web UI. |
| Manual Group | Plugin | `workspace-groups.manual.json` | Identity is its current unique display key. |
| Effective Group | Derived only | None | Presentation identity: `{ key, source: 'rule' | 'manual' }`; rule origin identity remains available for rename/hide operations. |
| Top level | Derived only | None | Absence of an effective Group, never a real Group entity. |
| Manual assignment/order | Plugin | Manual overlay | Stores only IDs, keys, nullable assignment, and order arrays. |
| Expansion/view state | Plugin UI | Browser store | Presentation-only; never changes grouping semantics. |
| React row/node | UI only | None | Disposable projection, not a domain entity. |

## 3. Canonical Domain Model

The persisted plugin model stays limited to these authoritative shape summaries
of the exported contracts in `src/core/types.ts`:

```ts
interface GroupsConfig {
  categories: GroupCategory[]
  manual?: ManualGroups
}

interface ManualGroups {
  categories: string[]
  assignments: Record<string, string | null>
  categoryOrder?: string[]
  workspaceOrder?: Record<string, string[]>
  renamed?: Record<string, string>
  hidden?: string[]
}

```

The derived `EffectiveCategory` contract is exported from `src/core/matcher.ts`:

```ts
interface EffectiveCategory {
  key: string
  source: 'rule' | 'manual'
}
```

For a rule Group, `category.name` in `GroupsConfig.categories` is the stable
origin used by `renamed[origin]` and `hidden.includes(origin)`.
`EffectiveCategory` is a presentation record, not the stable identity-bearing
rule record; its `key` is the mutable display/assignment/order key. Rename/hide
code recovers origin at the boundary through the operator config and overlay
maps. A manual Group has no separate origin; its unique current name is both
identity and display key. A display key must never be persisted as a rule origin.

There is no separate `RuleGroupEntity`, `ManualGroupEntity`, `TopLevelGroup`,
`WorkspaceGroupMembership`, or `OrderEntity`. Those concepts are either a source
flag, a nullable assignment, or an order array.

A new persisted field is allowed only when all are known before implementation:

1. one concrete user-visible behavior requires it;
2. its owner and trust boundary are explicit;
3. backward-compatible parsing and migration behavior are defined;
4. validation and one regression test exist;
5. the behavior cannot be derived from existing snapshots or fields.

## 4. Core Invariants

- One Workspace resolves to at most one effective Group.
- `undefined` effective Group means top level.
- `null` manual assignment forces top level and overrides rules.
- `__topLevel__` is only an order-map key; it is never a Group name.
- Hidden rule Groups do not classify; matching continues to later active rules.
- Manual override wins over rule classification.
- Rule classification is first active match wins.
- Stored order is filtered to current members; missing members follow stable Host order.
- Self-move is a no-op.
- Moving by DnD, menu, or keyboard must call the same mutation path.
- A filesystem change requires an explicitly approved Host filesystem contract (currently only directory creation is used); registration-order changes require the matching official DSH reorder API.
- Every visible action works or is not rendered.

## 5. Canonical Pure Pipelines

Business semantics live in pure functions under `src/core` or pure client
reducers/derivers. React components assemble callbacks and render results.

The current exported signatures are the authority; this abbreviated map is
conceptual and must not be copied as an API declaration:

```text
normalizePath(path) -> normalized comparison path
resolveCategory(config, manual, workspaceId, path, title) -> display key | top level
effectiveCategories(config, manual) -> ordered EffectiveCategory entries
orderedWorkspaceIds(manual, key, memberIds) -> effective Workspace ID order
moveBefore / moveAfter -> reordered ID list
deriveGroups(list, workspaces, archivedIds, config, view, manual) -> CategoryNode[]
deriveTopLevel(list, workspaces, archivedIds, config, view, manual) -> WorkspaceGroupNode[]
```

Rules:

- A branch used by Host and Client belongs in shared core, not duplicated callers.
- A mutation used by DnD, menu, and keyboard is one function with several triggers.
- A renderer does not reclassify or resort data independently.
- Derived nodes contain display data only; they do not gain persistence methods.
- Async transport stays outside pure functions.

## 6. Dependency Direction

```text
src/core/*
  ↑          ↑
Host code   Client derivation/store code
               ↑
          React components
```

Allowed:

- `core` imports zero React, browser, Node I/O, Cordis, or DSH runtime values;
- Host and Client both import shared core;
- React components import pure derivation and injected contracts;
- Client actions call injected official DSH services;
- Host boundaries parse, validate, and atomically persist plugin-owned data.

Forbidden:

- `core → React` or `core → DSH runtime`;
- Client code importing Host filesystem modules;
- Host code importing React/UI code;
- component-to-component hidden mutation channels;
- direct writes to DSH storage or YAML from browser actions;
- cross-plugin value imports where DSH slots/services are the supported seam.

## 7. File Responsibilities

| File/area | One responsibility |
|---|---|
| `src/core/types.ts` | Shared data contracts and reserved compatibility constants. |
| `src/core/matcher.ts` | Pure classification and ordering semantics. |
| `src/host-config.ts` | YAML read/shape validation. |
| `src/host-manual.ts` | Manual overlay validation and atomic file I/O. |
| `src/index.ts` | Thin Host route composition. |
| `src/client/tree.ts` | Pure snapshot-to-tree/search derivation. |
| `src/client/store-core.ts` | Pure view-state transitions. |
| `src/client/stores.ts` | Bind pure transitions to DSH store. |
| `src/client/contract.ts` | Minimal injected action/hook surface. |
| `src/client/index.ts` | Thin DSH registration and official action adapters. |
| `src/client/rows.tsx` | Presentational rows and local menu-open state. |
| `src/client/GroupsBrowser.tsx` | Screen composition: connect state, focused components, and shared mutation triggers. Independently changing dialog/mutation logic moves to pure helpers or focused components. |
| `src/client/DirectoryBrowser.tsx` | Directory-picking interaction only. |
| `src/client/locales/*` | User-visible copy only. |

Split a file only when it has two independently changing responsibilities, not
because it crossed an arbitrary line count. Do not create one-file abstractions
whose only purpose is forwarding calls.

## 8. Abstraction Budget

Use the first rung that satisfies the real requirement:

1. Remove the need or hide a non-working action.
2. Reuse an official DSH primitive, slot, hook, or action.
3. Reuse an existing repository type or pure helper.
4. Use JavaScript/TypeScript/React platform behavior directly.
5. Add the smallest local pure function or component code.
6. Only then add an abstraction.

Distinguish ordinary local code from an architectural layer:

- a focused React component may have one rendering surface;
- a local pure helper may have one caller when it isolates a testable invariant;
- an extracted test seam may exist solely to make real behavior runnable;
- a reusable architectural layer/wrapper claims a general contract across features.

A new reusable architectural layer is permitted only when its proposal records:

- current callers and the stable semantic contract they share;
- exact duplicated branches/files removed and before/after branch count;
- why a local helper/component is insufficient;
- the layer's deletion condition if the second caller disappears;
- evidence that callers do not immediately unwrap or bypass it;
- explicit lifecycle and owner;
- one direct test protecting its invariant.

A one-caller component/helper is acceptable when it has one clear responsibility
and lowers local complexity without pretending to be a reusable framework.
Default abstraction budget per change: zero new architectural layers.

## 9. Prohibited Speculative Layers

Do not add these without an approved amendment proving necessity:

- `GroupManager`, `WorkspaceManager`, `SessionManager`;
- repository/DAO layers over one JSON file;
- service/controller/use-case layers that only forward one call;
- entity classes wrapping plain DSH snapshots;
- factories with one implementation;
- plugin-local dependency injection;
- plugin-local event bus or command bus;
- generic mutation engines or reducers for a handful of explicit operations;
- generic tree frameworks before the existing tree contract is insufficient;
- caches, virtualization, worker threads, or indexed stores without measurements;
- feature flags/config fields for behavior with no current second mode.

Naming a type does not justify making it an entity. Prefer literal data and
small functions over class hierarchies.

## 10. Mutation and Persistence Rules

- One user intent produces one overlay mutation and one persistence call.
- Calculate the next overlay from the latest accepted snapshot.
- Validation occurs at Host trust boundaries.
- File publication remains atomic.
- Planned concurrent-write protection uses revision/ETag, not more client managers; until implemented, touched code must not widen the existing last-write-wins debt.
- Failed writes leave current UI data intact and show a recoverable error.
- DnD/menu/keyboard parity shares mutation logic; only event adapters differ.
- Cleanup removes stale assignment/order references while touching no unrelated IDs.
- Filesystem paths come from Host API responses; Client never concatenates path strings.

## 11. UI and Accessibility Rules

- New/touched visible controls never point at no-op handlers; existing Search-mode violations are named baseline debt and must be removed in the planned functional-UI wave.
- Destructive actions explain the storage boundary.
- Pending operations block conflicting dismissal/submission and expose busy text.
- New/touched pointer-only behavior requires a keyboard/touch menu alternative. Group Move Up/Down is tracked baseline debt.
- DnD is an enhancement, not the sole editing mechanism; existing Group reorder remains a temporary named exception until its menu alternative lands.
- Use DSH primitives and `--dsw-alias-*` tokens before custom UI.
- Rail mode renders rail controls only, never squeezed wide content.
- Search mode preserves action semantics or suppresses actions.
- Accessibility state is semantic (`aria-*`), not inferred from color alone.

## 12. Performance Rules

- Correctness precedes optimization.
- Build `Map`/`Set` indices when repeated scans are measured hot; do not add caches by default.
- Cache only stable snapshots with explicit invalidation.
- Virtualize only after recorded 500/1000-Workspace evidence shows it is needed.
- A performance optimization must include a benchmark fixture and preserve pure semantics.
- Do not retain duplicate derived trees in persistent state.

## 13. Baseline Debt Ledger

| ID | Existing violation | Owner | Plan link | Removal condition | Amendment |
|---|---|---|---|---|---|
| DEBT-SEARCH-ACTIONS | Search rows expose no-op controls. | Lead | [Stage 2](./DEVELOPMENT_PLAN.md#stage-2-functional-ui) | Every visible Search action calls the real shared action path or is hidden; rendered tests pass. | Grandfathered baseline; touched Search code must remove or explicitly amend it. |
| DEBT-GROUP-KEYBOARD | Group reorder lacks Move Up/Down keyboard/touch actions. | Lead | [Stage 3](./DEVELOPMENT_PLAN.md#stage-3-accessibility) | Menu actions exist, boundary states are disabled, DnD/menu share mutation logic. | Grandfathered baseline; no new pointer-only Group action allowed. |
| DEBT-OVERLAY-CONCURRENCY | Manual overlay is last-write-wins without revision/ETag. | Lead | [Stage 1](./DEVELOPMENT_PLAN.md#stage-1-correctness) | GET/PUT revision contract, conflict response, client recovery and concurrency tests pass. | Grandfathered baseline; writes must not add another unversioned persistence path. |
| DEBT-ARIA-TREE | Tree ownership, roving focus and Arrow navigation are incomplete. | Lead | [Stage 3](./DEVELOPMENT_PLAN.md#stage-3-accessibility) | Valid tree ownership, roving focus, Arrow/Home/End and rendered accessibility tests pass. | Grandfathered baseline; touched markup must not worsen roles/focus. |
| DEBT-VERIFIER-SETUP | Browser verifier setup failure or 0/0 can pass. | Lead | [Stage 4](./DEVELOPMENT_PLAN.md#stage-4-build-compatibility) | Setup errors and zero executed checks exit non-zero; regression proves it. | Grandfathered baseline; verifier changes must preserve fail signals. |
| DEBT-ACTIVE-BEFORE-GATE | Plugin was installed in active Web before disposable-profile compatibility gate. | Lead | [Stage 4](./DEVELOPMENT_PLAN.md#stage-4-build-compatibility) | Disposable-profile GUI suite and compatibility evidence are recorded; only then may release readiness be claimed. | Grandfathered deployment fact; no broader rollout until removal condition. |

Temporary debt outside this table requires a stable ID, owner, linked plan task,
explicit removal condition, and approved amendment. Updating a plan checkbox is
not itself an amendment.

## 14. Change Decision Checklist

Before code:

- Is this a real current behavior, not future flexibility?
- Does DSH or this repository already provide the action/type/helper?
- Which existing entity owns the data?
- Can the behavior be derived instead of persisted?
- Can one shared pure function serve every trigger?
- Can we delete/hide something instead of adding machinery?

Before approval:

- Did the change add a new entity or layer? If yes, why are plain data/functions insufficient?
- Are DSH-owned concepts still referenced rather than duplicated?
- Is top level still absence, not an entity?
- Is there one mutation path?
- Are trust boundaries and failure behavior tested?
- Is the smallest working diff used?

## 15. Gemini Assignment Contract

Every worker assignment must state:

- exact files it may modify;
- existing types/functions it must reuse;
- entities/layers it must not create;
- the single behavior and verification command;
- no architecture redesign, decomposition, agents, commits, merges, pushes, or restarts.

Workers must not introduce managers, repositories, factories, services, generic
frameworks, or persisted fields unless the approved parent spec explicitly names
them. Worker results are implementation evidence, never architecture authority.

## 16. Sol Review Questions

An independent review must ask:

- Can any new file/type/layer be deleted or inlined?
- Did the change duplicate a DSH entity or action?
- Is one concept represented by multiple types without semantic need?
- Did DnD/menu/keyboard paths diverge?
- Did React acquire business rules that belong in pure core?
- Did a derived value become persisted unnecessarily?
- Did a local implementation replace an available DSH primitive/API?
- Is failure handling simpler and explicit?
- Is complexity justified by current tests or measurements?

A review finding that reduces entities, branches, files, or ownership ambiguity is
preferred over a speculative extensibility suggestion.

## 17. Amendment Rule

These rules may change only through a user-approved Micro-Spec that states:

1. the rule being changed;
2. the concrete blocker under the current rule;
3. the minimal replacement;
4. migration and rollback impact;
5. tests proving the new complexity is necessary.

Silence, worker preference, code size, or hypothetical future features are not
valid amendments.

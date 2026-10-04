# Independent group and workspace colors

## Clarified outcome
User explicitly clarified: groups have their own colors, workspaces their own, no inheritance. Supersedes workspace-color-inheritance.md. Prior inheritance interpretation was incorrect. Remove parent fallback from grouped tree, search and navigator; absent workspace color stays neutral. Own workspace colors remain; session tags/filter semantics unchanged. Do not mutate manual metadata, schemas, auth/core/model/provider or restart.

## Live correction evidence
Canonical 350 tests passed, 9 existing skips; real loader and isolated consumer passed. Exact rc2 build/typecheck/installed loader passed. HMR-published SHA256 8d3a956c16fdd66e830aea886ead44750b20aadb8290ae7edd4118432ba13b74, actual served rev 2c7c03c31f87 equals candidate. Existing Suflyor-staff group retained own purple; four workspace choices have no own colors in live metadata and now render neutral rgb(173,178,184), no inherited inline color. Metadata unchanged; preferences restored. Tree/search independent neutral/own pink behavior verified by DOM regression; current live search returned no eligible row, not claimed as live search evidence. Service lifecycle unchanged, no restart.

## Plan and verification
Use direct existing manual.colors[workspaceId], remove now-unnecessary inheritance helper and its declarations via build. Retain regressions asserting group green / uncolored workspace neutral / own pink workspace pink in tree/search/navigator. Test clearing workspace tag leaves group intact. Build/verify canonical, pinned rc2 build and installed loader. Existing HMR client watcher deployment with exact backups; verify actual served bytes and real Suflyor group children own colors or neutral. No live metadata mutation. Update public READMEs/design reference; historical screenshots labelled superseded, no pretending old evidence is current. Commit/push dedicated branch.

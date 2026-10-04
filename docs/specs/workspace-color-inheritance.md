# Workspace folder color inheritance (superseded)

User clarification: group and workspace colors are independent; see independent-folder-colors.md. This prior interpretation and its screenshots are historical, not current behavior.

## Outcome and scope
User reports category child color not inherited. Child means workspace folder under group. Fix visual effective color in grouped tree, search tree and unified workspace navigator/selected trigger; own non-null color wins, otherwise fallback to current parent group color. Ungrouped workspaces keep own color only. No session color inheritance, icon inheritance, filter-matching changes, schema/data migration, auth/core/provider changes or restart. Explicit color editor continues to edit stored override, not copy inherited color into metadata. Clearing workspace override resumes inheritance. Reclassification/rename follows current resolved display group.

## Root cause
GroupsBrowser reads manual.colors[workspaceId] directly for grouped WorkspaceRow and search rows, and for navigatorWorkspaces. Group color filter already matches whole group; do not alter its independent selection semantics. setItemColor(null) deletes own color. Persistence uses shared legacy colors map; no namespace migration requested.

## Plan / acceptance
Small pure effectiveFolderColor helper using own ?? parent, reuse across affected render paths. Red-green regression on existing real GroupsBrowser fixture with colored Dev + uncolored W1. Unit tests for own/default/null/top-level/change parent/nonmutation. DOM tests for inherited grouped/tree/navigator/search and explicit override. Canonical build/verify; compatible rc2 build/native loader; authenticated live browser compare rendered icons to group's color, explicit overrides unchanged, search and picker checked. Do not mutate live metadata just to test. Back up/register client artifact via existing verified HMR; compare served bytes, service identity unchanged. Update three owning READMEs; commit/push dedicated branch.

## Regression evidence
Existing integration fixture reproduced missing navigator inherited RGB. Added helper tests and dedicated grouped-tree/search fixture with inherited green W1 and explicit pink W2; own colors still stored untouched. Canonical fixture syntax/type fixes are verification plumbing, not product changes. Compatible rc2 build/typecheck and actual installed module loader passed. Changes affect only two grouped row render sites and navigator color derivation; top-level and session sites unchanged.

## Final evidence
Canonical 351 tests passed, 9 existing skips; loader and isolated consumer passed. Published rc2 typecheck/build and actual installed loader passed. HMR final SHA256 527c723fc3ee1f10f5ed3cbfe58e0784c817b3e0537f02b273569c712b3940da, served rev 6f86276e0d0f contains exact built registration. Existing live Suflyor-staff group checked: all four unoverridden child icons use inherited rgb(168,85,247) in drilldown, grouped tree and search; metadata snapshot unchanged. Explicit pink override wins in real DOM regression; clear/null/top-level/change-parent covered in pure tests. Filter preferences restored. Service PID/start unchanged (2359515 / 12:11:37 UTC), no restart. Screenshots saved under opendesign/mockups/folder-colors.

## Limits
Custom valid CSS colors continue through existing folderIconColor validator. Legacy shared ID/name collision not solved. Invalid explicit color handling unchanged. Editors preview explicit values by design. Existing sessionId pageerror baseline remains outside scope.

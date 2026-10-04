# Native DSH sidebar reference

Project-local extraction, not a replacement theme. Approved direction: native DSH, ENERGY 1 / RHYTHM 1 / MOTION 1.

## Sources
Current DSH semantic CSS variables and owning plugin styles; the user's live sidebar screenshot; published Menu control in DSH 0.2.0-rc.2. Preserve the application's chosen font (`font: inherit`), rather than enforcing the shipped Montserrat font asset.

## Foundations
- Text: `--dsw-alias-label-primary` and `--dsw-alias-label-secondary`; older aliases as fallbacks.
- Surfaces: `--dsw-alias-bg-l1`, `--dsw-alias-bg-l2`, `--dsw-alias-fill-l1`, `--dsw-alias-fill-l2`.
- Borders/focus: `--dsw-alias-border-l2`, `--dsw-alias-border-primary`, host link accent.
- Rhythm: 4/6/8/12px. Controls use 6px radius, 32px desktop height, 44px coarse-pointer height. No display typography, decorative shadows or motion beyond hover/focus.

## Sidebar patterns
Status buttons wrap without clipping. One full-width workspace navigator preserves icon/chevron and selected group breadcrumb; its anchored popup drills group → workspace, with search, Back and counts. Drilling is not selection; choosing a workspace uses native uiWorkspace.openWorkspace. Root search spans groups; explicit All-in-group scopes only the tree. Additional filters occupy their own row: independent color and period selectors show current choices. Color uses a 3×3 labelled palette with an All colors entry; period uses clock/calendar icons in a short menu. Selection remains native Menu behavior; no color-only meaning. Active-filter summary has a header with one icon-labelled reset button and wrapping chips below. Reset clears filter fields but preserves search and returns keyboard focus to All. Navigator popup width is 300px capped by viewport; coarse-pointer rows and reset targets are at least 44px. Empty filtered list says no matches, not no workspaces. Menus retain native focus/selection behavior. Small colored icons convey user's folder identity, not decoration. Group, workspace and session colors are independent. Workspace icons use only their stored color in tree/search/navigator; an unset or cleared color is neutral, never inherited.

## Limits
Do not hardcode live host palette: semantic tokens preserve dark/light themes. Native menu interactions, equal widths at 240/280/360px and seven coarse-pointer control heights of 44px were verified on the served rc2 bundle. Formal WCAG contrast measurement was not performed; visual inspection in dark/light is not a contrast certification. This reference is scoped to sidebar filters; other DSH surfaces are not standardized here.

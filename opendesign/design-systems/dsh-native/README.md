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
Status buttons wrap without clipping. Scope controls stack, share width, truncate only their label, preserve icon and chevron. Additional filters occupy their own row. Active-filter summary wraps; reset appears once. Empty filtered list says no matches, not no workspaces. Menus retain native focus/selection behavior. Small colored icons convey user's folder identity, not decoration.

## Limits
Do not hardcode live host palette: semantic tokens preserve dark/light themes. Native menu interactions, equal widths at 240/280/360px and seven coarse-pointer control heights of 44px were verified on the served rc2 bundle. Formal WCAG contrast measurement was not performed; visual inspection in dark/light is not a contrast certification. This reference is scoped to sidebar filters; other DSH surfaces are not standardized here.

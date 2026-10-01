# Folder icon artwork

The 38 outlined symbols in `tabler-data.ts` are from [Tabler Icons v3.48.0](https://github.com/tabler/tabler-icons/tree/v3.48.0/icons/outline), MIT licensed, copyright (c) 2020–2026 Paweł Kuna. The complete license is in `LICENSE`; `provenance.json` records each source URL and original SVG SHA256.

The DeepSeek whale in `brand-data.ts` is from [Lobe Icons at e633956d](https://github.com/lobehub/lobe-icons/tree/e633956d3612e1a6ddcb5d1caa161aaa6bcd36ce/packages/static-svg), MIT licensed, copyright (c) 2023 LobeHub; see `LOBE-LICENSE`. Fixed brand-blue fill is replaced by `currentColor` so user-chosen colors work. It identifies DeepSeek/DSH projects; software artwork licensing does not imply brand endorsement or transfer trademark rights.

Only trusted SVG element names and geometric attributes were extracted. Rendering uses React elements and `currentColor`, not HTML injection, remote URLs or uploaded SVG. Display stroke width is 1.75 at the existing DSH row size; source artwork uses a 24×24 view box. The default folder/project glyph remains the native DSH icon.

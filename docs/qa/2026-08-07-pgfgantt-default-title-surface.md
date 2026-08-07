# `pgfgantt`: Default Title Surface QA

## Scope

This accepted slice covers the default surface of `\\gantttitle` only:

- default `title` fill is white;
- default title outline remains drawn;
- title label placement, title height, and title shifts retain their existing
  pgfgantt lowering behavior.

The real driver is `test/fixtures/examples/pgfgantt/grid-style-list.tex`.
It combines a single title with styled horizontal and vertical grids plus two
ordinary chart rows, making an incorrect title fill visually distinct from the
canvas and grid beneath it.

## Local MacTeX Reading

Reviewed locally on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfgantt/pgfgantt-doc.pdf`

The source declares the default at line 483 as
`\\@gtt@stylekeydef{title}{shape=rectangle, inner sep=0pt, draw, fill=white}`.
The following title implementation computes its left/right extent from title
shifts, then its vertical box from `title top shift` and `title height`. The
existing lowering already matches that geometry; its hard-coded `black!8` fill
was the remaining incorrect part of this narrow slice.

## Third-Party SVG Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The complete after bundle is:

`outputs/qa-pgfgantt-title-default-2026-08-07/`

It contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX native PNG, grid
variants, diff PNGs, and comparison sheets. In the TikZKit SVG, the title is a
separate black-stroked `<path>` with `fill="white"`; tikztosvg emits an
equivalent white title surface in its clipped path group. The two SVGs differ
in text representation (browser `<text>` versus outlined glyph paths), so
MacTeX remains the visual oracle.

## Visual Change

Inspected after sheet:

`outputs/qa-pgfgantt-title-default-2026-08-07/diff/pgfgantt-grid-style-list-native-sheet.png`

Before the change, the TikZKit title rectangle was visibly pale gray while the
MacTeX and tikztosvg title was white. This made the title look like part of the
background canvas rather than the bordered Gantt title cell.

After the change, TikZKit has the same white title cell with a black border;
the colored vertical grid starts beneath it and the title label stays centered.
The registered TikZKit-to-MacTeX changed-pixel ratio fell from `0.2455` to
`0.1400`, with mean absolute RGBA falling from `0.05222` to `0.04668`. The
remaining visible residual is primarily text rasterization and a small overall
SVG bounding-box mismatch, not the title surface.

## Implementation And Verification

Changed:

- `src/frontend/latex-shell.js`: lowered title rectangles now use `fill=white`.
- `test/walmes-compat.test.js`: title regression locates the actual title
  geometry so the white chart canvas cannot satisfy the assertion.
- `src/packages/pgfgantt.js`: records the local source default and the slice.

Verified with:

```bash
node --test --test-name-pattern='uses pgfgantt title and element geometry defaults with local overrides|maps pgfgantt hgrid and repeated vgrid styles onto consecutive grid lines' test/walmes-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \\
  --output outputs/qa-pgfgantt-title-default-2026-08-07 \\
  --only pgfgantt-grid-style-list --native-reference \\
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 30000
npm run examples:diff -- --output outputs/qa-pgfgantt-title-default-2026-08-07 \\
  --register --alignment-radius 3
```

## Remaining Limits

`pgfgantt` remains `partial`: title lists, calendar/date slot generation,
Gantt links, progress, custom canvas/element shapes, and the wider date/time
configuration grammar still need source-driven implementations.

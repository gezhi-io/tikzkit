# Node-Style Font Inheritance QA

## Scope and Boundary

This pass fixes one shared TikZ capability: a font supplied through `every
node` or `nodes={...}` must become the actual SVG `FontSpec` for ordinary
nodes and inline path nodes. It does not attempt a general glyph-outline
renderer or full TeX box/crop parity.

The visual driver is the real PGF manual fixture
`test/fixtures/examples/decorations/pathreplacing-show-path-construction.tex`.
Its picture has `every node/.style={font=\tiny}` and exercises ordinary
callback labels on a line, two cubic segments, and a closing line.

## Local MacTeX Reading

Reviewed on the local TeX Live 2025 installation:

- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex`
  says `/tikz/every node` is installed at the beginning of every node.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
  defines `/tikz/nodes` as `every node/.append style={#1}`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
  and `pgfmanual-en-library-decorations.tex` define the callback decoration
  used by the driver.

This gives the needed order: a picture font is the scope layer; `every node`
and `nodes` install node-layer patches; an explicit node or path-node font
overrides those; a leading content declaration overrides all of them.

## Implementation

`src/engine/evaluate.js` now resolves the inherited node-style font separately
from picture options and records it as the internal node-font layer before
creating the text item. It also records a path font as a node layer only when
the path itself explicitly provided `font=...`; the inherited picture font
therefore stays a scope font for inline path labels.

`test/font-spec.test.js` covers both `every node/.style={font=\tiny}` and
`nodes={font=\small}` for ordinary and inline nodes, plus precedence against
picture, explicit path-node, explicit node, and leading content fonts.

## Three-Way Visual QA

Local tools found and used:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- PNG conversion: `/opt/homebrew/bin/rsvg-convert`

Artifacts are intentionally ignored by Git and remain at
`outputs/qa-every-node-fonts-2026-08-07/after/`:

- MacTeX PNG: `mactex-png/decorations-pathreplacing-show-path-construction.png`
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- 1cm-grid images and the four-panel sheet:
  `tikzkit-grid-png/`, `tikztosvg-grid-png/`, and
  `diff/decorations-pathreplacing-show-path-construction-native-sheet.png`

I inspected native, TikZKit, tikztosvg, and diff panels. Before this change,
the JS labels were visibly about twice the native size and expanded the JS crop
to 159x116px, while MacTeX and tikztosvg were both 144x105px. Afterwards the
four labels are physically 5pt CMR5 text and follow the reference paths; the
JS crop is 137x102px. The remaining visible difference is a small SVG text
measurement/crop residual, not a missing label or misplaced callback geometry.

The TikZKit SVG now contains `<text>` elements with
`font-size="17.57299"` at the renderer's 100 units/cm scale, exactly 5 TeX pt,
and `TikZKitCMR5`. tikztosvg instead emits TeX glyph outlines in a
`107.93pt x 78.56pt` viewBox, with y-flipped drawing paths and
`stroke-linecap=butt` / `stroke-linejoin=miter`. This explains the remaining
outline and crop mismatch; MacTeX remains the authority.

## Verification

```sh
node --test --test-name-pattern='materializes inherited every-node|keeps local and content font precedence|preserves FontSpec source' test/font-spec.test.js
node --test --test-name-pattern='inherits every node placement|runs show path construction' test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --only decorations-pathreplacing-show-path-construction \
  --output outputs/qa-every-node-fonts-2026-08-07/after \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa-every-node-fonts-2026-08-07/after \
  --register --alignment-radius 3
```

Diagnostics remain empty for the real fixture. Exact TeX glyph outlines,
rotated text bounds, and final native crop parity remain the next text-renderer
slice.

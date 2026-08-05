# positioning base/mid anchors visual QA (2026-08-06)

## Scope

This round implements one narrow `tikzlibrary{positioning}` slice only:
`base left`, `base right`, `mid left`, and `mid right` placements together
with the matching `base`, `base east/west`, and `mid`, `mid east/west` node
anchors. The driver is
`test/fixtures/examples/positioning/base-mid-anchor-alignment.tex`, adapted
from the local PGF manual's `X`, `a`, `y` baseline example.

It does not claim exact TeX box layout for arbitrary multiline content,
custom shapes, or all positioning directions.

## Local MacTeX Review

Reviewed the following local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex`:
  `base right` joins the new node's `base west` to the reference node's
  `base east`; `mid right` analogously joins `mid west` to `mid east`.
  The `on grid` branch replaces those anchors with `center`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex`:
  the canonical `\\huge X`, `a`, `y` example demonstrates why a normal
  `right=of` line does not align a baseline.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`:
  a rectangle's `base` anchor uses the TeX baseline and its `mid` anchor is
  `.5ex` above it; east/west add the rectangle border x coordinate.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tutorial-chains.tex`:
  it documents that a fixed `text height` and `text depth` is still needed
  when source text boxes should have identical visual height/depth.

TikZKit therefore records reusable text baseline and midline offsets on node
records, rather than shifting this one fixture's coordinates. `on grid` zeros
both node size and these offsets, preserving PGF's centre-to-centre override.

## Three-Way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; the native reference used local `pdflatex`.
The generated, ignored review directory is:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-positioning-base-mid-2026-08-06/`

It contains the MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, 1cm-grid
versions, and comparison sheets. The inspected final panels are:

- `mactex-png/positioning-base-mid-anchor-alignment.png`
- `tikzkit-grid-png/positioning-base-mid-anchor-alignment.png`
- `tikztosvg-grid-png/positioning-base-mid-anchor-alignment.png`
- `diff/positioning-base-mid-anchor-alignment-sheet.png`

The tikztosvg SVG stores glyphs in reusable `<path>` definitions and flips its
TikZ coordinate system with `transform="matrix(1, 0, 0, -1, ...)"`; it draws
the red baseline and blue dashed midline as ordinary stroked paths. TikZKit
keeps browser text as `<text>` inside translated groups, while emitting the
same guide-line geometry. This explains the remaining glyph rasterization
difference without moving the anchors.

## Visual Result

Before the change, TikZKit placed the base/mid rows near the same node-centre
y coordinate: the red and blue guide strokes crossed the text and the `X`,
`a`, `y` rows collapsed. After the change, the red line crosses all three
baselines and the blue dashed line crosses all three mid anchors. The final
TikZKit, tikztosvg, and MacTeX panels visibly have the same three-row layout.

The tikztosvg registered PNG comparison is still not pixel-identical:
`0.1100` changed-pixel ratio and `0.0272` mean absolute RGBA, with equal
146x109px canvases. Inspection localizes that residual to browser glyph
rasterization/metrics rather than the base or mid guide-line positions.

## Verification

```bash
node --test --test-name-pattern='aligns base and mid positioning' test/interpreter.test.js
node --test test/library-modules.test.js test/web-fixture-catalog.test.js
node --test --test-name-pattern='example fixtures convert through the public TikZ to SVG pipeline' test/example-fixtures.test.js
npm run gallery:audit
npm run examples:render -- --fixtures test/fixtures/examples \\
  --output outputs/qa-positioning-base-mid-2026-08-06 \\
  --only positioning-base-mid-anchor-alignment --native-reference \\
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-positioning-base-mid-2026-08-06 \\
  --register --alignment-radius 3
```

The focused tests and fixture pipeline pass with no diagnostics. The registry
now lists `positioning` as a 77-case built-in entry, names the reviewed local
source, and records this anchor slice. The existing full interpreter suite has
unrelated known baseline failures, so it is not used as the acceptance claim
for this focused change.

## Remaining Work

Exact multiline TeX height/depth, arbitrary custom-shape `base`/`mid`
anchors, rotated text boxes, and the broader positioning key family remain
partial. The next positioning slice should use a real multiline
`text height`/`text depth` case to calibrate those box metrics against MacTeX.

# Matrix Fixed-Width Ellipse QA

## Scope

This slice corrects one shared behavior only: a fixed-width TikZ text node
with wrapped lines that include a scoped font-size command. The real driver is
[`latex-examples-haskell-type-classes.tex`](../../test/fixtures/examples/latex-examples/haskell-type-classes.tex): a `matrix` of `ellipse` nodes where the
`Enum` cell contains a normal bold title and a wrapped `\small` paragraph.

The change does not attempt to implement general TeX paragraph glue,
hyphenation, arbitrary font scopes, or matrix algorithms beyond their normal
node-box layout.

## Local TeX Reading And Measurement

Reviewed on 2026-08-08:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`:
  `text width` creates a `\pgfutil@minipage[t]`, then applies the node's text
  action before collecting the paragraph box.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`:
  an ellipse expands half the text-box width/height plus inner separation by
  `sqrt(2)` and only then accounts for outer separation.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/size10.clo`:
  normal text is 10pt/12pt and `\small` is 9pt/11pt.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarymatrix.code.tex`:
  matrix cells remain ordinary nodes, so their final geometry comes from those
  node text boxes.

An isolated local `\pgfutil@minipage[t]{3cm}` with the exact `Enum` content
measured `ht=6.86111pt`, `dp=37.75pt`, hence a `44.61111pt` text box. The
three wrapped small lines retain the owning 12pt minipage baseline grid; only
their glyph boxes and wrap widths use the 9pt scope. This corrected a prior
assumption that those continuation lines should advance by 11pt.

## Implementation

- `src/engine/evaluate.js` now applies the TeX paragraph-box model to every
  supported `text width` node: first-line height + base paragraph baseline
  intervals + final-line depth.
- `src/renderers/svg/plainTextNode.js` uses that same base grid when emitting
  wrapped `tspan` offsets, so painted text and node size agree.
- `src/renderers/svg/textLayout.js` supports an explicit base-baseline mode
  while retaining per-line baseline behavior for non-paragraph multiline
  nodes.

Regression coverage is in `test/text-package-macros.test.js` and
`test/svg-renderer.test.js`.

## Commands And Parameters Exercised

`\usetikzlibrary{shapes}`, `\matrix`, `row sep=0.5cm`, `column sep=0.5cm`,
`ellipse`, `text width=3cm`, `align=center`, `inner sep=0pt`, `\textbf`,
`\small`, explicit `\\`, node names, and `ultra thick` directed edges.

Implemented: fixed-width paragraph measurement/paint baseline behavior,
matrix node-box propagation, scoped glyph-size wrapping.

Still partial: TeX glue/penalty line breaking, arbitrary paragraph commands,
font-specific bold hbox metrics, and complete node/matrix bounding-box
calibration.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its PNG uses the
local `rsvg-convert`. All artifacts are in
`outputs/qa-matrix-ellipse-minipage-2026-08-08/`:

- TikZKit SVG/PNG: `tikzkit-svg/latex-examples-haskell-type-classes.svg` and
  `tikzkit-png/latex-examples-haskell-type-classes.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/latex-examples-haskell-type-classes.svg`
  and `tikztosvg-png/latex-examples-haskell-type-classes.png`;
- MacTeX native PNG: `mactex-png/latex-examples-haskell-type-classes.png`;
- four-panel sheet: `diff/latex-examples-haskell-type-classes-native-sheet.png`.

I inspected the JS grid panel, tikztosvg grid panel, MacTeX panel, registered
diff, and four-panel sheet. Before this change, the JS `Enum` ellipse was
visibly shorter and pulled the lower matrix rows upward. Afterwards, its
ellipse expands from `2.145cm` to `2.216cm`, versus the native TeX geometry of
about `2.218cm`; the following rows and their arrows move down with it. The
JS canvas grew from `528x408px` to `528x414px`, closer to native `537x422px`.
Registered mean absolute RGBA difference moved from `0.06612` to `0.06194`.
Those numbers support the visible geometry correction rather than substitute
for it.

The tikztosvg SVG uses transformed TeX glyph paths while TikZKit emits
browser text/tspans. TikZKit therefore still differs in text rasterization,
but its ellipse, line spacing, and inherited matrix positions are now closer
to the MacTeX oracle.

## Verification

Passed:

```bash
node --test --test-name-pattern='text-width paragraphs|TeX minipage paragraphs' \
  test/svg-renderer.test.js test/text-package-macros.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-matrix-ellipse-minipage-2026-08-08 \
  --only latex-examples-haskell-type-classes \
  --tikztosvg --native-reference --grid --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-matrix-ellipse-minipage-2026-08-08 \
  --register --alignment-radius 3
```

The complete `test/svg-renderer.test.js` suite retains a pre-existing unrelated
basic-arrow width assertion (`57.09pt` vs `57.49pt` reference); all focused
tests for this slice pass.

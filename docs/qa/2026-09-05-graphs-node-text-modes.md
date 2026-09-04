# TikZ Graphs Node Text Modes QA (2026-09-05)

## Scope

This slice implements three related TikZ `graphs` node-text semantics:

- `math nodes` wraps default graph-node text, including slash text, in math mode;
- `empty nodes` suppresses default graph-node text;
- node-local `as=...` and `/tikz/graphs/as=...` override both modes, including an explicitly empty value.

When `math nodes` and `empty nodes` both occur, their source order decides the active mode. Arbitrary `typeset=...` callbacks, subgraphs, graph-drawing algorithms, circular/grid placement, node sets, and other graph operators remain outside this slice.

## Local MacTeX Review

Reviewed these local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/graphs/tikzlibrarygraphs.code.tex`, especially the node parser and typesetter around lines 980-1165;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-graphs.tex`, especially the `as`, `empty nodes`, and `math nodes` descriptions around lines 1025-1175;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`, circle sizing around lines 1187-1258;
- `cmmi10.tfm`, `cmmi7.tfm`, `cmr7.tfm`, and `cmsy10.tfm` under `/usr/local/texlive/2025/texmf-dist/fonts/tfm/public/cm/`.

The graphs source keeps a node's graph name separate from its displayed text. `math nodes` and `empty nodes` replace the graph-level typesetter, while `as` is handled as a node-local final override. The circle source computes radius from the TeX text box plus inner separation and then enforces minimum width/height. The TFM files show that 7pt math letters have design-specific advances, not a uniform 0.7 scale of 10pt metrics; TeX also uses `SUP2`, `SUB1`, `SUB2`, rule-thickness clearance, and x-height correction for script placement.

Local pdfTeX box measurements used as the metric target were:

- `$a_1$`: 9.77202pt wide, 4.30554pt high, 1.49998pt deep;
- `$b^2$`: 8.77779pt wide and 8.14003pt high;
- `$c_3^n$`: 9.77089pt wide, 6.6428pt high, 2.4821pt deep.

## Case Inventory

| Driver | Commands and environments | Options and values |
| --- | --- | --- |
| `graphs-node-text-flowchart` | `\\documentclass`, `\\usepackage`, `\\usetikzlibrary`, `document`, `tikzpicture`, `\\graph` | `empty nodes`, `as`, node/edge styles, 2cm growth, 1.2cm branching, 7mm circles |
| `graphs-node-text-math` | same shell and graph command | `math nodes`, subscript/superscript text, 1.8cm growth, 1.1cm branching, 8mm circles |
| `graphs-node-text-physics` | graph plus quotes library | `math nodes`, slash text, `as={Detector}`, quoted math edge labels, 2.4cm growth, 11mm by 8mm boxes |

The adjacent `.review.json` files account for every dependency, command, environment, option, and numeric literal. All three strict semantic audits are accepted with zero TODOs and blockers.

## Reference Structure

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`, MacTeX used `/Library/TeX/texbin/pdflatex`, and PNG conversion used `/opt/homebrew/bin/rsvg-convert`.

The reference SVG outlines TeX formula glyphs as paths inside transformed groups; arrows are emitted as filled paths with PGF's cap/join behavior, and the page matrix flips the SVG y axis. TikZKit keeps editable SVG `<text>` and `<tspan baseline-shift=...>` content while using ordinary `<ellipse>` or rounded-box geometry. For the math fixture, the final TikZKit and tikztosvg view boxes are effectively identical: 129.11pt by 58.26pt versus 129.108pt by 58.242pt.

## Visual Result

Before this change, the empty flowchart node visibly printed `wait`; math graph nodes printed `_` and `^` as ordinary characters; and superscript/combined-script nodes enlarged beyond the native 8mm minimum. The physics state labels had the same plain-text script problem.

After the change, the inspected native four-way sheets show:

- the `wait` circle is empty while `Start`, `Review`, and `Done` remain visible through `as`;
- `a_1`, `b^2`, and `c_3^n` have real sub/superscript placement and all four mathematical circles remain approximately 8mm;
- `x_0`, `x_1`, and `v_1` are math typeset, while `Detector` remains ordinary explicit text and quoted transition formulas remain intact;
- node placement, branching, arrow geometry, fills, and line weights closely track both MacTeX and tikztosvg.

The flowchart and math raster dimensions match the reference. The physics sheet retains a one-pixel width and two-pixel height raster difference caused by formula/edge-label crop bounds. Diff ratios remain secondary evidence; acceptance is based on the visible semantics and geometry above.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-graphs-node-text-before/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-graphs-node-text-after/`

The after directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, 1cm-grid variants, diff images, native four-way sheets, and the comparison page for all three drivers.

## Verification

```bash
node --test test/graphs.test.js

npm run case:audit -- test/fixtures/examples/graphs/node-text-flowchart.tex --review test/fixtures/examples/graphs/node-text-flowchart.review.json --strict
npm run case:audit -- test/fixtures/examples/graphs/node-text-math.tex --review test/fixtures/examples/graphs/node-text-math.review.json --strict
npm run case:audit -- test/fixtures/examples/graphs/node-text-physics.tex --review test/fixtures/examples/graphs/node-text-physics.review.json --strict

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-05-graphs-node-text-after \
  --only graphs-node-text-flowchart \
  --only graphs-node-text-math \
  --only graphs-node-text-physics \
  --native-reference --strict-tikztosvg \
  --continue-on-external-failure \
  --tikztosvg-engine pdflatex \
  --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-05-graphs-node-text-after
```

All three renderers completed for all three cases with zero TikZKit diagnostics and zero external failures. The focused graph tests pass. A pre-existing stale multiline-circle expectation remains outside this graph slice; clean-HEAD reproduction confirmed that it is not introduced here.

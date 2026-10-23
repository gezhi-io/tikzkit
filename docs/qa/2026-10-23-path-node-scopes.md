# Path-Local Node Scopes

## Scope and Status

This batch addresses one shared parser defect: an ordinary node-only path
was lowered as a tree even when it contained no `child` operation. This
discarded its path-local `every node` definition and could discard later
nodes. Fourteen real line-segment cases recover 56 missing endpoint crosses.
Core TikZ remains **partially compatible**; this is not whole-library acceptance.

The full suite decreases from 93 failures to 76, without changing existing
test assertions or adding skips. Actual Chrome comparisons pass for all 15
selected cases in both default JS and SVG-text modes. Direct MacTeX PDF-to-PNG
thin-line rasterization still differs, so whole-raster acceptance remains
**false**, not waived.

## Local Source Review

Paths are relative to `/usr/local/texlive/2025/texmf-dist/` unless absolute.

| Source | Rule applied |
| --- | --- |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 2093-2118 | A path starts its own TeX group and applies path keys there. Its style definitions must not escape to subsequent paths. |
| Same file, lines 3791-3837 | Each node starts its own group, initializes its defaults, applies `every node`, then consumes explicit node options. Individual options override inherited defaults. |
| `tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex`, lines 13-43 | `cross out` inherits rectangle anchors and paints two foreground diagonals, with arrow state cleared. Empty text does not imply an invisible shape. |
| `/Library/TeX/texbin/tikztosvg`, lines 175-194 | The wrapper loads packages before libraries. Declarations in a generated preamble package must retain their preceding library loads. |

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`, version
0.3.0. References use local TeX Live 2025 pdflatex and `rsvg-convert` 2.63.0.
No online compiler, downloaded font or package installation was used.

## Implementation

- `src/frontend/parser.js`: `parsePathNodeTree` only accepts nodes containing actual child trees. Ordinary node-only paths retain the path AST and use the existing path interpreter, including every-node styles and all node segments.
- `scripts/render-example-fixtures.js`: preserve library loads in the generated preamble package before dependent declarations such as `>=stealth'`. Library-only sources retain the previous wrapper eligibility rule.
- `scripts/browser-cross-out-metrics.js`: inspect the actual painted SVG transforms, geometry, stroke width, color and canvas bounds in Chrome. One-to-one matching also checks coincident endpoint multiplicity.
- `scripts/audit-module-regressions.js`: optional `--cross-out-metrics` adds these checks to the existing browser screenshots and side-by-side sheets.

No per-case coordinates or new rendering offsets were added. Existing
line-segment and interpreter expectations pass unchanged. The regression
tests retain a real `child` tree as a control against overcorrecting the parser.

## Commands and Parameters Checked

| Commands/options | Coverage and boundary |
| --- | --- |
| `\path ... node ...;` | Multiple empty nodes and their original coordinates survive parsing. |
| `every node/.style`, `every node/.append style` | Local style definitions, inherited defaults and later-path isolation. |
| Explicit node `shape`, `draw`, `red/blue/gray` | Per-node overrides take precedence over path defaults. |
| `cross out`, `inner sep=0pt`, minimum width/height, `thick` | Both diagonals, native physical dimensions, color and stroke width are compared. |
| `\begin{scope}[xshift=1cm]` | The surrounding transform is applied once; local node styles do not leak. |
| `node ... child ...` | Retains the tree AST, child node and parent connection. Broader tree algorithms are unchanged. |
| `\tkzGrid`, `\tkzAxeXY`, `\draw`, coordinate arithmetic | Real-case context remains visible. This batch does not newly implement or certify the whole tkz-fct package. |
| `to path`, `\tikztotarget`, `at start/end`, `\tikztonodes` | A separate 30-cross intersection control preserves its existing output. |
| `\usetikzlibrary`, `\usepgfplotslibrary`, preamble keys | Reference-wrapper tests verify library/declaration order. This is not a full arbitrary-TeX preamble interpreter. |

## Visual Evidence

Artifact directories under `outputs/qa/`:

- `2026-10-23-path-node-before/`: immutable pre-change JS/native images and the first full-suite comparison.
- `2026-10-23-path-node-after/`: fresh JS SVG/PNG, MacTeX PNG, tikztosvg SVG/PNG, native/diff sheets, browser screenshots and final test summary.

The after directory contains `browser-audit.html`, `browser-audit.json`,
`browser/`, `mactex-png/`, `tikztosvg-svg/`, `tikztosvg-png/`, `tikzkit-svg/`,
`tikzkit-png/`, `diff/` and `mactex-vector/`. These are local generated artifacts,
not links promised to exist on GitHub.

| Real fixture IDs (with `latex-examples-` prefix) | Visual result |
| --- | --- |
| `line-segments-bounding-box` | Four gray corner crosses restored; rectangle and guides retain their positions. |
| `line-segments-f1` through `line-segments-f8` | All four endpoint crosses restored per case across intersecting, disjoint, horizontal and vertical arrangements. Segment colors and draw order remain unchanged. |
| `line-segments-t2` through `line-segments-t6` | Four endpoints retained per case, including coincident endpoints. In the complete-overlap case only two cross locations are visible, but all four nodes and their draw order remain present. |
| `lines-intersections` | Thirty endpoint crosses remain unchanged, checking the separate to-path expansion route. |

All 15 native/JS/tikztosvg sheets were visually inspected, including enlarged
Chrome before/after sheets for f1 and t6. The missing crosses visibly return;
this is not a change to an image-difference number alone.

Chrome renders the default JS API SVG and the exported SVG-text SVG alongside
the local tikztosvg SVG. The compiler is called by the Node audit harness;
editor event handlers and in-page compilation are not exercised by this run.
All panels use the same 3x physical scale and raw canvas origin, with no
per-case alignment or image fitting. Maximum endpoint error is 0.047px,
maximum canvas error 0.047px, and compared stroke colors are identical.
Both JS modes pass the 0.12px gate; diagnostics and browser errors are zero.

The reference represents a cross as two `M/L` diagonal subpaths, no fill,
gray stroke and the inherited local transform. JS uses separate shape paths
with the same physical geometry. Canvas bounds, not only cross centers, are
checked to prevent accidental rescaling from concealing displacement.

### Native Raster Difference

JS versus tikztosvg SVG-to-PNG comparisons pass for all 15 cases. Direct
MacTeX PDF-to-PNG grid lines remain visibly darker/thicker, so the aggregate
native raster gate is still false. Its thresholds were not relaxed.

As a control, each original MacTeX PDF was independently converted with
`pdf2svg`, then rasterized using `rsvg-convert`. Those 15 PNGs have zero
changed pixels against the tikztosvg PNGs. This isolates the observed grid
darkness to the direct PDF rasterization route; it does not authorize silently
accepting that route's failing gate. PDFs, derived SVG/PNGs and measured
results remain in `.mactex-work/` and `mactex-vector/comparison.json`.

## Tests and Reproduction

New regressions:
[path scopes](../../test/path-node-scope.test.js),
[preamble order](../../test/tikztosvg-preamble-order.test.js), and
[browser gate integrity](../../test/browser-cross-out-metrics.test.js).

```sh
node --test test/path-node-scope.test.js test/tikztosvg-preamble-order.test.js \
  test/example-render-script.test.js test/browser-cross-out-metrics.test.js
npm run test:summary
npm run gallery:audit
npm run check:architecture
npm run docs:links
git diff --check
```

To regenerate a representative case (repeat `--only` for the IDs above):

```sh
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output outputs/qa/2026-10-23-path-node-after \
  --only latex-examples-line-segments-f1 --preserve-output \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/audit-module-regressions.js --fixtures test/fixtures/examples \
  --output outputs/qa/2026-10-23-path-node-after \
  --before outputs/qa/2026-10-23-path-node-before \
  --only latex-examples-line-segments-f1 --cross-out-metrics \
  --browser-module "$PLAYWRIGHT_MODULE"
```

`PLAYWRIGHT_MODULE` points to the installed local Playwright module; the audit
does not download a browser. The final 15-case audit uses every ID above.

| Check | Result |
| --- | --- |
| Focused path/reference tests | 67 passed; browser gate tests add 3 passed |
| Full suite | 2827 tests: 2737 passed, 76 failed, 14 skipped |
| Previous full suite | 2819 tests: 2712 passed, 93 failed, 14 skipped |
| Failure-name comparison | 16 leaf failures resolved plus their one aggregate parent; no new failing names |
| Chrome default JS and SVG-text | All 15 cases pass endpoint and canvas checks, zero diagnostics |
| Entire core gallery | 660/660 render, zero diagnostics; this does not certify all images visually |
| Architecture / documentation links / whitespace | Pass; one pre-existing architecture debt remains |
| Native PDF raster comparison | Still not accepted; separate native vector control is identical to tikztosvg |

## Remaining Work

The full suite is not green. Its machine-readable failure list is retained
in `test-summary.json`. PGFPlots still has 21 focused failures, including
ordinary-text legends, histogram cropping and 3D layouts/labels. Other failures
include serialization expectations and unimplemented behavior; none is
silenced to improve the count. Follow-up work should continue with a small
native-source-reviewed runtime defect and a failing semantic regression,
then repeat browser comparison before claiming broader compatibility.

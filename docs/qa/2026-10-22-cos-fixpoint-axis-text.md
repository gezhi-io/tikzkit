# Cos-Fixpoint Axis Text

## Scope

Follow up the [enlarged-clipping repair](2026-10-22-cos-fixpoint-clipping.md)
with numeric tick baselines, custom mathematical tick labels, x/y labels and
the intersection annotation in `latex-examples-cos-fixpoint`.

The shared implementation opts 2D middle axes with default description placement
into native math boxes and TeX node anchors. It preserves explicit source text,
explicit text tick labels, and scope isolation. Boxed axes, 3D axes and explicitly
positioned axis descriptions retain their existing layout path. PGFPlots remains
partial; this is not an all-library or pixel-identical acceptance claim.

## Local Source Review

Sources under `/usr/local/texlive/2025/texmf-dist/`:

- `tex/latex/pgfplots/pgfplots.sty`: registry entry point into the generic implementation.
- `tex/generic/pgfplots/pgfplotsticks.code.tex`: `show@ticklabel@@` creates real TikZ nodes; oriented-surface label placement accounts for tick alignment and the middle-axis origin before selecting a node anchor.
- `tex/generic/pgfplots/pgfplots.code.tex`: non-boxed axis tick defaults and x/y description styles determine the tick projection and the label anchors.
- `tex/generic/pgf/math/pgfmathfloat.code.tex:1648`: the default number printer uses `pgfutilensuremath`, not plain text. Negative signs, decimal digits and their height/depth must therefore use the math box.
- `tex/generic/pgf/modules/pgfmoduleshapes.code.tex:891`: rectangle anchors include `.5\pgflinewidth` outer separation even when the node is not drawn; `.3333em` inner separation belongs to the node layout.

The reproducible [native probe](../../test/fixtures/pgfplots-axis-text-metrics.tex)
records text-box width/height/depth and tick/label node anchors using the same
`compat=1.9` and axis dimensions as the real case. Selected TeX dimensions:

| Math box | Width (pt) | Height (pt) | Depth (pt) |
| --- | ---: | ---: | ---: |
| `0.5` | 12.77782 | 6.44444 | 0 |
| `-0.5` | 20.55562 | 6.44444 | 0.83333 |
| `\pi` | 6.05905 | 4.30554 | 0 |
| `\frac{\pi}{2}` | 7.32747 | 6.95120 | 3.44841 |
| `x=y\approx0.739085` | 75.42120 | 6.44444 | 1.94444 |

The negative tick has nonzero depth. Centering a plain browser text line with
an approximate baseline cannot reproduce its native node anchor. Similarly,
the annotation gap contains the empty parent node's outer separation as well
as the label node's padding and explicit `label distance=0.1cm`.

## Implementation

- `src/pgfplots/axisTikzLowering.js`: scopes native math and node-anchor semantics to the accepted middle-axis family, including overlay labels. A separator protects this scope from a preceding legacy `\tikzstyle`. When enlargement moves the viewport outside the original allocation, the final plot rectangle replaces estimated gutters; measured text supplies the remaining bounds.
- `src/pgfplots/ticks.js`: marks default numeric labels for math painting, without rewriting their semantic text or user-supplied labels.
- `src/tikz/text.js`: normalizes these numbers as math, with mathematical minus and grouped thousands separators.
- `src/engine/evaluate.js`: propagates native math into labels and uses the unpainted node's outer separation for anchor placement.
- `src/renderers/svg/renderSvg.js` and `bounds.js`: use the same normalized math box for painting and bounding-box calculation.
- `scripts/audit-module-regressions.js`: measures every glyph origin and all tick-segment centers/lengths in actual Chrome, relative to one shared plot-clip origin. It does not independently fit individual labels.

No fixture coordinates, text offsets or source options were changed. The font
faces are the existing packaged MacTeX Computer Modern fonts; no replacement
fonts or online installations were introduced.

## Visual Verification

`command -v tikztosvg` returns `/Library/TeX/texbin/tikztosvg`.
Fresh references use local pdflatex; rsvg-convert rasterizes the reference SVG.
Artifacts are in `outputs/qa/2026-10-22-cos-fixpoint-text-after/`:

- `tikztosvg-svg/`, `tikztosvg-png/`: third-party SVG and PNG.
- `mactex-png/`: native PDF rasterization.
- `tikzkit-svg/`, `tikzkit-png/`: JS exports.
- `browser-audit.html`, `browser-audit.json`: live SVG panels and browser measurements.
- `browser/`: default JS, tikztosvg, SVG-text and before screenshots, their sheet/diff, and isolated curve paint.
- `native-probe/`: native log and PDF.

All browser panels, the diff and the native PNG were visually inspected.
Before: y-axis numbers sit too high, `\pi` sits too low, and the intersection
formula uses a visibly different face/spacing. After: tick baselines, the
fraction and pi, x/y labels and annotation follow the native boxes. The
annotation no longer looks heavier than the reference. Enlarged curve tails
and legend geometry remain intact. The canvas contracts from about 302.29bp
to 300.55bp wide; the reference is 300.357bp.

The reference encodes font outlines as `defs/path` plus positioned `use`
elements, straight centered tick subpaths with 0.19925bp strokes, and a
transformed plot clip. JS uses native CM SVG text boxes and individual tick
paths. Both representations are measured after browser transforms, at the
same physical 3x scale, after waiting for fonts to load.

| Browser check | Default JS and SVG-text |
| --- | --- |
| Glyph origins | 32/32; maximum error 0.175px |
| Tick centers and lengths | 6/6; maximum error 0.229px |
| Legend glyph/frame errors | 0.036px / 0.007px |
| Plot-clip dimension error | 0.174px |
| Blue curve bidirectional pixel coverage, 2px tolerance | 100% |
| Red curve bidirectional pixel coverage, 2px tolerance | At least 99.965% |
| Diagnostics / browser errors / failed fonts | 0 / 0 / 0 |

Glyph/tick acceptance tolerance is 0.3px in the 3x view, with a single clip
translation and no rescaling or per-label adjustment. The old panel fails the
glyph gate because most of its text uses a different layout path; its seven
native glyphs must not be presented as an all-text position comparison.

Raw diffs still show antialiasing and subpixel path/crop differences. Canvas
width/height differ from tikztosvg by about 0.2bp, and grid paint/axis arrow
shapes are not newly certified here. These residuals are not hidden by the
position checks or described as zero difference.

## Commands and Options Checked

- `\documentclass`, `preview`, `\PreviewBorder{0mm}`, `\usepackage{pgfplots}`, `\pgfplotsset{compat=1.9}`, `tikzpicture`, `axis`: the complete original source is the driver; general document typesetting remains outside the library.
- `axis x line=middle`, `axis y line=middle`: default centered 0.15cm tick strokes, origin-tick suppression and the existing x/y tip placement are checked.
- `xtick={0,1.5708,3.14159}`, `xticklabels={$0$,$\frac{\pi}{2}$,$\pi$}`: labels use the original values and native inline math sizes. The origin label is omitted like native PGFPlots.
- Automatic y ticks `-1,-0.5,0.5,1`: math-mode digits/minus, measured depth and east anchors are checked.
- `xlabel=$x$`, `ylabel=$y$`: native glyphs and default label anchors are checked.
- `\coordinate (a) at (axis cs:0.739085,0.739085)`, `\fill[red] ... circle (3pt)`, `\node[label={[label distance=0.1cm]0:...}]`: the point and annotation remain in the same projected coordinate system; the label gap includes both node anchors.
- `\frac`, `\pi`, `=`, `\approx`, decimal digits, `\cos`: native CM boxes and glyph painting are used in both default/browser and SVG-text paths.
- `xmin=0`, `xmax=pi`, `ymin=-1`, `ymax=1`, both enlargement options, `width=12cm`, `height=8cm`: existing range/clip acceptance remains passing.
- Both `\addplot` calls, `domain=-8:8`, `samples=200`, `very thick`, blue/red, `cos(deg(x))`, and `x`: unchanged sampling with actual curve-paint regression checks.
- `grid=major`, `grid style={dashed,gray!30}`: preserved; exact grid dash/raster equality is not part of this text repair.
- `legend style={at={(0.2,0.37)},anchor=north,fill=none}` and `\legend`: previous native legend checks remain passing.
- Arbitrary number-format macros, scaled/exponent tick typography, boxed/3D text and explicit description coordinates: not newly completed by this change.

## Tests and Reproduction

Five new regression tests pass. The initial three position/painting assertions
failed before implementation; existing assertions were not relaxed. The focused
axis-text, clipping, legend and six-fixture LDA checks pass 18/18. The complete
suite reports 2,789 tests: 2,661 pass, 114 pre-existing failures (including an
aggregate failure), 14 skip. Failure names are unchanged from the previous
batch. There was no GitHub push or npm publication in this turn.

```sh
node --test test/pgfplots-axis-text.test.js test/pgfplots-enlarged-clipping.test.js test/pgfplots-legend-metrics.test.js test/pgfplots-lda-shared-visual.test.js
npm run test:summary
/Library/TeX/texbin/pdflatex -interaction=batchmode -halt-on-error -output-directory outputs/qa/2026-10-22-cos-fixpoint-text-after/native-probe test/fixtures/pgfplots-axis-text-metrics.tex
node scripts/render-example-fixtures.js --only latex-examples-cos-fixpoint --output outputs/qa/2026-10-22-cos-fixpoint-text-after --native-reference --strict-tikztosvg --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/audit-module-regressions.js --fixtures test/fixtures/examples --only latex-examples-cos-fixpoint --output outputs/qa/2026-10-22-cos-fixpoint-text-after --before outputs/qa/2026-10-22-cos-fixpoint-clipping-after --legend-metrics --plot-clip-metrics --axis-text-metrics --browser-module <local-playwright-index.mjs>
```

Next: audit boxed-axis numeric labels and scale multipliers against native node
probes before extending the opt-in boundary. Keep the glyph, tick and curve
paint gates so numeric/visual regressions are visible together.

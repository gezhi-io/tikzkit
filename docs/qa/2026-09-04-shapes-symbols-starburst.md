# PGF shapes.symbols starburst QA

## Slice and acceptance boundary

- Library slice: the `starburst` node family from `shapes.symbols`.
- Priority: the registry listed `shapes.symbols` as partial, while starburst was
  still rendered as a rectangle. This affected alert flowcharts, mathematical
  callouts, and physics annotations.
- In scope: outline construction, content and minimum sizing, seeded random tip
  heights, outer/inner/numeric/compass anchors, shape-border rotation, mitered
  outer separation, border clipping, paint bounds, and the formula metrics used
  by the mathematical fixture.
- Out of scope: the other unsupported `shapes.symbols` families and a complete
  TeX math layout engine.

## Local source review

Reviewed these MacTeX 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex:95-564`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex:928-1117`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfunctions.random.code.tex:28-92`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex:487-603`

Implementation points learned from the executable source:

- The defaults are 17 points, `.5cm` point height, and random seed 100.
- The inner content radii are multiplied by 1.41421 before point height and
  minimum dimensions are applied.
- The seeded point-height ratio is `.25 + .75*rnd`, where `rnd` is produced by
  PGF's Park-Miller-style integer generator. Seed zero makes every point full
  height.
- `shape border uses incircle=false` rounds the anchor rotation to quarter
  turns. Incircle mode accepts the requested angle.
- PGF's paint path intentionally remains unrotated while its anchors use the
  shape-border rotation. TikZKit follows the executable source rather than
  applying a visual rotation inferred from the key name.
- Outer separation is a mitered offset polygon. Expanding a bounding rectangle
  or moving vertices radially does not reproduce PGF's named anchors.
- Compass and automatic edge anchors are ray intersections with that rotated
  miter polygon.

The focused formula was also measured directly with local MacTeX at `\small`.
Its TeX box is `98.56082pt` wide, `6.75pt` high, and `2.25pt` deep. The SVG-text
estimator now selects the 9pt optical metrics before the node scale and measures
`\{`, `\}`, `\lVert`, `\rVert`, relation spacing, binary minus, and the
subscripted epsilon consistently. Its estimate is `98.833pt`, a `0.272pt`
difference.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Before: `outputs/qa-shapes-symbols-starburst-2026-09-04-before/`.
- Final: `outputs/qa-shapes-symbols-starburst-2026-09-04-final/`.
- Saved TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`.
- Saved tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`.
- Saved native PNG: `mactex-png/`.
- Grid overlays: `tikzkit-grid-svg/`, `tikzkit-grid-png/`,
  `tikztosvg-grid-svg/`, and `tikztosvg-grid-png/`.
- Four-way inspected sheets:
  - `diff/shapes-starburst-alert-flow-native-sheet.png`
  - `diff/shapes-starburst-uncertainty-math-native-sheet.png`
  - `diff/shapes-starburst-shock-physics-native-sheet.png`

The tikztosvg SVG uses one closed path with nonzero fill, butt line caps, miter
joins, a y-flipping transform, and path-based TeX glyphs. TikZKit emits the same
alternating inner/outer polygon directly in canvas coordinates, paints formulas
as scoped SVG text, and emits arrow tips as explicit paths. The final viewBox
differences are limited to the text raster and subpixel crop margins.

## Visual result

Before this slice:

- The alert flow used a small rectangle instead of a 12-point full-height
  starburst, shortening the canvas by 20px vertically.
- The physics fixture used a large rectangle. Vector endpoints and the north,
  south-east, and automatic border anchors therefore met the wrong contour.
- The mathematics fixture used a purple rectangle, leaked `lVert`/`rVert` text,
  overlapped labels, and was 75px narrower than the native reference.

After this slice:

- The alert flow has the native 12-point outline, two-line centered label,
  west/east clipping, and south orthogonal return path. TikZKit is 418x87px;
  tikztosvg and MacTeX are 418x89px.
- The physics fixture has the native seeded 17-point contour. Both velocity
  vectors, the north normal, and the south-east marker meet the same outline.
  TikZKit is 248x163px against the 249x162px reference.
- The mathematics fixture has the seeded 9-point outline, source-defined anchor
  rotation, outer point 1, inner point 5, numeric 35-degree anchor, and complete
  formula. TikZKit is 239x116px against the 240x115px reference.
- All three cases render through TikZKit, tikztosvg, and MacTeX with zero
  diagnostics and zero external-render failures.

The changed-pixel ratios fell from 35.95% to 11.87% for the flowchart, 21.80%
to 7.73% for the physics fixture, and 59.12% to 10.01% for the mathematics
fixture. These values support, but do not replace, inspection of the sheets.
Remaining visible differences are SVG versus TeX glyph rasterization and a
1-2px crop margin. No focused shape, anchor, edge, label, or formula element is
missing.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=2pt]{standalone}` | accepted wrapper | fixture crop and reference harness |
| `\usepackage{tikz}`, `\usepackage{amsmath}` | implemented/accepted for used slice | package registry and document shell |
| `\usetikzlibrary{shapes.symbols,positioning,arrows.meta}` | implemented for used slices | per-library modules |
| `\begin{tikzpicture}[>=...,node distance=...,every node/.style=...]` | implemented | scoped options and style registry |
| `stage/.style`, `flow/.style`, `vector/.style` | implemented | named style expansion |
| `\node[starburst]`, direct `shape=starburst` | implemented | shared starburst layout and renderer geometry |
| `starburst points=9/12/17` | implemented | alternating polygon vertex count |
| `starburst point height=4/5/7mm` | implemented | maximum outer-tip height |
| `random starburst=0/23/314/2025` | implemented | exact local PGF integer sequence |
| `shape border rotate=18` | implemented | source-compatible anchor rotation |
| `shape border uses incircle` | implemented | circular content radius and arbitrary anchor angle |
| `minimum width`, `minimum height`, `minimum size`, `inner sep` | implemented | source ordering and sqrt(2) content fit |
| `outer sep=1/2pt` | implemented | mitered anchor border |
| `draw`, `fill`, mixed colors, `line width`, `thick`, `rounded corners`, `align=center`, `font=\small` | implemented for fixture usage | shared option and text layers |
| `right=of` and `node distance` | implemented | positioning library |
| `.north`, `.south`, `.south east`, `.west`, `.east`, `.center` | implemented | compass and center anchors |
| `.outer point 1`, `.inner point 5`, `.35` | implemented | named point and numeric border anchors |
| `\draw[->]`, `\draw[dashed]`, `--`, `|-`, `++(x,y)` | implemented | path builder, clipping, and explicit arrow paths |
| `\fill ... circle`, inline `node[midway/above/below/right]` | implemented | path actions and path-node placement |
| `\coordinate ... at (...)` | implemented | named coordinate registry |
| `\Omega`, `\varepsilon`, `\{`, `\}`, `\lVert`, `\rVert`, `\leq`, sub/superscripts | implemented for focused SVG-text formula | math fallback, optical metrics, and upright symbols |

No command or option used by these three fixtures is silently ignored. The
library remains `partial` because other `shapes.symbols` nodes and complete TeX
math typography remain outside this slice.

## Verification

```sh
node --test test/shapes-symbols-starburst.test.js
node --test --test-name-pattern='renders common relation commands|adds TeX-like spacing' test/renderer.test.js
npm run examples:render -- --output outputs/qa-shapes-symbols-starburst-2026-09-04-final --only shapes-starburst-alert-flow --only shapes-starburst-uncertainty-math --only shapes-starburst-shock-physics --native-reference --strict-tikztosvg --continue-on-external-failure
npm run examples:diff -- --output outputs/qa-shapes-symbols-starburst-2026-09-04-final
npm run extension-registry
```

The starburst module suite passes 5/5 and the focused math suite passes 3/3.
The full renderer file remains at its previous-commit baseline of 178 passing
and 10 pre-existing failures. The full repository run has unrelated existing
fixture-manifest failures plus local socket-permission failures; this slice adds
no renderer regression.

## Next slice

Continue with one independently verifiable `shapes.symbols` family selected by
registry case count and visual severity. A good next candidate is `burst`-like
callout coverage only if it has real corpus use; otherwise move to the highest
count unsupported package/library rather than expanding this slice.

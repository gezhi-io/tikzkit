# Legacy Prime Arrows QA (2026-09-05)

## Scope

This slice implements the ordinary legacy `arrows` library terminals
`latex'`, `latex' reversed`, `stealth'`, and `stealth' reversed`. The library
has 145 registered cases and remains partial. The acceptance boundary is:

- preserve all four names through parsing and the scene IR;
- derive tip dimensions from the active line width;
- reproduce the source cubic silhouettes and paint rules;
- shorten the shaft to the tip end at either path terminal;
- orient tips from the local start or end tangent on straight, orthogonal, and
  cubic paths.

Arbitrary `\pgfarrowsdeclare` programs and custom arrow setup code are outside
this slice.

The permanent drivers cover three real uses:

- `arrows-legacy-prime-flowchart`: straight, orthogonal, and bent workflow
  connections;
- `arrows-legacy-prime-math`: maps, an inverse curved map, and bidirectional
  vertical arrows;
- `arrows-legacy-prime-physics`: force vectors and a curved momentum change.

## Local MacTeX Review

Reviewed these TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`, especially lines 490-553;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`, especially the reversed-arrow declaration around line 1102;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`, especially lines 38-43.

Both prime tips use `d = 0.28pt + 0.3 * line width`. For `latex'`, the declared
back and front extents are `-4d` and `6d`, and the closed three-cubic shape is
filled without a stroke. For `stealth'`, they are
`-(6d + 0.5 * line width)` and `2d + 0.5 * line width`; the three-cubic shape
resets dashing, uses a round join, and is both filled and stroked. PGF creates
the `reversed` names by reflecting the source arrow in its local x axis, which
also swaps the effective terminal extents.

At `line width=2pt`, the verified back/front/placement/assembly values in pt
are:

| Tip | Back | Front | Placement | Assembly |
| --- | ---: | ---: | ---: | ---: |
| `latex'` | -3.52 | 5.28 | 5.28 | 8.80 |
| `latex' reversed` | -5.28 | 3.52 | 3.52 | 8.80 |
| `stealth'` | -6.28 | 2.76 | 2.76 | 9.04 |
| `stealth' reversed` | -2.76 | 6.28 | 6.28 | 9.04 |

## Command And Parameter Inventory

The drivers exercise `\documentclass`, `\usepackage`, `\usetikzlibrary`,
`\begin`/`\end`, `\node`, `\draw`, and `\fill`, with `document` and
`tikzpicture` environments. Libraries and packages are `tikz`, `arrows`, and
`positioning`.

Verified options and values include:

- arrow names `latex'`, `latex' reversed`, `stealth'`, and
  `stealth' reversed`, at both start and end terminals;
- `line width=2pt` for every primary arrow and `.8pt` for the physics baseline;
- colors `blue`, `red`, `purple`, `orange!85!black`, `green!50!black`, and
  `teal!70!black`;
- `node distance=1.2cm and 1.7cm` in the flowchart and
  `1.8cm and 2.5cm` in the map;
- node dimensions `minimum width=2cm`, `minimum height=8mm`,
  `minimum size=9mm`, `inner sep=1pt`, circles, and rounded rectangles;
- `right=of`, `below=of`, `above`, `below`, `left`, `right`, `midway`, and
  `sloped` node placement;
- straight `--`, orthogonal `-|`, and `to[bend left/right=18|24]` paths;
- physics coordinates from `(-2.3,0)` to `(2.5,0)`, vector terminals
  `(2.15,1.15)`, `(-1.75,.95)`, `(0,-1.75)`, and the curved path from
  `(-1.65,-1.2)` to `(1.75,-1.1)`.

Within this boundary all listed arrow names, dimensions, directions, paint,
and terminal shortening are implemented. Generic custom arrow declarations,
arbitrary setup-code arithmetic, custom clipping/hulls, and custom concave
join behavior remain unsupported. The remaining text-box size and font crop
differences in these fixtures are shared text-layout work, not arrow behavior.

## Reference Tools And SVG Structure

The local tools used were:

- tikztosvg: `/Library/TeX/texbin/tikztosvg`;
- MacTeX: `/Library/TeX/texbin/pdflatex`;
- SVG-to-PNG: `/opt/homebrew/bin/rsvg-convert`.

The inspected tikztosvg flowchart SVG has viewBox `0 0 275.622 93.382` and
emits shafts and tips as separate ordinary `<path>` elements. Its `latex'`
tip has a nonzero fill and no stroke. Its `stealth'` tip has fill plus stroke,
`stroke-width=1.99255`, butt caps, and round joins. Reversed tips use reflected
path data combined with tangent transforms; no SVG marker element substitutes
for the PGF geometry.

TikZKit now emits distinct `tikz-arrow-latex-prime`,
`tikz-arrow-latex-prime-reversed`, `tikz-arrow-stealth-prime`, and
`tikz-arrow-stealth-prime-reversed` path classes. The renderer applies the
same fill/stroke and cap/join split as PGF. It also records a curve's first
control-point tangent separately from its end tangent, fixing curved start
tips that previously pointed along the wrong direction.

## Visual Result

Before this change, reversed prime tips collapsed onto forward geometry in the
flowchart. In the mathematical driver the red inverse map pointed the wrong
way, and the purple and orange vertical arrows disagreed with native output.
The physics driver's curved start tip was initially hooked because it reused
the curve's end tangent.

After the change, inspection of all three native four-way sheets confirms:

- the flowchart has the same four tip silhouettes, directions, colors, line
  widths, and shaft contact points as MacTeX and tikztosvg;
- the inverse map and both vertical mathematical arrows point in the native
  directions, while the two-ended path has independent start/end shapes;
- the force vectors and curved momentum path use their local terminal tangents,
  with the curved start tip no longer distorted;
- all layers are present and all three TikZKit renders have zero diagnostics.

The remaining visible differences are text metrics, node-box height, and crop
margins. As secondary measurements, TikZKit versus tikztosvg mean absolute
RGBA differences are approximately 0.03062, 0.03038, and 0.03212 for the
flowchart, mathematics, and physics drivers. Acceptance is based on the visible
arrow geometry and terminal behavior, not these aggregate values.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-arrows-legacy-prime-before/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-arrows-legacy-prime-after/`

The after directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
1cm grid variants, diff images, and native four-way sheets for all three
drivers. Generated artifacts are intentionally ignored by Git.

## Verification

```bash
node --test test/arrows-legacy-prime.test.js test/arrows-spaced-common.test.js

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-05-arrows-legacy-prime-after \
  --only arrows-legacy-prime-flowchart,arrows-legacy-prime-math,arrows-legacy-prime-physics \
  --continue-on-external-failure --strict-tikztosvg \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-05-arrows-legacy-prime-after

npm run extension-registry
```

The eight focused legacy/spaced-arrow tests pass. All three visual drivers
render through TikZKit, tikztosvg, and MacTeX with zero TikZKit diagnostics and
zero external-render failures. Under the same local full-suite conditions, the
committed baseline reports 2,314 tests with 2,165 passing, 135 failing, and 14
skipped. This slice plus the public-link regression test reports 2,320 tests
with 2,174 passing, 132 failing, and 14 skipped. All six added tests pass and
the existing failure count decreases by three.

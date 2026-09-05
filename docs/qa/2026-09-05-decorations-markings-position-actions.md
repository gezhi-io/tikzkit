# Decorations Markings Position And Arrow Actions QA (2026-09-05)

## Scope

This slice implements path-position semantics and arrow actions for
`decorations.markings`. The acceptance boundary is:

- unitless fractional positions, including negative values measured from the
  path end;
- positive and negative absolute dimension positions;
- `between positions ... and ... step ...` with fractional or dimensioned
  steps;
- repeated `mark` declarations in source order;
- `\arrow` and `\arrowreversed`, including their local color, line-width, and
  arrow-tip options;
- direct `decorate` and `postaction={decorate}` activation.

It does not claim arbitrary marking code. Mark nodes, `mark connection node`,
mark-information keys, and non-arrow marking actions remain unsupported.

The permanent drivers cover three distinct path shapes and use cases:

- `decorations-markings-position-actions-flowchart`: absolute dispatch points
  and a reversed return-path arrow;
- `decorations-markings-position-actions-math`: dimension-stepped tangent
  arrows on a cubic curve and a negative end-relative marker;
- `decorations-markings-position-actions-physics`: repeated direction arrows
  on a closed circular path.

## Local MacTeX Review

Reviewed these local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.markings.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.markings.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, especially the marking-position and arrow-action sections around lines 700-975.

The PGF implementation distinguishes a scalar position from a TeX dimension.
A positive scalar multiplies the decorated path length; a negative scalar is
added to one path length after multiplication. Positive dimensions are absolute
distances from the start, while negative dimensions are added to the path
length. Between-position marks recursively add the parsed step and do nothing
when the end precedes the start. The TikZ frontend defines `\arrow` and
`\arrowreversed` with optional local scope options; reversal is a local x-axis
reflection rather than a 180-degree change to the path tangent.

## Implemented Syntax

| Syntax | Parameters verified |
| --- | --- |
| `mark=at position P with {A}` | `P=.5`, `P=-.25`, `P=10mm`, `P=-5mm`, and a dimension stored in a TeX variable |
| `mark=between positions A and B step S with {A}` | fractional endpoints, negative end-relative endpoints, and absolute dimension steps |
| `\arrow[options]{tip}` | `Stealth`, `Stealth[length=4pt]`, `Latex`, `>`, color, and line width |
| `\arrowreversed[options]{tip}` | shared arrow geometry followed by the native local x reflection |
| decoration activation | direct `decorate` and `postaction={decorate}`; no execution when activation is absent |

Still unsupported in this library slice:

- arbitrary TeX commands inside a marking action;
- node creation and `mark connection node`;
- `\pgfkeysvalueof{/pgf/decoration/mark info/...}` and mark-info sequence keys;
- arbitrary transform or style callbacks whose meaning cannot be reduced to
  the shared arrow renderer.

## Reference Tools And SVG Structure

The local tools used were:

- tikztosvg: `/Library/TeX/texbin/tikztosvg`;
- MacTeX: `/Library/TeX/texbin/pdflatex`;
- SVG-to-PNG: `/opt/homebrew/bin/rsvg-convert`.

The inspected tikztosvg SVGs emit arrow tips as ordinary inline path data, not
SVG marker elements. Their Stealth and Latex paths use nonzero fill, butt caps,
miter joins, and affine matrices that combine translation, tangent rotation,
and the page-level y-axis inversion. Reversed arrows contain a negative local
axis in that matrix. Their view boxes are `0 0 276.066 53.958`,
`0 0 173.272 77.354`, and `0 0 129.832 128.265` for flowchart, mathematics,
and physics respectively.

TikZKit now lowers marking arrows through the same arrow-tip geometry used by
ordinary path endpoints. The SVG contains typed `tikz-arrow-tip` paths with
explicit `stroke-linecap`, `stroke-linejoin`, and
`translate(...) rotate(...)`; `\arrowreversed` adds `scale(-1 1)`. The
interpreter computes the marker point and tangent before rendering, so curved
paths retain the correct local direction.

## Visual Result

Before the change, the flowchart had no three internal dispatch/return arrows,
the mathematical curve only showed its two axis-end arrows, and the magnetic
field circle had no direction markers. Path strokes, labels, and backgrounds
were present, making the missing semantic layer clearly visible even though it
covered relatively few pixels.

After the change, the inspected native four-way sheets show:

- all three flowchart markers at the same absolute positions, with matching
  blue/orange paint and return direction;
- five blue Stealth tangent tips and one red reversed Latex tip on the cubic
  mathematical path, matching the reference locations and tangent angles;
- nine evenly stepped green Stealth tips plus one negative end-relative red
  reversed Latex tip on the circular physics path;
- no new diagnostics in any of the three drivers.

The remaining visible differences are small text rasterization and tight-crop
edges. The registered TikZKit-versus-tikztosvg mean absolute RGBA values are
approximately 0.02250, 0.01433, and 0.00218. These numbers are supplementary;
acceptance was based on inspecting missing elements, position, tangent,
direction, color, line width, and layer order.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-decorations-markings-before/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-decorations-markings-after/`

Each directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, 1cm
grid variants, registered diffs, and native four-way sheets for all three
drivers. These generated artifacts are intentionally ignored by Git; see
[Generated Artifacts](../generated-artifacts.md) for the repository policy.

## Verification

```bash
node --test test/decorations-markings.test.js
node --test --test-name-pattern='marking' test/interpreter.test.js test/real-cases.test.js
node --test test/geometry.test.js test/options.test.js

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-05-decorations-markings-after \
  --only decorations-markings-position-actions-flowchart \
  --only decorations-markings-position-actions-math \
  --only decorations-markings-position-actions-physics \
  --continue-on-external-failure --strict-tikztosvg \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-05-decorations-markings-after --register

npm run extension-registry
npm run docs:links
```

The six dedicated regression tests pass. The three visual drivers render in
all three engines with zero TikZKit diagnostics and zero external-render
failures. The older repeated-marking real-case test retains a pre-existing,
unrelated gray rounding assertion (`rgb(192)` expected versus `rgb(191)`
rendered); the same failure is present on the committed pre-change baseline.
Under the same local full-suite conditions, the committed baseline reports
2,308 tests with 2,159 passing, 135 failing, and 14 skipped. This slice reports
2,314 tests with 2,165 passing, 135 failing, and 14 skipped: all six added tests
pass and the existing failure count does not increase.

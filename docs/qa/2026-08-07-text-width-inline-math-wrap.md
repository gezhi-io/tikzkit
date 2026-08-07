# `text width` Mixed Inline-Math Wrap

## Scope

This QA slice changes one shared capability only: SVG-text paragraph wrapping
for a TikZ node with `text width` whose prose contains inline formulas. Its
real visual driver is
`test/fixtures/implementation-examples/real-world/parallel-line-angles.tikz`
(`Parallel lines angle relationships`). It does not change coordinate
evaluation, angle geometry, node placement, colors, or browser math CSS.

## Local MacTeX Reading

Reviewed the local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`:
  `text width` stores the requested width in `\\tikz@text@width`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex`:
  the node text box uses the fixed width before paragraph line breaking; its
  default is left/ragged-right unless `align` changes that behavior.

The implementation therefore measures a formula as an indivisible TeX-sized
word group before deciding whether a following prose word belongs on the same
line. It does not imitate paragraph breaking by treating fallback Unicode
math glyphs as ordinary text.

## Implementation

`src/renderers/svg/textLayout.js` now uses `estimateFormulaBox()` for each
inline math token and combines that width with the surrounding Main-Regular
text metrics. A small documented font-paint safety allowance accounts for the
browser's physical CMU glyph paint after TeX metric measurement. The same
measurement is used by ordinary and flush wrapping paths.

The targeted regression is in `test/renderer.test.js`. It asserts these three
lines for the real paragraph at `text width=6cm`:

```text
When we assume that AB and CD
are parallel, i.e., AB || CD, then alpha = gamma
and beta = delta.
```

The code uses rendered mathematical symbols; the ASCII transcription above is
only intended to make the expected word grouping easy to inspect.

## Commands And Parameters Exercised

The driver exercises `\\usetikzlibrary{angles,calc,quotes}`, `\\coordinate`,
`\\path`, `edge`, `pic`, `\\node`, named anchors, calc interpolation,
`text width=6cm`, `right=1cm`, `rounded corners`, `fill=red!20`, and
`inner sep=1ex`. The repaired text includes `\\color`, `\\mathbin`, Greek
letters, relations, punctuation, and inline formulas. Angle construction,
line routing, and color mixing were already supported and are not part of this
change.

Still incomplete for this slice: TeX hyphenation, glue/penalty justification,
full `minipage` paragraph composition, styled-font paragraph shaping, and
arbitrary macro-driven font changes.

## Three-Way Visual QA

Artifacts were generated in the ignored directory
`outputs/qa-text-width-inline-math-wrap-2026-08-07/after/`:

- MacTeX native PNG: `mactex-png/real-world-parallel-line-angles.png`
- TikZKit SVG/PNG: `tikzkit-svg/real-world-parallel-line-angles.svg` and
  `tikzkit-png/real-world-parallel-line-angles.png`
- local tikztosvg SVG/PNG:
  `tikztosvg-svg/real-world-parallel-line-angles.svg` and
  `tikztosvg-png/real-world-parallel-line-angles.png`
- comparison sheet and diff: `index.html` and `diff/`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its PNG was made
with `/opt/homebrew/bin/rsvg-convert`. Its SVG uses transformed SVG paths and
a tight `viewBox`, not an HTML `foreignObject`; it served as a line-break and
geometry reference alongside MacTeX.

Before the fix, TikZKit ended the second paragraph line with `then` and put
the compact `alpha = gamma` relation at the beginning of a third line. After
the fix, TikZKit, tikztosvg, and MacTeX all place `then alpha = gamma` on line
two, with the final `and beta = delta.` on line three. The red text box,
parallel lines, angle fills, anchors, and diagram positions remain unchanged.
The direct PNGs and gridded comparison sheet were inspected; pixel statistics
were used only as a secondary check.

## Verification

Passed focused regression:

```bash
node --test --test-name-pattern='keeps compact inline math on the TeX-sized svg-text paragraph line' test/renderer.test.js
```

The maintained renderer suite contains pre-existing failures outside this
slice, so broad-suite status was not used as acceptance evidence. The focused
test, diagnostics, and the inspected three-way visual result are the
acceptance gate for this narrowly bounded change.

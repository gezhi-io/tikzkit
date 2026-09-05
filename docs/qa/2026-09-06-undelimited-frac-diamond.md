# Undelimited Fraction Arguments And Diamond Text Boxes

## Scope

This round covers one shared TeX-math slice: `\\frac`, `\\dfrac`, and
`\\tfrac` accept either a brace group or one undelimited TeX token for each
argument. The real visual driver is `shapes-diamond-split-physics`, whose
`$E_k=\\frac12mv^2$` label previously leaked `frac12` as ordinary text and
made the diamond and all connected arrows much too large.

The boundary is ordinary atom/script sequences around text-style fractions.
It does not claim a complete TeX expansion engine, arbitrary nested math
environments, or exact metrics for every font and display-style construct.

## Local TeX Reading

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx` around
line 15742 and
`/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty` around line
233. Both define `\\frac` with two ordinary TeX arguments. TeX therefore
accepts `\\frac12`, `\\frac\\pi2`, and grouped forms without requiring braces
around every single-token argument.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
from line 311. The diamond split algorithm measures the upper and lower TeX
boxes independently, takes their maximum width and total height, and combines
those values with the aspect ratio and minimum dimensions. A wrong formula
box therefore changes the node border and every edge clipped to that border.

A local MacTeX measurement probe reported an upper formula box of
`50.49373pt x (8.44843pt + 3.44841pt)` and a lower box width of `45.00769pt`.
Those values drive the portable SVG-text fraction metrics rather than a
case-specific diamond coordinate.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. MacTeX used
`/Library/TeX/texbin/pdflatex`, and SVG rasterization used
`/opt/homebrew/bin/rsvg-convert`. The four-case artifact set is stored in:

- `outputs/qa/2026-09-06-undelimited-frac-diamond-after/`
- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-svg/` and `tikztosvg-png/`
- `mactex-png/`
- `diff/*-native-sheet.png`

The preserved pre-fix energy-state artifact is in the `before/` subdirectory.
Before the fix it measured 463x224 px, exposed `frac12`, and pushed the blue,
orange, and red arrows away from the center. After the fix the numerator,
fraction rule, denominator, subscript, and superscript are all visible; the
result is 419x173 px against MacTeX's 421x175 px. The diamond border, split
rule, arrow endpoints, and annotation positions now agree visually.

The tikztosvg SVG uses glyph outlines through `<path>` definitions and `<use>`
instances, a transformed polygon path, butt line caps/joins, and a 0.398pt
fraction rule. TikZKit keeps semantic `<text>/<tspan>` content and emits a
separate line inside `tikz-inline-fraction`; its viewBox is expressed in the
engine's scaled scene coordinates. Both now produce the same formula
structure and nearly the same painted bounds, while MacTeX remains the native
authority.

The combination cases `calc-multi-term-coordinate-sums`,
`shapes-diamond-split-flowchart`, and `shapes-diamond-split-math` retain their
geometry and diagnostics. The calc case also improves visibly because its
single-token `1/2` expression is now a stacked fraction instead of leaked raw
command text.

## Implementation And Verification

- `src/tikz/text.js` reads grouped, control-sequence, and single-token
  undelimited arguments and normalizes them recursively.
- `src/tikz/textMetrics.js` measures mixed ordinary atoms, scripts, and
  fractions using local Computer Modern advances and the measured TeX
  fraction height/depth.
- Focused tests cover numeric, control-sequence, grouped, spaced `tfrac`, and
  a real multipart-node composition.
- All four TikZKit, tikztosvg, and MacTeX renders completed with zero
  diagnostics and zero external-render failures.

The full suite reports 2,490 tests: 2,335 passing, 141 failing, and 14 skipped
in the restricted workspace. Five failures are workbench server tests caused
by `listen EPERM` while binding local test ports; excluding those
environment-only failures leaves the unchanged 136 known project failures
and 2,340 passing tests. Remaining visual differences are small glyph-outline
and line-antialiasing details, plus the intentional semantic-text versus
glyph-path SVG representation.

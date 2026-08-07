# Matrix Scoped-Line Baselines QA

## Scope

This accepted slice covers one shared text-layout behavior only: a multi-line
TikZ node whose later line changes to `\\small`, `\\scriptsize`, or an explicit
`\\fontsize{...}{...}\\selectfont`. It does not change matrix placement,
ellipse geometry, arrows, or paragraph line breaking.

The real visual driver is
`test/fixtures/examples/latex-examples/haskell-type-classes.tex`. Its `Enum`
matrix cell has a normal bold title followed by a wrapped `\\small` paragraph.

## Local MacTeX Reading

Reviewed locally on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarymatrix.code.tex`:
  matrix cells are ordinary TikZ nodes, so their text uses the normal node
  text-box machinery.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/size10.clo`:
  `\\normalsize` is 10pt with a 12pt baseline skip, while `\\small` is 9pt
  with an 11pt baseline skip.

The native PDF's `Enum` word boxes corroborate the rule: the wrapped small
lines begin at y=134.759318, 146.714318, and 158.669318pt, approximately one
11.955pt baseline interval apart after font glyph ascent is accounted for.

## Implementation

`src/tikz/text.js` carries a local line's physical `fontSizePt` and
`baselineSkipPt` into normalized line styles. `src/renderers/svg/textLayout.js`
and `src/renderers/svg/plainTextNode.js` use those values when at least one
line has a local size command: the break after a normal `Enum` title uses the
preceding 12pt baseline, while subsequent `\\small` lines use 11pt. Existing
plain and legacy mixed-size fallback behavior remains unchanged.

Regression coverage:

- `test/text-package-macros.test.js` asserts that `\\small` retains 9pt/11pt.
- `test/svg-renderer.test.js` asserts normal-to-small and small-to-small SVG
  `tspan dy` values.

## Commands And Parameters Exercised

The driver exercises `\\usetikzlibrary{shapes}`, `\\matrix`, `row sep=0.5cm`,
`column sep=0.5cm`, ellipse nodes, `text width=3cm`, `align=center`,
`inner sep=0pt`, `\\textbf`, `\\small`, multiline text, node names, and
ultra-thick directed edges. This change implements only the local
font-size/baseline part of that input.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its PNG was made by
the local `rsvg-convert`. The inspected after bundle is:

`outputs/qa-matrix-haskell-scoped-baseline-2026-08-07/`

It contains:

- TikZKit SVG/PNG: `tikzkit-svg/latex-examples-haskell-type-classes.svg` and
  `tikzkit-png/latex-examples-haskell-type-classes.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/latex-examples-haskell-type-classes.svg`
  and `tikztosvg-png/latex-examples-haskell-type-classes.png`;
- MacTeX PNG: `mactex-png/latex-examples-haskell-type-classes.png`;
- four-panel visual sheet:
  `diff/latex-examples-haskell-type-classes-native-sheet.png`.

The tikztosvg SVG uses its own transformed geometry and TeX glyph output;
TikZKit emits browser SVG text with `tspan` line offsets. The native PNG is
therefore the final visual oracle. All three panels were inspected, including
the focused `Enum` crops in `diff/enum-tikzkit-crop.png` and
`diff/enum-mactex-crop.png`.

Before the fix, the normal-to-small title break was compressed to about 8.17pt
and the three small lines were packed at about 10.8pt. After the fix, the SVG
uses 12pt and 11pt respectively: the `Enum` title and its three wrapped lines
are visibly spaced like the native cell and no longer bunch in the upper half
of the ellipse. Registered TikZKit-to-MacTeX residual improved from 0.19419
changed pixels / 0.06643 mean absolute RGBA to 0.19334 / 0.06612. The numbers
are secondary evidence; the accepted improvement is the inspected text
spacing.

## Verification And Limits

Passed:

```bash
node --test test/text-package-macros.test.js test/svg-renderer.test.js
npm run examples:render -- --fixtures test/fixtures/examples \\
  --only latex-examples-haskell-type-classes \\
  --output outputs/qa-matrix-haskell-scoped-baseline-2026-08-07 \\
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-matrix-haskell-scoped-baseline-2026-08-07 \\
  --register --alignment-radius 3
```

The full SVG renderer suite currently contains an unrelated pre-existing
`basic arrow math label` width assertion (57.09pt versus a 57.49pt reference),
so the focused passed suites above are the acceptance gate for this slice.

Remaining work: exact TeX paragraph glue and hyphenation, full local
font-declaration scope behavior in every rich-text renderer, and matrix-wide
row/bounding-box calibration still remain partial.

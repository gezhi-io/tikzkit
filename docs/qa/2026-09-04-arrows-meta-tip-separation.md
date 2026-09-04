# `arrows.meta` Composite Tip Separation

## Scope

This round implements one bounded `arrows.meta` family: rigid built-in arrow
tip sequences with per-tip `sep`. It covers symbolic and named built-in tips,
bare/default `sep`, explicit positive and negative dimensions, line-width and
outer-width factors, terminal path shortening, and the reversed assembly order
at a path start. It does not claim arbitrary user-declared names inside a
sequence or curved `bend`/`flex` arrow deformation.

Three permanent examples exercise the feature in ordinary diagrams:

- `test/fixtures/examples/arrows/meta-separation-flowchart.tex`
- `test/fixtures/examples/arrows/meta-separation-math.tex`
- `test/fixtures/examples/arrows/meta-separation-physics.tex`

They cover single terminal padding, composite Stealth and Latex tips, two-ended
sequences, positive/default/negative separation, double lines, and the compact
`[sep]>>>` syntax.

## Local MacTeX Study

Read these installed TeX Live 2025 sources and documentation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`,
  especially the `sep` key around lines 494-498, line-width-dependent values
  around lines 587-610, and sequence shortening/drawing around lines 780-945.
  A separation belongs after its tip in the source sequence; negative values
  overlap tips. The final end tip's separation also opens a terminal gap. Start
  sequences are assembled in reverse order.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`,
  the Computer Modern Rightarrow, Latex, and Stealth declarations around lines
  663-1030. Sequence advance uses each tip's logical assembly length, not its
  painted SVG bounds. For the core `>` tip that length is
  `1.6pt + 2.2 * line width`; Latex and Stealth expose their resolved lengths.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`,
  “Specifying Paddings” around lines 1464-1525. Bare `sep` resolves to
  `0.88pt + 0.3 * effective line width`, with an outer factor of 1. For double
  lines, PGF computes the effective width from the full and inner widths before
  applying the factors.

TikZKit now stores a renderer-neutral arrow sequence in parsed path options,
resolves logical assembly metrics once, and shares those placements between
SVG drawing and bounds calculation. Marker definitions are intentionally not
created for a sequence because each tip is emitted as inline geometry.

## Three-Way Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`, and the native reference used local MacTeX.

Artifacts are in:

- `outputs/qa-arrows-meta-separation-2026-09-04/tikzkit-svg/`
- `outputs/qa-arrows-meta-separation-2026-09-04/tikztosvg-svg/`
- `outputs/qa-arrows-meta-separation-2026-09-04/{tikzkit,tikztosvg,mactex}-png/`
- `outputs/qa-arrows-meta-separation-2026-09-04/diff/`

I inspected all three native sheets. The flowchart has matching terminal gaps
and an orange two-Stealth retry arrow. The math panel correctly reverses its
two-tip start sequence and retains three tips on the curved relation. The
physics panel visibly distinguishes wider blue gaps, touching green default
gaps, and overlapping red tips. Tip counts, order, direction, colors, stroke
widths, caps, joins, and path layers agree with MacTeX and tikztosvg. Residual
differences are one- or two-pixel canvas framing, text rasterization, and thin
stroke antialiasing; no arrow geometry is missing.

The tikztosvg SVG uses inline transformed paths rather than SVG markers. Its
Stealth tips are filled/stroked miter paths, while `>` tips are round-cap and
round-join stroke paths. In the `[sep]>>>` row the three reference transforms
have equal intervals of about 4.96pt; TikZKit's equal intervals are about
4.98pt after unit conversion. That structure and spacing validate the shared
assembly model rather than a case-specific coordinate adjustment.

## Visible Improvement

Before this slice, a composite arrow specification was treated as one terminal
tip, so repeated heads and their configured gaps were absent. After the change,
all three diagrams preserve every requested tip and the positive, zero,
default, and negative separations visibly match the two local references.

Registered comparisons are supporting evidence only: the three TikZKit panels
are within one or two pixels of their reference dimensions, with mean absolute
RGBA residuals from about 0.010 to 0.020. Acceptance is based on the inspected
tip geometry and placement, not those aggregate values.

## Verification

```bash
node --test --test-name-pattern='arrows.meta tip sequences|arrows.meta sequence|final arrows.meta sep|inverts an arrows.meta start sequence|inline arrow tip|arrows.meta Latex|arrows.meta length|arrows.meta Stealth|scaled Latex edge tips' test/interpreter.test.js test/renderer.test.js
node scripts/render-example-fixtures.js \
  --output outputs/qa-arrows-meta-separation-2026-09-04 \
  --only arrows-meta-separation-flowchart,arrows-meta-separation-math,arrows-meta-separation-physics \
  --native-reference --strict-tikztosvg
node scripts/diff-example-pngs.js \
  --output outputs/qa-arrows-meta-separation-2026-09-04 --register
```

The focused suite passes 12/12. Rendering produces 3/3 TikZKit SVG/PNG,
tikztosvg SVG/PNG, and MacTeX PNG references with zero TikZKit diagnostics and
zero external-renderer failures. The full `npm test` run reports 1964 tests,
1825 passing, 125 failing, and 14 skipped. The two apparent baseline deltas
inspected (`circuitikz-varcap-diodes` manifest ownership and the Bellman-Ford
three-frame expectation) reproduce unchanged in an isolated snapshot of
commit `4b713836`; this slice adds four passing tests and no new failure.

## Remaining Boundary

Arbitrary user-declared names inside composite sequences, curved `bend`/`flex`
tips, repeated `reversed` cancellation, arbitrary setup-code keys, and
declaration-time TeX arithmetic remain partial. A useful next arrow slice is
source-driven `bend`/`flex` behavior on cubic and orthogonal paths.

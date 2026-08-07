# TikZ calc: multi-term coordinate sums and scalar factors

## Scope

This change implements one shared `calc` capability slice: a coordinate
calculation now accepts the local PGF grammar of an arbitrary signed series of
coordinates, each optionally preceded by a PGF math factor and followed by
its own modifier chain. The fixture is
`test/fixtures/examples/calc/multi-term-coordinate-sums.tex`. This is not a
claim of complete `calc` or complete TeX expansion.

## Local MacTeX source and manual review

Reviewed on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarycalc.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-coordinates.tex`

The manual's *The General Syntax* states that a calculation starts with an
optional factor and coordinate, then repeats `+` or `-` plus another optional
factor-coordinate term. *The Syntax of Factors* explains that a factor ends at
the next `*(` and is evaluated through `\pgfmathparse`. In the source,
`\tikz@parse@calculator` initializes `\pgf@xa`/`\pgf@ya`; `\tikz@cc@add` and
`\tikz@cc@sub` set the term sign; `\tikz@cc@parse@factor` evaluates the
factor; and `\tikz@cc@mid@checks` applies any `! ... !` modifier before the
point is added to the accumulators. TikZKit now mirrors that order rather than
splitting at only the first top-level sign.

## Real-source parameter audit

| Input | Result |
| --- | --- |
| `\usetikzlibrary{calc}` | built-in library module, locally source-reviewed |
| `$(A)+(B)+(C)$` | all three named-coordinate terms accumulate |
| `$2*(A)-.5*(B)+(C)$` | signed scalar factors accumulate |
| `cos(0)*sin(90)*(1,1)` | factor parser stops at the coordinate `*(` delimiter |
| `${1+1}*(.5,.5)` | braced PGF math factor works |
| `!t!(B)`, `!1cm!90:(B)`, `!(P)!(B)` | retained interpolation, distance/angle, and projection modifier chains |

Still partial: arbitrary TeX macro expansion inside factors, malformed or
ambiguous unbraced nested `*(` factors, and untested combinations with every
explicit PGF coordinate system.

## tikztosvg reference and artifacts

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`; PNG
conversion used `/opt/homebrew/bin/rsvg-convert`.

The `tikztosvg` SVG has a `205.49pt x 92.53pt` viewBox. It paints grid lines
in an inverted-y transform, uses filled circle paths for the points, and emits
Computer Modern glyph references through `<use>` elements; it has no
`foreignObject`. TikZKit uses browser `<text>` and its own calculated viewBox,
but its red, blue, and green point centers now land on the same grid
intersections as both external references.

- before: `/private/tmp/tikzkit-qa-calc-multiterm-before-2026-08-07/`
- after: `/private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07/`
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07/tikzkit-svg/calc-multi-term-coordinate-sums.svg` and `/private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07/tikzkit-png/calc-multi-term-coordinate-sums.png`
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07/tikztosvg-svg/calc-multi-term-coordinate-sums.svg` and `/private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07/tikztosvg-png/calc-multi-term-coordinate-sums.png`
- MacTeX PNG: `/private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07/mactex-png/calc-multi-term-coordinate-sums.png`
- inspected sheet: `/private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07/diff/calc-multi-term-coordinate-sums-native-sheet.png`

## Visual result

Before the fix, `$(A)+(B)+(C)$` stopped after `A`; the second `+` was folded
into an unknown coordinate name (`B)+(C`). The red point and its label were
therefore near the base points instead of the top grid intersection. The blue
weighted point likewise missed its expected right-side location, and the green
difference did not return to the origin. The JS panel had three unknown
coordinate diagnostics.

After the fix, the red point is at `(2,2)`, the blue point at `(3,0.5)`, and
the green point at `(0,0)`. Inspection of the MacTeX, tikztosvg, TikZKit, and
diff panels shows the three colored points on matching grid intersections. The
remaining diff comes from browser/native text rasterization and TikZKit's
slightly larger text-driven SVG bounds, not a missing or shifted computed
point. The registered JS-to-MacTeX mean absolute RGBA value is `0.01055`; it
is supporting data rather than the acceptance criterion.

## Verification

Passed:

```bash
node --test --test-name-pattern='calc expressions|signed calc coordinate|calc scalar multiplication' \
  test/interpreter.test.js test/coordinates-section13.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only calc-multi-term-coordinate-sums \
  --output /private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-calc-multiterm-after-2026-08-07 \
  --register --alignment-radius 3
npm run gallery:audit -- --only calc-multi-term-coordinate-sums
```

The focused regressions passed, all three references were generated, and the
gallery semantic gate reports `331/331 rendered, 0 diagnostics`.

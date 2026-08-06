# PGF Zigzag State Machine QA (2026-08-07)

## Scope

This correction is deliberately limited to the `zigzag` path-morphing
decoration. It covers the PGF state sequence on one complete input subpath:
`up from center`, alternating `big down` / `big up`, then `center finish` and
the final endpoint. It includes `pre length`, `segment length`, `amplitude`,
`post length`, a terminal `-stealth` tip, and phase continuity across a
linear polyline. It does not claim exact normal interpolation at sharp bends
or arbitrary curved-path flattening.

Driver: `test/fixtures/examples/decorations/zigzag-native-state.tex`.

```tex
\draw[-stealth, very thick, red, decorate,
  decoration={zigzag,pre length=2mm,segment length=8mm,
    amplitude=1.5mm,post length=3mm}]
  (0,0) -- (2.15,0) -- (2.15,1.25) -- (5.5,1.25);
```

## Local MacTeX Review

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`, lines 29-54.
The local `\pgfdeclaredecoration{zigzag}` declaration gives every active
state width `0.5 * \pgfdecorationsegmentlength`, draws its peak at local
`0.25 * segment length`, and switches to `center finish` when fewer than half
a segment remains. `center finish` returns to the state origin before
`final` joins `\pgfpointdecoratedpathlast`.

That means a repeated `L/2` vertex loop is not equivalent: it starts at the
wrong phase, never performs the native center finish, and restarts after each
source line. The implementation now carries the state over the flattened
complete subpath.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; the native reference used local MacTeX
`pdflatex`.

Ignored reproducible artifacts:

- `/private/tmp/tikzkit-qa-zigzag-before-2026-08-07-v2/`
- `/private/tmp/tikzkit-qa-zigzag-after-2026-08-07/`

Each directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, grid
variants, a diff, and a four-panel sheet. The tikztosvg SVG has viewBox
`0 0 157.1 45.13`; the red decoration is one transformed `<path>` whose data
places peaks at one-quarter segment offsets and has `stroke-linecap="butt"`,
`stroke-linejoin="miter"`. Its stealth tip is a separate filled path, not an
SVG marker. TikZKit likewise keeps the tip separate from the decorated stroke.

## Visual Review

Viewed the before and after native sheets, the TikZKit/tikztosvg grid panels,
the MacTeX PNG, and the diff panels. Before the correction, TikZKit's zigzag
changed phase at the `x=2.15` corner: it used a half-segment repetition per
source command, causing the first vertical zig to occur at the restart phase
and shifting every following horizontal peak. MacTeX and tikztosvg instead
continue the state sequence across that corner.

After the correction, the red line reaches the corner at the same partial
state as MacTeX, the first vertical peak appears at the continued `0.05cm`
offset, and the upper horizontal run has matching peak/trough order and final
straight lead before the arrow. TikZKit versus MacTeX changed-pixel ratio fell
from `10.16%` to `1.49%`; this number is supporting evidence only. The
remaining visible difference is raster antialiasing. tikztosvg is slightly
wider due to its own 157.1pt canvas/3px registration offset, but its path
geometry agrees with native MacTeX.

## Commands And Options Audited

- `\usetikzlibrary{arrows,decorations.pathmorphing}`
- `\draw`, `decorate`, `decoration={...}`, `-stealth`, `very thick`, `red`
- `zigzag`, `pre length=2mm`, `segment length=8mm`,
  `amplitude=1.5mm`, `post length=3mm`
- Numeric coordinates `0`, `2.15`, `1.25`, and `5.5`

## Change And Verification

- `src/engine/evaluate.js`: runs zigzag across the complete subpath and emits
  the local PGF quarter-apex/half-state/center-finish sequence.
- `test/zigzag-decoration.test.js`: protects apex placement, center finish,
  and phase continuity at a non-aligned polyline corner.
- `test/interpreter.test.js`: updates the existing zigzag expectation from the
  old half-segment approximation to the native quarter-segment apex.
- `src/tikz/libraries/decorations.pathmorphing.js`: records the implemented
  subset for the generated extension registry.

```bash
node --test test/zigzag-decoration.test.js
node --test --test-name-pattern='zigzag' test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-zigzag-after-2026-08-07 \
  --only decorations-zigzag-native-state --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-zigzag-after-2026-08-07 \
  --register --alignment-radius 3
```

The focused regression tests pass, diagnostics did not increase, and the
real case has a visible geometry correction. Remaining work is sharp-corner
normal handling, exact curve flattening, and other path-morphing decorations.

The semantic audit at
`/private/tmp/tikzkit-qa-zigzag-after-2026-08-07/case-audit-accepted.md` was
also accepted in strict mode: 1 package, 2 libraries, 6 commands, 12 option
keys, and 14 numeric groups each have source-review and test/artifact
evidence.

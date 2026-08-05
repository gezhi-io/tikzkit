# Positioning `on grid` Centre Placement QA

## Scope

This slice implements only the `positioning` library's `on grid` behavior for
modern `above/below/left/right=... of ...` keys. The normal border-to-border
placement rule, legacy `right of` syntax, and `base`/`mid` anchor variants are
outside this change.

The driver is the documented PGF example at
`test/fixtures/examples/positioning/on-grid-center-placement.tex`.

## Local Source Review

Reviewed local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex`

The library maps ordinary `above=... of <node>` to the referenced node's
`north` anchor and the new node's `south` anchor, so the specified shift is a
border gap. The `on grid` key sets its ignore-size flag: the reference becomes
`center` and the new node anchor becomes `center`, so the specified shift is a
center-to-center distance. A single diagonal distance is still scaled by
`0.707106781`; this slice does not alter that established behavior.

## Reference Artifacts

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
used `/opt/homebrew/bin/rsvg-convert`.

All artifacts are intentionally ignored under:

`outputs/qa-positioning-on-grid-2026-08-06/`

- MacTeX native PNG: `mactex-png/positioning-on-grid-center-placement.png`
- TikZKit JS SVG/PNG: `tikzkit-svg/positioning-on-grid-center-placement.svg`,
  `tikzkit-png/positioning-on-grid-center-placement.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/positioning-on-grid-center-placement.svg`,
  `tikztosvg-png/positioning-on-grid-center-placement.png`
- Three-way and diff sheets: `diff/positioning-on-grid-center-placement-sheet.png`
  and `diff/positioning-on-grid-center-placement-native-sheet.png`

The tikztosvg SVG has a `105.29pt x 100.42pt` viewBox, uses an inverted
`matrix(1,0,0,-1,...)` transform for the drawing plane, and emits node frames
as stroked paths. The two `on grid` node-frame centers lie on the same 1cm grid
sequence as their references; text is outline glyph paths rather than SVG
`<text>` nodes. TikZKit retains browser SVG text, so antialiasing and glyph
pixels remain a separate residual.

## Visual Result

Before the fix, the right-hand `gridded` chain used node border dimensions and
placed `b2` 1.568341497211cm above `a2`, visibly off the horizontal grid. The
reference puts each gridded node exactly 1cm above its predecessor.

After the fix, `b2 - a2` and `c2 - b2` are exactly 1cm in TikZKit's scene
coordinates, matching the reference grid geometry. The visible change is that
the right chain now aligns with its 1cm horizontal grid lines; the left
non-gridded chain intentionally retains border-to-border spacing.

The registered TikZKit/tikztosvg diff improved from 2,718 changed pixels
(14.60%, mean absolute RGBA 0.03154) to 2,433 pixels (13.07%, 0.02645).
Those numbers are supporting evidence only; the accepted change is the
elimination of the visibly misplaced gridded node centres.

## Tests

```bash
node --test --test-name-pattern='uses positioning on grid' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-positioning-on-grid-2026-08-06 \
  --only positioning-on-grid-center-placement \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-positioning-on-grid-2026-08-06 \
  --register --alignment-radius 3
```

The focused regression and all three renderers pass without diagnostics.
The broader repository suite retains pre-existing unrelated failures; it is
not used as evidence for this focused positioning slice.

## Remaining Work

`base left/right` and `mid left/right` need baseline-aware text-box anchor
metrics before they can match PGF. Scoped `on grid` beyond inherited
picture/node options, rotated-node border intersections, and arbitrary shape
border anchors remain separate positioning work.

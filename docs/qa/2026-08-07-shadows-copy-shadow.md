# `shadows` Copy Shadow Visual QA (2026-08-07)

## Scope

This slice implements the documented `copy shadow` preaction for ordinary
paths and nodes. It is deliberately limited to one copy; `double copy shadow`,
special shading preservation, marker tips, and arbitrary hook code remain
outside this acceptance boundary.

The visual driver is `test/fixtures/examples/shadows/copy-shadow-path.tex`
(Case 309):

```tex
\draw[help lines] (-.25,-.25) grid (2.75,1.75);
\filldraw[copy shadow={opacity=.5},fill=blue!20,draw=blue,thick]
  (0,0) rectangle (2,1);
```

Implemented commands and parameter semantics:

- `\usetikzlibrary{shadows}`, `\draw`, `\filldraw`, `grid`, and `rectangle`;
- `copy shadow` and `copy shadow={opacity=.5}`;
- `fill=blue!20`, `draw=blue`, and `thick` copied into the preaction;
- source defaults `shadow scale=1`, `shadow xshift=.5ex`,
  `shadow yshift=.5ex`, and `every shadow`;
- ordinary node copy shadows through the same resolved fill/draw style.

## Local MacTeX Study

Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshadows.code.tex`, lines 102-116, and
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shadows.tex`, lines 149-217.

The source captures `\tikz@fillcolor` and `\tikz@strokecolor` before creating
the general-shadow preaction. It then applies scale one, positive `.5ex`
x/y shifts, copied fill/draw colors, `every shadow`, and caller options in that
order. The current manual's code block says a negative y shift, but the local
TeX Live implementation uses positive `.5ex`; this slice follows the macro
that produces the native result.

## Three-Way References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` is
`/opt/homebrew/bin/rsvg-convert`. Inspected artifacts:

- MacTeX PNG: `/private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07/mactex-png/shadows-copy-shadow-path.png`;
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07/tikzkit-svg/shadows-copy-shadow-path.svg` and `/private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07/tikzkit-png/shadows-copy-shadow-path.png`;
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07/tikztosvg-svg/shadows-copy-shadow-path.svg` and `/private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07/tikztosvg-png/shadows-copy-shadow-path.png`;
- native sheet and registered diff: `/private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07/diff/shadows-copy-shadow-path-native-sheet.png` and `/private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07/diff-png/shadows-copy-shadow-path-registered.png`.

The TikZKit SVG has the copied rectangle as a `tikz-path-shadow` group before
the main rectangle. Both use blue stroke and `rgb(204 204 255)` fill, while the
preaction carries `opacity=.5` and the `.5ex/.5ex` transform. tikztosvg bakes
the offset into path coordinates rather than using a transform group; both
structures preserve the same two painted rectangles.

## Visual Result

Before this change `copy shadow` was ignored, so only one blue rectangle was
visible. After it, the JS panel visibly has a second, half-opaque blue copy
behind and above-right of the foreground rectangle, matching the positive
y-shift used by local PGF. The same colour and outline are inherited rather
than replaced by the grey `drop shadow` paint.

TikZKit versus MacTeX has 3.96% changed pixels and mean absolute RGBA 0.00703;
TikZKit versus tikztosvg has 9.12% changed pixels and 0.01002 after 3px
registration. These numbers only support the visual conclusion: the formerly
missing copied geometry, fill, stroke, offset, opacity, and order now match.

## Verification

```bash
node --test --test-name-pattern='copy shadows|drop-shadow defaults|every shadow|general shadows as path preactions' \
  test/interpreter.test.js test/petarv-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07 \
  --only shadows-copy-shadow-path --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-shadows-copy-path-after-2026-08-07 \
  --register --alignment-radius 3
```

Seven focused shadow tests pass, and all three renderers completed the driver
with zero TikZKit diagnostics.

## Remaining Work

`double copy shadow` has a separate second preaction whose post-expansion
shifts are exactly doubled; it is not implemented here. Source paths with
shadings/patterns or marker tips also remain deliberately outside this
copy-shadow slice.

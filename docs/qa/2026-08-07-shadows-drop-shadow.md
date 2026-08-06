# `shadows` Drop Shadow Visual QA (2026-08-07)

## Scope

This slice adds the documented `drop shadow` defaults to the existing general
shadow preaction. It covers the ordinary path and node forms, caller overrides,
and a simple `every shadow/.style` hook. It is intentionally not a claim for
blur/fading/copy shadows, arbitrary executable hooks, or shadows on marker
tips and form-only patterns.

The real regression driver is
`test/fixtures/examples/shadows/drop-shadow-opacity.tex` (Case 307), derived
from the PGF manual's opacity example:

```tex
\draw[help lines] (0,0) grid (3,2);
\filldraw[drop shadow={opacity=1},fill=white]
  (1,2) circle (.5) (1.5,2) circle (.5);
\filldraw[drop shadow={opacity=.25},fill=white]
  (1,.5) circle (.5) (1.5,.5) circle (.5);
```

Implemented commands and options for this slice:

- `\usetikzlibrary{shadows}`, `\draw`, `\filldraw`, `circle`, and `grid`;
- `drop shadow` and `drop shadow={opacity=...}`;
- defaults `shadow scale=1`, `shadow xshift=.5ex`, `shadow yshift=-.5ex`,
  `opacity=.5`, and `fill=black!50`;
- simple `every shadow/.style={opacity=...,fill=...,shadow xshift=...}`;
- two `.5cm` circles in one `\filldraw`, painted as one compound shadow;
- `fill=white`, `black!50`, `opacity=1`, and `opacity=.25`.

## Local MacTeX Study

Read the local TeX Live 2025 implementation and manual:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshadows.code.tex`, lines 42-53;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shadows.tex`, lines 101-145.

The local `drop shadow` style is a `general shadow` with, in order, scale `1`,
shifts `.5ex` and `-.5ex`, opacity `.5`, and `black!50` fill. It then invokes
`every shadow` and finally expands the caller's `#1`, so caller keys win. The
implementation now retains this key order explicitly rather than relying on
JavaScript object overwrite order.

## Three-Way References

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
used `/opt/homebrew/bin/rsvg-convert`. The inspected artifacts are outside
Git:

- MacTeX PNG: `/private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07/mactex-png/shadows-drop-shadow-opacity.png`;
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07/tikzkit-svg/shadows-drop-shadow-opacity.svg` and `/private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07/tikzkit-png/shadows-drop-shadow-opacity.png`;
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07/tikztosvg-svg/shadows-drop-shadow-opacity.svg` and `/private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07/tikztosvg-png/shadows-drop-shadow-opacity.png`;
- comparison sheet and registered diff: `/private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07/diff/shadows-drop-shadow-opacity-native-sheet.png` and `/private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07/diff-png/shadows-drop-shadow-opacity-registered.png`.

The tikztosvg SVG has one grey compound fill path for each `\filldraw` pair:
each `d` attribute contains both closed circles, followed by a white compound
fill with black stroke. The lower grey compound path uses `fill-opacity=.25`.
TikZKit now has exactly one `tikz-path-shadow` group per pair; its SVG group
applies the `.5ex` x/y translation, while its path contains both circle
subpaths. This matches the native preaction layering instead of painting four
independent circle shadows.

## Visual Result

Before this slice, `drop shadow` was ignored: the JS panel contained only the
white pairs with black outlines. It also had no way to apply the documented
default offset or caller opacity.

After the change, the JS panel visibly has a grey lower-right shadow behind
each pair. The top pair is fully opaque because it overrides `opacity=1`; the
lower pair is visibly translucent at `.25`. The shadow is painted once for the
two-circle compound path, so the overlap is not artificially darkened. MacTeX
and tikztosvg show the same layer order, offset direction, compound geometry,
and opacity distinction.

The residual difference is raster calibration: TikZKit is 119x101px and
tikztosvg is 114x96px. With 3px registration the TikZKit/tikztosvg diff is
11.75% changed pixels and mean absolute RGBA 0.01320; TikZKit/MacTeX is
11.61% and 0.02343. These values are diagnostic only; the acceptance result is
the visible recovery of both missing preactions with the correct compound
layering and opacity override.

## Verification

```bash
node --test --test-name-pattern='drop-shadow defaults|every shadow|general shadows as path preactions|repeated general shadow styles' \
  test/interpreter.test.js test/petarv-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07 \
  --only shadows-drop-shadow-opacity --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-shadows-drop-opacity-after-2026-08-07 \
  --register --alignment-radius 3
npm run extension-registry
```

All five focused regressions pass. The rendered fixture has no TikZKit
diagnostics and successfully produced MacTeX PNG, TikZKit SVG/PNG, tikztosvg
SVG/PNG, registered diff, and native comparison sheet.

## Remaining Work

`every shadow/.style` supports ordinary style keys in this slice. Argumented,
code-backed, and scope-sensitive hook behavior remains partial. The next
shadow-specific slice should decide whether `blur shadow` gets SVG filter
support or whether arrow marker tips are included in the preaction.

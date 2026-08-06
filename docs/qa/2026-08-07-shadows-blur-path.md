# `shadows.blur` Path Filter Visual QA (2026-08-07)

## Scope

This slice makes the existing `shadows.blur` preaction render on ordinary
TikZ paths as well as nodes. It preserves the source option order, then uses
an SVG Gaussian filter as the browser approximation of the local package's
fading/multi-stroke shadow.

The real driver is `test/fixtures/examples/shadows/blur-shadow-path.tex`
(Case 308):

```tex
\filldraw[fill=yellow!20,draw=black,
  blur shadow={shadow blur radius=1mm,shadow blur steps=8}]
  (0,0) rectangle (2,1);
\filldraw[fill=blue!20,draw=black,
  blur shadow={shadow blur radius=1mm,shadow blur steps=8}]
  (0.35,1.5) circle (.45);
```

Implemented in this slice:

- `\usetikzlibrary{shadows.blur}`, `\filldraw`, `rectangle`, and `circle`;
- `blur shadow={...}`, `shadow blur radius=1mm`, and `shadow blur steps=8`;
- defaults `shadow scale=1`, `shadow xshift=.5ex`, `shadow yshift=-.5ex`,
  `shadow blur radius=.4ex`, and `shadow opacity=40`;
- simple `every shadow/.style` expansion before caller overrides;
- a filtered `tikz-path-shadow` preaction and the existing node equivalent.

`shadow blur steps` is recorded but cannot control an SVG Gaussian filter's
sampling. It remains intentionally approximate.

## Local MacTeX Study

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf-blur/tikzlibraryshadows.blur.code.tex`.
The library loads `shadows` and `calc`; lines 29-43 establish the radius,
step, opacity, and `blur shadow` defaults. Its `render blur shadow` code saves
the picture bounding box, builds a rounded/faded version of the full current
path, applies the shared scale/shift canvas transform, and restores the
bounding box afterwards. The fading code builds multiple strokes; it is not a
native SVG Gaussian blur.

TikZKit uses the same logical preaction sequence and options, but turns its
focused geometric result into a reusable `<filter><feGaussianBlur>` definition.
This gives browser SVG a soft edge while preserving the source's geometry and
the normal path's foreground paint.

## Three-Way References

Local tools:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`;
- PNG conversion: `/opt/homebrew/bin/rsvg-convert`.

Inspected artifacts:

- MacTeX PNG: `/private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07/mactex-png/shadows-blur-shadow-path.png`;
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07/tikzkit-svg/shadows-blur-shadow-path.svg` and `/private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07/tikzkit-png/shadows-blur-shadow-path.png`;
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07/tikztosvg-svg/shadows-blur-shadow-path.svg` and `/private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07/tikztosvg-png/shadows-blur-shadow-path.png`;
- native sheet and registered diff: `/private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07/diff/shadows-blur-shadow-path-native-sheet.png` and `/private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07/diff-png/shadows-blur-shadow-path-registered.png`.

TikZKit emits one `tikz-path-shadow` group per source path, with a translated
preaction child carrying `filter="url(#tikzkit-blur-shadow-100)"`; the shared
definition has `feGaussianBlur stdDeviation="10"` in renderer coordinates.
The tikztosvg SVG instead serializes the TeX-built soft outline paths and wraps
them in its colour-removal filter; there is no directly comparable Gaussian
filter. This is why MacTeX remains the visual oracle.

## Visual Result

Before this change the path form had the parsed blur metadata but painted as a
hard-edged, semitransparent black duplicate. The node renderer was already
soft, so the two source forms visibly disagreed.

After the change, both the yellow rectangle and blue circle have a soft dark
lower-right preaction in the TikZKit panel. The inspected MacTeX and
tikztosvg panels have the same object order, down-right offset, foreground
black outline, and visibly feathered shadow. TikZKit's falloff is smoother
than TeX's finite eight-step fade; that is the accepted, documented SVG
approximation rather than a claim of pixel identity.

TikZKit is 86x80px and tikztosvg is 80x75px. After 3px registration, the
TikZKit/tikztosvg difference is 16.58% changed pixels and mean absolute RGBA
0.01796; TikZKit/MacTeX is 19.00% and 0.02015. The metrics locate residual
raster/crop differences only; the visual acceptance is the previously hard
path shadow now rendered softly and consistently with node shadows.

## Verification

```bash
node --test --test-name-pattern='shadows\\.blur|blur shadow|drop-shadow defaults|general shadows as path preactions' \
  test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07 \
  --only shadows-blur-shadow-path --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-shadows-blur-path-after-2026-08-07 \
  --register --alignment-radius 3
```

All six focused tests pass; all three renderers produced their SVG/PNG
artifacts with zero TikZKit diagnostics.

## Remaining Work

Do not treat this as a bit-exact replacement for `pgf-blur`: `shadow blur
steps`, `shadow blur invert`, extra rounding, and TeX's multi-stroke profile
are not reproduced. The next `shadows.blur` slice should decide whether to
approximate inversion/rounding or leave the library at this explicit boundary.

# `shadows` General Path Shadow Visual QA (2026-08-07)

## Scope

This focused slice implements the documented `general shadow` preaction for
ordinary TikZ paths. It covers painting the same path before its normal paint,
scaling that pre-paint around the path bounding-box center, and applying
`shadow xshift` / `shadow yshift` in canvas coordinates.

It deliberately does not claim blur/fading shadows, copy/double-copy shadows,
`every shadow` hooks, arbitrary preaction code, or path shadows through
form-only patterns.

The regression driver is
`test/fixtures/examples/shadows/general-shadow-path.tex` (Case 306):

```tex
\usetikzlibrary{shadows}
\begin{tikzpicture}[even odd rule]
  \draw[general shadow={fill=red,shadow scale=1.25,
    shadow xshift=-2pt,shadow yshift=1pt}]
    (0,0) circle (.5) (0.5,0) circle (.5);
\end{tikzpicture}
```

Implemented commands and keys in this slice:

- `\usetikzlibrary{shadows}` and `\draw`;
- `general shadow={...}`;
- `fill=red`, `shadow scale=1.25`, `shadow xshift=-2pt`, and
  `shadow yshift=1pt`;
- the picture-level `even odd rule`, two `.5cm` circles, and their compound
  fill rule.

## Local MacTeX Study

Read local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshadows.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shadows.tex`,
  especially the `general shadow` discussion around lines 46-100.

The macro defines `general shadow` as a `preaction`: it paints the path with
the supplied shadow style first, then uses `transform canvas` to apply
`scale around=<shadow scale>:(current path bounding box.center)` and the two
shadow shifts. The manual also specifies that a shadow does **not** alter the
TikZ picture bounding box.

TikZKit now retains parsed path shadows in the scene item and the SVG renderer
emits a `tikz-path-shadow` group before the normal path. The SVG transform is
the same translate / center-scale / inverse-center sequence, with y converted
to SVG coordinates. The shadow uses the original fill rule but omits marker
tips in this first path-only slice.

## Three-Way References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; raster conversion
used `/opt/homebrew/bin/rsvg-convert`. Artifacts are outside Git:

- MacTeX PNG:
  `/private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07/mactex-png/shadows-general-shadow-path.png`;
- TikZKit SVG/PNG:
  `/private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07/tikzkit-svg/shadows-general-shadow-path.svg` and
  `/private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07/tikzkit-png/shadows-general-shadow-path.png`;
- tikztosvg SVG/PNG:
  `/private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07/tikztosvg-svg/shadows-general-shadow-path.svg` and
  `/private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07/tikztosvg-png/shadows-general-shadow-path.png`;
- four-way native sheet and registered diff:
  `/private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07/diff/shadows-general-shadow-path-native-sheet.png` and
  `/private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07/diff-png/shadows-general-shadow-path-registered.png`.

The tikztosvg SVG uses a red `fill-rule="evenodd"` path before the black,
unfilled outline path. It bakes the canvas transformation into its path data;
the normal outline carries the usual y-flip matrix. TikZKit represents the
same relationship as a red SVG path inside a transform group followed by the
black source path, preserving `fill-rule="evenodd"`, butt caps, and miter
joins.

## Visual Result

Before this change, the TikZKit panel had only the two black circle outlines;
the visibly enlarged, shifted red even-odd union was entirely absent. MacTeX
and tikztosvg both had the red preaction beneath that outline.

After the change, the JS SVG has the red shadow behind the same black pair of
circles. The red union is enlarged around the combined path center and shifts
left/down for the fixture's `-2pt` / `1pt` settings. The native sheet visibly
agrees on the missing-element defect being fixed.

The remaining raster difference is crop and anti-aliasing calibration, not a
missing shadow: TikZKit is 63x44px while tikztosvg is 58x39px. After a
3px registration, JS-vs-tikztosvg has 23.83% changed pixels and mean absolute
RGBA 0.02796; JS-vs-MacTeX has mean absolute RGBA 0.03139. These numbers are
diagnostic only; the acceptance criterion is the previously missing red path
now being visibly present with the correct layering, scale, shift, and
even-odd hole.

## Verification

```bash
node --test --test-name-pattern='general shadows as path preactions' test/interpreter.test.js
node --test --test-name-pattern='repeated general shadow styles' test/petarv-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07 \
  --only shadows-general-shadow-path --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-shadows-general-path-after-2026-08-07 \
  --register --alignment-radius 3
npm run extension-registry
```

Both focused regressions pass. The renderer produced MacTeX native PNG,
TikZKit JS SVG/PNG, tikztosvg SVG/PNG, diff, and comparison sheets without
diagnostics. `docs/extension-registry.{md,csv}` records `shadows` as partial
with Case 306 and the reviewed local source and manual.

## Remaining Work

The next shadows slice should test `drop shadow` and then decide whether
arrows should participate in a shadow preaction. Form-only patterns must also
route through `renderPathWithShadows` before that combination can be claimed.

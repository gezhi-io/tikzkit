# PGFPlots 3D Title Placement

## Scope

This slice corrects one shared PGFPlots 3D axis-description rule: `title` is
placed above the highest edge of the projected 3D axis box. It does not change
surface sampling, the 3D projection formula, colour mapping, `colorbar`
sampling, tick generation, or any case-specific coordinates.

The real driver is
`test/fixtures/examples/latex-examples/color-blind-friendly-mesh-colormap.tex`.
It uses `\begin{axis}`, `\addplot3[surf,samples=30] {x*y}`, a named
`colormap`, `title`, `colorbar`, and:

```tex
colorbar style={
  at={(-0.3,0)},
  anchor=south west,
  height=0.6*\pgfkeysvalueof{/pgfplots/parent axis height},
  title={$f(x,y)$}
}
```

Supported in this slice: the ordinary 3D axis title and its existing title
font/style handling. Still partial: arbitrary `title style` shifts, every
view-specific PGFPlots title rule, horizontal colorbars, and the complete
standalone colorbar-axis pipeline.

## Local MacTeX Study

Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`:

- lines 1142-1159 define a right colorbar as an ordinary child axis with
  parent-axis width/height and `at`/`anchor` placement;
- lines 10333-10337 save the parent-axis bounding-box diagonal as the
  dimensions used by that child axis;
- lines 10650-10685 replace the child colorbar description coordinate system
  with the parent axis picture box before applying `at`.

The important implication is that axis descriptions are attached to the full
projected axis picture, not a point on the top surface. TikZKit had used the
top-face midpoint for the 3D title. For an oblique view that midpoint lies
inside the projection, visibly overlapping the mesh and also shortening the
tight SVG canvas.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX produced the native PNG.

The inspected before/after roots are:

- `/private/tmp/tikzkit-qa-colorbar-before/`;
- `/private/tmp/tikzkit-qa-colorbar-after/`.

Each includes `mactex-png/`, `tikzkit-svg/`, `tikzkit-png/`,
`tikztosvg-svg/`, `tikztosvg-png/`, `diff/`, and `diff-png/`. The primary
four-panel evidence is
`diff/latex-examples-color-blind-friendly-mesh-colormap-native-sheet.png`.

The third-party SVG agrees closely with MacTeX: it has a `274.91pt` by
`199.16pt` viewBox and preserves the title above the projected frame. TikZKit
uses browser text nodes instead of outlined TeX glyph paths, so raster output
is not expected to be byte-identical.

## Visual Result

Before, TikZKit's title sat on the top mesh/frame and the cropped SVG was
`270.91pt` by `169.29pt`. The colorbar itself was present, but its title and
the 3D title made the whole composition visibly top-heavy compared with both
references.

After, the title is above the projected frame, the colorbar remains aligned
to the same parent-axis bottom edge, and TikZKit's canvas is `270.91pt` by
`191.67pt`, close to the `274.91pt` by `199.16pt` reference. The aligned
TikZKit-vs-MacTeX mean absolute RGBA residual falls from `0.0820` to `0.0383`;
the changed-pixel ratio falls from `37.10%` to `22.67%`. The remaining visible
differences are browser-versus-TeX text metrics, small projected-frame/tick
offsets, and the faceted SVG mesh rasterization. No element was removed and
no new diagnostic was introduced.

## Implementation And Verification

- `src/pgfplots/axis3d.js`: derives the title x coordinate from the projected
  bounding-box centre and the y coordinate from its top edge, then applies the
  existing `0.25cm` title offset.
- `test/pgfplots-seams.test.js`: adds a focused regression ensuring a 3D title
  clears both the projected top edge and the top-face midpoint.
- `src/packages/pgfplots.js`: records the feature and reviewed source result;
  the generated registry files receive the same status.

```bash
node --test --test-name-pattern='pgfplots 3d titles sit above' test/pgfplots-seams.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-colorbar-after \
  --only latex-examples-color-blind-friendly-mesh-colormap \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-colorbar-after \
  --register --alignment-radius 3
npm run extension-registry
```

The focused test passes. All three renderer artifact families were generated
for the driver, and the inspected comparison sheet shows the described visual
improvement.

## Remaining Work

- Calibrate the remaining approximately 7.5pt canvas-height gap without
  introducing per-example layout constants.
- Audit more azimuth/elevation views and `title style` overrides.
- Complete the independent child-axis behavior for horizontal/left colorbars
  and advanced PGFPlots description-coordinate forms.

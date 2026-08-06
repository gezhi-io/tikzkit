# `arrows.meta` Independent Tip Scaling

## Scope

This slice implements one shared arrow capability: the capitalized
`arrows.meta` `Latex` and `Stealth` tips now keep `scale`, `scale length`, and
`scale width` independent. It includes the resulting endpoint inset so a
painted path is shortened by the same longitudinal geometry as PGF.

The boundary is deliberately narrow. It does not claim composite tip parsing,
padding/separation, arbitrary arrow setup code, or the full `arrows.meta` key
space. Lower-case core `latex` remains the separately implemented classic tip.

The regression fixture is
`test/fixtures/examples/arrows/meta-tip-scaling.tex`. It uses one `very thick`
path for each of these cases:

```tex
Latex[]
Latex[scale length=1.8]
Latex[scale width=1.8]
Stealth[scale=1.5]
Stealth[scale length=1.8,scale width=.65]
Latex[scale length=1.5], shorten <=4mm, shorten >=3mm
```

## Local MacTeX Study

Reviewed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`:
  `/pgf/arrow keys/scale` assigns both the length and width scaling factors;
  the two individual keys remain independent.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`:
  `Latex` declares `length=+3pt 4.5 .8`, `width'=+0pt .75`, caps its outline
  width at one fifth of the calculated length, and derives its visible mitered
  outline after those dimensions are resolved.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`,
  “Scaling”: `scale` changes computed length, inset, and width; `scale length`
  applies only to length/inset, and `scale width` applies only to width. The
  same manual documents `shorten <=` and `shorten >=` as separate path-end
  shortening keys.

One subtle consequence is intentional: changing only the logical length can
move the *visible* outer width by a small amount because Latex recomputes the
stroked miter. The implementation follows that PGF calculation rather than
forcing a pixel-identical width.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The render command also used local `pdflatex`
for the MacTeX native PNG.

- Before: `/private/tmp/tikzkit-qa-arrows-meta-scale-before-2026-08-06/`
- After: `/private/tmp/tikzkit-qa-arrows-meta-scale-after-2026-08-06/`

Each directory contains the required artifacts:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-svg/` and `tikztosvg-png/`
- `mactex-png/`
- `diff/`, `diff-png/`, and the visual sheets

Inspected after panels:

- `/private/tmp/tikzkit-qa-arrows-meta-scale-after-2026-08-06/diff/arrows-meta-tip-scaling-sheet.png`
- `/private/tmp/tikzkit-qa-arrows-meta-scale-after-2026-08-06/diff/arrows-meta-tip-scaling-native-sheet.png`

The `tikztosvg` SVG uses filled `path` elements for the tips, with butt caps
and miter joins on the path stroke; it does not use SVG markers. The reference
therefore confirmed that the renderer must move both the tip shape and the
painted path end rather than only changing a marker viewBox.

## Visual Result

Before, TikZKit rendered the `scale length` and `scale width` variants as the
same default `Latex` tip. The second line was not longer, the third line was
not wider, and the fifth `Stealth` line could not express opposite length and
width changes.

After, the second tip grows longitudinally without proportional widening, the
third grows laterally without proportional lengthening, and the fifth becomes
longer and narrower. The final line retains the additional explicit 4 mm and
3 mm shorten values. These changes are visible in both the TikZKit/reference
sheet and the MacTeX/reference sheet. Remaining differences are small raster
and canvas-calibration residuals: TikZKit is 153x157 px and tikztosvg is
153x160 px for this fixture. The registered TikZKit/tikztosvg changed-pixel
ratio improved from 10.85% to 10.51%; it is supporting evidence, not the
acceptance criterion.

As a regression sweep, all 22 maintained fixtures whose source directly uses
`Latex[...]`, `Stealth[...]`, or `shorten <=`/`shorten >=` were rendered into
`/private/tmp/tikzkit-qa-arrows-meta-corpus-after-2026-08-06/`. It contains
22/22 TikZKit SVG/PNG pairs, 22/22 tikztosvg SVG/PNG pairs, and 22/22 native
MacTeX PNGs. The three timeout-prone LDA/line-chart cases were also repeated
individually in
`/private/tmp/tikzkit-qa-arrows-meta-corpus-remaining-after-2026-08-06/`;
they all produced the same three artifact families. This sweep checks for
missing render artifacts and new diagnostics; it does not turn unrelated
layout differences in those cases into arrow acceptance claims.

## Implementation and Verification

Changed shared code:

- `src/engine/options.js`: preserves independent meta scales in the drawing IR
  while keeping scaled default dimensions as non-explicit previews.
- `src/tikz/metrics.js`: separates logical length and width scaling in the
  Latex PGF geometry calculation.
- `src/renderers/svg/paths.js`: applies those factors to inline tip geometry
  and endpoint shortening.
- `src/engine/evaluate.js`: applies the same shortening to decoration arrows.

Verification:

```bash
node --test --test-name-pattern='Latex tip scale|arrows.meta length and width|classic latex' test/renderer.test.js
node --test --test-name-pattern='arrows.meta value syntax' test/interpreter.test.js
node --test test/library-modules.test.js
npm run examples:render -- --output /private/tmp/tikzkit-qa-arrows-meta-scale-after-2026-08-06 --native-reference --comparison-grid=svg --only arrows-meta-tip-scaling
npm run examples:diff -- --output /private/tmp/tikzkit-qa-arrows-meta-scale-after-2026-08-06 --register
```

The focused tests and the one-case three-way artifact run pass with no TikZKit
diagnostics. A broad arrow-name filtered interpreter run still contains one
unrelated pre-existing xcolor normalization assertion (`orange` versus
`rgb(255 128 0)`); it is outside this arrow-geometry slice.

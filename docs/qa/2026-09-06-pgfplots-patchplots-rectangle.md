# PGFPlots Rectangle Patch QA

## Scope

This pass covers one linear `patch type=rectangle` stream: four explicit 3D coordinates consumed as `A -> B -> C -> D`, projected as one closed planar face, with native mapped fill and faceted mesh paint. It also verifies the `x`, `y`, and rotated `z` labels used by this real axis fixture.

## Local Sources

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsmeshplothandler.code.tex`: the base rectangle class consumes four consecutive vertices and constructs the fill path `A -> B -> C -> D -> close`; shader-specific streams may reorder vertices later.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex`: the library redeclaration extends the base class with refinement and higher-order patch behavior without changing the linear rectangle path.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex` and `pgfplots.code.tex`: coordinate processing projects the patch before the faceted mesh paint and axis descriptions are emitted.
- `cmmi10.tfm` through local `tftopl`: math italic `z` has a 0.46505em advance and 0.430555em height.

## Reference Structure

Local `tikztosvg` is `/Library/TeX/texbin/tikztosvg`. Its rectangle SVG contains one nonzero-filled closed path with a 0.3985pt butt-cap/miter-join stroke. The path order is A, B, C, D; the fill is approximately `rgb(128,214,247)` and the mapped faceted edge is approximately `rgb(204,153,0)`. The native MacTeX PNG has the same geometry, paint order, and labels.

Before this pass, TikZKit already matched the rectangle geometry and paint but emitted the rotated `$z$` as a platform `<text>` glyph while `$x$` and `$y$` used Computer Modern outlines. The browser-dependent `z` shape was visibly inconsistent. TikZKit now uses the local TeX glyph outline and TeX metrics for all three labels. A remaining 3px overall-width difference is a shared 3D text-bound estimate, not rectangle geometry.

## Artifacts

- Before: `outputs/qa/2026-09-06-pgfplots-patchplots-rectangle-before/`
- After: `outputs/qa/2026-09-06-pgfplots-patchplots-rectangle-after/`
- Four-way sheet: `outputs/qa/2026-09-06-pgfplots-patchplots-rectangle-after/diff/pgfplots-patchplots-rectangle-native-sheet.png`
- Third-party SVG: `outputs/qa/2026-09-06-pgfplots-patchplots-rectangle-after/tikztosvg-svg/pgfplots-patchplots-rectangle.svg`

## Coverage

Implemented in this slice: `\usepgfplotslibrary{patchplots}`, `\addplot3`, `patch`, `patch type=rectangle`, explicit coordinate streams, `view`, explicit x/y/z ranges, width/height, x/y/z labels, `fill`, mapped faceted mesh color, opacity, and depth ordering.

Still partial: arbitrary patch tables, explicit point meta streams, `shader=interp`, quadratic and biquadratic patches, Coons patches, recursive refinement parity, and PDF shading.

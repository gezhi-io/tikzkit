# Native Roots, Matrices and Bold Math

## Scope

This follows the [fraction/script slice](2026-10-22-fractions-scripts.md).
The accepted boundary is ordinary Computer Modern math at 10/7/5pt, in the
default browser renderer as well as SVG-text export. It is not a certification
of every mathematical expression or of whole-project visual parity.

| Implemented family | Details |
| --- | --- |
| `\sqrt{...}`, `\sqrt[n]{...}` | Cramped nucleus, native rule clearance, root index, nested roots, and tall fraction contents. Size variants and extensible pieces come from CMEX; no glyph is stretched. |
| `matrix`, `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix` | Row struts, cell maxima, centered columns, native delimiters, and vertical centering on the math axis. |
| Basic `array` and `\left...\right` | `l/c/r` columns, 5pt column separation on each side, empty right delimiter, and point-valued row skips. |
| `\mathbf` | Bold upright alphabet; surrounding symbols and lowercase Greek do not automatically become bold. |
| `\boldsymbol` | Bold symbols and letters in its group, with native bold optical fonts. |
| `\boldmath`, `\unboldmath` | Scoped math-version selection, distinct from text `\bfseries`. |
| Node and legend integration | Native height/depth/width used for anchors and borders; package-specific CMEX settings retained by PGFPlots legend measurement. |

Specialized `aligned`, `cases`, `smallmatrix`, rules/custom array preambles,
accents, large-operator limits, sans math and other base sizes retain the old
whole-formula fallback. A supported outer root/matrix never drops an unsupported
inner expression just to use the new renderer.

## Source Review

Sources are from `/usr/local/texlive/2025/texmf-dist/`:

- `tex/latex/base/fontmath.ltx`: normal and bold operator/letter/symbol families;
  math alphabets are distinct from the global math version.
- `tex/latex/base/omlcmm.fd`, `omscmsy.fd`, `omxcmex.fd`: optical bold designs
  and fixed CMEX10 extension selection.
- `tex/latex/base/latex.ltx`: root-index placement uses 5mu and -10mu kerns
  and a raise based on the root's height minus depth. Array struts derive from
  the surrounding baseline skip, and arrays are vertically centered.
- `tex/latex/amsmath/amsmath.sty`: matrix wrappers remove the outer array
  column separation and add their own delimiters; small extension fonts differ
  from the `cmex10` option.
- `fonts/tfm/public/cm/` and `fonts/tfm/public/amsfonts/cmextra/`: native
  advances, italic corrections, math parameters, `nextlarger` chains, and
  top/middle/repeat/bottom assembly recipes. Corresponding Type 1 outlines
  under `fonts/type1/public/amsfonts/` are the only newly bundled glyph sources.
- `tex/generic/pgfplots/pgfplots.code.tex`: `every axis legend` sets cell
  `inner sep=2pt` and `text depth=0.15em`; legend rows must not just use the
  complete unmodified formula depth.

The TeX engine source was not installed locally. Its official
[TeX Live source](https://raw.githubusercontent.com/TeX-Live/texlive-source/trunk/texk/web2c/tex.web)
was checked for `var_delimiter`, `make_radical`, `make_left_right`, and `overbar`.
Local TeX runs independently verify the resulting geometry. KaTeX supplies
syntax trees, not the font outlines or final layout in this supported subset.

## Implementation

- `src/tex/mathBox.js`: renderer-neutral radical, matrix, and bold math boxes.
- `src/tex/mathDelimiters.js`: native font-size search and extensible assembly.
- `scripts/build-cm-math.py`: original bold CM/CMEX WOFFs and TFM extraction.
  CMEX pieces retain their original TeX slots through a private Unicode mapping.
- `scripts/build-cm-optical-fonts.py`: Delta/Omega Unicode aliases for native
  CMR/CMBX glyphs, without changing their outlines.
- `src/renderers/svg/nativeMath.js`: explicit glyph baselines and real bold
  faces, including preservation of contour stroke size under point scaling.
- `src/frontend/parser.js` and `latex-shell.js`: escaped braces do not change
  source group depth. Previously `\left\{` could swallow subsequent nodes.
- Font context, text measurement and PGFPlots legend lowering share the native
  box and AMS extension profile. No fixture-specific coordinates were added.

## Visual Results

The local command resolves to `/Library/TeX/texbin/tikztosvg` (0.3.0).
References use pdflatex, tikztosvg and rsvg-convert. Native PDF PNGs are also
retained. No packages or fonts were installed from the network.

Reference SVGs store font outlines in `defs` and position them with `use`.
TikZKit instead emits embedded MacTeX WOFF text at explicit baselines and rule
rectangles. Both use their original physical coordinate systems. Position
comparisons do not fit, rescale or translate one image to match another.

| Case | Before and after |
| --- | --- |
| `radicals` | Previously browser roots inherited the larger HTML layout, and export could flatten them into text. Native hooks, overbars, indices and stacked tall pieces now agree with tikztosvg; nested roots and small-font scripts remain correctly separated. |
| `matrices` | Before, escaped braces removed the last three nodes and matrices used approximate box dimensions. All eight nodes now appear, with centered rows/columns, correctly sized parentheses/brackets/braces/bars, and full 7/5pt matrices. |
| `bold-math` | Native CMBX/CMMIB/CMBSY glyphs replace synthetic/legacy bold layout. Greek symbols, upright Latin alphabets, normal outer scripts, and global bold fractions/roots are visibly distinct and match the reference. Delta and Omega no longer risk a missing Unicode slot. |
| `faktorraum` | The real plot's tiny two-row matrix legend uses the same native geometry and AMS extension profile. Overall axis/crop offsets remain outside this math acceptance boundary. |

Chrome rendered 13 fixtures with default public options. All have zero JS/export
diagnostics, browser errors and font-loading errors. All 67 packaged font
selection checks pass. The three new cases have 193 glyph origins, each compared
in actual browser CSS pixels against the reference:

| Case | Origins | Largest coordinate error |
| --- | ---: | ---: |
| radicals | 48 | 0.01678px |
| matrices | 98 | 0.00566px |
| bold-math | 47 | 0.01514px |

The previous fraction/script controls also pass. Independently, 126 native
hboxes (21 expressions, three sizes, two math versions) match JS width, height
and depth within 0.000298pt, below the regression tolerance of 0.001pt.
These measurements are distinct from raster antialiasing differences. The
six-panel native/reference/browser/export/diff sheets were actually inspected.
The live SVG page was checked at 1440x1000 and 390x844, with 26 loaded SVG
objects, no page overflow and no browser errors. Additional 4x device-resolution
Chrome screenshots confirm the root pieces, delimiters and bold outlines;
their CSS scale was not changed to fit the images.

## Artifacts

```text
outputs/qa/2026-10-22-math-structures-before/
outputs/qa/2026-10-22-math-structures-final/
  font-audit.html#radicals       live browser/reference SVG objects
  font-audit.json               provenance, diagnostics, glyph coordinates
  browser/                     default-browser SVG, PNG, six-panel sheets
    *-4x-sheet.png              browser/reference outline inspection
  tikztosvg-svg/                independent local reference SVGs
  tikztosvg-png/
  mactex-png/
  live-desktop-*.png
  live-mobile-*.png
  live-browser.json
outputs/qa/2026-10-22-math-structures-probes/
  probe.tex, probe.log, boxes.json
```

The general audit deliberately retains `visualAccepted: false` because its
other real-world controls still contain non-math differences. The focused
root/matrix/bold slice is accepted; that does not make `aligned`, marked Jordan
arrays, all PGFPlots geometry, or the entire project complete.

## Reproduction

```sh
node scripts/probe-math-structures.js outputs/qa/math-structure-probes
node --test test/math-structures.test.js test/math-box.test.js \
  test/font-audit.test.js test/font-identity.test.js test/font-spec.test.js \
  test/math-script-metrics.test.js
node scripts/audit-font-rendering.js \
  --output outputs/qa/math-structures \
  --browser-module /absolute/path/to/local/playwright/index.mjs \
  --browser-channel chrome
npm test
npm run check:architecture
npm run docs:links
node scripts/check-font-package.js
```

The focused run passes 124 tests. The full run has 2,744 tests: 2,588 pass,
142 fail, and 14 are skipped. All 142 failing names match the pre-change
baseline; none was added or suppressed. Architecture validation passes. The
local npm tarball smoke check resolves all 67 fonts and produces embedded/shared
SVGs without diagnostics. No publication or push was performed.

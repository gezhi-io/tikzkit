# PGFPlots tick number-print templates

## Scope

This slice implements the common optional-argument `\pgfmathprintnumber[...]` family inside 2D and 3D PGFPlots tick-label templates. The accepted keys are `fixed`, `fixed zerofill`, `precision`, `use comma`, `1000 sep`, `set thousands separator`, `set decimal separator`, and `dec sep`. Math wrappers and text/unit suffixes around `\tick` are preserved.

Scientific/fractional output, integer detection, arbitrary executable separator callbacks, and the complete PGF number-printer state machine remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex`
  - Lines 45-70 establish precision 2 as the default.
  - The fixed printer rounds to decimal places and removes trailing zeros unless `fixed zerofill` is active.
  - `\pgfmathprintnumber[...]{...}` applies its option list locally.
  - `use comma` selects comma decimals and period thousands grouping.
  - `1000 sep` aliases `set thousands separator`; decimal and thousands separators are display tokens.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`
  - The current transformed tick is inverse-transformed to its data coordinate and exposed as `\tick` before the user template is evaluated.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - x, y, and z tick-label templates are independent axis handlers and their surrounding label styles are applied after template expansion.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-math-numberprinting.tex`
  - The manual confirms fixed rounding, zero filling, local optional options, and separator behavior.

## Cases and semantic coverage

### Algorithm

`pgfplots-number-print-algorithm` uses `axis`, `\addplot coordinates`, `xtick`, `ytick`, `xticklabel`, and `yticklabel`. It verifies `fixed`, `fixed zerofill`, precision 2, fixed precision 1 without zero fill, math mode, `\mathrm`, thin space, seconds, and percent suffixes over x values `0, 1.25, 2.5, 3.75` and y values `0, 25, 50, 75, 100`.

### Mathematics

`pgfplots-number-print-math` uses `axis`, `\addplot3[surf]`, x/y/z domains and limits `0:1`, samples 11, `view={40}{30}`, explicit x/y/z ticks, and all three tick-label templates. It verifies `use comma`, zero-filled x values such as `0,00`, non-zero-filled y values such as `0,5`, and one-decimal z values such as `1.0` on the surface `x*y`.

### Physics

`pgfplots-number-print-physics` uses `axis`, `\addplot coordinates`, explicit x/y ticks, square marks, and unit-bearing templates. It verifies precision 1, `1000 sep={\,}`, `set decimal separator={,}`, milliseconds, volts, x values `0, 1250, 2500, 3750`, and y values `0, 2.5, 5, 7.5, 10, 12.5`.

Every dependency, command, environment, option, and numeric literal is recorded in the three adjacent `.review.json` files and backed by `test/pgfplots-number-print-templates.test.js`.

## Visual comparison

Before the fix, TikZKit emitted literal `pgfmathprintnumber[fixed,...]` control words at every tick. They overlapped the plots, expanded the SVG width to 781-829 px in the worst cases, and obscured the intended number, separator, and unit labels.

After the fix:

- Algorithm labels read `0.00s`, `1.25s`, `2.50s`, `3.75s` and `0%` through `100%`; the plot and labels occupy the intended compact frame.
- Mathematics labels use comma decimals on x/y and fixed one-decimal z labels. The surface, grid, axis labels, and tick text are all visible. The projected x=1 and y=0 labels remain close at the front corner because exact 3D label separation is a separate calibration issue; the SVG contains distinct `1,00` and `0` nodes.
- Physics labels retain grouped millisecond values and comma-decimal voltage values with their unit suffixes. No control words overlap the sensor trace.

The mean absolute RGBA residuals are supporting evidence only: algorithm changed from 0.0408 to 0.0205, mathematics from 0.1089 to 0.0253, and physics from 0.0488 to 0.0213. The accepted criterion is the visible replacement of literal commands by source-correct labels with no missing plot elements.

## tikztosvg and artifacts

Local executable: `/Library/TeX/texbin/tikztosvg`.

Artifacts are stored under:

- Before: `outputs/qa/2026-09-05-pgfplots-number-print-before/`
- After: `outputs/qa/2026-09-05-pgfplots-number-print-after/`
- TikZKit: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg: `tikztosvg-svg/` and `tikztosvg-png/`
- MacTeX: `mactex-png/`
- Four-way sheets and diffs: `diff/` and `diff-png/`

The tikztosvg SVGs use compact physical viewBoxes, glyph definitions plus transformed `<use>` nodes for TeX text, `fill-rule="nonzero"`, and PGF's `stroke-linecap="butt"` / `stroke-linejoin="miter"` defaults. The number printer has already resolved each tick before glyph emission, which supports expanding the semantic template before TikZKit's text and bbox stages rather than trying to hide control words in the SVG renderer.

## Verification

```text
node --test test/pgfplots-number-print-templates.test.js
node --test test/pgfplots-3d-tick-labels.test.js test/pgfplots-log-axes.test.js test/pgfplots-zlog-axes.test.js
npm run case:audit -- <fixture> --review <review.json> --strict
npm run extension-registry
npm run gallery:audit
```

All three references render through TikZKit, tikztosvg, and MacTeX with zero diagnostics and zero external-render failures.

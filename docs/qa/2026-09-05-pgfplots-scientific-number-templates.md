# PGF scientific number templates

## Scope

This slice implements PGF scientific number formatting for 2D and 3D PGFPlots tick-label templates. The accepted family is `sci`, `sci zerofill`, `precision`, `sci precision`, `sci 10^e`/`sci 10e`, `sci e`, `sci E`, and `use comma` for the mantissa. It also covers zero as exponent zero and rounding carry such as `999.9` at precision 2 becoming `1\cdot10^3`.

Fractional styles, `int detect` in tick templates, arbitrary `sci generic` callbacks, non-finite values, and the complete PGF float state machine remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex`
  - `sci` selects the scientific printer; `sci precision` overrides common `precision` when nonempty.
  - The mantissa is rounded before display and is renormalized when rounding reaches 10.
  - `sci zerofill` preserves the requested mantissa places.
  - Standard output is `m\cdot10^e`; `sci e` and `sci E` use a signed exponent token.
  - Standard scientific output retains `10^0`, including for zero.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-math-numberprinting.tex`
  - The manual documents scientific mantissa precision, zero fill, `sci 10e`, `sci e`, and `sci E` as separate presentation choices.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`
  - The current tick is exposed to the template in data coordinates after axis transforms and scaling decisions.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - x/y/z tick templates are evaluated independently before their text nodes are positioned and measured.

A local MacTeX truth probe confirmed these exact outputs: `1234.5 -> 1.23\cdot10^3`, `999.9 -> 1\cdot10^3`, `1 -> 1\cdot10^0`, `0 -> 0\cdot10^0`, zero-filled `1 -> 1.00\cdot10^0`, lowercase `12.345 -> 1.23e+1`, uppercase `0.012345 -> 1.23E-2`, and `sci precision=1` overriding `precision=4` to produce `1.2\cdot10^1`.

## Cases and complete semantic audit

### Algorithm

`pgfplots-scientific-number-algorithm` is a search-performance plot. Its one package, nine commands, three environments, 29 option paths, and 23 numeric literals are accepted by the adjacent review. It exercises explicit x/y limits and ticks, `scaled ticks=false`, major grid, labels, a marked coordinate plot, lowercase `sci e` for 0 through 3,000,000 states, and zero-filled standard scientific seconds from 0.0001 through 0.001.

### Mathematics

`pgfplots-scientific-number-math` is the 3D surface `x*y`. Its one package, nine commands, three environments, 37 option paths, 15 numeric literals, and one expression are accepted by the adjacent review. It exercises `view`, x/y domains, samples, x/y/z ranges and ticks, a scriptsize tick style, `scaled ticks=false`, a surface plot, general and scientific precision, zero fill, and comma-decimal mantissas on three projected axes.

### Physics

`pgfplots-scientific-number-physics` is a detector-current response curve. Its one package, nine commands, three environments, 29 option paths, and 21 numeric literals are accepted by the adjacent review. It exercises explicit x/y ranges and ticks, square marks, uppercase `sci E` frequency labels, lowercase `sci e` current labels, precision override, zero fill, and `Hz`/`nA` unit suffixes.

## Visual change

Before the fix, the optional scientific keys were ignored. The algorithm y ticks collapsed to ordinary rounded `0s`; its x ticks were grouped integers. The mathematics surface used ordinary `0.001`, `1000`, and `10000` labels. The physics plot used grouped `1,000Hz` and `4,000nA` labels. The plots themselves remained visible, but the requested number notation was absent.

After the fix, all three TikZKit panels visibly contain the same scientific forms as MacTeX and tikztosvg: algorithm x labels use `e+6` and y labels use `10^{-4}`/`10^{-3}`; the 3D surface has scientific x/y/z labels and comma mantissas; physics labels use uppercase `E` on frequency and lowercase `e` on current. Units, exponents, plot geometry, marks, colors, grids, and labels remain present, and diagnostics stay at zero.

Residual differences are primarily the existing browser-font/bbox width and 3D annotation calibration. TikZKit is 21px narrower than tikztosvg for the algorithm panel, 24px narrower for the 3D panel, and 7px narrower for physics. The 3D front-corner labels are close in all three renderers. Pixel residuals are supporting evidence only because replacing short ordinary labels with correct scientific expressions necessarily changes a large text region.

## tikztosvg and SVG structure

Local executable: `/Library/TeX/texbin/tikztosvg`.

The reference SVG uses a physical `viewBox`, glyph paths with transformed `<use>` elements, `fill-rule="nonzero"`, and PGF's `stroke-linecap="butt"` and `stroke-linejoin="miter"` defaults. Its number labels are already expanded before SVG emission. TikZKit performs the same semantic expansion before text measurement, then emits measurable `<text>/<tspan>` nodes with superscript exponent spans. This keeps PGF semantics out of the SVG renderer.

Artifacts:

- Before: `outputs/qa/2026-09-05-pgfplots-scientific-before/`
- After: `outputs/qa/2026-09-05-pgfplots-scientific-after/`
- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-*`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-*`
- MacTeX: `mactex-png/`
- Four-way sheets and diffs: `diff/` and `diff-png/`

## Verification

```text
node --test test/pgfplots-number-print-templates.test.js test/pgfplotstable-typeset.test.js test/case-semantic-audit.test.js
node scripts/case-semantic-audit.js <case> --review <review.json> --strict
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-pgfplots-scientific-after --only <case-id> --native-reference --strict-tikztosvg --continue-on-external-failure --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-scientific-after
npm run extension-registry
npm run gallery:audit
```

All three TikZKit, tikztosvg, and MacTeX renders completed. The accepted cases have zero diagnostics and zero external-render failures.

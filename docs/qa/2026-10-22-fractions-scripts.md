# Native Fraction and Script Layout

## Boundary

This slice fixes ordinary fractions and scripts in the default browser renderer,
not only the SVG-text export. It uses the installed Computer Modern optical
fonts and TFM dimensions at 10, 7, and 5 TeX points. It does not claim general
TeX or project-wide visual parity. No release or publication is part of this
change.

The shared renderer-neutral hbox is implemented in `src/tex/mathBox.js`.
`src/tikz/textMetrics.js` uses it for node dimensions and anchors;
`src/renderers/svg/nativeMath.js` paints its glyphs and rules. Supported formulas
use exactly the same layout in the public browser defaults and SVG-text export.
Unsupported formulas fall back as a whole, rather than losing individual terms.

## Local Source Review

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`:

| Source | Implementation consequence |
| --- | --- |
| `tex/latex/base/fontmath.ltx` | The default math sizes are 10/7/5pt. Operators, letters, and symbols have different families. Math punctuation such as `/`, comma, and decimal point uses the letters family, including at small optical sizes. |
| `source/latex/base/ltmath.dtx` | Ordinary `\frac` wraps TeX's `\over`; numerator/denominator dimensions, style transitions, and null-delimiter space belong in a box model, not a global CSS scale. |
| `tex/latex/base/omxcmex.fd` | The basic math extension font uses the fixed CMEX10 design at 10pt, including for small surrounding text. |
| `tex/latex/amsmath/amsmath.sty`, `tex/latex/amsfonts/amsfonts.sty` | AMS enables small extension fonts; `cmex10` keeps the fixed setup. This changes the fraction rule thickness at 7/5pt. |
| `tex/latex/amsmath/amsopn.sty` | Named operators use upright operator glyphs and math-operator spacing. |
| `fonts/tfm/public/amsfonts/cm/{cmr,cmmi,cmsy}{5,7,10}.tfm` | Native advances, height, depth, italic correction, kerning, math axis, script shifts, and fraction parameters. |
| `fonts/tfm/public/amsfonts/cm/cmex10.tfm`, `fonts/tfm/public/amsfonts/cmextra/cmex7.tfm` | Fixed versus optical extension rule dimensions. |
| `tex/latex/base/article.cls`, `tex/latex/base/latex.ltx` | Default array column separation is twice `\arraycolsep=5pt`. The marked-array lowering now uses this 10pt gap instead of an empirical 0.30cm gap. |

The local KaTeX parser supplies the AST. Its installed `genfrac`, `supsub`, and
spacing implementations were also checked against TeX's fraction/script rules.
TeX engine source was not available locally; native TeX hboxes and rendered
glyph origins provide independent numerical checks. No online fonts were used.

## Commands and Parameters

Implemented in this slice:

- Ordinary `\frac`, `\dfrac`, `\tfrac`, including nested ruled fractions.
- `_`, `^`, combined scripts, and nested scripts, with italic correction,
  script space, cramped denominator styles, and minimum vertical clearance.
- `\displaystyle`, `\textstyle`, `\scriptstyle`, `\scriptscriptstyle` within
  the supported formula subset.
- Ordinary CMR/CMMI/CMSY symbols, grouped expressions, `\mathrm`,
  `\mathnormal`, color groups, and named operators without limits.
- Base font sizes 10/7/5pt, including `\scriptsize` and `\tiny` in a default
  10pt document; optical designs are selected before any whole-node scaling.
- Ordinary node padding, explicit minimum dimensions, baseline/side anchors,
  and rectangular border centerlines use the actual hbox dimensions.
- AMS small extension fonts and the `cmex10` package option.

Not implemented by this slice: arbitrary base sizes, bold/sans mathematical
versions, roots, accents, stretchy delimiters, large operators with limits,
general matrices/arrays, arbitrary font commands, or a complete TeX math list.
Those retain their previous rendering paths and their known limitations.
The marked-array column-gap correction is not a complete matrix rewrite.

## Browser and Native Verification

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
The audit uses local pdflatex, tikztosvg, and `rsvg-convert`, without network
installation. Native PDF PNGs are kept separately from the SVG references.

The reference SVG stores font outlines in `defs` and places them with `use`
coordinates. It does not use HTML `foreignObject` or SVG `text`. TikZKit uses
embedded MacTeX-derived WOFF faces, explicit glyph baselines, and fraction rule
rectangles. Both are displayed as live SVG objects in the audit page; PNGs are
secondary evidence. No best-offset translation or fit-to-image scaling is used.

Chrome 155.0.8059.86 rendered all nine cases with the default public options:

| Case | Observed result |
| --- | --- |
| `fractions-scripts` | Ordinary/nested fractions and Greek scripts now match native size and baseline at 10/7/5pt. Numerators and denominators no longer inherit the old padded HTML box. All 56 browser glyph origins agree with tikztosvg within 0.01571 CSS pixels. |
| `polynomial-box` | Script heights, baseline, box padding, and border centerline match the native rectangular node. All seven glyph origins agree within 0.00296 CSS pixels. |
| `activation-functions` | The fraction and subscripted function names use the native optical sizes and narrower hboxes. Legend/container and axis differences remain outside this math slice. |
| `commutative-diagram` | Greek-letter labels and subscripts use their correct width, baseline, and script offsets. Whole-diagram geometry is not certified pixel-identical. |
| `font-face-selection` | Regular font selection remains correct; explicitly bold formulas retain the legacy path. |
| `jordan-array` | The native 10pt column gap avoids a matrix-width regression after script measurement was corrected. Marked-cell padding is still approximate. This is explicitly a native LaTeX document reference, not tikztosvg, because the source includes math outside a TikZ picture. |
| `evaluation-tree`, `b-tree` | Plain and monospace controls remain in the audit to detect unrelated font/geometry changes. |
| `portable-fonts` | Unsupported large-operator/matrix/font combinations remain visible; this case is not accepted as fully matching native. |

The 66 native hbox probes include 57 supported formula/size combinations and
nine legacy controls. For the 57 supported combinations, the largest absolute
width/height/depth error is below **0.000394 TeX points**; the gate is 0.015pt.
The previous 10pt compound fraction reserved about 64.87pt versus native
26.19424pt, and `\Theta_B` about 10.48pt versus native 14.6608pt. The new hboxes
remove those layout errors without case-specific positions.

All 59 packaged font selections pass. All nine cases have zero browser font
errors, page errors, and JS/export diagnostics. Desktop (1440x1000) and mobile
(390x844) screenshots of the live SVG page were inspected. Mobile panels scroll
internally to preserve physical scale; the page itself does not overflow.

These checks accept the focused fraction/script slice, not every formula or
diagram. The generated report deliberately retains `visualAccepted: false`
for overall parity and exposes the narrower numerical gates separately.

## Artifacts and Reproduction

Local output, deliberately not published as GitHub documentation assets:

```text
outputs/qa/2026-10-21-math-layout-before/
outputs/qa/2026-10-22-fractions-scripts-final/
  font-audit.html#fractions-scripts
  font-audit.json
  browser/                 default-browser SVG, screenshots, and six-panel sheets
  tikztosvg-svg/            local SVG references with explicit provenance
  tikztosvg-png/
  mactex-png/               native PDF rasterizations
  native-probes/            TeX source, log, and recorded box dimensions
  live-desktop.png
  live-mobile.png
```

```sh
node --test test/math-box.test.js test/math-script-metrics.test.js \
  test/font-audit.test.js test/font-identity.test.js test/font-spec.test.js
npm test
npm run check:architecture
npm run docs:links
node scripts/check-font-package.js
node scripts/audit-font-rendering.js \
  --output outputs/qa/2026-10-22-fractions-scripts-final \
  --browser-module /absolute/path/to/local/playwright/index.mjs \
  --browser-channel chrome
```

The 106 focused tests pass. The package smoke check resolves all 59 fonts and
exercises embedded/shared font assets with zero diagnostics; it does not publish
the package. The full suite has 2,726 tests: 2,570 pass, 142 fail, and 14 are
skipped. Its failing test names exactly match the pre-change baseline. The suite
was run with local port access for its workbench server tests; a sandboxed run
additionally fails six server tests with `listen EPERM`, not rendering failures.
These are tracked separately from the new numerical and browser checks; a
passing focused gate must not be reported as a green project-wide suite.

## Remaining Work

Extend the same native-probe method to other document sizes and mathematical
alphabets before enabling them in this layout path. Then handle roots, stretchy
delimiters, and large-operator limits with real font metrics. Matrix and multiline
layout need independent baseline/row/column acceptance checks rather than
compensating offsets in the SVG renderer.

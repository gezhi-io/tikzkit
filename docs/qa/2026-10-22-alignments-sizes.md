# Native Alignments, Cases and Math Sizes

## Accepted Scope

This extends the [root/matrix/bold work](2026-10-22-math-structures.md).
The boundary is ordinary Computer Modern inline math boxes, shared by the
default browser renderer and SVG-text export. It does not certify every AMS
environment, document-level equation layout, or whole-project visual parity.

| Commands and parameters | Implementation |
| --- | --- |
| `\begin{aligned}`, `&`, `\\` | Alternating right/left columns; common relation alignment; display-style cells; 10pt between equation pairs. |
| `[t]`, `[b]`, `[c]` | First baseline, last baseline, or math-axis centering, including nested environments. Optional positions no longer appear as literal text. |
| `\\[2pt]`, `\\[-2pt]` | Explicit positive/negative row gaps; native baseline/lineskip selection rather than a fixed row-height multiplier. |
| `\begin{cases}` | Two left-aligned text-style columns, a native extensible left brace, 1.2 array stretch, no outer column padding, and one text-font quad between columns. |
| `\text`, `\textrm`, `\textnormal`, `\textbf` | Ordinary condition text, spaces, native kerning/ligatures; roman conditions remain normal under `\boldmath` unless explicitly bolded. |
| `\ne`, `\neq` | The native zero-advance CMSY negation slash over the equals relation. |
| `\tiny` through `\Huge` | The ten standard size commands of the 10pt document profile, with local NFSS optical faces and script sizes. Explicit 6pt and 10.95pt math also work. |
| Fractions, scripts, roots, matrices and bold math at these sizes | Reuse native boxes and font parameters; no uniform scaling of a single 10pt formula. Cramped display-root superscripts use SUP3. |
| Browser painting | Native SVG text uses `geometricPrecision`; font outlines are unchanged, without browser small-text stem darkening. |

The tested base sizes are 5, 6, 7, 8, 9, 10, 10.95, 12, 14.4, 17.28, 20.74,
and 24.88 TeX pt. Standard size-command support is not a claim that every
document class's size profile is implemented.

## Local Source Review

All new fonts come from `/usr/local/texlive/2025/texmf-dist/`:

- `tex/latex/base/fontmath.ltx`, lines 75-86: `\DeclareMathSizes` explicitly
  selects text/script/scriptscript sizes; 8pt and 9pt use 6pt/5pt scripts.
- `tex/latex/base/ot1cmr.fd`, `omlcmm.fd`, `omscmsy.fd`: native design-size
  selection differs by family. For example, large italic letters use CMMI12,
  large bold italic letters use CMMIB10, and large Roman text uses CMR17.
- `tex/latex/amsmath/amsmath.sty`, lines 109-113: CMEX7/8/9/10 selection;
  lines 715-719: alignment strut; line 1341: `\openup\jot`; lines 1435-1524:
  alignment columns, positional boxes and display-style cells.
- The same file, lines 1117-1127: `cases` is `\left\lbrace` plus
  `\array{@{}l@{\quad}l@{}}` with `\arraystretch=1.2`.
- `fonts/tfm/public/cm/`, `fonts/tfm/public/amsfonts/cmextra/`, and matching
  `fonts/type1/public/amsfonts/` files: advances, height/depth, italic
  corrections, math parameters, ligatures and unchanged glyph outlines.
- `tikzlibrarydatavisualization.code.tex`, `every ticks` and major-tick
  defaults, and `tikzlibrarydatavisualization.polar.code.tex`, clean angle-axis
  ticks: 2pt tick length followed by 1pt inner and .1666em outer separation.
  Correct 8pt fraction metrics exposed a legacy negative-padding compensation;
  large clean half-plane polar labels now use this physical spacing instead.
  Other polar layout approximations are outside this slice.

No fonts or TeX packages were downloaded. There are now 82 packaged faces,
with source paths and hashes in `web/fonts/manifest.json`.

## Browser and Native Evidence

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`, version 0.3.0.
The audit uses pdflatex, local tikztosvg and rsvg-convert, and also keeps native
PDF PNGs. Reference SVGs use `defs` paths plus `use` placements. TikZKit uses
embedded MacTeX fonts with explicit glyph baselines and rule rectangles.
Both keep their physical dimensions; comparisons do not independently fit or
translate the images.

| Case | Visible change |
| --- | --- |
| `aligned` | Removed printed `[t]`/`[b]`; fractions and nested cases no longer flatten in export. Equation pairs share the correct relation columns. Tall fractions and display superscripts determine row clearance. |
| `cases` | Native brace size and column separation replace approximate HTML/export layouts. Conditions remain roman, ligatures stay intact, and fractions use text style rather than display style. |
| `common-math-sizes` | Small formulas no longer inherit oversized metrics; large formulas retain optical scripts, root indices and proper rule thickness. The two largest formulas no longer overlap. |
| `polar-small-fractions` | 8pt fractional tick labels retain native geometry and clear the outer axis after removal of the compensating negative offset. The plot/legend as a whole is not certified here. |

Four-times-resolution browser screenshots revealed an extra weight difference
that origin measurements alone missed. `geometricPrecision` removes it in the
tested Chrome renderer; comparing the font outline against the reference also
confirmed that the asset itself was not a substituted bold face. Small
rasterization differences and the reference SVG's rounded path coordinates
remain; this is not a pixel-identity claim across browsers.

The three new fixtures have 22 nodes and 360 glyph origins:

| Fixture | Origins | Maximum coordinate difference |
| --- | ---: | ---: |
| aligned | 73 | 0.00678 CSS px |
| cases | 127 | 0.00691 CSS px |
| common-math-sizes | 160 | 0.01600 CSS px |

All eight formula-origin gates pass within 0.03px. All 17 fixtures have zero
renderer diagnostics, browser errors and failed fonts. Sixteen references are
from tikztosvg; the non-TikZ Jordan array is explicitly native LaTeX.
The live comparison page loads 34 SVG objects at 1800x1200 and 390x844, with no
page overflow. Individual diagrams retain physical scale and scroll inside
their viewport on a narrow screen. Six-panel native/reference/browser/export/
diff sheets and magnified browser/reference details were visually inspected.

Independently, 384 native hboxes cover 16 expressions, 12 sizes and normal/bold
math versions. Maximum width/height/depth error is 0.000487pt, below the 0.003pt
test tolerance. This includes the lineskip branch for tall display superscripts,
not only the ordinary 15pt baseline branch.

## Files and Reproduction

- `src/tex/mathArrays.js`: shared aligned/cases/matrix geometry.
- `src/tex/mathFonts.js`: native sizes and optical font selection.
- `src/tex/mathBox.js`, `mathDelimiters.js`: text conditions, ligatures,
  negated equality, font/rule selection and cramped display scripts.
- `src/renderers/svg/nativeMath.js`: browser outline-preserving painting.
- Font builders, generated metrics/assets, package metadata, registry and
  focused regression tests accompany those changes.

```sh
python3 scripts/build-mactex-fonts.py
node scripts/probe-math-alignments.js outputs/qa/native-alignment-probes
node scripts/audit-font-rendering.js \
  --output outputs/qa/alignment-audit \
  --browser-module /absolute/path/to/playwright/index.mjs \
  --browser-channel chrome
node --test test/math-alignments.test.js test/math-box.test.js \
  test/math-structures.test.js test/font-audit.test.js \
  test/font-identity.test.js test/font-spec.test.js test/math-script-metrics.test.js
npm test
npm run check:architecture
npm run docs:links
node scripts/check-font-package.js
```

143 focused tests pass. The full suite has 2763 tests: 2607 pass, 142 fail,
14 skip. The 142 failure names exactly match the saved pre-change baseline;
there are no new full-suite failures. They remain unresolved, not waived as
successful tests. Package inspection does not publish a release.

Artifacts are local and are not part of the npm package:

```text
outputs/qa/2026-10-22-alignments-before/
outputs/qa/2026-10-22-alignment-probes/boxes.json
outputs/qa/2026-10-22-alignments-final-browser/
  font-audit.html#aligned       live JS/reference SVG page
  font-audit.json               diagnostics, source hashes and origins
  live-page.json                desktop/mobile object and font checks
  browser/                     screenshots, sheets and 4x detail pairs
  tikztosvg-svg/                local reference SVGs
  tikztosvg-png/                rsvg-convert reference PNGs
  mactex-png/                   native PDF PNGs
  tikzkit-svg/                  exported JS SVGs
  tikzkit-png/                  exported PNGs
```

## Remaining Limits

`alignedat`, `gathered`, `smallmatrix`, `split`, `multline`, equation numbers,
tags/intertext, custom array preambles/rules, rich condition text, arbitrary
font sizes, sans math, accents, and large-operator limits retain the existing
whole-formula fallback. Arbitrary TeX macro execution is not implemented.
Successful generation is not global visual acceptance: the audit deliberately
keeps `visualAccepted=false` because older plots and other controls still have
unresolved non-math layout differences. The scoped new alignment/size families
above were inspected, rather than certifying all diagrams from a passing exit.

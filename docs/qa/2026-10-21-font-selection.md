# Font Selection and Layered Rendering Audit

## Boundary

Fix native font selection for the packaged MacTeX faces, not all math layout.
Core TikZ remains `builtin`; that status does not claim complete compatibility.
PGFPlots and compound TeX layout remain partial. No release or publication is
part of this change.

The previous fixture runner defaults to `mathRenderer: "svg-text"`, while the
public API defaults to browser HTML math. A successful fallback export cannot
prove that the default browser rendering agrees with LaTeX. This audit separates
those paths instead of treating a batch pixel score as acceptance.

## Local Implementation Review

Sources below are relative to `/usr/local/texlive/2025/texmf-dist/`:

| Source | Relevant behavior |
| --- | --- |
| `tex/latex/pgf/frontendlayer/tikz.sty`, `tex/plain/pgf/frontendlayer/tikz.tex` | Both load the shared TikZ implementation. |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 3865-3905 | TikZ executes the selected text font before building the node hbox, including the text-width/minipage branch. |
| `tex/latex/base/fontmath.ltx`, lines 45-90 and math-size declarations | Operators are medium upright CMR, letters medium italic CMM, with distinct bold families; the normal 10pt math setup uses 10/7/5pt. |
| `tex/latex/base/omlcmm.fd`, `tex/latex/lm/omllmm.fd` | TeX chooses different optical math designs; smaller scripts are not always a uniform scale of the 10pt design. |
| `doc/fonts/lm-math/README-Latin-Modern-Math.txt` | Latin Modern Math contains multiple mathematical alphabets in a single font. Extracting an alphabet requires a new face identity. |
| `fonts/type1/public/amsfonts/cm/cmmi10.pfb`, `cmmib10.pfb` | Local font metadata distinguishes medium and bold italic designs. |

The font builder had changed the OpenType name table but retained the original
CFF identity and, for extracted LM alphabets, regular weight/style flags. Native
font selection could consequently choose bold outlines for a regular request.
The fix synchronizes `OS/2.usWeightClass`, `OS/2.fsSelection`, `head.macStyle`,
and CFF family/full/PostScript names. Glyph outlines and advance widths remain
unchanged for all 53 faces; before/after glyph fingerprints were compared.

## Acceptance Layers

1. Verify font tables against the CSS manifest, then ask Fontconfig which exact
   file a numeric weight/slant request selects. Do not merely check that a font
   file exists or its name appears in CSS.
2. Compile TeX hboxes for `x`, `\Theta_B`, `\varphi_1(x)`,
   `\frac{1}{1+e^{-x}}`, and `\mathbf{ABC}` at 10, 7, and 5pt. Record width,
   height, depth, and selected native font names alongside JS layout metrics.
3. Render focused real fixtures with the public browser defaults, SVG-text,
   native PDF, and local tikztosvg. Inspect all four images and raw differences
   at the same 96dpi physical scale, without fitting or best-offset alignment.

Commands/styles covered by the selection slice include normal text,
`\itshape`/`\textit`, `\bfseries`/`\textbf`, `\sffamily`, `\ttfamily`,
ordinary italic math, and explicit `\mathbf`/`\boldsymbol`. The audit probes
font size separately; it does not implement arbitrary NFSS substitutions,
general TeX math lists, missing symbol commands, or new package semantics.

## Observed Results

Before, 49/53 native face requests selected the expected file. After, 53/53 do.
The four corrected requests were Main regular, Main italic, Math italic, and
SansSerif regular. Each had selected a bold variant.

| Fixture | Visual observation |
| --- | --- |
| `activation-functions` | SVG-text legend letters/operators lose the unintended bold weight. Legend spacing, box dimensions, and formula layout still differ from native. |
| `commutative-diagram` | SVG-text `Phi`, `V`, `W`, `Theta`, and scripted labels have the intended lighter weight. Text baselines and ellipse layout still differ. |
| `font-face-selection` | Regular and italic math no longer inherit bold faces; the explicitly bold row stays bold. Baseline/box differences remain visible. |
| `mactex-portable-fonts` | Wrong bold math selection is removed. The fallback still exposes unsupported command text and inaccurate large-operator/matrix layout. It is not accepted as a portable replacement for the browser. |
| `evaluation-tree` | Plain-text negative control: image unchanged. Node/text placement is still not pixel-identical. |
| `b-tree-2-small-2` | Monospace negative control: image unchanged. Existing node/connector placement differences remain. |

All six default-browser PNGs are byte-identical before and after this fix.
The browser already selected these faces correctly via CSS. This is a visible
**SVG-text/native export improvement**, not a browser-layout fix. All six cases
have zero renderer diagnostics; zero diagnostics is not visual acceptance.

Native probes confirm CMR10 operators, CMMI10 letters, and CMMIB10 bold letters.
At 10pt, `\Theta_B` reserves about 10.48pt in JS versus a 14.66pt native hbox;
the compound fraction reserves about 64.87pt versus 26.19pt. These are layout
reservations, including JS padding, not painted ink widths. They identify
follow-up measurement work rather than a reason to apply a global font scale.

## Reference and Artifacts

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg`.
No separate local `tikz2svg` executable was on PATH. The reference run used
tikztosvg with pdflatex and `rsvg-convert`; native PNGs came from PDF rendering.
No network font installation or alternative reference substitution was used.

For the commutative diagram, tikztosvg emits a 150.773pt by 142.419pt SVG with
matching `viewBox`, glyph paths, and 49 `use` instances, without SVG `text` or
`foreignObject`. It freezes TeX glyph selection into outlines. TikZKit's text
output instead depends on font selection at rasterization time. Native PDF and
tikztosvg visibly agree on ordinary math weight; they expose the old fallback
font substitution independently of the numerical image difference.

Local generated output (not committed or linked as public GitHub assets):

- `outputs/qa/2026-10-21-font-selection-before/`
- `outputs/qa/2026-10-21-font-selection-after/`

Each contains native PNGs, tikztosvg SVG/PNG, JS SVG-text SVG/PNG, browser
SVG/PNG, six-panel sheets, source copies, native probe logs, and measurements.
Open `font-audit.html` in the after directory. The primary pair is browser JS
and tikztosvg; the expandable panel includes native PDF, SVG-text, and diffs.
The JSON records source/font/tool hashes, browser version, and diagnostics.
The generation/selection gate is separate from `visualAccepted: false`.

## Verification

```sh
node --test test/font-audit.test.js test/font-identity.test.js \
  test/font-assets.test.js test/font-raster-assets.test.js
npm run check:architecture
npm run docs:links
node scripts/check-font-package.js
node scripts/audit-font-rendering.js \
  --output outputs/qa/2026-10-21-font-selection-after \
  --browser-module /absolute/path/to/local/playwright/index.mjs \
  --browser-channel chrome
```

The focused tests pass (72). The package smoke check extracts a local tarball,
resolves all 53 font faces and licenses, and exercises both embedded and shared
font URLs with zero diagnostics. It does not publish the package.

The full suite is **not green**: 142 existing failures and 14 skipped tests
remain. The final run has 2,711 tests: 2,555 pass, 142 fail, and 14 are skipped.
An isolated unchanged-HEAD run has 2,655 tests: 2,499 pass, the same 142 fail,
and 14 are skipped. No new failing test names were introduced by the font fix.

## Next Slice

Fix the mathematical box model for Greek-letter scripts and compound fractions
against the native hbox probes, then check the affected node/legend anchors in
the browser. Do not compensate with case-specific coordinates or a global
scale. Keep the unchanged plain/monospace fixtures as controls, and keep the
unsupported SVG-text commands visible in the acceptance report.

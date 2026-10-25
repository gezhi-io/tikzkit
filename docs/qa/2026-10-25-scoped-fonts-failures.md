# Scoped Fonts, Spacing and Remaining Failures

## Scope and Outcome

The primary acceptance target is the real fetch/decode/execute diagram: fix
`Instruction fetch` and `Handle interrupts` word spacing, font sizes, row
baselines and node geometry using local MacTeX, then compare actual browser
rendering with local tikztosvg. Shared repairs also address the remaining
21-failure checkpoint. This is not full TikZ compatibility.

The explicit test collection moves from **3058 passed, 21 failed, 14 skipped**
(3093 total) to **3095 passed, 0 failed, 14 skipped** (3109 total). Sixteen tests
were added. Source-backed expectation corrections are listed separately below;
21 fewer failures do **not** mean 21 newly implemented features or 21 fully
matched figures. No tests were disabled or newly skipped.

No npm login, publication, version bump or remote push was attempted. Local
package packing was used only to verify the new font assets.

## Local Sources and Implementation

All TeX references are under `/usr/local/texlive/2025/texmf-dist/`.

| Source | Implementation lesson |
| --- | --- |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex:1129-1186` | `font=` replaces a deferred font program. Centered/ragged text installs `.3333em` spaceskip and `.5em` xspaceskip before body-local font changes; scriptsize does not shrink this already-installed glue. Badly centered/ragged text retains natural font glue. |
| `tikz.code.tex` node hbox and alignment construction | Each alignment row restores its surrounding font; an ordinary hbox shares a baseline across differently sized runs. Grouped font declarations must restore at their closing brace. |
| `tex/latex/base/ot1cmtt.fd:51-82` and local CMTT TFM/PFB files | Sizes 5-8 use cmtt8, 9 uses cmtt9, 10/10.95 use cmtt10, and 12+ use cmtt12. Bold upright typewriter substitutes regular rather than synthesizing weight. Optical selection precedes geometric scaling. |
| `tex/generic/pgf/basiclayer/pgfcorescopes.code.tex:244,309` | Literal text outside TikZ commands is typeset in nullfont. Replace the special-case `TODO` exception with general bare-text handling; unknown control sequences still receive diagnostics. |
| `tex/generic/pgf/modules/pgfmoduleshapes.code.tex:1198-1258`, `pgfcorepoints.code.tex:944` | Circle sizing uses PGF fixed-point normalization, not an ideal floating-point diagonal. |
| `tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex:1515-1886` | Signal paint and outer-miter anchor contours differ. Modern positioning must not add outer separation twice. |
| `tex/latex/base/fontmath.ltx` and CMSY TFM/PFB | The degree circle uses CMSY slot 0E, encoded as openbullet in the generated native font. Explicit math kerns preserve surrounding atom spacing. |
| `tikz.code.tex:628-644`, `pgfcoreshade.code.tex:103-108,881-946` | Shading converts named CMYK colors to RGB before interpolation. Ball stops are 0/9/18/25/50bp. Oblique axis shading scales in physical path bounds before rotation, not in a square SVG box. |
| `tikzlibrarydatavisualization.polar.code.tex:62-124,214-270,332-390`, `tikzlibrarydatavisualization.code.tex:535-605,634-638,890-950,1032`, `tikz.code.tex:4485-4536` | Clean partial polar axes shift 5pt outward, then place 2pt ticks and compass-anchored labels. Inner separation is 1pt; outer `.1666em` is resolved before the deferred 8pt label font. Both quadrant-origin labels survive. |

Independent TeX probes are retained in:

- `test/fixtures/scoped-node-font-metrics.tex`.
- `test/fixtures/remaining-layout-metrics.tex`.
- `test/fixtures/polar-tick-metrics.tex`.
- `test/fixtures/bare-picture-text-metrics.tex`.

The renderer now uses the same native hbox and paragraph runs for measuring and
painting. It preserves fixed paragraph glue, native line breaking and font
restoration rather than applying a horizontal scale to fit reference pixels.
Four new WOFF faces come only from the installed MacTeX CMTT fonts; no external
font download or browser substitute was introduced. The packed consumer loads
all 87 declared faces successfully.

## Commands and Options Checked

| Commands / parameters | Result and boundary |
| --- | --- |
| `tikzpicture`, `node`, `path`, styles, named-node paths | Existing interpretation retained; no reference image substituted for JS output |
| `font`, `text width`, `text centered`, `text badly centered`, `align`, `\\` | Shared scoped-font boxes and paragraph glue for the supported native text subset |
| `\huge`, `\scriptsize`, `\small`, `\bf`, `\bfseries`, `\tt`, `\ttfamily`, grouped declarations | Native row/group restoration and optical fonts; arbitrary NFSS families remain partial |
| `rectangle`, `circle`, `rounded corners`, minimum sizes, `inner sep`, `outer sep` | Native boxes feed shape dimensions; PGF circle arithmetic and signal outer contours repaired |
| `right of`, `below=... of`, `node distance`, `anchor`, `xshift`, `yshift`, `scale` | Physical-unit probes and browser controls retained; no per-case coordinate offsets |
| `color`, `fill`, `textcolor`, `ball color`, `top color`, `bottom color`, `shading angle` | Native color/glue preservation and corrected shading projection |
| `\,`, `\!`, physical hspace markers in rich HTML fallback | No visible private-use spacing markers; full fallback wrapping/math is not accepted |
| `\degree`, `\celsius`, `\ohm`, `\quad`, script styles | Supported native symbols and surrounding math-list glue |
| `scientific polar axes=clean`, degree/radian ticks and radius limits | Clean partial tick anchors improved; broader polar legends/full-circle behavior remains partial |
| Beamer `frame` title plus `chronology` | Title retained; whole-frame visual compatibility explicitly not accepted |

## Browser and Native Evidence

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
References use its local `pdflatex` mode and `rsvg-convert`, plus independent
MacTeX PDF-to-PNG renders. The reference SVGs use glyph paths and `<use>`
placements, physical transforms, separate node paths, and clipping for shaded
fills. They do not use browser paragraph layout. JS remains real SVG text with
embedded native fonts; the rich fallback remains distinct and is not hidden.

Artifacts (relative to the repository):

- `outputs/qa/2026-10-25-scoped-fonts-before/`: original scoped-font comparison.
- `outputs/qa/2026-10-25-scoped-fonts-after/`: intermediate result, including the
  still-failing fetch/decode word-spacing gate and 21-failure test checkpoint.
- `outputs/qa/2026-10-25-scoped-fonts-final/`: six final scoped-font cases.
- `outputs/qa/2026-10-25-remaining-layout-before/`: initial layout controls.
- `outputs/qa/2026-10-25-remaining-layout-final/`: twelve extended controls.
- `outputs/qa/2026-10-25-scoped-fonts-3d-controls/`: seven broader 3D controls.

Each rendered set contains `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`,
`tikztosvg-png/`, and `mactex-png/`. `browser-audit.html` and `browser/` contain
actual Chrome default-JS, tikztosvg, exported SVG-text, and diff panels. Reference
and browser images were inspected, not just their numeric diff summaries.

| Case family | Observed result |
| --- | --- |
| Fetch/decode | Small caption words no longer bunch together; `Instruction fetch` and `Handle interrupts` share the native word gaps. Large headings, caption baselines, colored frames and inter-node placement remain aligned. |
| Paragraph glue controls | Centered versus badly-centered spacing and sentence gaps stay distinct even after `\scriptsize`; shrinking the outer font correctly changes the installed glue. |
| Row/hbox/group controls | Row-local font changes stop leaking; mixed large/small hboxes share the native baseline, and grouped bold/color/size restores correctly. |
| Wrapped prose | The old five-line paragraph becomes the native four lines: `Gerente elige` / `una verifi-` / `cable accion` / `muy larga.` |
| Typewriter/tree | Optical typewriter metrics replace generic width compensation; tree-edge endpoints now respect the native multiline text border. |
| Earth / node shifts / signal | Text anchors and signal spacing agree with independent TeX measurements; signal connections terminate on the correct outer contour. |
| Shading | Yellow no longer inherits a DeviceCMYK solid-color cast; ball highlights and dark edges use the native radial span. The oblique cyan/orange rectangle no longer has an overextended transition. |
| Quarter polar axes | 30/60/90-degree labels use native directional anchors; degree glyphs, both zero labels and the radius-label outward shift match. |
| Half-plane polar control | Axis/tick placement improves, but legend waves, spacing and vertical placement still differ; **not accepted as a whole figure**. |
| Rich HTML spacing | Private-use spacing text is gone. Unsupported parallel-symbol fallback and line breaking still differ; **not accepted as a whole paragraph**. |
| Chronology | The missing title is restored. Event/tick geometry and page layout remain wrong; **not visually complete**. tikztosvg fails on `\usetheme` in its standalone wrapper; the genuine MacTeX PNG is retained without masquerading as tikztosvg output. |

Fourteen font/tick controls pass **360 glyph origins** in both default browser
and SVG-text, using the existing 0.09px tolerance at 3x physical scale. The
fetch/decode maximum origin discrepancy falls from **1.273185px to 0.019293px**;
the largest final gated discrepancy is 0.025925px. Alignment uses one fixed-frame
translation, not independent text fitting, rescaling or adjusted tolerances.
This does not certify all ink pixels or the three partial cases above.

All 18 primary/extended JS cases have zero diagnostics. Seventeen have genuine
tikztosvg SVG/PNG references; the Beamer/chronology failure is explicit in
`tikztosvg-log/remaining-chronology-title.log`. Zero diagnostics alone is not a
visual acceptance criterion.

The seven 3D controls also pass their unchanged 0.35px geometry gates in both
browser modes: axes, ticks, grid segments, label origins and canvas bounds.
The explicit-meta paint check remains exact in computed RGB. Their native and
browser sheets retain the expected clipped/coarse/smooth surfaces without
missing faces or displaced labels; raster edge differences are still visible.
This is a regression control, not newly claimed general 3D support.

## Changed Modules

- `src/tex/{textBox,fontSpec,mathFonts,mathBox,paragraphBox,paragraphBreaking}.js`
  and `src/tikz/{textMetrics,textWrapping}.js`: native boxes, scoped fonts,
  paragraph glue/breaking and mathematical glyph handling.
- `src/engine/evaluate.js`, `src/pgf/points.js`, and the positioning/signal
  library modules: shared geometry and anchors.
- `src/engine/{colors,options}.js` and `src/renderers/svg/{defs,style}.js`:
  source-derived gradient colors and physical projection.
- SVG paragraph/plain/rich-text modules: browser/export parity and explicit
  HTML spacing without private-use markers.
- `src/frontend/{parser,latex-shell}.js` and
  `src/tikz/libraries/datavisualizationPolarTicks.js`: nullfont, frame-title
  retention and clean partial polar tick positioning.
- MacTeX font builder, generated font data/metrics/manifests and four WOFFs;
  module metadata and `docs/extension-registry.{md,csv}`.
- Regression tests/probes/fixtures and the formal npm test entry points.

## Disposition of the 21 Failures

| Original failing test | Disposition |
| --- | --- |
| Automata initial diamond | Obsolete `<polygon>` assertion replaced by a closed, four-sided path check; geometry checks retained |
| Capability visual-gate metadata | Correct existing evidence path; retain partial status |
| Fixture semantic owner | Added missing owner/features for the existing circuitikz fixture |
| Chronology frame title | Fixed title extraction before Beamer unwrapping; broader layout remains open |
| Monospace tree clipping | Native text geometry plus independently measured PGF border points |
| Node shift controls | Corrected stale coordinate guesses: unitless shifts are TeX points, not centimeters |
| Chain join arrow | Check the existing legacy open-circle tip kind rather than an obsolete internal name |
| Earth picture scaling | Use independent native hbox/anchor values, accounting for the inverse picture CTM |
| Bare top-level picture text | General nullfont handling replaces a case-specific TODO exception; unknown-command regression added |
| Package/library declarations | Preserve the truthful partial status instead of asserting builtin completeness |
| GameBoy tiny labels | Test 5pt native glyph size, separating it from the SVG physical transform |
| General drawing gray stroke | Check native xcolor gray output of 191, not the old 192 rounding assumption |
| Ball shading | Correct native stops, colors, radius and focus |
| Math symbol fallback | Assert actual native glyph content rather than obsolete contiguous text serialization |
| Text-width paragraph | Implement native paragraph glue/breaking; verify native four-line result |
| Rich paragraph newlines | Preserve explicit thin spacing without leaking internal markers in HTML |
| Axis shading | Correct CMYK-to-RGB shading conversion and physical rotation span |
| Signal border geometry | Separate paint and anchor contours; remove duplicated outer separation |
| Gensymb symbols | Native CMSY degree mapping and math spacing; verify actual glyph families |
| Quadripole label | Assert native glyph sequence instead of literal TeX in SVG output |
| QuadParConnect labels | Same native-glyph semantic assertion; paths and diagnostics retained |

Additional assertions affected by new CMTT font identities and native font-key
precedence were updated from local NFSS/TikZ evidence. Regression tests for new
behavior were observed failing before implementation. No tolerance was relaxed
to make the browser controls pass.

## Verification

```sh
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-scoped-fonts-final/test-final.json test/*.test.js
npm run test:summary
node scripts/render-example-fixtures.js --fixtures test/fixtures/scoped-node-fonts --output outputs/qa/2026-10-25-scoped-fonts-final --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/scoped-node-fonts --output outputs/qa/2026-10-25-scoped-fonts-final --browser-module <local-playwright-module>
node scripts/render-example-fixtures.js --fixtures test/fixtures/remaining-layout-failures --output outputs/qa/2026-10-25-remaining-layout-final --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --continue-on-external-failure
node scripts/check-font-package.js
node --experimental-vm-modules scripts/check-architecture.js
npm run docs:links
git diff --check
```

For the extended browser audit, select the eleven `remaining-*` cases other
than chronology with repeated `--only` arguments; its reference failed and must
not be counted as a browser/tikztosvg pass. The exact saved browser JSON records
the selected IDs and all gate outcomes.

The npm test scripts now select `test/*.test.js`, the same complete formal
collection used for the failure count. Three argument-driven manual browser
probes remain available under `test/fixtures/` but are no longer accidentally
executed without their required paths. Existing fourteen skips are unchanged.
Architecture validation passes for 487 modules with one unchanged documented
legacy dependency; documentation links, local packed-font consumer and
`git diff --check` pass.

## Remaining Work

- Repair the mixed parallel-symbol paragraph through native symbol coverage and
  paragraph boxes, not a picture-specific line break.
- Replace the half-plane polar legend's fitted sample/spacing with the local
  visualizer example and matrix layout.
- Implement chronology event/tick/page geometry; title presence is not enough.
- Preserve existing 3D/font controls while extending full-circle/non-clean polar
  axes, arbitrary font families and unsupported rich mathematical content.
- The zero unit-failure count is **not** a claim that the whole gallery has
  passed visual review. These known visual residuals remain explicitly open.

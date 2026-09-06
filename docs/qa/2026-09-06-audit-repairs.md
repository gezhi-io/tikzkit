# Audit Repairs and MacTeX Fonts

Follow-up to [the project audit](2026-09-06-project-audit.md). This is a bounded
repair of the reported runtime and acceptance defects, not certification of all
gallery cases or complete TeX compatibility.

## Font Ownership

The package now has a dedicated `src/fonts/` module, public `./fonts` and
`./fonts/*` entries, a generated provenance manifest, and MacTeX-only WOFF
assets. The default SVG embeds fonts used by the rendered families. An external
`fontUrlPrefix` applies to both plain text and HTML math. The six old math TTFs
derived from KaTeX were removed; KaTeX remains a layout dependency only.

Font and renderer assets ship together for version consistency. A second npm
package was not published. Legacy native OTFs remain in the checkout for local
tools but are excluded from the new npm file list. See [font setup](../fonts.md).

## Native Sources Reviewed

Local root: `/usr/local/texlive/2025/texmf-dist`.

- `tex/latex/base/fontmath.ltx`: text/script/scriptscript size triplets;
  display style retains the text-size font; `mathcal` selects the symbols font.
- `tex/latex/base/ot1cmr.fd`, `ot1cmss.fd`, `ot1cmtt.fd`: optical design and
  family selection, rather than assuming every size is a scaled CMR10.
- `tex/latex/amsfonts/amsfonts.sty`: `mathbb` uses AMSb/MSBM and `mathfrak`
  uses Euler. Similar Unicode alphabet names do not imply identical outlines.
- Native AMS Type 1, CM Unicode, LM Math, and TeX Gyre Heros files listed in
  `web/fonts/manifest.json`: outlines, advance widths, delimiter variants, and
  source/asset digests. No font was fetched from the network.
- `tex/latex/base/latex.ltx`: grouping and local/global macro definitions;
  the document environment does not create a normal local macro scope.
- `tex/generic/pgfplots/pgfplots.scaling.code.tex`: 45pt initial label reserve
  and ratio application before projected fitting. The existing compact
  projection calibration is retained: replacing it wholesale caused visual
  regressions. Explicit uniform ratios now follow the same path as the default.
- `tex/generic/pgfplots/pgfplots.code.tex` and
  `pgfplotscoordprocessing.code.tex`: nonfinite samples are discarded by default;
  `unbounded coords=jump` inserts a break. A pole is not a valid zero value.

## Repair Boundaries

| Audit | Repair | Remaining boundary |
| --- | --- | --- |
| R1 | Restricted expression AST; no execution of input as JavaScript | Not a complete hostile-document sandbox |
| R2 | Non-progressing loops rejected; shared expansion budgets | General browser worker cancellation remains future work |
| R3 | Sequential macro expansion, local scope, lazy bodies, globals | Full TeX expansion primitives and declaration-order environments remain partial |
| R4 | Embedded MacTeX fonts and one shared asset prefix | Exact layout and every NFSS substitution remain partial |
| R5 | Structured math failures instead of valid-looking zero coordinates | Unsupported formulas still need explicit diagnostics and coverage |
| R6 | Font-relative lengths use native metrics and scoped font context | Arbitrary external font metrics require explicit support |
| R7 | Equivalent explicit/default ratios have identical sizing | Full PGF projected fitting is not ported |
| R8 | SVG definitions scoped by content or explicit prefix | Callers can still deliberately reuse an explicit prefix |
| R9 | CRLF, tilde/long/nested fences handled | This remains a TikZ fence extractor, not a Markdown renderer |
| R10 | Invalid CLI values rejected | CLI is not a TeX executable replacement |
| Q1 | Reviews bind source, implementation, and evidence digests | Existing reviews require rebinding after inspection |
| Q2 | Missing tools/artifacts block strict reference generation | Local dependencies must be installed separately |
| Q3 | Explicit strict diff mode has a failing exit status | Pixel thresholds do not replace visual review |
| Q4 | Changed sources, assets, options, or tools invalidate comparisons | Legacy artifacts must be regenerated |
| Q5 | Registration compares the union canvas | Alignment still permits bounded translation |
| Q6 | Dependent gnuplot sampling cannot claim independent acceptance | Genuine independent numerical reference remains outstanding |

## Visual Evidence

Local `tikztosvg`: `/Library/TeX/texbin/tikztosvg`, used with the local
pdfLaTeX engine. The smoke runner generates native PNG, tikztosvg SVG/PNG,
TikZKit SVG/PNG, and an HTML browser comparison in
`outputs/mactex-font-audit-2026-09-06/`.

The actual browser comparison exposed and then verified these changes:

- Summation/integral upper and lower limits were clipped. Measured math
  extents now expand the foreign object without inflating every letter by 18%.
- The apparent blackboard R and calligraphic capitals used different LM Unicode
  alphabets. Their primary faces now come from MSBM10 and CMSY10 respectively.
- Typewriter output no longer depends on a KaTeX font URL or a system font.
- A local rasterizer silently substituted sans-serif when given only WOFF.
  Decoding the same WOFF tables to local OpenType restored native text glyphs
  in PNG; the harness now performs this step automatically.

The activation-function legend and B-tree provide real regression context.
Glyphs are visibly improved; matrix/label offsets and B-tree pointer placement
are not certified as pixel-identical by this font repair.

There are 53 generated faces. Repeated font builds were byte-identical; math
WOFF assets were subset from 1,372,856 to 493,444 bytes without changing the
retained outlines or advances. Six missing slots remain explicit in the
manifest (see [font limits](../fonts.md#sizes-and-limits)). The portable-font
case also exposes an existing limitation: complex formulas in `svg-text`
raster output can still contain unsupported literal commands, even where the
default browser HTML math renderer displays the formula correctly.
That browser output still overestimates the widths of long special-symbol
formulas: the portable-font SVG is about 237pt wide against the native 145pt,
and its final two west-anchored formula rows shift right. Glyph availability
and clipping are repaired; horizontal formula measurement is not fully repaired.

The browser comparison was inspected separately from the raster fallback.
`*-browser-native-sheet.png` compares native PNG, tikztosvg PNG, actual Chromium
rendering, and a diff. `*-native-sheet.png` uses the `svg-text` PNG instead.
This distinction prevents the fallback from being mistaken for browser output.

## Reproduce

```bash
npm run font:build
node --test test/font-assets.test.js test/font-raster-assets.test.js test/math-style-scale.test.js
node --test test/runtime-math-safety.test.js test/font-dimension-runtime.test.js test/tex-macro-order-scope.test.js
node --test test/runtime-csp.test.js test/runtime-integration.test.js
node --test test/svg-definition-scope.test.js test/cli-option-validation.test.js test/code-blocks.test.js test/pgfplots-default-ratio.test.js
node --test test/qa-acceptance-gates.test.js
node scripts/render-mactex-font-smoke.js
node scripts/check-font-package.js
```

The independent package check extracts a fresh npm tarball, resolves exported
font assets from that package, and creates a browser consumer without the
development server's asset routes. It does not publish or download a package.

## Final Verification

- Focused font/runtime/macro/CLI/Markdown/definition/QA checks: **100/100 pass**.
- Web server checks, including evidence-cache invalidation: **6/6 pass**.
- All **658** manifest fixtures convert without error-level diagnostics. This
  is a pipeline check, not a visual acceptance of all 658 diagrams.
- Full suite: **2,609 tests; 2,453 pass, 142 fail, 14 skip**. The audit baseline
  was 2,512 tests with 148 failures. No newly failing test names remain. Five
  baseline failures were sandbox-only server binding errors; running the final
  suite with local-port permission is not a product fix for those five.
- Full/focused logs and the exact remaining failure list are saved under
  `outputs/mactex-font-audit-2026-09-06/` as `full-tests.log`,
  `focused-tests.log`, and `test-summary.json`.
- A fresh packed browser bundle renders both embedded-font and shared-font
  diagrams under `script-src 'self'`, without `unsafe-eval`. Two declared arrow
  tips render; no font loads fail or go to an external origin. The shared
  formula SVG is 50,455 bytes versus 1,369,296 bytes with embedded families.
- Documentation links and source-code whitespace checks pass. Imported font
  licenses and notices retain upstream whitespace verbatim. These checks
  preceded the v0.1.5 release; verification itself did not publish or push changes.

The original 228 review records require individual reinspection before binding;
old passing image comparisons must be regenerated. Full-suite failures,
horizontal math measurement, six uncovered symbol slots, and complex
`svg-text` formulas remain work, not accepted deliverables.

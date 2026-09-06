# Datavisualization function pin and outside scatter legend

## Scope

This pass covers one verifiable slice of `datavisualization` and
`datavisualization.formats.functions`:

- source-ordered function sampling for the Gaussian line;
- `when=x is 1` selection and the default normal `pin in data`;
- scatter `mark=*`, `mark size=1.4pt`, and PGF-style random expressions;
- `legend={south east outside}` with a mixed prose/math label.

It does not claim the complete PGF data-visualization object system.

## Local source review

Reviewed these TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledatavisualization.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.formats.functions.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/datavisualization/pgflibrarydatavisualization.formats.functions.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-dv-formats.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-dv-visualizers.tex`

The label visualizer records the current and preceding canvas positions. A
`when` threshold stops on the first source-ordered point at or above the
threshold. The default pin shifts the auto-anchored node by 3ex along the
screen-space normal, then clips the appended edge at the node border. The
south-east outside legend is a one-column matrix anchored south-west at the
data bounding box's south-east corner with physical em offsets.

## References and artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; MacTeX used
`/Library/TeX/texbin/pdflatex`. The after directory contains all references:

- `outputs/qa/2026-09-06-datavisualization-pin-scatter-after/tikzkit-svg/`
- `outputs/qa/2026-09-06-datavisualization-pin-scatter-after/tikzkit-png/`
- `outputs/qa/2026-09-06-datavisualization-pin-scatter-after/tikztosvg-svg/`
- `outputs/qa/2026-09-06-datavisualization-pin-scatter-after/tikztosvg-png/`
- `outputs/qa/2026-09-06-datavisualization-pin-scatter-after/mactex-png/`
- `outputs/qa/2026-09-06-datavisualization-pin-scatter-after/diff/`

The four-panel native sheet is
`diff/datavisualization-scatter-south-east-outside-native-sheet.png`.
The matching `before` directory preserves the pre-fix rendering.

## Visual result

Before the fix, the browser's mixed legend label ignored its explicit west
anchor, centered its foreign object over the requested point, and rendered
inline formula fragments 21% larger than the surrounding prose. That pulled
the long sum left over the scatter sample and widened the browser SVG, so the
axes were visibly smaller than `tikztosvg`.

After the fix, the marker, sum, and prose form one left-anchored row at the
south-east outside position; subscripts and superscripts retain their math
layout without changing the prose size. The browser SVG width moved from
332.52pt to 306.19pt, close to the 304.251pt `tikztosvg` reference. The
Gaussian leader moved from `(2.900,0.881)--(3.347,0.963)` to
`(2.900,0.881)--(3.349,1.060)`; the local native endpoint is approximately
`(3.347,1.051)`. The formula now sits above and to the right of that clipped
edge like the native auto node.

Unseeded scatter points differ between independent MacTeX and `tikztosvg`
processes because PGF chooses a process seed. Seeded `\pgfmathsetseed` cases
remain deterministic.

## Verification

Commands:

```sh
node --test --test-name-pattern='expands datavisualization function data into|uses screen-space pin distance|supports datavisualization pin in data text prime|places datavisualization text-prime|renders repeated datavisualization pin|supports datavisualization smooth line list visualizers with function sets' test/extensions.test.js
node --test --test-name-pattern='preserves grouped vector macros in mixed KaTeX rich text|positions mixed KaTeX text|includes KaTeX rich text|sizes scoped KaTeX' test/renderer.test.js
node --test --test-name-pattern='semantic audit assigns datavisualization function values' test/case-semantic-audit.test.js
node scripts/case-semantic-audit.js test/fixtures/examples/workbench/datavisualization-scatter-south-east-outside.tex --review test/fixtures/examples/workbench/datavisualization-scatter-south-east-outside.review.json --strict
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-06-datavisualization-pin-scatter-after --only datavisualization-scatter-south-east-outside --continue-on-external-failure --strict-tikztosvg --native-reference --native-latex-engine pdflatex --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-06-datavisualization-pin-scatter-after --register
npm test
```

The focused tests pass, all three renderers produced artifacts, diagnostics
remain zero, and the browser comparison was inspected at the fixture anchor.
The semantic audit accepts all 9 commands, 3 option paths, and 13 numeric
values with no remaining review items or blockers.
The full suite reports 2,360 passing, 135 existing failures, and 14 skipped
tests out of 2,509; the failure count did not increase from the 136-failure
pre-change baseline.

## Remaining boundary

Custom `pgfooclass` visualizers, arbitrary signal routing, and exact general
legend matrix packing are still partial. A future slice should implement one
of those with its own native case rather than broadening this acceptance gate.

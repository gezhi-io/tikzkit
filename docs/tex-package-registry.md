# TeX Package Registry

Generated from the merged core gallery (1561 cases). One observed \usepackage name maps to one file under `src/packages/<name>.js`.

## MacTeX Source Notes

- `pgfplots.sty` requires `graphicx` and `tikz`, then inputs `pgfplots.code.tex`; TikZKit implements this as a PGFPlots preprocessor slice instead of executing TeX macros, including common numeric tick-distance keys.
- `pgfplotstable.sty` requires `pgfplots`, inputs `pgfplotstable.code.tex`, then requires `array`; TikZKit currently uses table reads as data sources for `\addplot table`.
- `mathtools.sty` requires `keyval`, `calc`, `mhsetup`, then `amsmath`; TikZKit treats it as math rendering/macro compatibility and now expands `\DeclareMathOperator` into `\operatorname`, including SVG text fallback rendering.

## Packages

| package | cases | status | local source | implementation |
| --- | ---: | --- | --- | --- |
| `amsbsy` | 2 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsbsy.sty` | src/tex-text.js + src/renderer-svg.js |
| `amsfonts` | 1 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/amsfonts/amsfonts.sty` | src/math-metrics.js + src/renderer-svg.js |
| `amsmath` | 38 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty` | src/math-metrics.js + src/renderer-svg.js + src/preprocess.js:parseDeclareMathOperator |
| `amssymb` | 14 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/amsfonts/amssymb.sty` | src/math-metrics.js + src/renderer-svg.js |
| `amsthm` | 1 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/amscls/amsthm.sty` | src/preprocess.js:stripTexDocumentShell |
| `appendixnumberbeamer` | 1 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/appendixnumberbeamer/appendixnumberbeamer.sty` | src/preprocess.js:stripTexDocumentShell |
| `array` | 2 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/array.sty` |  |
| `babel` | 10 | noop | `/usr/local/texlive/2025/texmf-dist/tex/generic/babel/babel.sty` | src/preprocess.js:stripTexDocumentShell |
| `bm` | 5 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/bm.sty` | src/tex-text.js + src/renderer-svg.js |
| `booktabs` | 5 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/booktabs/booktabs.sty` |  |
| `braids` | 2 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/braids/braids.sty` | src/preprocess.js:expandBraidMacros |
| `calc` | 2 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/calc.sty` |  |
| `cfr-lm` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/cfr-lm/cfr-lm.sty` |  |
| `chemformula` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/chemformula/chemformula.sty` |  |
| `chronology` | 1 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/chronology/chronology.sty` | src/preprocess.js:expandChronologyEnvironments |
| `circuitikz` | 486 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/circuitikz/circuitikz.sty` | src/interpreter.js:appendCircuitikzToSegment |
| `color` | 3 | builtin | `/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/color.sty` | src/preprocess.js:collectColorDefinitions + src/tex-text.js |
| `colortbl` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/colortbl/colortbl.sty` |  |
| `comment` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/comment/comment.sty` |  |
| `contour` | 7 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/contour/contour.sty` | src/tex-text.js + src/renderer-svg.js |
| `drawstack` | 2 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/drawstack/drawstack.sty` |  |
| `enumitem` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/enumitem/enumitem.sty` |  |
| `etoolbox` | 4 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/etoolbox/etoolbox.sty` | src/preprocess.js toggle compatibility |
| `eulervm` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/eulervm/eulervm.sty` |  |
| `filecontents` | 3 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/filecontents/filecontents.sty` | src/preprocess.js:collectFilecontentsTables |
| `fontenc` | 7 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/base/fontenc.sty` | src/preprocess.js:stripTexDocumentShell |
| `forest` | 3 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/forest/forest.sty` | src/extensions/forest.js |
| `fourier` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/fourier/fourier.sty` |  |
| `fp` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/fp/fp.sty` |  |
| `fullpage` | 2 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/preprint/fullpage.sty` |  |
| `geometry` | 36 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/geometry/geometry.sty` | src/preprocess.js:stripTexDocumentShell |
| `graphicx` | 5 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/graphicx.sty` | src/tex-text.js + src/preprocess.js |
| `hyperref` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/hyperref/hyperref.sty` |  |
| `ifthen` | 2 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/base/ifthen.sty` |  |
| `inputenc` | 20 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/base/inputenc.sty` | src/preprocess.js:stripTexDocumentShell |
| `keyval` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/keyval.sty` |  |
| `latexsym` | 6 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latexsym.sty` | src/tex-text.js + src/renderer-svg.js |
| `lipsum` | 3 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/lipsum/lipsum.sty` |  |
| `lmodern` | 2 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/lm/lmodern.sty` | src/tikz-metrics.js:TIKZ_FONT_FAMILY |
| `makecell` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/makecell/makecell.sty` |  |
| `mathrsfs` | 1 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/jknapltx/mathrsfs.sty` | src/renderer-svg.js |
| `mathtools` | 23 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/mathtools/mathtools.sty` | src/math-metrics.js + src/renderer-svg.js + src/preprocess.js:parseDeclareMathOperator |
| `microtype` | 3 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/microtype/microtype.sty` |  |
| `multirow` | 3 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/multirow/multirow.sty` |  |
| `neuralnetwork` | 1 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/neuralnetwork/neuralnetwork.sty` | src/extensions/neuralnetwork.js |
| `pgf` | 4 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/basiclayer/pgf.sty` | src/preprocess.js + src/interpreter.js |
| `pgfcalendar` | 313 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/utilities/pgfcalendar.sty` | src/parser.js noop compatibility |
| `pgfgantt` | 311 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty` | src/preprocess.js:expandPgfganttCharts |
| `pgfmath` | 4 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/math/pgfmath.sty` | src/math.js + src/preprocess.js |
| `pgfplots` | 371 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty` | src/preprocess.js:expandPgfplotsAxes |
| `pgfplotstable` | 314 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplotstable.sty` | src/preprocess.js:collectPgfplotstableReads |
| `pifont` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/psnfss/pifont.sty` |  |
| `preview` | 36 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/preview/preview.sty` | src/preprocess.js:stripTexDocumentShell |
| `PTSansNarrow` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/paratype/PTSansNarrow.sty` |  |
| `ragged2e` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/ragged2e/ragged2e.sty` |  |
| `relsize` | 4 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/relsize/relsize.sty` | src/tex-text.js |
| `showframe` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/eso-pic/showframe.sty` |  |
| `sidecap` | 3 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/sidecap/sidecap.sty` |  |
| `siunitx` | 4 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/siunitx/siunitx.sty` | src/tex-text.js + src/interpreter.js circuitikz labels |
| `stanli` | 219 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/stanli/stanli.sty` | src/extensions/stanli.js |
| `sunitx` | 1 | partial |  | src/tex-text.js |
| `tabularx` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/tabularx.sty` |  |
| `tcolorbox` | 2 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/tcolorbox/tcolorbox.sty` |  |
| `textcomp` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/base/textcomp.sty` |  |
| `tikz` | 1077 | builtin | `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty` | src/parser.js + src/interpreter.js + src/renderer-svg.js |
| `tikz-3dplot` | 15 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-3dplot/tikz-3dplot.sty` | src/extensions/tikz-3dplot.js |
| `tikz-bagua` | 5 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-bagua/tikz-bagua.sty` | src/extensions/tikz-bagua.js |
| `tikz-cd` | 2 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-cd/tikz-cd.sty` | src/extensions/tikz-cd.js |
| `tikz-decofonts` | 2 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-decofonts/tikz-decofonts.sty` | src/extensions/tikz-decofonts.js |
| `tikz-dimline` | 1 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-dimline/tikz-dimline.sty` | src/extensions/tikz-dimline.js |
| `tikz-feynhand` | 1 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-feynhand/tikz-feynhand.sty` | src/extensions/tikz-feynhand.js |
| `tikz-feynman` | 4 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-feynman/tikz-feynman.sty` | src/extensions/tikz-feynman.js |
| `tikz-network` | 7 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-network/tikz-network.sty` | src/extensions/tikz-network.js |
| `tikz-palattice` | 1 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-palattice/tikz-palattice.sty` | src/extensions/tikz-palattice.js |
| `tikz-qtree` | 1 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikz-qtree/tikz-qtree.sty` | src/extensions/tikz-qtree.js |
| `tikz-uml` | 1 | unsupported |  |  |
| `tikzfxgraph` | 1 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikzfxgraph/tikzfxgraph.sty` | src/extensions/tikzfxgraph.js |
| `tikzpeople` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikzpeople/tikzpeople.sty` |  |
| `tikzquads` | 1 | extension | `/usr/local/texlive/2025/texmf-dist/tex/latex/tikzquads/tikzquads.sty` | src/extensions/tikzquads.js |
| `times` | 4 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/psnfss/times.sty` | src/tikz-metrics.js:TIKZ_FONT_FAMILY |
| `tkz-berge` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-berge/tkz-berge.sty` |  |
| `tkz-fct` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty` |  |
| `tkz-graph` | 5 | partial | `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-graph/tkz-graph.sty` | src/preprocess.js:expandTkzGraphMacros |
| `ulem` | 2 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/generic/ulem/ulem.sty` |  |
| `units` | 1 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/units/units.sty` |  |
| `verbatim` | 50 | noop | `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/verbatim.sty` | src/preprocess.js:stripTexDocumentShell |
| `xcolor` | 333 | builtin | `/usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty` | src/preprocess.js:collectColorDefinitions |
| `xspace` | 3 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/xspace.sty` |  |
| `xstring` | 2 | unsupported | `/usr/local/texlive/2025/texmf-dist/tex/generic/xstring/xstring.sty` |  |

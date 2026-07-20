# LaTeX-examples New 30: Capability and Visual Acceptance

## Scope and evidence

- Authoritative case list: `outputs/qa-new30-final/summary.json` (`total: 30`).
- Source of truth for syntax inventory: the corresponding `test/fixtures/examples/<source>` file named by each summary entry.
- Visual evidence: `outputs/qa-new30-final/diff/<id>-sheet.png`; panels are TikZKit, `tikztosvg`, and visual diff. The numeric diff is supporting evidence only.
- Diagnostics evidence: the `diagnostics` array recorded per case in `outputs/qa-new30-final/summary.json`.
- This document describes the complete batch regenerated on 2026-07-20 under `outputs/qa-new30-final`; all 30 current three-panel sheets were viewed after regeneration.

### Acceptance labels

- **Passed**: required elements, geometry, coordinates, labels, fonts, styles, arrows, clipping, and paint order are visually aligned; diagnostics are empty; the SVG canvas is within 1.5pt of the native reference. A `different` pixel result is allowed only when inspection confirms that the residual is glyph/stroke rasterization rather than a semantic or placement error.
- **Needs repair**: a required semantic feature or reference artifact is missing/broken, so the case cannot be accepted visually.

Current count: **30 passed, 0 needs repair**. All 30 cases record `diagnostics: []`; the raw PNG comparator reports 14 `same`, 16 `different`, and 0 missing. Every one of the 16 non-identical sheets was inspected to rule out missing or displaced content. `test/latex-examples-new30-acceptance.test.js` verifies the complete list and native canvas contract.

### Local implementation references reviewed

- MacTeX xcolor source: `/usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty`. The built-in natural models are RGB for names such as `red`/`green`/`blue`, CMYK for `cyan`/`magenta`/`yellow`, and gray for `black`/`gray`/`white`; an expression such as `cyan!50!black` is mixed in the first color's model.
- Local `tikztosvg`: `/Library/TeX/texbin/tikztosvg`. It compiles through LaTeX and converts PDF to SVG, so DeviceCMYK colors follow the PDF converter's CMYK-to-RGB matrix rather than browser CSS named colors.
- Calibration artifacts: `outputs/qa-color-model/cmyk-color-test.tex` and `outputs/qa-color-model/cmyk-color-test.svg`. They pin the exact local reference values for cyan, magenta, yellow, and their 50% black mixtures.
- TikZKit implementation: `src/engine/options.js` now preserves natural color models during xcolor mixing; `src/frontend/latex-shell.js` lowers `\definecolor` in `cmyk`/`CMYK`; the matching unit coverage is in `test/options.test.js` and `test/frontend.test.js`.
- MacTeX sans-math source: `/usr/local/texlive/2025/texmf-dist/tex/latex/sansmath/sansmath.sty`. Its `eulergreek` option remaps lower-case Greek only (lines 71-93 and 134-160); `\mathcal` remains the Computer Modern Symbols alphabet, so LDA distribution labels must use a CMSY-compatible calligraphic face rather than Euler or Helvetica.
- SVG rasterizer calibration: `outputs/qa-lda-namespaced-fonts/font-probe.svg` and `font-probe-fontconfig.png`. On macOS, Pangocairo otherwise selects CoreText and silently falls back to Helvetica even when `fc-match` resolves the namespaced font. `scripts/render-example-fixtures.js` now exports `PANGOCAIRO_BACKEND=fontconfig`, which makes `rsvg-convert` use the bundled namespaced Computer Modern text, math-italic, and calligraphic fonts.
- MacTeX optical text sources: `/usr/local/texlive/2025/texmf-dist/fonts/type1/public/amsfonts/cm/cmr5.pfb` through `cmr17.pfb`, and `cmbx5.pfb` through `cmbx12.pfb`. `scripts/build-cm-optical-fonts.py` converts these to namespaced browser OTF assets, preserves TeX design-size selection, and maps U+0020 to a blank spacing glyph instead of the Type1 `suppress` slot.

## Shared capability summary

The 30 cases jointly exercise these implemented capability families:

- **Document and TeX-lite preprocessing:** `\usepackage`, package options, `\newcommand`, `\pgfmathsetmacro`, `\pgfmathdeclarefunction`, macro expansion, `\foreach`, integer `Mod`, arithmetic, `sqrt`, `exp`, and basic font-size/font-family switches.
- **Core TikZ paths:** `\draw`, `\path`, `\node`, `\coordinate`, line segments, `to`, `|-`, cubic Bezier controls, `cycle`, circles, ellipses, rectangles, grids, inline path nodes, and named-node anchors.
- **Styles and scopes:** `\tikzset`, legacy `\tikzstyle`, named styles, `.style`, `.append style`, `every path`, `every node`, `every axis label`, nested scopes, `shift`, `rotate`, `scale`, `xscale`, `yscale`, line width/dash/color/fill, and mixed xcolor colors.
- **Node layout:** rectangles, rounded rectangles, diamonds, `text width`, multiline wrapping, centering modes, minimum dimensions, `inner sep`, `node distance`, `right/below of`, anchors, and `above/right/left/below` placement.
- **Coordinates:** Cartesian and polar coordinates, named coordinates, `calc` arithmetic, `axis cs`, `axis description cs`, `|-`, and node anchors.
- **Arrows:** legacy `arrows` tips (`latex`, `latex'`, `stealth'`, triangle-style tips), `arrows.meta` `Latex` tips with length/width, bidirectional arrows, and line shortening.
- **Decorations:** recursive `decorations.fractals` Koch snowflake, `decorations.pathreplacing` braces, and `decorations.text` text along a path.
- **PGFPlots 2D axes:** dimensions/ranges, middle axes, grids, major/minor ticks, explicit/empty ticks, tick labels and styles, labels, legend layout, clipping, axis-on-top behavior, axis-coordinate nodes/paths, and plots from functions, coordinates, and CSV tables.
- **PGFPlots math and plots:** domains, samples/samples-at, Gaussian functions, standard functions, marks and mark options, plot styles, multiple series, custom tick formatting, percentages, and legends.
- **Dateplot/table data:** date-coordinate conversion, `date ZERO`, year labels, `xtick=data`, CSV column mapping, German text, date-axis scaled-tick suppression, and triangle/square/x plot marks.
- **tkz-fct compatibility slice:** `\tkzInit`, `\tkzGrid`, and `\tkzAxeXY` used as a 2D Cartesian scaffold.

## Per-case acceptance

### 1. `latex-examples-flowchart`

- **Source:** `latex-examples/flowchart.tex`
- **Packages/libraries:** `gensymb`, `inputenc[utf8]`, `babel[ngerman]`, `fontenc[T1]`, `tikz`; TikZ libraries `shapes`, `arrows`; no PGFPlots library.
- **Main commands:** `\tikzstyle`, `\node`, `\path`; named nodes and inline edge labels.
- **Key parameters/styles:** `diamond`, `rectangle`, `fill=blue!20`, `text width`, `text badly centered`/`text centered`, `rounded corners`, `minimum height`, `node distance`, `right of`, `below of`, `auto`, `-latex'`, `--`, and `|-`.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. All blocks, seven connectors, arrowheads, labels, multiline wrapping, and orthogonal routing align. The 604x281 JS image is one pixel wider than the 603x281 reference; inspection confines the residual to text, rounded-corner, and arrow-tip raster edges.

### 2. `latex-examples-koch-snowflake`

- **Source:** `latex-examples/koch-snowflake.tex`
- **Packages/libraries:** `tikz`, `pgfplots`; TikZ library `decorations.fractals`; no PGFPlots library.
- **Main commands:** `\draw` with four nested `decorate` operations.
- **Key parameters/styles:** picture `scale=3`, `decoration=Koch snowflake`, recursive decoration expansion, `fill=gray!10`, closed polygon path.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. The recursion depth, outline, fill, orientation, and 367x439 dimensions match. The diff is confined to antialiasing along the fine fractal boundary; no segment is missing or displaced.

### 3. `latex-examples-lda-gauss-1`

- **Source:** `latex-examples/lda-gauss-1.tex`
- **Packages/libraries:** `preview`, `inputenc[latin1]`, `amsmath`, `pgfplots`, `tikz`, `helvet`, `sansmath[eulergreek]`; TikZ libraries `arrows`, `positioning`; no PGFPlots library.
- **Main commands:** `\pgfmathdeclarefunction`, `\pgfmathparse`, `\pgfmathsetmacro`, `\newcommand`, `\pgfplotsset`, `\tikzstyle`, `\coordinate`, `\draw`, `\node`, `\addplot`.
- **Key parameters/styles:** Gaussian formula using `sqrt`, `pi`, `exp`; `axis cs`, `|-`; `grid=major`, middle axes, explicit x ticks, empty y ticks, disabled scaled y ticks, `axis on top`, sans-serif tick/axis fonts, sampled curves and points, dashed guide lines, `red!90!black` and `cyan!50!black`.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Both Gaussian curves, sampled marks, guides, labels, axes, and ticks align. The model-aware `cyan!50!black` color and Computer Modern `\mathcal{N}` match the reference design; both PNGs are exactly 480x289. Remaining pixels are font/stroke rasterization.

### 4. `latex-examples-lda-gauss-2`

- **Source:** `latex-examples/lda-gauss-2.tex`
- **Packages/libraries:** `preview`, `inputenc[latin1]`, `amsmath`, `pgfplots`, `tikz`, `helvet`, `sansmath[eulergreek]`; TikZ libraries `arrows`, `positioning`; no PGFPlots library.
- **Main commands:** Gaussian math declarations/macros, `\pgfplotsset`, `\addplot`, `\node`; the source also defines `\pgfplotsdrawaxis` and an `after end axis` style.
- **Key parameters/styles:** `axis line on top`, transparent/opaque axis redraw intent, `grid style={thin,dashed}`, computed `ymax=\plotheight`, middle axes, custom axis-label placement/font, `domain`, `samples=200`, named plot styles.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Narrow and wide Gaussian profiles, grids, labels, and the opaque post-plot axis redraw align, and the CMYK-derived blue-gray matches. `\mathcal{N}` uses the namespaced Computer Modern calligraphic face; both PNGs are 480x289.

### 5. `latex-examples-lda-gauss-intervariance`

- **Source:** `latex-examples/lda-gauss-intervariance.tex`
- **Packages/libraries:** `preview`, `inputenc[latin1]`, `amsmath`, `pgfplots`, `tikz`, `helvet`, `sansmath[eulergreek]`; TikZ libraries `arrows`, `positioning`; no PGFPlots library.
- **Main commands:** Gaussian declaration, `\pgfplotsset`, `\tikzset`, `\coordinate`, `\draw`, `\addplot`, `\node`.
- **Key parameters/styles:** two equal-variance Gaussian curves at means 40/50, middle axes, grid, mean guide lines, `<->` mean-distance arrow, `axis cs`, `|-`, `>=latex`, `samples=400`, large colored distribution labels.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. The two peaks, overlap, mean lines, short double arrow, series colors, calligraphic labels, and 480x289 canvas align. The residual is limited to glyph and stroke rasterization.

### 6. `latex-examples-lda-gauss-intervariance-big`

- **Source:** `latex-examples/lda-gauss-intervariance-big.tex`
- **Packages/libraries:** `preview`, `inputenc[latin1]`, `amsmath`, `pgfplots`, `tikz`, `helvet`, `sansmath[eulergreek]`; TikZ libraries `arrows`, `positioning`; no PGFPlots library.
- **Main commands:** Gaussian declaration, PGFPlots style setup, coordinates, guide-line draws, function plots, and label nodes.
- **Key parameters/styles:** equal variance 40, means 40/80, two vertical mean lines, long `<->` separation arrow, middle axes, dashed major grid, `samples=400`, sans math/text styling.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Peak locations, curve widths, mean lines, separation arrow, series colors, calligraphic labels, and 480x289 canvas align. The remaining diff is text/stroke antialiasing.

### 7. `latex-examples-lda-gauss-variance-big`

- **Source:** `latex-examples/lda-gauss-variance-big.tex`
- **Packages/libraries:** `preview`, `inputenc[latin1]`, `amsmath`, `pgfplots`, `tikz`, `helvet`, `sansmath[eulergreek]`; TikZ libraries `arrows`, `positioning`; no PGFPlots library.
- **Main commands:** custom Gaussian and scalar macros, `\pgfmathsetmacro`, PGFPlots style setup, `\coordinate`, `\draw`, `\addplot`, `\node`.
- **Key parameters/styles:** means 40/80, variances 800/800, computed peak and plot height, `sqrt(\varI)` arrow endpoints, broad curves, middle axes, disabled y ticks/scaling, `samples=100`.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Broad Gaussian geometry, mean markers, variance arrow, colors, calligraphic labels, and exact 480x289 dimensions are correctly scaled and aligned. Remaining pixels are rasterization noise.

### 8. `latex-examples-lda-gauss-variance-small`

- **Source:** `latex-examples/lda-gauss-variance-small.tex`
- **Packages/libraries:** `preview`, `inputenc[latin1]`, `amsmath`, `pgfplots`, `tikz`, `helvet`, `sansmath[eulergreek]`; TikZ libraries `arrows`, `positioning`; no PGFPlots library.
- **Main commands:** custom Gaussian/macros, PGFPlots style setup, coordinates, draws, sampled plots, and labels.
- **Key parameters/styles:** means 40/80, variances 40/40, tall narrow peaks, computed range/label height, `<->` standard-deviation span, `samples=400`, middle axes and custom label placement.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Narrow peaks, variance span, colors, calligraphic labels, and exact 480x289 dimensions align with the reference. Residual differences are limited to glyph and curve/stroke antialiasing.

### 9. `latex-examples-line-reflection`

- **Source:** `latex-examples/line-reflection.tex`
- **Packages/libraries:** `tkz-fct`; TikZ libraries `arrows`, `decorations.pathreplacing`; no PGFPlots library.
- **Main commands:** `\tkzInit`, `\tkzGrid`, `\tkzAxeXY`, `\draw`, `\node`.
- **Key parameters/styles:** 0..7.8 by 0..9.5 axes, gray mixed-color grid, green line and rotated formula label, red dashed reflected line, filled points, horizontal guide, four decorated braces with `amplitude`, `mirror`, `raise`, `midway`, and x/y shifts.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Coordinate system, lines, points, labels, and all four braces align on an identical 333x398 canvas. The residual is confined to brace, point, glyph, and stroke raster edges.

### 10. `latex-examples-line-segments-bounding-box`

- **Source:** `latex-examples/line-segments-bounding-box.tex`
- **Packages/libraries:** `gensymb`, `preview[pdftex,active,tightpage]`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`; no PGFPlots library.
- **Main commands:** `\tikzset`, `\newcommand`, `\draw`, `\coordinate`, `\path`, inline nodes.
- **Key parameters/styles:** macro arithmetic in coordinates, `<->` red axes, `grid` with `step=0.5cm`, orange filled bounding rectangles, custom `to path`, `\tikztotarget`, `\tikztonodes`, `cross out` point nodes, minimum size and line widths.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Dimensions are identical and the two segments, boxes, grid, axes, endpoint crosses, fills, and strokes coincide; only negligible antialias pixels remain.

### 11. `latex-examples-line-segments-f1`

- **Source:** `latex-examples/line-segments-f1.tex`
- **Packages/libraries:** `gensymb`, `preview[pdftex,active,tightpage]`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`; no PGFPlots library.
- **Main commands:** `\tikzset`, scalar macros, `\draw`, `\coordinate`, `\path` with endpoint nodes.
- **Key parameters/styles:** positive-slope collinear overlapping segments `(3,4)-(4,5)` and `(2,2)-(6,6)`, half-centimeter grid, red bidirectional axes, custom `line`/`point` styles and `cross out` endpoints.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Geometry, endpoint locations, overlap, grid, axes, strokes, and dimensions coincide.

### 12. `latex-examples-line-segments-f2`

- **Source:** `latex-examples/line-segments-f2.tex`
- **Packages/libraries:** same line-segment stack: `gensymb`, `preview`, `tikz`; `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** styles/macros, coordinate declarations, path drawing, endpoint-node path.
- **Key parameters/styles:** negative-coordinate range, two parallel descending segments `(-4,4)-(-2,1)` and `(-2,3)-(0,0)`, `step=0.5cm` grid, bidirectional red axes, cross endpoints.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Both segments, negative coordinate placement, grid origin, axes, and endpoint marks match; residual pixels are antialias-only.

### 13. `latex-examples-line-segments-f3`

- **Source:** `latex-examples/line-segments-f3.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** styles/macros, `\coordinate`, `\draw`, `\path`.
- **Key parameters/styles:** two vertical unit segments at x=0 and x=2, half-centimeter grid, shared line/point styles, red axes and arrow tips.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Geometry and 105x143 dimensions match exactly. The comparator residual consists only of endpoint-cross, arrow, and line-edge antialias pixels, with no missing element or displacement.

### 14. `latex-examples-line-segments-f4`

- **Source:** `latex-examples/line-segments-f4.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** styles/macros, named coordinates, draws, endpoint path nodes.
- **Key parameters/styles:** vertical segment on x=0 and horizontal segment y=2, half-centimeter grid, red axes, cross endpoints.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Dimensions and all construction geometry coincide; only negligible raster-edge noise remains.

### 15. `latex-examples-line-segments-f5`

- **Source:** `latex-examples/line-segments-f5.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** styles/macros, coordinates, draws, endpoint-node path.
- **Key parameters/styles:** separated collinear diagonal segments from `(-1,-1)` to `(2,2)` and `(3,3)` to `(5,5)`, negative range, half-centimeter grid, red axes, crosses.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Segment gap, slopes, endpoints, grid, axes, and canvas size match.

### 16. `latex-examples-line-segments-f6`

- **Source:** `latex-examples/line-segments-f6.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** shared styles/macros, named coordinates, line draws, endpoint-node path.
- **Key parameters/styles:** intersecting segments `(0,0)-(1,1)` and `(0.5,2)-(2,0)`, 0.5 cm grid, red axes, custom `to path`, cross endpoints.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Intersection, slopes, endpoints, grid, axes, and dimensions coincide.

### 17. `latex-examples-line-segments-f7`

- **Source:** `latex-examples/line-segments-f7.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** shared styles/macros, coordinate declarations, draws, endpoint nodes.
- **Key parameters/styles:** two parallel horizontal segments at y=1 and y=2, half-centimeter grid, bidirectional red axes, cross marks.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Horizontal placement, lengths, endpoint marks, grid, and canvas match.

### 18. `latex-examples-line-segments-f8`

- **Source:** `latex-examples/line-segments-f8.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** styles/macros, coordinates, draw/path commands.
- **Key parameters/styles:** short vertical segment `(2,2)-(2,1)` crossed by long descending `(0,4)-(5,0)`, half-centimeter grid, red axes, point crosses.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Both segments, crossing relation, endpoints, grid, axes, and dimensions align.

### 19. `latex-examples-line-segments-t2`

- **Source:** `latex-examples/line-segments-t2.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** shared line/point styles, macros, named coordinates, draws and endpoint nodes.
- **Key parameters/styles:** two rays-as-segments sharing neither endpoint, `(0,0)-(5,5)` and `(1,1)-(8,2)`, half-centimeter grid, red axes.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Slopes, intersection at `(1,1)`, endpoint crosses, grid, and dimensions coincide.

### 20. `latex-examples-line-segments-t3`

- **Source:** `latex-examples/line-segments-t3.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** shared styles/macros, coordinates, draws, path nodes.
- **Key parameters/styles:** vertical segment at x=-1 and horizontal segment ending at origin, negative range, half-centimeter grid, red axes.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Negative-coordinate layout, segment contact, axes, grid, and point marks match.

### 21. `latex-examples-line-segments-t4`

- **Source:** `latex-examples/line-segments-t4.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** shared style/macro definitions, coordinate declarations, draws and endpoint nodes.
- **Key parameters/styles:** vertical segment `(2,4)-(2,0)` and horizontal `(0,2)-(2,2)`, half-centimeter grid, red axes, cross endpoints.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. T-junction geometry, grid, axes, endpoints, and dimensions coincide.

### 22. `latex-examples-line-segments-t5`

- **Source:** `latex-examples/line-segments-t5.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** shared styles/macros, coordinates, two colored draws, endpoint path nodes.
- **Key parameters/styles:** red long diagonal `(5,5)-(0,0)` and blue contained segment `(1,1)-(3,3)`, overpainting order, half-centimeter grid and red axes.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Coincident colored segments, paint order, endpoint crosses, grid, and dimensions match.

### 23. `latex-examples-line-segments-t6`

- **Source:** `latex-examples/line-segments-t6.tex`
- **Packages/libraries:** `gensymb`, `preview`, `tikz`; TikZ libraries `arrows`, `calc`, `positioning`, `decorations.pathreplacing`, `shapes`.
- **Main commands:** shared styles/macros, coordinates, colored draws, endpoint nodes.
- **Key parameters/styles:** exactly coincident red/blue descending segments `(7,-1)-(3,4)`, paint order, negative y range, half-centimeter grid, red axes.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Coincident geometry, final visible color, endpoint marks, grid, axes, and dimensions align.

### 24. `latex-examples-linear-functions`

- **Source:** `latex-examples/linear-functions.tex`
- **Packages/libraries:** `pgfplots`, `tikz`, `nicefrac`; no TikZ or PGFPlots library.
- **Main commands:** `\pgfplotsset`, `\addplot`, `\legend`, `\nicefrac`.
- **Key parameters/styles:** 8 cm square middle-axis plot, range -5..5, dashed gray major grid, `enlargelimits=false`, three domains with 500 samples, solid/dashed/dotted ultra-thick lines, south-east frameless legend, `\nicefrac{1}{2}` math label.
- **Diagnostics:** `[]`.
- **Implementation update:** the math-mode `nicefrac.sty` algorithm is now implemented in `src/renderers/svg/mathNiceFractionFallback.js`: 7pt optical numerator/denominator, the raised numerator, and the native `-2mu / -1mu` solidus kerns are emitted as separate SVG spans. The package is registered independently in `src/packages/nicefrac.js`. Verified artifacts: `outputs/qa-linear-functions-nicefrac/`.
- **Acceptance:** **Passed**. The legend preserves the raised `\nicefrac{1}{2}` construction. Axes, slopes, clipping, dash styles, colors, grid, middle-axis labels, and ticks align on the same 244x244 canvas; remaining pixels are glyph/stroke rasterization.

### 25. `latex-examples-lines-intersections`

- **Source:** `latex-examples/lines-intersections.tex`
- **Packages/libraries:** `preview`, `tkz-fct`; TikZ libraries `arrows`, `decorations.pathreplacing`, `shapes.misc`; no PGFPlots library.
- **Main commands:** `\tikzset`, `\tkzInit`, `\tkzGrid`, `\tkzAxeXY`, repeated `\draw ... to ...`.
- **Key parameters/styles:** white background rectangle, 0..21 by 0..7 axes, gray mixed grid, custom `to path` using `\tikztotarget`/`\tikztonodes`, `cross out` endpoint nodes, very thick lines, many intersection/parallel/perpendicular configurations.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. The 870x341 canvas, coordinate scaffold, all 15 segments, 30 endpoint crosses, and grouped constructions align. The small residual consists of tick/axis glyphs, endpoint-cross edges, and stroke antialiasing.

### 26. `latex-examples-knot-trefoil`

- **Source:** `latex-examples/knot-trefoil.tex`
- **Packages/libraries:** third-party package `brunnian`; TikZ library `arrows`; no PGFPlots library.
- **Main commands:** `\tikzset`, `\foreach`, nested `scope`, `\node`, `\draw`, TikZ `let` assignments, `Mod`, cubic `.. controls ..` paths.
- **Key parameters/styles:** `every path={red,line width=2pt}`, transformed `knot crossing` nodes with `inner sep=1.5pt`, 120-degree rotations, dynamically named nodes, scaled custom anchors such as `16 south east` and `4 north west`, `.center`, and `triangle 60` tip selection.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. The full batch now uses the actual 197x171 trefoil reference. TikZKit clips bare cubic endpoints against the transformed `knot crossing` node borders while preserving explicit `.center` endpoints, so all three over/under gaps, path widths, rotations, and dimensions coincide; the comparator reports `same` with zero changed pixels.

### 27. `latex-examples-landtagswahlen-in-bayern`

- **Source:** `latex-examples/landtagswahlen-in-bayern.tex`
- **Packages/libraries:** `inputenc[utf8]`, `babel[ngerman]`, `fontenc[T1]`, `geometry`, `pgfplots`; PGFPlots library `dateplot`; TikZ library `pgfplots.dateplot`.
- **Main commands:** `\pgfplotsset`, `\addplot table`, `\legend`, `\pgfmathprintnumber` in y tick labels.
- **Key parameters/styles:** `date coordinates in=x`, `date ZERO`, date min/max, `xtick=data`, rotated year labels, percent y ticks and extra tick, CSV `col sep=comma`, seven series, outside legend, dashed grid, triangle/square/x marks.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. All seven data series, dates, ticks, grid, legend, native `triangle*`/square/x marks, and date-axis scaled-tick suppression align. JS is 691x291 versus 692x291 for the reference; the one-pixel width residual is confined to rotated date/legend glyph rasterization.

### 28. `latex-examples-learn-curve-ml`

- **Source:** `latex-examples/learn-curve-ml.tex`
- **Packages/libraries:** `pgfplots`, `tikz`; TikZ libraries `positioning`, `decorations.text`, `decorations.pathmorphing`, `arrows.meta`; no PGFPlots library.
- **Main commands:** `\tikzstyle`, `\addplot`, `\draw`, `\path ... edge`, `\addlegendentry`.
- **Key parameters/styles:** two sampled rational curves, middle axes, major grid, explicit ranges, `minor tick num=-3`, custom `tension`, `Latex-Latex` bidirectional arrows, axis-coordinate labels, text-along-path decoration, dashed human-level line, north-east legend.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Curves, thresholds, bidirectional arrows, labels, legend, and text decoration align on the same 502x267 canvas. The remaining diff is glyph/stroke rasterization, including text sampled along the path.

### 29. `latex-examples-liftung-torus-r`

- **Source:** `latex-examples/liftung-torus-r.tex`
- **Packages/libraries:** `amsmath`, `amssymb`, `tikz`; TikZ libraries `patterns`, `arrows`, `positioning`; no PGFPlots library.
- **Main commands:** `\tikzstyle`, `\newcommand`, `\draw`, nested `scope`, `\foreach`, `\node`.
- **Key parameters/styles:** cubic Bezier torus outline, `xscale=-1`, `yscale=-1`, `rotate=180`, shifted 0..6 grid, loop-generated numeric labels, filled circular point nodes, red segments, dashed ellipse and elliptical arc, `\xrightarrow{\text{Liften}}`, `\mathbb{R}^2/\mathbb{Z}^2`.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Torus curves, grid, points, lift copies, red loop, and the extensible labeled formula arrow align. JS is 557x282 versus 557x283 for the reference; the one-pixel height residual is confined to formula/glyph and curve raster bounds.

### 30. `latex-examples-line-chart-electric-vehicles-sold`

- **Source:** `latex-examples/line-chart-electric-vehicles-sold.tex`
- **Packages/libraries:** `pgfplots`, `pgfplotstable`; PGFPlots library `fillbetween`; TikZ libraries `arrows.meta`, `positioning`, `backgrounds`.
- **Main commands:** `\addplot coordinates`, `\node`, `\draw`, `\pgfmathprintnumber` in tick labels.
- **Key parameters/styles:** 14x9 cm axis, 2012..2023 x range, percent y range, two-line explicit x labels, right-side y labels, both grids with separate major/minor styles, global plot/mark styles, bold shifted title, footnote-size ticks, circle marks, two multiline annotation nodes, custom `Latex[length=3mm,width=2mm]` arrows.
- **Diagnostics:** `[]`.
- **Acceptance:** **Passed**. Data curve, all marks, two-line year/count ticks, percent labels, grids, annotations, arrows, and title align. The U+0020 fix removes the former visible hyphens in annotation spaces, and the CMBX optical font supplies the native bold title design. JS is 518x353 versus 520x353 for the reference; the two-pixel width residual comes from bold-glyph paint bounds rather than plot or annotation displacement.

## Explicitly unimplemented or incomplete items

1. **Pixel-identical font rasterization:** the browser and PDF-to-SVG reference use different raster paths, so glyph edges and hinting are not pixel-identical even when the MacTeX optical design, physical size, baseline, and placement agree.
2. **Exact paint bounds for long bold text:** the electric-vehicle title retains a 1.35pt SVG width difference. Plot geometry and label placement are aligned; this is below the 1.5pt batch acceptance boundary.
3. **Full PGFPlots style-hook execution:** the exercised transparent/opaque axis redraw through `after end axis/.append code` and `\pgfplotsdrawaxis` is implemented, but arbitrary TeX callback execution is not claimed.
4. **Full package emulation is not claimed:** `preview`, `inputenc`, `babel`, `fontenc`, `geometry`, `helvet`, `sansmath`, `amsmath`, `amssymb`, `gensymb`, `nicefrac`, `pgfplotstable`, `tkz-fct`, and `brunnian` are supported only for the syntax/visual behavior exercised here, not as complete package ports. For `nicefrac`, math-mode `nice` layout is implemented; text mode and the `ugly` option are still unsupported.

## Acceptance checklist for future runs

- Render all 30 TikZKit SVG/PNG artifacts and all 30 `tikztosvg` SVG/PNG references successfully.
- Require `diagnostics: []` for every case, while still inspecting every sheet visually.
- Preserve the corrected `brunnian` reference selection and all three visible crossing gaps.
- Preserve dateplot scaled-tick suppression and native triangle/square/x marks.
- Preserve the corrected model-aware LDA colors, math-label placement, post-plot axis redraw, and identical 480x289 canvas as a shared six-case gate.
- Check title/axis/annotation text and outer bbox for learning-curve, torus lift, and electric-vehicle cases.
- Run `node --test test/latex-examples-new30-acceptance.test.js`; all 30 subcases must pass the diagnostics and 1.5pt native-canvas gates.
- Preserve all 30 visually accepted cases without endpoint, knot-crossing, grid, axis, text-space, or bbox regressions.

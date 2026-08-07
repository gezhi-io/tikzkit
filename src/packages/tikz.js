export const texPackage = {
  "name": "tikz",
  "status": "builtin",
  "implementedBy": "src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js",
  "registryImplementedBySuffix": "scripts/render-example-fixtures.js:applyTikztosvgDocumentCropBorder/createTikztosvgPreambleInputEnv",
  "features": [
    "tikzpicture extraction",
    "draw/path/fill/node/coordinate subset",
    "compact textstyle/scriptstyle metrics for simple math node labels",
    "TeX-sized inline math word groups for svg-text text width wrapping",
    "browser rich-text inline math wrapping shares the TeX-sized svg-text token layout",
    "outer node minipage width mapped to shared text width",
    "mixed-inline-math outer minipage reflow with TeX vbox height",
    "resolved scope font metrics for node and rectangle-split layout",
    "every node/nodes font inheritance materialized into SVG FontSpec",
    "transform canvas scale/rotate/shift kept separate from TikZ coordinate transforms",
    "declared coordinate systems with dynamic #1 pgfmath arguments and pgfpointxy/pgfpoint outputs"
  ],
  "requires": [
    "pgf",
    "pgffor"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty",
  "localDoc": null,
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex (/tikz/transform canvas; \\tikzdeclarecoordinatesystem; /tikz/text width; /tikz/nodes appends to every node; default text-width action is ragged right with \\rightskip=0pt plus2em and normal TeX spaces); /usr/local/texlive/2025/texmf-dist/source/latex/base/ltboxes.dtx (\\@iiiminipage copies the required width to \\hsize, \\textwidth, and \\columnwidth before \\@parboxrestore and packs the minipage vbox); /usr/local/texlive/2025/texmf-dist/tex/generic/hyph-utf8/patterns/tex/hyph-en-us.tex (US-English Liang patterns and 2/3 minima); /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-transformations.tex (transform canvas semantics); /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-coordinates.tex (declared coordinate-system argument semantics); /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex (every node is installed at the beginning of every node; node text-width paragraph layout)",
  "localSourceReviewedLatest": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex (/tikz/use as bounding box is an executable path mode, lines 534 and 1958); /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex (/pgf/use as bounding box invokes PGF's bounding-box callback, line 41); /Library/TeX/texbin/tikztosvg (local wrapper creates standalone[crop,tikz,multi=false] then appends fragment input)",
  "caseCount": 1077,
  "caseExamples": [
    "1D 2D cross connection / 1d 2d_cross connection",
    "2D Convolution / 2d_convolution",
    "À trous convolutions / a_trous_convolutions",
    "A3C execution / a3c_execution",
    "A3C neural network / a3c_neural_network",
    "Amplitude modulation / amplitude_modulation",
    "Bidirectional long short term memory / bidirectional_long_short term_memory",
    "BWT / bwt",
    "Convolutional autoencoder / convolutional_autoencoder",
    "Convolutional cross connection / convolutional_cross connection",
    "Coordinate systems / coordinate_systems",
    "CRT rendering / crt_rendering"
  ],
  "observedOptions": [],
  "registryNoteSuffix": "Reviewed locally on 2026-08-07: PGF circle sizing takes the Euclidean diagonal of its TeX text box. Multi-line math circles therefore bypass the wider SVG measurement box and use calibrated TeX row metrics, while SVG still paints the text.",
  "registryNoteSuffixLatest": "On 2026-08-08, the local reference harness began injecting document crop paths only into top-level executable tikzpictures and loads non-package source preamble declarations through a disposable style wrapper before tikztosvg opens its document. This avoids macro-definition corruption; legacy picture plus overlay TikZ sources can still require a clearly labelled MacTeX fallback.",
  "notes": "TeX Live tikz.sty loads pgf and pgffor, then inputs tikz.code.tex. Simple math scripts use a shared TeX textstyle/scriptstyle box metric so minimum-size nodes are not over-expanded. Text-box measurement preserves the resolved scope font family, so font=\\tt affects rectangle-split geometry as it does in PGF. `every node` and `nodes={...}` now materialize their resolved font in the physical SVG FontSpec for ordinary and inline path nodes; a picture font remains the scope layer, an explicit node/path-node font is the node layer, and a leading content command still wins. Reviewed on 2026-08-07: transform canvas now keeps PGF's backend matrix separate from coordinate transforms for uniform scale, rotation, and shifts on paths and nodes, scales canvas stroke/text geometry, and locally disables automatic picture-size tracking. The parser now preserves `\\pgfmathsetmacro` expressions containing the coordinate-system `#1` argument through preprocessing, so a `\\tikzdeclarecoordinatesystem` can compute distinct `cs:` coordinates at runtime before its `\\pgfpointxy` or `\\pgfpoint` result is mapped to the current basis. The node source/manual confirm that text width sets a fixed text box before paragraph breaking. LaTeX's `\\@iiiminipage` sets its required width as `\\hsize`, `\\textwidth`, and `\\columnwidth`; TikZKit now maps an outer node-local minipage width, including `0.35\\textwidth`, into that shared node text-width path unless TikZ explicitly supplies text width. SVG-text preserves every inline formula as a TeX-sized word group before measuring mixed prose. Scoped `\\small`/`\\scriptsize`/`\\fontsize` lines now retain their FontSpec size and baseline skip through wrapping; a size transition uses the preceding TeX line's baseline rather than an averaged browser gap. On 2026-08-08, an outer minipage now uses the TeX paragraph-vbox height rather than the larger painted-glyph cache; mixed inline-math wrapping also applies normal-space shrink and conservative English `re-`/`lation` hyphenation. The browser `foreignObject` rich-text path now delegates mixed prose/formula line breaking to the same TeX-sized SVG-text token wrapper, preventing a 6cm node from choosing different words in browser and fallback rendering. The native visual-reference harness also wraps body-only `.tikz` fragments with their declared packages and libraries before invoking MacTeX. Full TeX pattern dictionaries, glue/penalty justification, nested minipage vertical layout, arbitrary coordinate-system TeX/key parsing, multi-command PGF point arithmetic, non-uniform node-anchor geometry, and downstream anchor reuse after transform canvas remain partial."
};

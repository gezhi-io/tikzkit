export const texPackage = {
  "name": "tikz",
  "status": "builtin",
  "implementedBy": "src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/renderSvg.js",
  "features": [
    "tikzpicture extraction",
    "draw/path/fill/node/coordinate subset",
    "compact textstyle/scriptstyle metrics for simple math node labels",
    "TeX-sized inline math word groups for svg-text text width wrapping",
    "outer node minipage width mapped to shared text width",
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
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex (/tikz/transform canvas; \\tikzdeclarecoordinatesystem; /tikz/text width; /tikz/nodes appends to every node); /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx (\\@iiiminipage copies the required width to \\hsize, \\textwidth, and \\columnwidth before \\@parboxrestore); /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-transformations.tex (transform canvas semantics); /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-coordinates.tex (declared coordinate-system argument semantics); /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex (every node is installed at the beginning of every node; node text-width paragraph layout)",
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
  "notes": "TeX Live tikz.sty loads pgf and pgffor, then inputs tikz.code.tex. Simple math scripts use a shared TeX textstyle/scriptstyle box metric so minimum-size nodes are not over-expanded. Text-box measurement preserves the resolved scope font family, so font=\\tt affects rectangle-split geometry as it does in PGF. `every node` and `nodes={...}` now materialize their resolved font in the physical SVG FontSpec for ordinary and inline path nodes; a picture font remains the scope layer, an explicit node/path-node font is the node layer, and a leading content command still wins. Reviewed on 2026-08-07: transform canvas now keeps PGF's backend matrix separate from coordinate transforms for uniform scale, rotation, and shifts on paths and nodes, scales canvas stroke/text geometry, and locally disables automatic picture-size tracking. The parser now preserves `\\pgfmathsetmacro` expressions containing the coordinate-system `#1` argument through preprocessing, so a `\\tikzdeclarecoordinatesystem` can compute distinct `cs:` coordinates at runtime before its `\\pgfpointxy` or `\\pgfpoint` result is mapped to the current basis. The node source/manual confirm that text width sets a fixed text box before paragraph breaking. LaTeX's `\\@iiiminipage` sets its required width as `\\hsize`, `\\textwidth`, and `\\columnwidth`; TikZKit now maps an outer node-local minipage width, including `0.35\\textwidth`, into that shared node text-width path unless TikZ explicitly supplies text width. SVG-text preserves every inline formula as a TeX-sized word group before measuring mixed prose. TeX hyphenation, glue/penalty justification, nested minipage vertical layout, arbitrary coordinate-system TeX/key parsing, multi-command PGF point arithmetic, non-uniform node-anchor geometry, and downstream anchor reuse after transform canvas remain partial."
};

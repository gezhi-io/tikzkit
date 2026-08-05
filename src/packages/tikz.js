export const texPackage = {
  "name": "tikz",
  "status": "builtin",
  "implementedBy": "src/frontend/parser.js + src/engine/evaluate.js + src/tikz/textMetrics.js + src/renderers/svg/renderSvg.js",
  "features": [
    "tikzpicture extraction",
    "draw/path/fill/node/coordinate subset",
    "compact textstyle/scriptstyle metrics for simple math node labels",
    "resolved scope font metrics for node and rectangle-split layout"
  ],
  "requires": [
    "pgf",
    "pgffor"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty",
  "localDoc": null,
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
  "notes": "TeX Live tikz.sty loads pgf and pgffor, then inputs tikz.code.tex. Simple math scripts use a shared TeX textstyle/scriptstyle box metric so minimum-size nodes are not over-expanded. Text-box measurement preserves the resolved scope font family, so font=\\tt affects rectangle-split geometry as it does in PGF."
};

export const texPackage = {
  "name": "relsize",
  "status": "partial",
  "implementedBy": "src/tex/relativeMath.js + src/tex/mathBox.js + src/renderers/svg/nativeMath.js",
  "localSourceReviewed": "yes",
  "features": [
    "mathlarger and mathsmaller advance native math styles on the wrapped atom",
    "nested display-style mathlarger selects the nearest 10pt-document NFSS size",
    "native CM metrics and glyphs for ordinary, bold and scripted wrapped symbols"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/relsize/relsize.sty",
  "localDoc": null,
  "caseCount": 4,
  "caseExamples": [
    "Dropout / dropout",
    "Hierarchical graph classifier / hierarchical_graph_classifier",
    "X LSTM / x lstm",
    "plot curves is lm plot command"
  ],
  "observedOptions": [],
  "notes": "Reviewed relsize.sty lines 40-130 and 268-315 locally on 2026-10-23. Chrome compares 31 relative-size and bold glyph origins with tikztosvg at a shared frame, in default and SVG-text modes. Large-operator limits, external decorators, arbitrary fontsize/math-size declarations and text relsize commands remain partial. Evidence: docs/qa/2026-10-23-failure-repairs.md."
};

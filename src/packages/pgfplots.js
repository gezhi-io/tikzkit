export const texPackage = {
  "name": "pgfplots",
  "status": "partial",
  "implementedBy": "src/preprocess.js:expandPgfplotsAxes",
  "features": [
    "axis-like environments",
    "\\addplot coordinates/table/functions",
    "ticks/labels/legends subset",
    "xtick/ytick/ztick distance",
    "3D surf and ternary slices"
  ],
  "requires": [
    "tikz",
    "graphicx"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty",
  "localDoc": null,
  "caseCount": 371,
  "caseExamples": [
    "Amplitude modulation / amplitude_modulation",
    "Frequency modulation / frequency_modulation",
    "GMHMM / gmhmm",
    "IQ sampling / iq_sampling",
    "Multiplex chain GMHMM (beta) / multiplex_chain_gmhmm_beta",
    "Multiplex chain GMHMM / multiplex_chain_gmhmm",
    "Sampling / sampling",
    "X LSTM / x lstm",
    "Tikzfxgraph wrapped pgfplots graph",
    "amplitude modulation",
    "bose einstein distribution 3d",
    "bose einstein distribution"
  ],
  "observedOptions": [],
  "notes": "TeX Live pgfplots.sty requires graphicx and tikz, then inputs pgfplots.code.tex. TikZKit handles common numeric tick-distance keys in the preprocessor."
};

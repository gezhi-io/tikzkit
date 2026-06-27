export const texPackage = {
  "name": "pgfplotstable",
  "status": "partial",
  "implementedBy": "src/preprocess.js:collectPgfplotstableReads",
  "features": [
    "\\pgfplotstableread macro data for addplot table"
  ],
  "requires": [
    "pgfplots",
    "array"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplotstable.sty",
  "localDoc": null,
  "caseCount": 314,
  "caseExamples": [
    "fileIO circles from data",
    "fileIO table read data fileio pgf table",
    "fileIO time read data timeline fileio pgf foreach text",
    "agronomia",
    "analise covarianca efeitos",
    "anotacoes intersecao",
    "anova one factor null hypothesis",
    "association is not causation",
    "barras erro",
    "barras",
    "bias variance mse",
    "bias variance mse2"
  ],
  "observedOptions": [],
  "notes": "TeX Live pgfplotstable.sty requires pgfplots, inputs pgfplotstable.code.tex, then requires array."
};

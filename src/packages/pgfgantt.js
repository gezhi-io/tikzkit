export const texPackage = {
  "name": "pgfgantt",
  "status": "partial",
  "implementedBy": "src/frontend/latex-shell.js:expandPgfganttCharts",
  "features": [
    "ganttchart",
    "\\gantttitle",
    "\\ganttbar",
    "\\ganttgroup",
    "\\ganttmilestone subset",
    "hgrid=true",
    "vgrid style-list subset"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfgantt/pgfgantt-doc.pdf",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty: hgrid default/style-list parser at lines 50-97; vgrid parser at lines 99-140; canvas, grid origin, and title/chart row placement at lines 375-404; /usr/local/texlive/2025/texmf-dist/doc/latex/pgfgantt/pgfgantt-doc.pdf: documented hgrid/vgrid repeated style-list syntax",
  "caseCount": 311,
  "caseExamples": [
    "agronomia",
    "analise covarianca efeitos",
    "anotacoes intersecao",
    "anova one factor null hypothesis",
    "association is not causation",
    "barras erro",
    "barras",
    "bias variance mse",
    "bias variance mse2",
    "bias variance",
    "bivariate normal",
    "bleasdale nelder rep"
  ],
  "observedOptions": [
    "x unit",
    "y unit title",
    "y unit chart",
    "hgrid=true",
    "vgrid={*n{style},...}"
  ],
  "notes": "Reviewed TeX Live 2025 pgfgantt.sty and manual. Basic hgrid/vgrid style lists lower to consecutive cyclic TikZ grid styles; gantt links, calendar/date slots, title lists, progress, and custom canvas/element shapes remain unsupported."
};

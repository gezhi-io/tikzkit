export const texPackage = {
  "name": "pgfplotstable",
  "status": "partial",
  "implementedBy": "src/frontend/latex-shell.js:collectPgfplotstableReads/lowerPgfplotstableTypeset/pgfplotstableScientificAlignedCell; src/frontend/parser.js:extractTabularPictureLayouts; src/engine/evaluate.js:appendTabularPictureLayouts/tabularCellTextLayout",
  "features": [
    "\\pgfplotstableread macro data for addplot table",
    "\\pgfplotstabletypeset inline or read-table output with basic headers, rows, columns, and col sep",
    "per-column int detect, fixed/fixed zerofill, sci/sci zerofill, precision, sci precision, and use comma number printing",
    "per-column dec sep align for supported fixed decimal cells",
    "per-column sci sep align for supported scientific mantissa/exponent cells"
  ],
  "requires": [
    "pgfplots",
    "array"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplotstable.sty",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotstable.pdf",
  "localSourceReviewed": [
    "/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplotstable.sty (loads pgfplots, pgfplotstable.code.tex, and array for decimal alignment, lines 29-37)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/numtable/pgfplotstable.code.tex (the default typeset path begins/ends a tabular, selects all columns when columns is empty, accepts the documented column separators, and dec/sci sep align create r@{}l pairs with spanning headers, lines 219-330, 361-362, 1086-1105, and 1307-1348)",
    "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex (number printer defaults precision to 2, configures fixed/sci/zerofill/decimal separators, and inserts the configurable scientific exponent mark before standard 10^n output, lines 56, 819-899, 976-1037, and 1583-1630)",
    "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotstable.pdf (basic table typesetting, header/column selection, fixed/scientific formatting, and decimal-alignment overview, pages 5-15)"
  ],
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
  "observedOptions": [
    "col sep=space|comma|tab|&",
    "columns={...}",
    "columns/<name>/.style",
    "column name",
    "int detect",
    "fixed",
    "fixed zerofill",
    "sci",
    "sci zerofill",
    "precision",
    "sci precision",
    "use comma",
    "dec sep align",
    "sci sep align"
  ],
  "notes": "TeX Live pgfplotstable.sty requires pgfplots, inputs pgfplotstable.code.tex, then requires array. Reviewed locally on 2026-08-06: typeset output delegates basic rows to tabular; TikZKit lowers inline or \\pgfplotstableread-backed tables with header detection, columns selection, comma/space/tab/& separators, default plain-integer thousands grouping, and the focused per-column int detect/fixed/sci number-printer subset. For supported fixed values containing a decimal separator, dec sep align uses a shared per-column decimal anchor; for supported sci/int-detect scientific output, sci sep align uses a shared exponent anchor and retains 10^0. Headers stay unsplit in both forms. Full number formatting, printer-order interactions, external files, sci subscript/generic formats, dcolumn, non-finite special values, arbitrary row/column styles, and postprocessing remain partial."
};

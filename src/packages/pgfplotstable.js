export const texPackage = {
  "name": "pgfplotstable",
  "status": "partial",
  "implementedBy": "src/frontend/latex-shell.js:collectPgfplotstableReads/lowerPgfplotstableTypeset/pgfplotstableFormatScientific/pgfplotstableScientificAlignedCell; src/pgf/numberFormat.js:pgfScientificParts/formatPgfScientificNumber; src/frontend/parser.js:extractTabularPictureLayouts; src/engine/evaluate.js:appendTabularPictureLayouts/tabularCellTextLayout",
  "features": [
    "\\pgfplotstableread macro data for addplot table",
    "\\pgfplotstabletypeset inline or read-table output with basic headers, rows, columns, and col sep",
    "per-column int detect, fixed/fixed zerofill, sci/sci zerofill/sci subscript/sci superscript, controlled sci generic templates, precision, sci precision, and use comma number printing",
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
    "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex (number printer defaults precision to 2, configures fixed/sci/zerofill/decimal separators, and selects standard 10^n, direct 1_{n}/1^{n}, or callback-configured sci generic output, including retain unit mantissa, lines 807-941 and 976-1082)",
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
    "sci subscript",
    "sci superscript",
    "sci generic",
    "sci generic/mantissa sep",
    "sci generic/empty mantissa sep",
    "sci generic/exponent",
    "retain unit mantissa=false",
    "use comma",
    "dec sep align",
    "sci sep align"
  ],
  "notes": "TeX Live pgfplotstable.sty requires pgfplots, inputs pgfplotstable.code.tex, then requires array. Reviewed locally on 2026-08-06: typeset output delegates basic rows to tabular; TikZKit lowers inline or \\pgfplotstableread-backed tables with header detection, columns selection, comma/space/tab/& separators, default plain-integer thousands grouping, and the focused per-column int detect/fixed/sci number-printer subset. For supported fixed values containing a decimal separator, dec sep align uses a shared per-column decimal anchor; standard sci/int-detect output uses sci sep align's shared exponent anchor and retains 10^0. The local sci subscript and sci superscript printers instead output mantissa_{exponent} or mantissa^{exponent}, including 0.00_0 and 0.00^0; they bypass the standard scientific exponent marker, so sci sep align deliberately remains a whole-cell layout. The focused sci generic subset accepts mantissa sep, empty mantissa sep, exponent with literal #1 substitution, and retain unit mantissa=false; it remains a whole cell and preserves zero exponents. It does not execute TeX callbacks or #2/#3 generic-template parameters. Headers stay unsplit in all forms. Full number formatting, printer-order interactions, external files, generic TeX callbacks, dcolumn, non-finite special values, arbitrary row/column styles, and postprocessing remain partial."
};

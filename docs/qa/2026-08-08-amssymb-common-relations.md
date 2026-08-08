# amssymb common relations QA

## Scope

This focused slice implements SVG-text fallback and metric support for
\varnothing, \leqslant, \geqslant, \nleq, \ngeq, \nsubseteq, \nsupseteq,
\rightsquigarrow, \leadsto, \therefore, and \because. It does not claim
complete AMSa/AMSb coverage.

## Local source review

- /usr/local/texlive/2025/texmf-dist/tex/latex/amsfonts/amssymb.sty, lines
  78-88 and 101-108 declare \rightsquigarrow, \therefore, \because,
  \leqslant, and \geqslant as \mathrel.
- The same file, lines 173-234, classifies the implemented negated
  comparisons as relations and \varnothing as an ordinary atom.
- /usr/local/texlive/2025/texmf-dist/tex/latex/amsfonts/amsfonts.sty, lines
  147-152, makes \leadsto an alias of \rightsquigarrow.
- A local 10pt TeX measurement reports 7.7778pt for the empty-set and
  comparison glyphs, 10.0000pt for \rightsquigarrow, and 6.6667pt for
  \therefore and \because. Those advances now drive the shared fallback
  metrics.

## Three-way visual QA

- TikZKit SVG/PNG:
  outputs/qa-amssymb-common-relations-2026-08-08/final/tikzkit-svg/ and
  tikzkit-png/
- tikztosvg SVG/PNG:
  outputs/qa-amssymb-common-relations-2026-08-08/final/tikztosvg-svg/ and
  tikztosvg-png/
- MacTeX native PNG and comparison sheets:
  outputs/qa-amssymb-common-relations-2026-08-08/final/mactex-png/ and diff/

tikztosvg was found at /Library/TeX/texbin/tikztosvg; PNG conversion used
/opt/homebrew/bin/rsvg-convert. Its SVG is a 258.92pt by 25.27pt
outline-glyph document: the math text is emitted as reusable glyph paths,
not browser text nodes. MacTeX remains the reference for glyph geometry.

Before this change TikZKit painted literal control-word fragments such as
leqslant, varnothing, and rightsquigarrow. The final panel paints the actual
relation and ordinary glyphs with TeX relation spacing, while retaining the
enclosing node geometry. TikZKit is now 338 by 33 pixels against the 346 by
34 pixel tikztosvg reference, rather than the former 321 by 33 pixel layout;
diagnostics remain zero. The residual is principally Computer Modern outline
versus browser-font rasterization and a small total advance difference, not a
missing symbol or shifted drawing.

## Validation

    node --test test/text-package-macros.test.js test/example-render-script.test.js
    npm run examples:render -- --fixtures test/fixtures/examples --only amssymb-common-relations --output outputs/qa-amssymb-common-relations-2026-08-08/final --native-reference --comparison-grid-mode svg --strict-tikztosvg
    npm run examples:diff -- --output outputs/qa-amssymb-common-relations-2026-08-08/final --register --alignment-radius 3

The focused tests pass and the TikZKit, tikztosvg, and MacTeX artifacts were
all generated and visually inspected.

## Remaining scope

The full AMS symbol inventories, extensible arrows, rare delimiters, and
package-dependent font selection remain partial.

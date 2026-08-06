# pgfplotstable Scientific Generic QA (2026-08-06)

## Scope

This slice implements the documented, data-only `sci generic` number-printer
subset for visible `\pgfplotstabletypeset` tables:

- `sci generic/mantissa sep`,
- `sci generic/empty mantissa sep`,
- `sci generic/exponent` with literal `#1` exponent substitution, and
- `retain unit mantissa=false`.

It is intentionally not a TeX execution path. Generic template callbacks,
their `#2` floating-point flag and `#3` raw-mantissa parameters, arbitrary
printer ordering, and macro expansion remain outside this slice.

The real fixture is
`test/fixtures/examples/pgfplots/pgfplotstable-sci-generic.tex`. It formats
`0.001`, `123.4`, `1`, `0`, and `-0.001` three times: first as
`mantissa \times 10^{exponent}`, then with unit mantissas suppressed, and
finally with `sci sep align` enabled. It therefore exercises
negative/positive/zero exponents, signed unit mantissas, the zero value, all
three generic fields, the `retain unit mantissa=false` branch, and the native whole-cell behavior
of generic output under scientific-column alignment.

## Local MacTeX Study

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex`,
  lines 807-850: the shared scientific formatter decides whether a numeric
  unit mantissa is emitted. `retain unit mantissa=true` is the default;
  `false` suppresses either sign's unit mantissa and switches to
  `empty mantissa sep`.
- The same file, lines 930-941: `pgfmathfloatrounddisplaystyle@generic`
  resolves the generic keys before passing its selected pre-exponent and
  exponent fragments to the shared formatter.
- The same file, lines 1054-1065: `sci generic={...}` registers its value as
  a number-format key set. It defines the three focused keys, while the
  bundled `verbatim` style demonstrates an alternate `exponent={e#1}`
  template.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/numtable/pgfplotstable.code.tex`,
  lines 298-326: `sci sep align` only splits the standard scientific exponent
  marker. Generic output provides no such marker, so it remains one complete
  table cell.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotstable.pdf`,
  pages 35-36: documents `mantissa sep`, `exponent={...#1...}`, and the
  distinction between formatting the scientific representation and formatting
  a fixed mantissa.

TikZKit parses the generic value with the existing brace-aware option parser
and substitutes `#1` without evaluating TeX. This leaves the table-layout
layer unchanged and prevents a generic cell from acquiring an invented
`sci sep align` split.

## Implemented Parameters

| Command or key | Status | Boundary |
| --- | --- | --- |
| `\pgfplotstabletypeset` | implemented subset | inline or registered tables only |
| `columns/<name>/.style` | implemented subset | selected column styles |
| `sci`, `sci zerofill`, `sci precision` | implemented subset | shared number-printer subset |
| `sci generic={...}` | implemented subset | data templates only |
| `mantissa sep` | implemented | literal fragment with `#1` substitution |
| `empty mantissa sep` | implemented | selected for suppressed unit mantissas |
| `exponent={...#1...}` | implemented | literal exponent template |
| `retain unit mantissa=false` | implemented | omits any signed/unsigned mantissa numerically equal to one |
| `sci generic,sci sep align` | implemented | remains one whole cell |
| generic `#2`/`#3` callbacks, arbitrary TeX expansion | not implemented | no TeX callback execution |
| `dcolumn`, non-finite values, arbitrary post-processing | partial | outside the focused table subset |

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are in
`/private/tmp/tikzkit-qa-pgfplotstable-sci-generic-2026-08-06`:

- TikZKit SVG/PNG: `tikzkit-svg/pgfplotstable-sci-generic.svg` and
  `tikzkit-png/pgfplotstable-sci-generic.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplotstable-sci-generic.svg` and
  `tikztosvg-png/pgfplotstable-sci-generic.png`.
- MacTeX PNG and inspected four-panel sheet:
  `mactex-png/pgfplotstable-sci-generic.png` and
  `diff/pgfplotstable-sci-generic-native-sheet.png`.

I inspected the TikZKit, tikztosvg, MacTeX, grid, and registered-diff panels.
Before the change, both generic columns ignored their templates: the JS result
used the default `\cdot 10^n` output and retained `1.00` in every unit
mantissa cell. After it, all panels visibly contain the custom `\times`
separator and `10` exponent template; the unitless column shows `10^{-3}` and
`10^{0}` where the input mantissa is one, while the signed unit input becomes
`-10^{-3}` and the zero input remains `0.00 \times 10^{0}`. The fourth
generic-align column remains a complete
formula instead of acquiring a false mantissa/exponent split. No table rows,
headers, or exponents are missing.

The TikZKit output is `278.67pt x 75.72pt` (`372 x 101px`), while the pdflatex
MacTeX PNG is `368 x 101px` and the tikztosvg XeLaTeX path-outline SVG has
`viewBox="0 0 271.91 71.73"` (`363 x 96px`). tikztosvg uses `<path>` glyph
definitions and `<use>` placement rather than SVG `<text>`. The remaining
horizontal JS reserve is a font-metric/preview-cropping difference, not a
missing generic token or cell. Registered differences are supporting evidence
only; acceptance is based on the inspected semantic and visible geometry.

## Regression

```bash
npm test -- test/pgfplotstable-typeset.test.js \
  test/example-render-script.test.js \
  test/tabular-picture-layout.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplotstable-sci-generic-2026-08-06 \
  --only pgfplotstable-sci-generic --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output \
  /private/tmp/tikzkit-qa-pgfplotstable-sci-generic-2026-08-06 \
  --register --alignment-radius 3
```

The focused regression checks the literal `#1` substitutions, the unit-mantissa
suppression for both negative and zero exponents, zero-value preservation, and
the absence of synthetic `tabular-scientific-*` fragments.

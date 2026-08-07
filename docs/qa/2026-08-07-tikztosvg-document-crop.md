# tikztosvg Document Crop QA

## Scope

This shared QA slice preserves document-level outer margins in disposable
`tikztosvg` inputs. It covers only `\\documentclass[border=<dimension>]{standalone}`
and `\\setlength\\PreviewBorder{<dimension>}`. It does not alter TikZKit's
renderer or claim a general TeX page-layout implementation.

## Local Reference Study

The source document is the authority for the crop contract:

- `standalone` with `border=2pt` contributes 2pt on every edge of the output
  box.
- `preview` with `\\setlength\\PreviewBorder{2mm}` likewise expands the
  previewed material by 2mm on every edge.
- `tikztosvg` consumes an extracted `tikzpicture` and crops to that picture's
  painted bounds, so it cannot see either document-level setting unless the
  generated input makes the bounding box explicit.

The normalizer now appends a TikZ `use as bounding box` path based on `current
bounding box` inside every extracted picture. This mirrors the source's crop
without changing the user fixture, parser, or SVG renderer.

## Real Visual Check

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The three real pgfplotstable drivers are in:

`/private/tmp/tikzkit-qa-pgfplotstable-column-widths-2026-08-07/index.html`

The inspected four-way sheets are:

- `diff/pgfplotstable-inline-typeset-native-sheet.png`
- `diff/pgfplotstable-number-formats-native-sheet.png`
- `diff/pgfplotstable-dec-sep-align-native-sheet.png`

Before this change, tikztosvg omitted the fixtures' `standalone[border=2pt]`
margin. Its PNGs were respectively `109x64`, `196x64`, and `130x64`, while
MacTeX was `115x70`, `201x70`, and `136x70`. That made a uniform 2pt crop
error look like a table-column and baseline error.

After the change, tikztosvg is `115x70`, `201x70`, and `136x70`, the same as
MacTeX. The panels show complete headers, all data rows, measured numeric
columns, and the shared decimal anchor; remaining TikZKit differences are
browser font rasterization and at most one output pixel of text measurement,
not a whole-canvas translation. Diff ratios remain supporting evidence only.

## Regression

```bash
node --test --test-name-pattern='tikztosvg normalization preserves standalone and preview crop borders|tikztosvg wraps standalone pgfplotstable output' test/example-render-script.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples/pgfplots --only pgfplotstable-inline-typeset --only pgfplotstable-number-formats --only pgfplotstable-dec-sep-align --output /private/tmp/tikzkit-qa-pgfplotstable-column-widths-2026-08-07 --native-reference --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js --output /private/tmp/tikzkit-qa-pgfplotstable-column-widths-2026-08-07 --register --alignment-radius 3
```

The focused regression passes and all three JavaScript, tikztosvg, and MacTeX
renders complete with no external failure.

## Boundary

Unadorned document classes, `standalone` default options, arbitrary geometry
packages, page offsets, and general preview/page-layout semantics still remain
outside this normalizer. The source document remains the native crop oracle.

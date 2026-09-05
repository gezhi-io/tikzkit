# Karnaugh Multi-Picture Document

## Scope

This severe-gap slice covers one document-layout rule: all consecutive
top-level TikZ pictures are visible by default. The real driver is
`latex-examples-karnaugh-map-2`, where a stale fixture-level active-figure
selection discarded the entire second 4-by-4 map.

The accepted boundary is default multi-picture rendering and the continued
availability of explicit `activeFigureId` selection. It does not claim general
TeX paragraph, page-breaking, or arbitrary display-math layout between
pictures.

## Local TeX Reading

Reviewed the fixture's `Karnaugh` environment, `contingut`, `minterms`,
`maxterms`, `indeterminats`, and implicant macros in
`test/fixtures/examples/latex-examples/karnaugh-map-2.tex`. The document
contains two independent top-level environment calls; the second one owns four
`X` cells and eight grouping paths.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
around lines 1709-1753. Every `tikzpicture` opens its own PGF picture and
`\endtikzpicture` closes that picture and its local group. Nothing in this
environment contract selects only the first picture.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. MacTeX used
`/Library/TeX/texbin/pdflatex`, and SVG rasterization used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are in:

- `outputs/qa/2026-09-06-karnaugh-multi-picture-after/`
- `tikzkit-svg/latex-examples-karnaugh-map-2.svg`
- `tikzkit-png/latex-examples-karnaugh-map-2.png`
- `tikztosvg-svg/latex-examples-karnaugh-map-2.svg`
- `tikztosvg-png/latex-examples-karnaugh-map-2.png`
- `mactex-png/latex-examples-karnaugh-map-2.png`
- `diff/latex-examples-karnaugh-map-2-native-sheet.png`

Before the correction, the browser and generated TikZKit artifact showed only
the first map. Afterward TikZKit paints both maps, including all four `X`
values, all 12 numeric values in the second map, and all eight second-map
implicant borders. Their cell geometry, baseline, and inter-picture spacing
are close to MacTeX.

tikztosvg still emits only the first picture for this document. Its SVG is
therefore not authoritative for the multi-picture count; MacTeX is the native
reference here. This divergence is retained in the comparison artifacts
rather than hidden.

## Implementation And Verification

- `test/fixtures/examples/manifest.json` no longer applies the obsolete
  `activeFigureId=figure:0` projection to a document whose result requires two
  pictures.
- `test/example-fixtures.test.js` verifies the manifest contract and the 16
  values of the right-hand map.
- `scripts/build-extension-registry.js` records default multi-picture painting
  and the opt-in nature of active-figure selection.

The focused test passes. The full suite reports 2,488 tests: 2,333 passing,
141 failing, and 14 skipped in the restricted workspace. Five failures are
the workbench server tests, all caused by `listen EPERM` while binding a local
test port; excluding those environment-only failures leaves the unchanged 136
known project failures and 2,338 passing tests. TikZKit, tikztosvg, and MacTeX
all complete without rendering diagnostics or process failures; the known
visual discrepancy is that tikztosvg drops the second picture while MacTeX
and TikZKit retain it.

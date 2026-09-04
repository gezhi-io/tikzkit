# Multipart repeated empty-part rule QA

## Scope

This slice closes the remaining `shapes.multipart` option-order gap for
rectangle split nodes. Its acceptance boundary is:

- preserve every repeated `rectangle split empty part width` key;
- add all default, style, and local width rules in source order;
- preserve every repeated empty-part height and depth key;
- use the largest height and largest depth, as a TeX hbox does;
- keep part fills, part anchors, text alignment, and edge routing unchanged.

## Local source review

The implementation was checked against:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`, lines 477-501 and 575-614;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, lines 1680-1740;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.multipart.code.tex`;
- the TikZ, calc, positioning, and arrows.meta sources recorded in each case review file.

The three metric keys are `.code` keys, not ordinary stored values. Each use
appends a zero-width `\vrule` to `\pgf@lib@sh@rs@every@emptypart`. Adjacent
rules add their widths. When the rules are packed into one hbox, TeX selects
the maximum height and the maximum depth independently. The library has
already executed the initial 1ex width, 1ex height, and 0ex depth keys, so
explicit values extend those defaults instead of replacing them.

## Reference pipeline

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. SVG rasterization
used `/opt/homebrew/bin/rsvg-convert`, and native references used local
`pdflatex`. Artifacts are stored in
`outputs/qa/2026-09-04-shapes-multipart-empty-rules/`:

- `tikzkit-svg/` and `tikzkit-png/` contain browser-rendered output;
- `tikztosvg-svg/` and `tikztosvg-png/` contain the third-party reference;
- `mactex-png/` contains the native reference;
- the grid folders, `diff-png/`, and `diff/` contain 1cm overlays and sheets.

The `tikztosvg` SVG uses point-sized viewBoxes, glyph paths, nonzero part
fills, and one compound outline/split path with butt caps and miter joins.
The math case places the three empty sections at about 16.04pt between adjacent
separator centers. TikZKit emits separate fill paths, separator paths, and the
outer rectangle, with the same physical empty-section spacing and cap/join
behavior. Live SVG text remains renderer-owned.

## Visual review

- `shapes-rectangle-split-empty-rules-flowchart`: both empty pipeline slots
  have the native width and height. Their named anchors remain centered, so
  the Retry and Commit arrows leave the same points in all three references.
- `shapes-rectangle-split-empty-rules-math`: all three gaps have equal native
  width; the `g_1`, `g_2`, and `g_3` guides are centered below those gaps.
  Formula parts remain base-aligned and each custom fill ends at the correct
  separator.
- `shapes-rectangle-split-empty-rules-physics`: two widths from a named style
  and one local width accumulate. Both photon arrows land at the empty-part
  anchors and the bandwidth arrow spans the complete node.

Before the change, direct repeated widths measured 7.31pt instead of 9.31pt
in the zero-padding regression, and style plus local widths measured 8.31pt
instead of 13.31pt. This made real empty parts visibly too narrow. After the
change, both metrics match the PGF rule calculation. The math sheet remains
about 6 raster pixels narrower overall because TikZKit's live formula glyph
advance is smaller than the converted Computer Modern outlines; the repeated
empty-part widths and separator locations themselves align. No required
element is missing or clipped.

## Semantic coverage

The accepted cases cover `\tikzset`, named `.style` definitions, local node
options, `\nodepart`, horizontal rectangle splits, per-part fills, part
alignment, named part anchors, calc offsets, ordinary paths, and Latex arrow
tips. Every repeated width, height, and depth literal is listed by the strict
case audit. All three cases have zero TODOs, zero blockers, and zero TikZKit
diagnostics.

## Verification

```sh
node --test --test-reporter=spec test/options.test.js test/shapes-multipart-empty-metrics.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-shapes-multipart-empty-rules --only shapes-rectangle-split-empty-rules-flowchart,shapes-rectangle-split-empty-rules-math,shapes-rectangle-split-empty-rules-physics --tikztosvg-engine pdflatex --math-renderer svg-text --native-reference --continue-on-external-failure
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-multipart-empty-rules
```

All three renderers completed all three cases. The slice is visually accepted,
and `shapes.multipart` is promoted from `partial` to `builtin`.

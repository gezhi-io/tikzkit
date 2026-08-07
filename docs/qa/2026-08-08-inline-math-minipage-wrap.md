# Mixed Inline-Math `minipage` Paragraph QA

## Scope And Acceptance Boundary

This slice implements one shared fixed-width paragraph behavior only: an outer
TikZ node `minipage` whose prose contains inline math. The real driver is
[`real-world/minipage-text-width.tex`](../../test/fixtures/implementation-examples/real-world/minipage-text-width.tex).

Acceptance for this slice is visual, not merely diagnostic:

- keep inline `\alpha = \gamma` as one TeX-sized word group;
- reproduce the native four-line paragraph, including `re-` / `lation`;
- preserve the fixed `0.35\textwidth` node width, arrow endpoint, and 1ex
  padding; and
- size the rounded node from the TeX paragraph vbox rather than the larger SVG
  painted-glyph cache.

It does not claim full TeX paragraph composition, arbitrary-language
hyphenation, footnotes, lists, or nested minipages.

## Local MacTeX Reading

Reviewed TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/source/latex/base/ltboxes.dtx`:
  `\@iiiminipage` establishes the requested width as `\hsize`, `\textwidth`,
  and `\columnwidth`, then packs the paragraph in a minipage vbox. Its height
  is the first line height plus each baseline interval plus the final line
  depth, not the union of painted glyphs.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/hyph-utf8/patterns/tex/hyph-en-us.tex`
  and `patterns/txt/hyph-en-us.pat.txt`: US English declares left/right
  hyphen minima of 2/3 and supplies Liang patterns. TikZKit does not bundle the
  whole pattern dictionary; this slice uses only conservative safe English
  candidates required by the visible driver.

The native driver extracted with `pdftotext -layout` is:

```text
When α = γ, keep the re-
lation with its explanatory
sentence so the block wraps
naturally.
```

## Implemented Source Surface

The driver exercises `\documentclass[border=2pt]{standalone}`,
`\usepackage{tikz}`, `tikzpicture`, `\node`, an outer
`\begin{minipage}{0.35\textwidth}`, inline `\alpha`, `=`, `\gamma`, a named
node `(note)`, `draw`, `rounded corners`, `fill=red!10`, `inner sep=1ex`, and
`\draw[-stealth,thick,blue] ... (note.west)`.

Implemented in this slice:

- `0.35\textwidth` resolves into the shared fixed text width;
- inline math is measured as an indivisible TeX-sized token;
- sequential outer-minipage wrapping uses a normal-space shrink allowance;
- a following plain English word may contribute a conservative hyphenated
  prefix, then subsequent whole tokens are repacked; and
- outer-minipage node height uses the TeX vbox metric rather than the cached
  SVG glyph extent.

Still partial: complete Liang dictionaries and language selection, TeX
badness/penalty optimization, arbitrary discretionary commands, justification,
footnotes, and nested minipage vertical semantics.

## Three-Way Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The reproducible ignored artifacts are in:

`outputs/qa-inline-math-minipage-wrap-2026-08-08/`

- MacTeX native PNG: `mactex-png/real-world-minipage-text-width.png`;
- TikZKit SVG/PNG: `tikzkit-svg/real-world-minipage-text-width.svg` and
  `tikzkit-png/real-world-minipage-text-width.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/real-world-minipage-text-width.svg` and
  `tikztosvg-png/real-world-minipage-text-width.png`;
- 1cm-grid variants in `tikzkit-grid-*` and `tikztosvg-grid-*`; and
- inspected comparison panels:
  `diff/real-world-minipage-text-width-native-sheet.png`,
  `diff/real-world-minipage-text-width-sheet.png`, and
  `diff-png/real-world-minipage-text-width.png`.

I inspected the MacTeX, TikZKit, tikztosvg, grid, and diff panels. Before the
change, TikZKit omitted `re-`, shifted `relation` to the next line without a
hyphen, packed `wraps naturally.` onto the last line, and made a 206x81px
canvas. Afterward all three renderers visibly use the same four lines and the
same rounded-box/arrow placement. MacTeX and TikZKit now crop to 206x77px;
tikztosvg crops to 206x78px. The remaining red pixels are glyph rasterization
and SVG path-versus-text antialiasing, not a missing element or a layout shift.
The post-change JS-vs-tikztosvg comparison reports 20.39% changed pixels and
mean absolute RGBA 0.0374; these numbers are supporting context, not the
acceptance criterion.

The tikztosvg SVG has `viewBox="0 0 154.07 57.79"`, glyph `<use>` groups, and
a vector rounded rectangle; it has no `foreignObject`. TikZKit emits a native
SVG `<text>` with four `<tspan>` lines. This explains the remaining glyph-edge
diff while the line positions and node geometry agree.

## Verification

Passed:

```bash
node --test --test-name-pattern='outer minipage width|mixed-inline-math minipage|compact inline math|reflows a minipage inline-math paragraph|uses conservative English hyphenation' \
  test/interpreter.test.js test/renderer.test.js test/text-package-macros.test.js

node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/implementation-examples \
  --output outputs/qa-inline-math-minipage-wrap-2026-08-08 \
  --only real-world-minipage-text-width \
  --native-reference --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa-inline-math-minipage-wrap-2026-08-08
```

All one-of-one TikZKit, tikztosvg, and MacTeX artifacts rendered and the
TikZKit diagnostic count remained zero. This is a completed visual improvement
for the stated minipage paragraph slice, not a blanket claim for TeX layout.

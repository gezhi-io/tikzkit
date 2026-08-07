# Browser Mixed-Math Fixed-Width Paragraph QA

## Scope And Acceptance Boundary

This slice fixes one browser-visible discrepancy only: a TikZ `text width`
node containing prose plus inline math must select the same line groups in the
browser rich-text/HTML route as in TikZKit's SVG-text fallback and the local
reference renderers. The real driver is
[`real-world/parallel-line-angles.tikz`](../../test/fixtures/implementation-examples/real-world/parallel-line-angles.tikz).

Acceptance is visual and intentionally narrow:

- a `text width=6cm` paragraph has the native three-line grouping;
- inline colored `AB`, `CD`, `\mathbin{\|}`, `\alpha = \gamma`, and
  `\beta = \delta` stay attached to the appropriate prose;
- the red rounded text box, parallel-line geometry, four filled angle pics,
  and their labels remain in place; and
- the reference pipeline produces all TikZKit, tikztosvg, and native MacTeX
  artifacts when the source is a bare `.tikz` fragment.

It does not claim full TeX paragraph breaking, arbitrary browser font-raster
parity, or generic document-preamble inference.

## Source Surface Audited

The driver uses `\usetikzlibrary{angles,calc,quotes}`, `angle radius=.75cm`,
six polar/cartesian nodes, two `intersection cs` coordinates, a path with
red/blue/thick edges, four `pic {angle=...}` constructions, `right=1cm`,
`text width=6cm`, `rounded corners`, `fill=red!20`, `inner sep=1ex`, and the
mixed inline formulas named above. The current focused implementation covers
the fixed-width node's wrapping and the already-supported angle/intersection
features; it does not generalize this result to every TikZ library feature.

## Local MacTeX Reading

Reviewed TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`:
  `/tikz/text width` stores a fixed width, supplies a ragged-right text action
  (`\rightskip=0pt plus2em`, normal `\spaceskip`/`\xspaceskip`), and places
  node contents in a minipage-like box before shape sizing.
- `/usr/local/texlive/2025/texmf-dist/source/latex/base/ltboxes.dtx`:
  `\@iiiminipage` carries the requested width through `\hsize`, `\textwidth`,
  and `\columnwidth`, then packs the paragraph as a vertical box.

The consequence for TikZKit is that the browser renderer must not choose a
different character-count wrapper from the SVG-text fallback merely because it
uses HTML for the final formula paint.

## Implemented Behavior

`wrapRichTextLines()` now detects source lines with inline math and delegates
their break decisions to `wrapSvgTextLineWithSource()`. It passes the original
TeX source, fallback text, physical text width, and resolved line font size;
the browser renderer still paints scoped formula HTML afterward. Plain rich
text keeps its existing browser-oriented wrapper.

`normalizeNativeMacTeXInput()` now preserves full documents unchanged, but
wraps a body-only `.tikz` fragment in `standalone`, adds `tikz` when missing,
retains its `\usepackage`, `\usetikzlibrary`, and `\usepgfplotslibrary`
declarations, and adds `pgfplots` only when an axis/addplot fragment requires
it. This makes native reference rendering symmetric with tikztosvg's fragment
preamble behavior instead of failing at a leading `\usetikzlibrary`.

Still partial: TeX's global line-breaking optimization, arbitrary hyphenation
patterns, penalties/glue, nested minipages, arbitrary package-order inference,
and exact HTML-versus-TeX glyph rasterization.

## Three-Way Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Reproducible ignored artifacts are in
`outputs/qa-rich-text-paragraph-2026-08-08/`:

- native MacTeX: `mactex-png/real-world-parallel-line-angles.png`;
- TikZKit SVG/PNG: `tikzkit-svg/real-world-parallel-line-angles.svg` and
  `tikzkit-png/real-world-parallel-line-angles.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/real-world-parallel-line-angles.svg` and
  `tikztosvg-png/real-world-parallel-line-angles.png`;
- grid variants in `tikzkit-grid-*` and `tikztosvg-grid-*`; and
- inspected panels: `diff/real-world-parallel-line-angles-native-sheet.png`,
  `diff/real-world-parallel-line-angles-sheet.png`, and
  `diff-png/real-world-parallel-line-angles.png`.

I inspected the native, TikZKit, tikztosvg, grid, and diff panels. Before the
browser change, its rich-text layout split after `are`, then left `then` and
the relations on different lines. After the change all paths group the text as:

```text
When we assume that AB and CD
are parallel, i.e., AB || CD, then alpha = gamma
and beta = delta.
```

The visual math remains typeset, so the ASCII transcription above records only
the line groups. The rounded box, line/angle positions, colors, and labels are
unchanged. The current diff panel has glyph-edge antialiasing residuals rather
than missing elements or a shifted text box. The tikztosvg SVG is a vector
`viewBox="0 0 371.28 125.49"` with glyph `<use>` definitions and no
`foreignObject`; TikZKit's comparison artifact is SVG `<text>`/`<tspan>`.
That output-model difference explains the remaining glyph-shape pixels.

The browser-specific path was checked separately through `renderWorkbenchSource()`
with the scoped math renderer: diagnostics remained zero and it returned the
same three rich-text lines. Raster artifact generation exercises the SVG-text
fallback, so the two checks together cover the two render paths.

## Verification

Passed:

```bash
node --test --test-name-pattern='wraps rich TikZ text width paragraphs|keeps compact inline math|reflows a minipage inline-math paragraph|native MacTeX reference wraps a bare TikZ fragment' \
  test/renderer.test.js test/example-render-script.test.js

node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/implementation-examples \
  --output outputs/qa-rich-text-paragraph-2026-08-08 \
  --only real-world-parallel-line-angles \
  --native-reference --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa-rich-text-paragraph-2026-08-08
```

The render reports one-of-one TikZKit, tikztosvg, and MacTeX outputs with zero
TikZKit diagnostics and zero external-render failures. This is a completed
visual improvement for the stated rich-text fixed-width scope, not blanket
TeX paragraph compatibility.

# `arrows.meta` `Latex` Terminal Assembly

## Scope

This slice implements one shared capability: the capitalized
`arrows.meta` `Latex` tip now keeps PGF's distinct visible-tip placement and
covered-line end. It applies to both a start terminal such as
`arrows={{Latex[scale=.5]}-}` and an end terminal such as
`-{Latex[scale=.5]}`.

The boundary is deliberately narrow. It does not claim composite tips, the
full arrow key space, per-tip padding/separation, arbitrary arrow declaration
setup code, or every bending/flex mode.

## Local MacTeX Study

Reviewed these TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`:
  the `Latex` declaration sets `length=+3pt 4.5 .8`, `width'=+0pt .75`, caps
  the outline width, records its inner length, then draws the outline from
  that inner base to the visible tip.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`:
  `\pgfarrowssettipend`, `\pgfarrowssetlineend`, and the arrow drawing shift
  keep the line end and the visible arrow point as different coordinates.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`:
  documents the scale keys used by the real driver.

The implementation therefore exposes two renderer-neutral measurements from
the shared metric calculation: `terminalPlacement` for the covered path end,
and `tipPlacement` for the visible pointed outline. It does not hardcode the
network geometry.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The batch also generated local MacTeX native
PNGs. All three renderers succeeded for both cases.

- Before: `outputs/qa-arrows-meta-line-end-before-2026-08-07/`
- After: `outputs/qa-arrows-meta-line-end-after-2026-08-07/`

Each directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, and
comparison sheets. Inspected after panels:

- `outputs/qa-arrows-meta-line-end-after-2026-08-07/diff/arrows-meta-latex-reverse-line-end-sheet.png`
- `outputs/qa-arrows-meta-line-end-after-2026-08-07/diff/latex-examples-feed-forward-perceptron-sheet.png`
- `outputs/qa-arrows-meta-line-end-after-2026-08-07/diff/latex-examples-feed-forward-perceptron-native-sheet.png`

The tikztosvg SVG confirms that the reference uses independent filled/stroked
arrow `path` elements with transforms, not SVG markers. Its line ends at the
assembly base while the pointed `Latex` outline extends from that base.

## Visual Result

Before, TikZKit placed a scaled `Latex` outline directly at the raw terminal
and shortened the source line by the visible inner length. In the real
`latex-examples-feed-forward-perceptron` case this left red residual clusters
around the output and hidden nodes: arrow points and their joins sat on the
wrong side of the PGF assembly base.

After, both line ends stop at the PGF base and the visible arrow point is
placed separately. The small standalone driver aligns the start/end arrow
geometry with tikztosvg; in the real network the large node-adjacent clusters
collapse to sparse antialiasing residuals. TikZKit versus tikztosvg changed
pixels for the real network fell from 1.22% to 0.28%; TikZKit versus native
MacTeX fell from 3.90% to 3.16%. Those numbers support the inspected visual
change rather than replacing it.

## Implementation and Verification

Changed shared code:

- `src/tikz/metrics.js`: derives the PGF `Latex` terminal base and visible-tip
  offsets from active line width and scales.
- `src/renderers/svg/paths.js`: uses the base to shorten the painted path and
  the visible-tip offset to place the inline SVG outline.
- `test/renderer.test.js`: verifies both the line end and visible-tip
  transforms.
- `test/fixtures/examples/arrows/meta-latex-reverse-line-end.tex`: independent
  local regression driver.

Verification:

```bash
node --test --test-name-pattern='Latex tip scale|Latex tips at their PGF-specific line ends|uses the arrows.meta Latex geometry|arrows.meta length and width' test/renderer.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-arrows-meta-line-end-after-2026-08-07 \
  --only arrows-meta-latex-reverse-line-end,latex-examples-feed-forward-perceptron \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-arrows-meta-line-end-after-2026-08-07 \
  --register --alignment-radius 3
```

## Remaining Work

Composite arrow lists, arbitrary `sep`/`pad` keys, flexible/bending arrow
placement, and setup-code declarations remain partial. The next arrow slice
should take one of those families rather than adding per-diagram adjustments.

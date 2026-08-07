# Node-Local `minipage` Text Width

## Scope

This focused slice implements one shared node-layout behavior: an outer
`minipage` inside a TikZ node supplies the node's text width when the node does
not already have an explicit TikZ `text width`. It also accepts TeX's implicit
scalar/register length syntax such as `0.35\textwidth`. Explicit TikZ `text
width` remains authoritative.

The driver is
`test/fixtures/implementation-examples/real-world/minipage-text-width.tex`.
This is deliberately not a claim of complete `minipage` support: nested box
vertical layout, footnotes, lists, floats, native hyphenation, and TeX's
glue/penalty justification are excluded.

## Local MacTeX Reading

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx`,
  `\@iiiminipage`: it assigns the required width to `\@tempdima`, then sets
  `\hsize`, `\textwidth`, and `\columnwidth` before `\@parboxrestore` and
  starts the minipage paragraph box.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
  and `pgfmanual-en-tikz-shapes.tex`: node `text width` is the corresponding
  fixed text box used before paragraph breaking.

The implementation follows that shared width-box idea rather than preserving a
fake `minipage` command in renderer text. `src/tikz/text.js` extracts the
outer width before text macro expansion; `src/engine/evaluate.js` installs it
as `text width`; and `src/engine/math.js` inserts the multiplication required
by JavaScript for `0.35\textwidth`.

## Commands And Parameters Exercised

The source uses `\documentclass[border=2pt]{standalone}`, `\usepackage{tikz}`,
`\begin{tikzpicture}`, `\node`, an outer `\begin{minipage}{0.35\textwidth}`,
inline `$\alpha = \gamma$`, `draw`, `rounded corners`, `fill=red!10`,
`inner sep=1ex`, a named node `(note)`, its `west` anchor, `\draw`,
`-stealth`, `thick`, and `blue`. The regression also checks the precedence of
an explicit `text width=2cm` over the enclosing `minipage` width.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are ignored but reproducible in:

`outputs/qa-minipage-text-width-2026-08-07/after-flush/`

- MacTeX PNG: `mactex-png/real-world-minipage-text-width.png`
- TikZKit SVG/PNG: `tikzkit-svg/real-world-minipage-text-width.svg` and
  `tikzkit-png/real-world-minipage-text-width.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/real-world-minipage-text-width.svg` and
  `tikztosvg-png/real-world-minipage-text-width.png`
- gridded SVG/PNGs plus `diff/real-world-minipage-text-width-native-sheet.png`

The tikztosvg SVG has a tight `viewBox` and vector glyph/path groups, not an
HTML `foreignObject`; its box geometry and line breaking are therefore a
useful second implementation reference alongside native MacTeX.

Before the change, TikZKit discarded the minipage width and produced one long,
overwide text line. After the change, TikZKit, tikztosvg, and MacTeX all place
the arrow and the same-width, four-line rounded box at the same coordinate.
TikZKit's sequential fallback does not yet reproduce MacTeX's discretionary
`re- / lation` hyphenation or its later-line packing exactly; the inspected
diff remains nonzero for those glyph/line-break differences. This is a real
visual improvement, not full paragraph-layout parity.

## Verification

Passed:

```bash
node --test --test-name-pattern='outer minipage width|passes TikZ text width' test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/implementation-examples \
  --only real-world-minipage-text-width \
  --output outputs/qa-minipage-text-width-2026-08-07/after-flush \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
node scripts/diff-example-pngs.js \
  --output outputs/qa-minipage-text-width-2026-08-07/after-flush --alignment-radius 3
```

The focused test and diagnostics pass. Broader rendering coverage must still
be reviewed case by case because this change intentionally does not claim full
TeX paragraph composition.

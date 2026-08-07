# Scoped CMBX Bold Text

## Scope And Acceptance Target

This slice changes one shared text-rendering behavior: a plain-text segment
made bold by `\textbf{...}` or `\bfseries` selects the bundled Computer Modern
Bold Extended (CMBX) face at the active TeX design size. It does not attempt a
general font package implementation, reflow matrix geometry, or change math
font selection.

The real driver is
[`test/fixtures/examples/latex-examples/haskell-type-classes.tex`](../../test/fixtures/examples/latex-examples/haskell-type-classes.tex).
Its matrix cells use `\textbf{Eq}`, `\textbf{Show}`, and the local
`{\small ...}` declaration. The acceptance target is that those headers use
the native bold face while the following body text remains regular and the
existing ellipse, row, column, and arrow placement stay unchanged.

## Local MacTeX Reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarymatrix.code.tex`
  confirms that each matrix cell is an ordinary named TikZ node: cell text
  metrics determine its own node box, then row/column separation places that
  box.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx` declares
  `\textbf` through `\bfseries`, so the command changes only the scoped
  selection rather than creating a new text object.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/size10.clo` defines the
  normal 10pt/12pt and `\small` 9pt/11pt text-size and baseline pairs. CMBX
  provides 5, 6, 7, 8, 9, 10, and 12pt design faces; 17pt display text follows
  the 12pt bold face.

## Source Surface Audit

| Surface | Status |
| --- | --- |
| `\usetikzlibrary{shapes}` and `\matrix[row sep=0.5cm,column sep=0.5cm]` | Existing matrix/node placement; reviewed and unchanged |
| `\tikzstyle{node}` with ellipse, 3cm text width, `align=center` | Existing shared node and paragraph layout; unchanged |
| `\textbf{...}`, `\bfseries` | Implemented as a scoped CMBX font-family selection |
| `{\small ...}` | Existing 9pt/11pt scoped line sizing and baseline skip; preserved |
| `\draw[edge]`, `->`, `ultra thick` | Existing renderer support, exercised but out of this slice |

`npm run case:audit -- test/fixtures/examples/latex-examples/haskell-type-classes.tex --strict`
still blocks because its ownership/review manifest does not yet map every
document-wrapper command or `\textbf`/`\small`; this is audit metadata debt,
not a renderer diagnostic. The render pipeline itself reports zero TikZKit,
tikztosvg, and MacTeX failures for this case.

## Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
`/opt/homebrew/bin/rsvg-convert`. The inspected artifacts are ignored by Git
and live in
[`outputs/qa-inline-cmbx-bold-2026-08-08/`](../../outputs/qa-inline-cmbx-bold-2026-08-08/):

- `tikzkit-svg/` and `tikzkit-png/` are the JavaScript output.
- `tikztosvg-svg/` and `tikztosvg-png/` are the local third-party reference.
- `mactex-png/` is the native acceptance reference.
- `diff/latex-examples-haskell-type-classes-native-sheet.png` is the inspected
  TikZKit/tikztosvg/MacTeX/diff panel; all panels also have a 1cm grid variant.

Before this change, TikZKit emitted `font-weight="700"` while retaining the
regular `TikZKitCMR10` family, leaving `Eq`, `Show`, `Read`, and the other
headers visibly too light. After it, each scoped header receives
`font-family="TikZKitCMBX10, TikZKitCMUSerif, serif"`; the bold glyph shape and
width visually match the MacTeX headers, while regular descriptions, the
`\small` Enum line, node centers, and connectors do not move.

The registered TikZKit-to-MacTeX pixel residual changes from `0.19334` to
`0.19626`. That aggregate number is not accepted as an improvement signal here:
it penalizes the intentional replacement of a regular CMR outline with the
correct CMBX outline. The visible acceptance condition is met, but remaining
whole-panel differences include text rasterization and a 528x408px TikZKit crop
against the 537x422px native crop. tikztosvg is less faithful for this case's
`(->)` body text, so MacTeX remains the visual authority.

## Implementation And Verification

Changed files:

- `src/renderers/svg/plainTextNode.js`
- `test/svg-renderer.test.js`
- `docs/extension-registry.csv`
- `README.md`

```bash
node --test --test-name-pattern='scoped text font wrappers|keeps scoped textbf|measures text-width' \
  test/svg-renderer.test.js test/text-package-macros.test.js
npm run examples:render -- --output outputs/qa-inline-cmbx-bold-2026-08-08 \
  --only latex-examples-haskell-type-classes --tikztosvg --native-reference --grid
npm run examples:diff -- --output outputs/qa-inline-cmbx-bold-2026-08-08 \
  --register --alignment-radius 3
```

The focused regression tests pass. The tri-render run generated all SVG/PNG
artifacts with zero external failures. The broader SVG test file has one
pre-existing, unrelated arrow-bounds tolerance failure (`57.09pt` versus an
expected `57.49pt`); this slice neither changes arrow code nor adjusts that
tolerance.

## Remaining Work

- The semantic-audit ownership map should be extended so `\textbf`, `\small`,
  style declarations, and their source review are visible in an accepted case
  manifest.
- Font-family selection currently covers bundled Computer Modern Roman bold
  design sizes. Sans, mono, italic-bold, and arbitrary package font switching
  need their own evidence-driven slices.

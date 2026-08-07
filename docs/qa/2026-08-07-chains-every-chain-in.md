# Chains `every chain in` QA

## Scope

This pass implements one bounded TikZ `chains` behavior: a `\chainin` command
inherits the active `every chain in` style before applying the command's direct
bracket options. It also accepts the documented grouped join style form such as
`join=by {red,very thick}`.

The real driver is
`test/fixtures/examples/chains/branches-and-chainin.tex`. It is adapted from
the local chains manual's existing-node example and retains forked branches so
the implementation is checked alongside normal chain aliases and joins.

## Local MacTeX Reading

Read from TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-chains.tex`, lines 302-343. The manual defines `\chainin` as a shortcut that puts an existing node on the active chain, optionally joins it to the previous node, and positions later nodes relative to it.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarychains.code.tex`, lines 197-212. `\tikz@lib@chainin@` lowers the command to `late options={name=#1,on chain,every chain in/.try,#2}`. Therefore inherited style keys precede direct command keys.

TikZKit mirrors that order. The generic join parser additionally strips an
outer option group before parsing the edge style; TeX's `edge[every join,#1]`
accepts the same grouped form.

## Command And Parameter Audit

The driver uses:

- `\usetikzlibrary{chains,arrows.meta}`.
- `node distance=3mm and 10mm`; `every node/.style` with `draw`,
  `minimum width=8mm`, and `minimum height=6mm`.
- `every join/.style={-{Stealth[length=1.8mm]}}`.
- `every chain in/.style={join=by {red,very thick}}`.
- `start chain`, `on chain`, `\chainin`, `start branch`, `continue branch`,
  `join=with`, `going above`, and `going below`.

The accepted slice includes inherited and explicit `join=by` styles. It does
not claim arbitrary continuation of the source path after `\chainin`, generic
TeX late-options handlers, or multi-chain mutation after arbitrary path code.

## Three-Way Visual Evidence

Local references were available:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- PNG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- MacTeX: local `pdflatex` plus `pdftocairo`

Artifacts are deliberately local and ignored by Git:

- Before: `/private/tmp/tikzkit-qa-chains-every-chain-in-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-chains-every-chain-in-after-2026-08-07/`

Each directory contains `mactex-png/`, `tikzkit-svg/`, `tikzkit-png/`,
`tikztosvg-svg/`, `tikztosvg-png/`, 1cm-grid variants, and
`diff/chains-branches-and-chainin-native-sheet.png`.

The tikztosvg SVG has a `134.67pt x 125.92pt` viewBox, TeX outline glyph paths,
and flipped `matrix(1,0,0,-1,...)` drawing transforms. Its inherited join is a
red `stroke-width="1.19553"` line with a separately transformed red arrow-tip
path. TikZKit emits the same semantic line and arrow as SVG paths plus live
SVG text; its viewBox is `138.26pt x 129.51pt`. The remaining canvas and glyph
raster differences are expected reference-format differences, not missing
chain geometry.

## Visible Change

Before the change, the TikZKit panel had no `B -> existing` connection when
the fixture used only `every chain in/.style={join=by {red,very thick}}`.
MacTeX and tikztosvg both rendered a red, very-thick diagonal Stealth arrow.

After the change, the TikZKit panel visibly contains that same red diagonal
arrow from `B` to `existing`; its endpoint is cropped at the existing node and
the following `C` node still continues from `existing`. The branch chains
(`1 -> 2` and `alpha -> beta`) and all black joins remain in their original
locations. The registered MacTeX comparison changed-pixel ratio improves from
`0.09783` to `0.09342`; the important acceptance evidence is the restored
arrow, not that aggregate number.

## Verification

```sh
node --test --test-name-pattern='chainin inherits every chain in|explicit chainin options override|chains an existing|adds chain join edges' test/interpreter.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only chains-branches-and-chainin \
  --output /private/tmp/tikzkit-qa-chains-every-chain-in-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg

npm run examples:diff -- --output /private/tmp/tikzkit-qa-chains-every-chain-in-after-2026-08-07 \
  --register --alignment-radius 5

npm run extension-registry
```

All four focused semantic regressions pass. The final visual run produced all
TikZKit, tikztosvg, and MacTeX artifacts with zero external failures and no
TikZKit diagnostics.

## Next Boundary

The next `chains` slice should implement the full path continuation described
by the manual after `\chainin`; it needs a parser representation for the
surrounding `\path` statement rather than adding more behavior to this command
in isolation.

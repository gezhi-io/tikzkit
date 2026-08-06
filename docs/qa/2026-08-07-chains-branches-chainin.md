# Chains Branches And `chainin` QA

## Scope

This pass implements one bounded `chains` library feature family: forked
`start branch` / `continue branch` chains and `\chainin` insertion of an
already drawn node. The driver is
`test/fixtures/examples/chains/branches-and-chainin.tex`, adapted from the
local TikZ chains manual examples. It exercises two normal chains, two delayed
branches, `parent/branch` endpoint aliases, a direct existing-node insertion,
`join`, `every join`, `node distance=3mm and 10mm`, and a scaled `Stealth`
tip.

This does not claim full `chains` parity. Inherited `every chain in` style
expansion and continuing an arbitrary path after `\chainin` remain partial.

## Local Source Reading

Read from local TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarychains.code.tex`, lines 14-36 and 197-212.
  `start chain` holds an active chain name, placement, count, and aliases;
  `\chainin` is lowered to late `on chain` options; `start branch` starts
  `current/branch` and first chains the parent end node; `continue branch`
  is a `continue chain` using that qualified name.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-chains.tex`, lines 303-343 and 409-495.
  The manual specifies that `\chainin` does not redraw the existing node,
  its `join` connects it to the previous chain endpoint, and following nodes
  position relative to it. It also specifies that a branch begins at the fork
  node and preserves the parent chain when the branch scope ends.

The interpreter mirrors those state transitions: it seeds `parent/branch-1`,
`parent/branch-begin`, and `parent/branch-end` with the fork node record;
then later `continue branch` resumes the same chain state. `\chainin` adds
the existing record to the active chain and runs the ordinary join-path code,
without emitting another node box.

## Command And Parameter Audit

`node scripts/case-semantic-audit.js test/fixtures/examples/chains/branches-and-chainin.tex`
found 9 command families, 12 option paths, and 9 numeric literals. The
relevant rendering surface is:

- Implemented in this pass: `\chainin (existing) [join]`,
  `start branch=numbers going below`, `start branch=greek going above`,
  `continue branch=numbers`, `continue branch=greek`, `on chain`,
  `join=with trunk/numbers-end`, and `join=with trunk/greek-end`.
- Existing shared behavior used by the case: `start chain`, `node distance`,
  `every node/.style` (`draw`, `minimum width=8mm`, `minimum height=6mm`),
  `every join/.style={-{Stealth[length=1.8mm]}}`, and inline `\alpha` /
  `\beta` math labels.
- Still partial: `every chain in` inherited styles, arbitrary continuation of
  the path containing `\chainin`, and general TeX math layout beyond the
  shared inline-label renderer.

The generated audit is kept with the visual artifacts at
`/private/tmp/tikzkit-qa-chains-branches-2026-08-07-final/semantic-audit.md`.
It deliberately reports generic document/font review items separately from
this feature's zero parser/interpreter diagnostics.

## Three-Way Reference

Local `tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; SVGs were
rasterized through `/opt/homebrew/bin/rsvg-convert`. Native MacTeX uses local
`pdflatex` and `pdftocairo`. Final artifacts are in:

`/private/tmp/tikzkit-qa-chains-branches-2026-08-07-final/`

The directory contains all four comparison forms:

- `mactex-png/chains-branches-and-chainin.png`
- `tikzkit-svg/` and `tikzkit-png/`, plus the 1cm-grid variants
- `tikztosvg-svg/` and `tikztosvg-png/`, plus the 1cm-grid variants
- `diff/chains-branches-and-chainin-native-sheet.png` and registered diff

`tikztosvg` emits a `134.672pt x 125.920pt` SVG with outline glyph `<path>`
elements, TeX's flipped `matrix(1,0,0,-1,...)` drawing transforms, and
`stroke-width="0.3985"` paths. TikZKit emits semantic SVG `<text>` plus
geometry paths and an explicit `138.26pt x 129.51pt` view box. The remaining
size delta is therefore mostly crop padding and browser glyph rasterization,
not a missing branch or misplaced fork.

## Visual Result

Before this pass, `start branch`, `continue branch`, and `\chainin` were
unparsed/partial: a real fork either produced an unsupported-statement
diagnostic or left subsequent nodes on the parent chain. There was no
`parent/branch-end` alias for the two joins, and chaining an existing node
could not make the following node continue from that node.

After the change, the viewed MacTeX/TikZKit/tikztosvg sheet has the same
recognizable structure in all three panels: the upper `existing` box joins to
the main walk without being duplicated; the `trunk` stays horizontal
`A -> B -> C`; `1 -> 2` grows downward from `B`; and
`alpha -> beta` grows upward from `B`. The two joins from `C` terminate at
the expected branch endpoints. No element is absent from the TikZKit panel,
and the final render has zero TikZKit diagnostics.

The raw MacTeX-to-TikZKit comparator reports a `0.0939` changed-pixel ratio.
That is auxiliary: direct panel review attributes it to a roughly 5px crop
reserve, SVG text-versus-TeX outlines, and antialiasing. The fork geometry,
arrow direction, node positions, branch aliases, and text content are visibly
present and aligned.

## Verification

```sh
node --test --test-name-pattern='branch|chains an existing' test/interpreter.test.js

node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-chains-branches-2026-08-07-final \
  --only chains-branches-and-chainin \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-chains-branches-2026-08-07-final --register

npm run extension-registry
```

The focused regression passes. Final visual generation must complete with one
MacTeX PNG, one tikztosvg SVG/PNG, one TikZKit SVG/PNG, a native comparison
sheet, and no added diagnostics before this change is accepted.

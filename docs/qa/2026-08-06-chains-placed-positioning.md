# TikZ Chains Placed Positioning QA

## Scope

This slice implements the `chains` library's `placed` positioning family:

- `start chain=<name> placed <positioning>`;
- `continue chain=<name> placed <positioning>`;
- a one-node `on chain=<name> placed <positioning>` override; and
- a first-node `placed {at={(...)}}` rule.

It deliberately does not implement `start branch`, `continue branch`, or
`\chainin`. Those remain outside this accepted slice.

The visual driver is
`test/fixtures/examples/chains/placed-chain-layout.tex`. It places `Source`,
then `Parse` below it, uses a local rightward override for `Render`, and resumes
the stored downward placement for `Export`. The existing real-world
`latex-examples/doubly-linked-list.tex` is the no-regression companion case.

## Local MacTeX Study

Read these TeX Live 2025 files locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarychains.code.tex`:
  `start chain` and `continue chain` save a placement macro per chain;
  `on chain` assigns aliases and exposes `\tikzchainprevious` before applying
  that macro. A `going` rule skips the first node, whereas `placed` executes
  its rule for the first node too. A rule without `=` becomes
  `<direction>=of \tikzchainprevious`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-chains.tex`:
  confirms the first-node distinction and documents `placed {at=(...)}` for
  indexed placement.

This matters for validation: `start chain=flow placed below` followed by a
bare first `on chain` is invalid in native TeX because it asks for
`below=of` an empty previous-node name. The driver therefore uses the native
valid form `on chain={flow placed {at={(0,0)}}}` for its first node.

## Commands And Parameters

| Source item | Status | Notes |
| --- | --- | --- |
| `\usetikzlibrary{chains,positioning,arrows.meta}` | partial | chains placement subset plus existing positioning and arrow support |
| `node distance=7mm` | supported | edge-to-edge placement spacing |
| `start chain=flow placed below` | supported | stored per-chain placement |
| `on chain={flow placed {at={(0,0)}}}` | supported | legal first-node placement rule |
| `on chain=flow placed right` | supported | local-only override; stored `below` remains unchanged |
| `continue chain=flow placed right` | supported | changes stored placement in a scope or the current node |
| `chain-begin`, `chain-end`, `chain-<n>` | supported | aliases retained by existing chain machinery |
| `join=by`, `join=with ... by ...` | supported | existing chain edge subset |
| `start branch`, `continue branch`, `\chainin` | not implemented | explicitly retained as the partial boundary |

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
`/opt/homebrew/bin/rsvg-convert`; native reference compilation uses local
`pdflatex`.

Artifacts are in `outputs/qa-chains-placed-positioning/`:

- MacTeX PNG: `mactex-png/chains-placed-chain-layout.png`;
- TikZKit SVG/PNG: `tikzkit-svg/chains-placed-chain-layout.svg` and
  `tikzkit-png/chains-placed-chain-layout.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/chains-placed-chain-layout.svg` and
  `tikztosvg-png/chains-placed-chain-layout.png`;
- inspected four-way panels: `diff/chains-placed-chain-layout-native-sheet.png`
  and `diff/latex-examples-doubly-linked-list-native-sheet.png`.

The tikztosvg SVG has a tight `viewBox="0 0 128.36 100.41"`, maps TeX's
upward y axis using transformed path groups, and emits arrowheads as filled
paths rather than SVG markers. Its edges use butt caps and miter joins. That
matches the geometric model to preserve here: node-border spacing comes from
positioning, then a normal path and filled tip are painted between nodes.

## Visual Result

Before the repair, TikZKit parsed `flow placed below` as a literal chain name.
The next `on chain` node therefore used the fallback rightward direction, and
`on chain=flow placed right` incorrectly selected a different chain. The
intended vertical/horizontal sequence could not be reproduced.

After the repair, the inspected MacTeX, TikZKit, and tikztosvg panels all show
the same visible route: `Source -> Parse` down, `Parse -> Render` right, and
`Render -> Export` down. Each arrow terminates at the adjacent rectangle
border rather than its center. The companion doubly-linked-list case retains
its horizontal three-cell list nodes, looped back-links, and terminal cross
nodes. Residual differences are text rasterization and sub-pixel crop size,
not missing nodes, wrong chain direction, or incorrect edge attachment.

## Implementation And Verification

- `src/engine/evaluate.js`: stores `going` or `placed` placement objects;
  parses each location consistently; applies a one-node override without
  mutating stored placement; resolves explicit `placed at=(...)` coordinates.
- `src/tikz/libraries/chains.js`: records the supported scope and remaining
  partial boundary.
- `test/interpreter.test.js`: adds regression coverage for a local override
  and a `continue chain` placement change.
- `test/fixtures/examples/chains/placed-chain-layout.tex` and the manifest:
  add a MacTeX-valid visual driver.
- `docs/extension-registry.{md,csv}`: regenerated; `chains` now has eight
  tracked cases and source-reviewed partial status.

```bash
node --test --test-name-pattern='chains with the local placed|continues a placed chain|changes placed chain placement|places nodes on named chains|chain join|multiple named chains' test/interpreter.test.js
node --test --test-name-pattern='manifest points|fixtures convert' test/example-fixtures.test.js
node --test test/library-modules.test.js
npm run extension-registry
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-chains-placed-positioning \
  --only chains-placed-chain-layout,latex-examples-doubly-linked-list \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-chains-placed-positioning \
  --register --alignment-radius 3
```

All listed checks pass. The broader test files contain unrelated historical
failures, so the focused commands above are the acceptance gate for this
library slice.

## Remaining Work

- Implement branch activation/restoration and `\chainin` late options.
- Add `\tikzchaincount` expression expansion inside arbitrary placed rules.
- Extend the visual corpus with branch and multi-chain examples once those
  semantics are implemented.

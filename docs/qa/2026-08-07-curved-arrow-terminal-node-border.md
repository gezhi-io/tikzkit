# Curved Arrow Terminal Node-Border QA - 2026-08-07

## Scope

This slice corrects the terminal crop for curved `to[out=...,in=...]` and
`edge` paths whose arrow tip enters a circular or elliptical node. It does not
claim arbitrary node-shape borders, all arrow declarations, or general path
shortening.

The real driver is `latex-examples-artificial-neuron`; the regression panels
are `latex-examples-agent-environment-diagram-pomdp`,
`latex-examples-doubly-linked-list`, and
`latex-examples-hidden-markov-model-abc-2`.

## Local PGF Review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex`:
  the `to[out=...,in=...]` path obtains endpoint positions through
  `\pgfpointshapeborder` in the tangent directions.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`:
  circles include `outer sep` in their border calculation, while their visible
  background drawing subtracts it.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`:
  arrow geometry and line shortening depend on the active path line width.

The implementation therefore preserves the existing PGF-style outer separation
and applies an additional half-active-line-width endpoint extension only when a
curve has a terminal marker.

## Local References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

- Before: `/private/tmp/tikzkit-qa-curve-edge-terminal-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-curve-edge-terminal-after-2026-08-07/`

The after directory contains JavaScript SVG/PNG, `tikztosvg` SVG/PNG, MacTeX
native PNG, and the four-way `diff/*-native-sheet.png` panels for all four
cases.

In the `tikztosvg` SVG for the driver, the central circle's visible radius is
about `12.45pt`, while the first curved-arrow tip terminates at about
`13.05pt` from its center. TikZKit's corresponding terminal distance moved
from about `12.70pt` to `13.10pt`. The small rendered-pixel diff statistic did
not materially move because this is a sub-two-pixel endpoint correction at the
comparison scale; the inspected arrow-tip geometry did.

## Visual Inspection

Before the change, the five black tips in `artificial-neuron` ended too close
to or within the central circle's black outline. After the change, each tip
finishes outside that outline at the same visual radius as the MacTeX and
`tikztosvg` panels.

The POMDP, doubly linked list, and HMM panels remained visually unchanged:
their straight edges, bend edges, and loop arrows were not altered by this
circle/ellipse curved-terminal rule.

## Implementation And Verification

Changed `src/engine/evaluate.js` so curve clipping receives marker-aware
terminal padding. `nodeBorderPoint` expands only circle/circle-split and
ellipse/cloud endpoint geometry. Added a focused interpreter regression in
`test/interpreter.test.js`.

```bash
node --test --test-name-pattern='clips curved to-path arrows|extends curved arrow tips|attaches bend edges|keeps arrow endpoints' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-curve-edge-terminal-after-2026-08-07 --only latex-examples-artificial-neuron,latex-examples-agent-environment-diagram-pomdp,latex-examples-doubly-linked-list,latex-examples-hidden-markov-model-abc-2 --native-reference --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-curve-edge-terminal-after-2026-08-07 --register --alignment-radius 3
```

All focused interpreter checks passed. The render and diff workflow generated
all four artifact classes for all four fixtures; no diagnostics were added.

## Remaining Work

Rectangle, polygon, and custom shape endpoint expansion remains deliberately
unchanged. This slice also does not yet model tip-specific separation options,
arbitrary declared-arrow hulls, or every PGF arrow shortening interaction.

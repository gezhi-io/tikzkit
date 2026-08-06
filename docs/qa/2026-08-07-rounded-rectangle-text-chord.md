# Default Rounded Rectangle Text Chord QA

## Scope

This pass implements one shared `shapes` slice: the default convex
`rounded rectangle` node width. It deliberately does not claim arbitrary
rounded-rectangle arc modes, concave/straight end modes, or a general
`graphicx` implementation.

The real driver is `latex-examples-class-tree`, whose `clf` nodes use
`draw, outer sep=0pt, rounded rectangle, minimum height=0.8cm, align=center`.
All fourteen `\\includegraphics` resources were already embedded correctly;
the visible JS mismatch was the over-wide plain-text boxes that pushed the
tree branches and image columns apart.

## Local Source Reading

- Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex`, lines 77-205 and 368-398.
  PGF defaults both ends to `convex` with `rounded rectangle arc length=180`.
  It starts from the TeX content box plus `inner xsep`, computes a radius from
  the final half-height, then adds the convex chord width on each side.
- Read `/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/graphicx.sty` and
  `graphics.sty` while checking the image nodes. Their width/height aspect
  calculation was not the source of this case's mismatch.

## Reference and Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg` (run with `--pdflatex` for this
  local probe); PNG conversion: `/opt/homebrew/bin/rsvg-convert`.
- Full real-case artifact bundle:
  `/private/tmp/tikzkit-qa-rounded-rectangle-class-tree-2026-08-07/`
  - MacTeX PNG: `mactex-png/latex-examples-class-tree.png`
  - TikZKit SVG/PNG: `tikzkit-svg/latex-examples-class-tree.svg`,
    `tikzkit-png/latex-examples-class-tree.png`
  - tikztosvg SVG/PNG: `tikztosvg-svg/latex-examples-class-tree.svg`,
    `tikztosvg-png/latex-examples-class-tree.png`
  - four-panel visual sheet:
    `diff/latex-examples-class-tree-native-sheet.png`
- A focused tikztosvg geometry probe is at
  `/private/tmp/tikzkit-rounded-rectangle-geometry.svg` and `.png`.
  Its `pedestrian` path is 53.633pt wide.

## Visual Result

Before the change, TikZKit made the `pedestrian` box about 62.5pt wide because
it added a fixed `0.54em` on each side. After the change it is 53.7pt, against
the local tikztosvg 53.6pt reference. In the actual class tree, the JS
`pedestrian`, `four+-wheelers`, and `two-wheelers` capsules visibly contract;
their branch endpoints and the two image columns now align much more closely
with the MacTeX and tikztosvg panels. Images remain present and retain their
natural aspect ratios.

The MacTeX-aligned changed-pixel ratio for the whole panel fell from about
17.2% to 10.8%. This is supplementary only; acceptance is based on inspecting
the native/tikztosvg/TikZKit/diff sheet and the corrected shared node geometry.

## Implementation and Tests

- `src/engine/evaluate.js`: replaces fixed rounded-rectangle horizontal
  padding with the PGF convex-arc chord calculation.
- `test/petarv-compat.test.js`: adds a regression derived from the local
  53.633pt TikZKit/tikztosvg probe.
- `src/tikz/libraries/shapes.js`: records the implemented feature and source
  review for the generated registry.

Verified:

```sh
node --test --test-name-pattern='default convex rounded rectangles|A3C-style rounded math nodes|matches native A3C environment' test/petarv-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-rounded-rectangle-class-tree-2026-08-07 --only latex-examples-class-tree --native-reference --comparison-grid-mode svg --strict-tikztosvg --continue-on-external-failure --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-rounded-rectangle-class-tree-2026-08-07 --register --alignment-radius 3
node --test test/class-tree.test.js
```

The broad `test/petarv-compat.test.js` file still contains unrelated stale
font and transform snapshots; this pass's focused regression and class-tree
resource test pass. The unrelated failures are not changed or masked here.

## Remaining Work

- Support non-default `rounded rectangle arc length`, concave/straight arc
  modes, and their exact border-anchor paths.
- Continue separating formula metric calibration from this shape geometry;
  multi-line math nodes improved but still retain independent TeX/SVG text
  measurement residuals.

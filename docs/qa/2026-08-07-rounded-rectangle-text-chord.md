# Default Rounded Rectangle Text Chord QA

## Scope

This pass implements one shared `shapes` slice: the default convex
`rounded rectangle` node width and its border clipping for straight/curved
node edges. It deliberately does not claim arbitrary rounded-rectangle arc
modes, concave/straight end modes, or a general `graphicx` implementation.

The real driver is `latex-examples-class-tree`, whose `clf` nodes use
`draw, outer sep=0pt, rounded rectangle, minimum height=0.8cm, align=center`.
All fourteen `\\includegraphics` resources were already embedded correctly;
the visible JS mismatches were the over-wide plain-text boxes and their
connector endpoints being clipped to the box corners rather than the capsule.

## Local Source Reading

- Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex`, lines 77-205 and 368-430.
  PGF defaults both ends to `convex` with `rounded rectangle arc length=180`.
  It starts from the TeX content box plus `inner xsep`, computes a radius from
  the final half-height, then adds the convex chord width on each side. Its
  `anchorborder` first intersects the radial edge ray with a horizontal/vertical
  chord and otherwise intersects the matching circular end cap.
- Read `/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/graphicx.sty` and
  `graphics.sty` while checking the image nodes. Their width/height aspect
  calculation was not the source of this case's mismatch.

## Reference and Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg` (run with `--pdflatex` for this
  local probe); PNG conversion: `/opt/homebrew/bin/rsvg-convert`.
- Initial size-only artifact bundle:
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
- Follow-up edge-border artifact bundle:
  `/private/tmp/tikzkit-qa-rounded-rectangle-border-2026-08-07/`
  - MacTeX PNG: `mactex-png/latex-examples-class-tree.png`
  - TikZKit SVG/PNG: `tikzkit-svg/latex-examples-class-tree.svg`,
    `tikzkit-png/latex-examples-class-tree.png`
  - tikztosvg SVG/PNG: `tikztosvg-svg/latex-examples-class-tree.svg`,
    `tikztosvg-png/latex-examples-class-tree.png`
  - visual sheet: `diff/latex-examples-class-tree-native-sheet.png`
  - `tikztosvg` emits a 325.599pt by 169.426pt SVG viewBox. Each capsule is a
    stroked path with horizontal chords and cubic half-caps; straight branch
    paths begin at the corresponding cap intersection. It uses `butt` line
    caps and `miter` joins, while text is encoded as positioned glyph uses.

## Visual Result

Before the change, TikZKit made the `pedestrian` box about 62.5pt wide because
it added a fixed `0.54em` on each side. After the change it is 53.7pt, against
the local tikztosvg 53.6pt reference. In the actual class tree, the JS
`pedestrian`, `four+-wheelers`, and `two-wheelers` capsules visibly contract;
their branch endpoints and the two image columns now align much more closely
with the MacTeX and tikztosvg panels. Images remain present and retain their
natural aspect ratios.

The new border sheet was inspected as a four-panel TikZKit/tikztosvg/MacTeX/diff
comparison. In the JS panel, root-to-child edges now leave rounded nodes at
the visible capsule curve, matching the native panel, rather than terminating
at the invisible outer-rectangle corner. The whole panel is also 449x241px
instead of the earlier 455x241px browser result. The MacTeX-aligned changed
pixel ratio is 10.8% and mean absolute RGBA is 0.0200; these are supplementary
only, not the acceptance criterion.

## Implementation and Tests

- `src/engine/evaluate.js`: replaces fixed rounded-rectangle horizontal
  padding with the PGF convex-arc chord calculation and adds the matching
  default-cap `anchorborder` intersection for straight/curved paths.
- `test/interpreter.test.js`: regression for a diagonal line and `to[out=,in=]`
  curve, including terminal arrow padding.
- `test/petarv-compat.test.js`: adds a regression derived from the local
  53.633pt TikZKit/tikztosvg probe.
- `src/tikz/libraries/shapes.js`: records the implemented feature and source
  review for the generated registry.

Verified:

```sh
node --test --test-name-pattern='default convex rounded rectangles|A3C-style rounded math nodes|matches native A3C environment' test/petarv-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples --only latex-examples-class-tree --output /private/tmp/tikzkit-qa-rounded-rectangle-border-2026-08-07 --native-reference --tikztosvg-engine pdflatex --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-rounded-rectangle-border-2026-08-07 --register --alignment-radius 3
node --test --test-name-pattern='clips rounded-rectangle paths' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-rounded-rectangle-class-tree-2026-08-07 --only latex-examples-class-tree --native-reference --comparison-grid-mode svg --strict-tikztosvg --continue-on-external-failure --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-rounded-rectangle-class-tree-2026-08-07 --register --alignment-radius 3
node --test test/class-tree.test.js
```

The broad `test/petarv-compat.test.js` file still contains unrelated stale
font and transform snapshots; this pass's focused regression and class-tree
resource test pass. The unrelated failures are not changed or masked here.

## Remaining Work

- Support non-default `rounded rectangle arc length`, concave/straight arc
  modes, and their exact border-anchor paths. The new border clip covers only
  the default convex 180-degree end caps.
- Continue separating formula metric calibration from this shape geometry;
  multi-line math nodes improved but still retain independent TeX/SVG text
  measurement residuals.

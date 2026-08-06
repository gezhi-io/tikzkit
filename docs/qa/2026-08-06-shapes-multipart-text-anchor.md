# `shapes.multipart`: rectangle-split `text` anchor

## Scope

This slice corrects the shared `anchor=text` geometry for horizontal
`rectangle split` nodes. The placement point now maps to the first visible
part's text-box origin, and a later `(node.text)` lookup uses that same point.
It covers the interaction with `rectangle split ignore empty parts`; it does
not expand the broader multipart-shape family.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`

The base PGF shape definition declares `text` at the node-part text origin.
The multipart implementation computes part origins after filtering empty parts:
with `rectangle split ignore empty parts`, empty non-text parts alias the prior
part, while the first text part remains the node's `text` anchor. Thus `text`
is not the geometric centre of a split rectangle.

## Third-party reference

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`.

Artifacts:

- Before: `outputs/qa-multipart-ignore-empty-current-2026-08-06/`
- After: `outputs/qa-multipart-ignore-empty-after-2026-08-06/`
- TikZKit SVG/PNG: `tikzkit-svg/pgf-rectangle-split-ignore-empty.svg`,
  `tikzkit-png/pgf-rectangle-split-ignore-empty.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/pgf-rectangle-split-ignore-empty.svg`,
  `tikztosvg-png/pgf-rectangle-split-ignore-empty.png`
- MacTeX native PNG: `mactex-png/pgf-rectangle-split-ignore-empty.png`
- Three-way and native sheets: `diff/pgf-rectangle-split-ignore-empty-sheet.png`,
  `diff/pgf-rectangle-split-ignore-empty-native-sheet.png`

The tikztosvg SVG uses a 138.18pt by 14.06pt viewBox, glyph-path `<use>`
elements, and one compound stroked path per split outline. TikZKit emits two
SVG rectangle-split groups with browser `<text>` elements. Those renderer
representations differ, but PGF's geometry establishes the intended text
anchor placement.

## Visual result

The real PGF manual fixture is
`test/fixtures/examples/latex-examples/rectangle-split-ignore-empty.tex`.
It places an ordinary three-cell node followed by a node at `(3,0)` with its
empty middle part ignored.

Before the change, both split nodes used their geometric centres at their
coordinates. The second coloured record therefore sat visibly too far right,
making the JS image 192px wide versus tikztosvg's 185px. After the change,
each node shifts from its text origin to its actual split-box centre. The
second node now follows the first at the intended coordinate relationship;
TikZKit is 184px wide against the 185px tikztosvg result. The remaining one
pixel canvas difference and glyph antialiasing come from browser text versus
tikztosvg's DVI glyph paths, not a displaced node or separator.

MacTeX's raster is 190px by 24px because its PDF conversion has a different
crop and antialiasing envelope; its comparison sheet confirms the same
two-cell coloured record and text-anchor relationship.

## Validation

```sh
node --test test/shapes-multipart-ignore-empty.test.js
node --test --test-name-pattern='lays out horizontal rectangle split|uses rectangle split text origins|uses cmtt10 advances|optically centers rectangle split|renders rectangle split part fills|maps ordinal nodepart' test/interpreter.test.js
npm run gallery:audit
npm run examples:render -- --manifest test/fixtures/examples/manifest.json --only pgf-rectangle-split-ignore-empty --native-reference --comparison-grid-mode svg --strict-tikztosvg --output outputs/qa-multipart-ignore-empty-after-2026-08-06
npm run examples:diff -- --output outputs/qa-multipart-ignore-empty-after-2026-08-06 --register --alignment-radius 3
```

The dedicated regression, six focused existing split tests, and
`gallery:audit` pass with no new diagnostics. One broader pre-existing
rectangle-split fill assertion remains in the full name-filtered run because
the current color work normalizes `purple` to `rgb(191 0 64)`; it is outside
this anchor slice.

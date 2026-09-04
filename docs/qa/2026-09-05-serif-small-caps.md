# Serif Small Caps

## Scope

This slice implements the serif `\scshape` and `\textsc{...}` font-shape
family for ordinary TikZ text. It covers source-case preservation, physical
Computer Modern small-cap glyphs, standard size scaling, colored text
segments, multiline nodes, and matching text metrics for node layout. It does
not claim bold or italic small caps, arbitrary NFSS family substitutions, or a
complete TeX paragraph engine.

The permanent flowchart, mathematics, and physics drivers are:

- `test/fixtures/examples/fonts/small-caps-flowchart.tex`
- `test/fixtures/examples/fonts/small-caps-math.tex`
- `test/fixtures/examples/fonts/small-caps-physics.tex`

Their strict dependency, command, declaration, environment, option, and number
inventories are recorded in the adjacent `small-caps-*-audit.md` files.

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx` around lines
13800 and 14221. `\scshape` changes the NFSS shape to `\scdefault`, while
`\textsc` applies the same declaration only to its argument. Neither command
uppercases the source text.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/latex/base/ot1cmr.fd` around lines
70-75. Every standard `OT1/cmr/m/sc` size from 5pt through 24.88pt selects the
single `cmcsc10` design face and scales it. Reviewed `cmcsc10.tfm` with local
`tftopl`: uppercase slots are full-height capitals, lowercase slots contain
separately drawn small capitals, and the two groups have different widths and
heights. The space is 0.377774em, uppercase A is 0.813881em wide, and lowercase
a is 0.613332em wide. Reviewed local `cmcsc10.pfb` as the browser glyph source.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; native references
used `/Library/TeX/texbin/pdflatex`, PNG conversion used
`/opt/homebrew/bin/rsvg-convert`, and the browser font was generated from the
local MacTeX `cmcsc10.pfb`. Before and after MacTeX PNG, TikZKit SVG/PNG,
tikztosvg SVG/PNG, registered diffs, and four-way sheets are stored in:

- `outputs/qa/2026-09-05-serif-small-caps-before`
- `outputs/qa/2026-09-05-serif-small-caps-after`

Before the fix, the browser relied on CSS synthetic small caps over an ordinary
Roman font. In the flowchart and physics cases it visibly painted mixed-case
words such as `Source` and `Initial State`, unlike MacTeX. The mathematics
title used the wrong advance width and cropped the browser canvas to 179px
against the 215px reference.

After the fix, the first capital remains full height while lowercase source
slots paint real small capitals in all three cases. Colored initials share the
same baseline and face as following text, multiline state labels stay centered,
and text-driven node widths and connector endpoints remain stable. The math
canvas is now 215px wide, matching tikztosvg; the flowchart differs by one
pixel in width, and the physics canvases are both 219x71px. Diff ratios remain
nonzero because tikztosvg and MacTeX convert text to backend glyph paths while
TikZKit intentionally preserves selectable SVG text, and because the raster
antialiasers differ.

The tikztosvg SVGs contain glyph `<use>` groups, butt path caps, miter joins,
nonzero-filled arrow tips, and a y-flipping transform matrix. TikZKit uses the
same path paint conventions for geometry, retains `<text>` for editable output,
and selects `TikZKitCMSC10` through an embedded `@font-face`. The reference
therefore confirms that the font choice and layout belong before SVG painting,
not in a post-render uppercase transform.

## Implementation And Verification

- `src/renderers/svg/fontFamilies.js` centralizes physical family selection and
  maps medium upright serif small caps to `TikZKitCMSC10`.
- `src/tikz/textMetrics.js` measures the reduced cmcsc10 TFM alphabet and its
  common kerning pairs for logical text boxes and node bounds.
- `src/renderers/svg/plainTextNode.js`, `segmentedText.js`, and `textEngine.js`
  apply the same family and metrics to plain, scoped, colored, and multiline
  text.
- `scripts/build-cm-optical-fonts.py` generates the packaged OTF from local
  MacTeX outlines; fixture and web-server tooling copy and serve it.

All three strict semantic audits pass. All three TikZKit renders have zero
diagnostics, and MacTeX plus tikztosvg generated every requested artifact.

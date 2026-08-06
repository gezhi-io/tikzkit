# \`shapes.multipart\`: circle-split \`lower\` anchor

## Scope

This slice implements the native \`circle split\` relationship among the upper
\`text\` part, the lower part selected by \`\nodepart{lower}\`, the central
separator, and the named \`(node.lower)\` anchor. It is exercised through the
\`automata\` library's \`state with output\` style. It does not broaden support to
the other multipart shapes or arbitrary multi-part declarations.

Driver: \`test/fixtures/examples/automata/state-with-output.tex\`.

\`\`\`tex
\node[state with output,initial] (idle) at (0,0)
  {$q_0$\nodepart{lower}idle};
\node[state with output,accepting] (ready) at (3,0)
  {$q_1$\nodepart{lower}ready};
\draw[gray,dashed] (idle.lower) -- (ready.lower);
\`\`\`

## Local PGF Review

Reviewed local TeX Live 2025 sources:

- \`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex\`
- \`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex\`
- \`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-automata.tex\`

\`automata\` defines \`state with output\` only as
\`circle split, draw, minimum size=2.5em, every state\`; the geometric behavior
lives in \`pgflibraryshapes.multipart.code.tex\`. Its \`circle split\` shape uses
the upper and lower TeX boxes independently. The separator is drawn through
the inherited circle center, while \`lower\` is the lower box origin:
\`x=-0.5*lower width\` and
\`y=-inner ysep-lower height-0.5*line width\`, measured relative to that center.

## References And Artifacts

\`tikztosvg\` was found at \`/Library/TeX/texbin/tikztosvg\`; PNG conversion uses
\`/opt/homebrew/bin/rsvg-convert\`. MacTeX native rendering used \`pdflatex\`.

Generated and inspected artifacts:

- \`/private/tmp/tikzkit-qa-automata-circle-split-2026-08-06/tikzkit-svg/automata-state-with-output.svg\`
- \`/private/tmp/tikzkit-qa-automata-circle-split-2026-08-06/tikztosvg-svg/automata-state-with-output.svg\`
- \`/private/tmp/tikzkit-qa-automata-circle-split-2026-08-06/mactex-png/automata-state-with-output.png\`
- \`/private/tmp/tikzkit-qa-automata-circle-split-2026-08-06/diff/automata-state-with-output-native-sheet.png\`

The \`tikztosvg\` SVG represents the three states as circle paths and exposes the
guide from \`(-0.5*idle width, lower baseline)\` to
\`(3cm-0.5*ready width, lower baseline)\`. TikZKit uses SVG \`<circle>\` and
browser text, but now computes the same semantic points before rendering.

## Visual Result

Before this correction the dashed guide began near each state center and its
two ends had different vertical positions. The upper/lower labels were also
forced into mirrored offsets. In the corrected JS panel, the guide begins at
\`idle.lower\`'s left text origin and ends at \`ready.lower\`'s left text origin,
matching both local reference renderers. The lower labels use their own
text-box heights, so \`ready\` (which has a nonzero TeX depth) sits slightly
differently from \`idle\` and \`done\`, as in PGF.

Residual visual difference is browser glyph rasterization and a small crop
envelope difference: the JS image is \`217x156px\`; tikztosvg is \`222x150px\`.
The state topology, circle boundaries, accepting double outline, arrows, and
the lower-anchor guide are present and aligned.

## Commands And Parameters Covered

Implemented and verified for this slice:

- \`\usetikzlibrary{automata}\`
- \`state with output\`, \`every state\`, \`initial\`, \`accepting\`
- \`circle split\`, \`\nodepart{lower}\`, \`(node.lower)\`
- \`minimum size\`, \`inner sep\`, \`inner xsep\`, \`inner ysep\`, \`line width\`
- upper/lower inline text and inline math box metrics

Still partial: other multipart shapes, arbitrary repeated empty-part rules,
rich/multiline lower text fallback metrics, and general automata path geometry
beyond the shared path renderer.

## Validation

\`\`\`sh
npm test -- test/automata.test.js
npm run gallery:audit
npm run examples:render -- --fixtures test/fixtures/examples \
  --only automata-state-with-output \
  --output /private/tmp/tikzkit-qa-automata-circle-split-2026-08-06 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- \
  --output /private/tmp/tikzkit-qa-automata-circle-split-2026-08-06 \
  --alignment-radius 3
\`\`\`

All focused tests and the \`297/297\` core gallery audit pass with no new
diagnostics. All three reference artifacts rendered successfully.

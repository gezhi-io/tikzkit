# graphicx `resizebox` Around One TikZ Picture

## Scope

This slice supports the non-starred form
`\resizebox{<width>}{<height>}{<single tikzpicture>}` when both dimensions are
literal positive physical lengths. It intentionally does not claim support for
`\resizebox*`, either `!` aspect-ratio branch, multiple pictures in one box, or
general non-TikZ TeX box content.

The real driver is `test/fixtures/examples/latex-examples/arc.tex`. Its outer
wrapper is `\resizebox{250px}{250px}{...}` around one picture. The picture
uses `\newcommand\R{1.3cm}`, ordinary `\draw` circle/line/path/arc operations,
`fill`, `line width=0.1pt`, two color scopes, and coordinate labels `$\alpha$`
and `$r$`. These existing commands and options are reused; this change only
adds the missing outer graphicx box semantics.

## Local MacTeX Study

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/graphicx.sty`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/graphics.sty`,
  especially `\resizebox`, `\Gscale@@box`, `\Gscale@box@dd`, and
  `\Gscale@box@dddd` around lines 534-575.

`graphicx.sty` delegates graphics sizing to `graphics.sty`. The non-starred
`\resizebox` measures an `\hbox` using height, divides requested width by
natural width and requested height by natural height independently, then hands
both factors to `\Gscale@box`. The starred form measures total height instead.
The `!` branches select one derived factor; with two explicit dimensions the
result is intentionally anisotropic. Therefore this implementation applies one
final SVG group transform to the complete scene rather than mapping the command
onto TikZ `xscale`/`yscale`, which would leave text, markers, and stroke widths
unscaled.

## Implementation

- `src/engine/math.js` recognizes TeX `px` as one PostScript point (`1/72in`).
- `src/frontend/parser.js` detects a `\resizebox` that exactly wraps one
  `tikzpicture` and carries its dimensions through the AST.
- `src/index.js` measures the natural Scene Graph bounds and attaches the two
  graphicx scale factors to the IR.
- `src/renderers/svg/renderSvg.js` expands the SVG viewBox and wraps all scene
  markup in a single translated `scale(x,y)` group. Geometry, text, line
  widths, fills, and arrow definitions therefore share the same transform.
- `src/packages/graphicx.js` records the partial feature, implementation
  owners, local-source review, and boundaries. The generated core registry has
  no `graphicx` row because its current 288-case corpus has no direct
  `\usepackage{graphicx}` declaration: this fixture receives it transitively
  from `standalone`. The package catalog is the source used when such a direct
  case is present.

## Reference Artifacts And SVG Analysis

`command -v tikztosvg` resolved to `/Library/TeX/texbin/tikztosvg`; PNG files
were rendered with `/opt/homebrew/bin/rsvg-convert`.

Artifacts are under
`/private/tmp/tikzkit-qa-graphicx-resizebox-after-2026-08-06/`:

- MacTeX native PNG: `mactex-png/latex-examples-arc.png`;
- TikZKit SVG/PNG: `tikzkit-svg/latex-examples-arc.svg` and
  `tikzkit-png/latex-examples-arc.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/latex-examples-arc.svg` and
  `tikztosvg-png/latex-examples-arc.png`;
- 1cm-grid variants: `tikzkit-grid-png/` and `tikztosvg-grid-png/`;
- inspected JS/tikztosvg sheet: `diff/latex-examples-arc-sheet.png`;
- inspected native/JS/tikztosvg/diff sheet:
  `diff/latex-examples-arc-native-sheet.png`.

The TikZKit SVG declares a `250pt` square viewBox and a final
`translate(...) scale(3.373851 3.258384)` group. Its child paths keep their
natural path data and line widths because SVG scales them as one graphicx box.
The tikztosvg SVG has a `74.1pt` by `77.27pt` viewBox, path-outlined glyphs,
and flipped `matrix(1,0,0,-1,...)` path transforms. tikztosvg cannot compile
the preserved wrapper here (`Missing \endgroup inserted` at the closing box
brace), so the reusable QA harness intentionally unwraps `resizebox` for that
reference. It remains a valid natural-TikZ geometry reference, but is not a
graphicx-size reference for this input.

## Visual Result

Before this change, TikZKit ignored the outer box and produced a 99x103px
image, essentially the same small scale as the unwrapped tikztosvg panel. The
MacTeX native result was 349x349px, so the actual graphic occupied a visibly
different coordinate scale.

After the change, TikZKit produces 334x334px. In the inspected native sheet,
the circle, red arc, blue chord, green sector, and both math labels now occupy
the same large grid region as MacTeX. The remaining visible differences are a
slightly tighter native crop, browser-versus-TeX math glyph metrics (most
noticeable for alpha), and antialiasing. tikztosvg stays small for the stated
tool limitation. The registered JS-vs-MacTeX diff is 12.77% changed pixels at
mean absolute RGBA 0.04389; that number is supporting evidence only. The
accepted improvement is the corrected whole-picture physical scale and shared
stroke/text scaling.

## Validation

```bash
node --test --test-name-pattern='graphicx resizebox' test/interpreter.test.js
node --test --test-name-pattern='normalizes LaTeX preview wrappers' test/example-render-script.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-graphicx-resizebox-after-2026-08-06 \
  --only latex-examples-arc --native-reference --comparison-grid-mode svg \
  --strict-tikztosvg --external-timeout-ms 15000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-graphicx-resizebox-after-2026-08-06 \
  --register --alignment-radius 3
```

All focused tests and the three-renderer artifact generation completed with no
TikZKit diagnostics. The broad `test/interpreter.test.js` suite retains
pre-existing unrelated failures, so it is not represented as a green gate for
this focused slice.

## Next Work

1. Add the `!` width/height derivation and `\resizebox*` total-height branch.
2. Preserve graphicx wrappers in tikztosvg when its input mechanism supports a
   top-level measured TeX box, then turn this third-party natural-size caveat
   into a fully scaled comparison.
3. Audit the remaining graphicx fixtures for `\scalebox`, rotation, trim, and
   viewport behavior independently of this one-picture resize path.

# Brace Polyline Final-State QA

## Scope

- Library: `decorations.pathreplacing`.
- Accepted slice: a `brace` decoration with `mirror`, `raise`, `amplitude`, and `aspect` on a polyline subpath.
- Boundary: the declaration reaches PGF's `final` state after the first input segment. It must not restart a brace on later `--` segments of that subpath.

## Local implementation reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`, lines 140-185: `brace` declares `width=+\\pgfdecoratedremainingdistance,next state=final`; its cubic construction uses the remaining current input segment and the `aspect`/`amplitude` bounds.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`, lines 753-823: the decoration runner exposes the current segment remaining distance, transitions to `final`, and advances across the source input segments without re-entering the initial state.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathreplacing.code.tex`: loads the TikZ key layer for the same PGF decoration declaration.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- PNG converter: `/opt/homebrew/bin/rsvg-convert`.
- MacTeX native PNG: `outputs/qa-brace-polyline-after/mactex-png/decorations-brace-polyline-continuity.png`.
- TikZKit SVG/PNG: `outputs/qa-brace-polyline-after/tikzkit-{svg,png}/decorations-brace-polyline-continuity.*`.
- tikztosvg SVG/PNG: `outputs/qa-brace-polyline-after/tikztosvg-{svg,png}/decorations-brace-polyline-continuity.*`.
- Comparison sheet: `outputs/qa-brace-polyline-after/diff/decorations-brace-polyline-continuity-sheet.png`.

Before the repair, TikZKit emitted a horizontal brace and a second vertical brace at the corner. MacTeX and tikztosvg emitted one horizontal brace ending at the first segment's endpoint; the gray reference polyline and three red markers made the omitted vertical decoration unambiguous. After the repair, all three images show that same single brace. Remaining red pixels in the raster diff are antialiasing and SVG unit-rasterization differences, not an extra decorated segment.

The tikztosvg SVG contains one brace `<path>` terminating at the first segment end and uses `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and a matrix transform. Its first cubic control points follow PGF's `.15/.5` coefficients, confirming that the path is the relevant state result rather than an unrelated clipping effect.

## Change and verification

- `src/engine/evaluate.js`: tracks the brace final state per subpath and suppresses later input segments after the first brace segment.
- `test/brace-path-segmentation.test.js`: verifies the terminal point remains on the raised first segment baseline.
- `test/fixtures/examples/decorations/brace-polyline-continuity.tex`: permanent minimal visual regression driver.
- `test/fixtures/examples/manifest.json`: exposes the driver in the browser workbench inventory.

Commands run:

```sh
node --test test/brace-path-segmentation.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa-brace-polyline-after --only decorations-brace-polyline-continuity --strict-tikztosvg --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output outputs/qa-brace-polyline-after
```

The focused regression passed and the fixture emitted no diagnostics. The broad fixture-manifest suite has an existing unrelated metadata failure for `latex-examples/rectangle-split-ignore-empty.tex`, which is not part of this slice.

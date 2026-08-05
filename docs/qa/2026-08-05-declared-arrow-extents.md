# Declared Arrow Extents QA

## Scope

- Feature slice: legacy `\pgfarrowsdeclare` endpoint extents for a single
  user-declared arrow tip.
- Driver: `test/fixtures/examples/arrows/declared-leaf-tip.tex`.
- Boundary: literal `\pgfarrowsleftextend`, `\pgfarrowsrightextend`, and
  `\pgfarrowssetlineend` dimensions; not arbitrary declaration-time TeX.

## Local Reference Study

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg` (local XeLaTeX engine).
- MacTeX source inspected:
  `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`.
- `\pgfarrowsrightextend` stores the arrow `tipend`,
  `\pgfarrowsleftextend` stores `backend`, and the default `lineend` is
  `0pt`. PGF shortens a terminal path by `tipend - lineend`.
- Compatibility declarations record endpoint placement but no arrow hull, so
  their painted leaf must not expand the picture bounding box beyond the
  original stroked path.

## Visual Result

The driver declares a filled leaf from `-2pt` to `1pt`, then draws both
`-leaf` and `leaf-` terminals. Before this fix TikZKit left the stems at their
unshortened endpoints and included the SVG leaf bounds in the viewBox. Its
PNG was `117 x 41px`, versus the `115 x 40px` local tikztosvg output; the
diff affected 573 of 4,600 pixels (12.46%).

After lowering the literal endpoint values, both stems stop one point inside
their leaf, while the visible leaf remains at the original path terminal. The
arrow paint no longer expands the viewBox. TikZKit and tikztosvg now both
render at `115 x 40px`; 17 thin-raster pixels differ (0.37%) and there is no
visible endpoint, canvas, or clipping discrepancy. A local `pdflatex` native
PNG was also inspected and has the same two shortened stems and filled leaves.

Artifacts are together in
`outputs/qa-declared-leaf-after/{mactex-png,tikzkit-svg,tikzkit-png,tikztosvg-svg,tikztosvg-png,diff}/`.

## Verification

```bash
node --test test/declared-arrow-extents.test.js test/arrows-declared.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output outputs/qa-declared-leaf-after \
  --only arrows-declared-leaf-tip --preserve-output
node scripts/diff-example-pngs.js --output outputs/qa-declared-leaf-after
pdflatex -interaction=nonstopmode -halt-on-error \
  -output-directory=outputs/qa-declared-leaf-after/mactex-build \
  test/fixtures/examples/arrows/declared-leaf-tip.tex
```

The five focused declared-arrow tests pass. The full repository suite remains
an independent work-in-progress gate with known unrelated failures.

## Remaining Work

This is not general `arrows` completeness. Dynamic setup expressions,
`\pgfarrowshullpoint`, visual ends/flex mode, declaration-time line-width
math, clipping, composed custom tips, and arbitrary TeX macros remain
unsupported or partial.

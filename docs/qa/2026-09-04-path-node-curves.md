# Curved Path Node Placement

## Scope

This round implements one shared TikZ path-node slice: cubic `pos` placement,
local-tangent `auto` anchors, `swap`/`auto=right`, and existing `sloped`
rotation. It does not change path geometry or hard-code coordinates for an
individual figure. Automatic anchors combined with arbitrary non-uniform
shape transforms remain outside this slice.

Three new permanent examples exercise the behavior:

- `test/fixtures/examples/paths/curve-auto-flowchart.tex`
- `test/fixtures/examples/paths/curve-auto-math.tex`
- `test/fixtures/examples/paths/curve-auto-physics.tex`

## Local MacTeX Study

Read these installed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 1095-1125, 4462-4535, and 4948-4950. `pos` sets the path timer; a cubic timer calls `pgftransformcurveattime`. `auto` normalizes the local tangent and selects a discrete compass anchor from a 0.05pt quadrant threshold. `swap` toggles left/right, and the prime table contains the exact opposite anchors.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`, lines 566-590. `pgftransformcurveattime` computes both the Bézier point and a normalized tangent frame; without `allow upside down`, a reversed tangent is flipped before text rotation.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex`, lines 1866-2040. The manual confirms that cubic `pos` is parameter time rather than arc length, `auto` means left/right of the local curve, and `sloped` aligns the node's horizontal axis to the tangent.

The important correction is that PGF does not use the complete segment's end-to-end chord and does not continuously project a rectangle along the normal. It chooses `north`, `south`, `east`, `west`, or one of the four corner anchors from the local tangent.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native references used local MacTeX.

The semantic probe is preserved in `/private/tmp/path-node-auto-probe.tex`
during this run. Its reference SVG uses cubic `C` path data, butt caps, miter
joins, separate arrow transforms, and independently transformed label glyphs.
At `pos=.2` on a 4cm arch, the path point is `x=0.416cm`; the reference moves
the A node center to about `x=0.245cm`, proving that the local rising tangent
selects `south east`. TikZKit previously kept `x=0.416cm`; it now gives
`x=0.255cm`. The mirrored right-side and `swap` probes follow the opposite
anchor table.

## Visual Evidence

All artifacts are in `outputs/qa-path-node-curves-2026-09-04/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-input/`, `tikztosvg-svg/`, and `tikztosvg-png/`
- `mactex-png/` and `mactex-log/`
- `diff/`, including native four-way and before/after/native sheets

I inspected all six sheets. Panel order in the native sheets is MacTeX,
tikztosvg, TikZKit, diff. Panel order in the before/after/native sheets is old
TikZKit, new TikZKit, MacTeX.

- Flowchart: `submit` now moves left/up along the rising control curve,
  `accept` moves right/up along the falling curve, and swapped `revise` stays
  below the return curve. All agree visibly with both references.
- Mathematics: `f`, `g`, `g^{-1}`, and `f^{-1}` follow their own local curve
  tangents instead of sharing each full arc's horizontal chord.
- Physics: `t_1` and swapped `t_2` occupy opposite trajectory sides, while
  `\vec v(t)` remains tangent-aligned and upright.

No node, formula, arrow, path, color, or layer is missing. The remaining
visible differences are browser font outlines and a one-pixel canvas-height
residual, not incorrect path-node sides or coordinates.

## Implemented Commands And Parameters

Implemented and exercised in this slice:

- Commands: `\draw`, `\node`, cubic `.. controls ..`, inline path `node`.
- Path-node parameters: `pos`, `auto`, `auto=left`, `auto=right`, `swap`,
  `sloped`, `above`, `below`, and inherited `every node` font styling.
- Shared geometry: cubic Bézier point at parameter time, normalized local
  tangent, eight-way compass anchor selection, circle/rectangle shape anchor
  reuse, explicit node shifts, and upright tangent rotation.
- Supporting figure parameters: named anchors, `Stealth`/`Latex` length,
  line width presets, draw/fill colors, rounded rectangles, diamonds, circles,
  minimum dimensions, `aspect`, and math labels.

Not completed by this slice:

- Exact TeX behavior for multiple successive `swap` toggles hidden inside
  arbitrary key callbacks.
- Automatic anchors on arbitrarily transformed non-uniform custom shapes.
- General soft-path timers for decorations and arbitrary user-defined path
  operations.
- Exact glyph outlines from TeX; browser SVG text remains a calibrated font
  rendering path.

## Verification

```bash
node --test test/path-node-curves.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-path-node-curves-2026-09-04 \
  --only paths-curve-auto-flowchart \
  --only paths-curve-auto-math \
  --only paths-curve-auto-physics \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output outputs/qa-path-node-curves-2026-09-04 \
  --register --alignment-radius 6
```

The focused path-node regression passes 7/7; the related path/graph batch
passes 18/18. The render batch produces 3/3 TikZKit
SVG/PNG, 3/3 tikztosvg SVG/PNG, and 3/3 MacTeX PNG references with zero
TikZKit diagnostics and zero external failures.

The complete test suite contains 1975 tests: 1832 pass, 129 retain known
historical failures, and 14 are skipped. The pre-change baseline contains 1968
tests: 1825 pass, the same 129 fail, and the same 14 are skipped. All seven new
tests pass, and comparing failed test names finds no new or fixed failures.

## Remaining Boundary

The next useful path-node slice is `auto` together with `sloped` on reversed
curves and transformed custom shapes, followed by `|-`/`-|` piecewise timers.

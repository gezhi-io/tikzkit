# Case 005 Snake Arrow Bounds QA

## Scope

- Feature slice: `decorations.pathmorphing` snake length, terminal arrow, and
  bounding-box behavior.
- Driver: `test/fixtures/examples/decorations/snake-arrow-lengths.tex`.
- Source command:

  ```tex
  \draw[-stealth, decoration={snake, pre length=0.01mm,
    segment length=2mm, amplitude=0.3mm, post length=1.5mm},
    decorate, thick, red] (hs1) -- (s1);
  ```

## Local Reference Study

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- MacTeX source inspected:
  `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`.
- The native `snake` declaration has a `.3125 * segment length` startup,
  alternates `\pgfpathcosine` and `\pgfpathsine` half-waves, uses a
  `.3125 * segment length` end state, then draws the final straight remainder.
  The decoration consumes the requested pre/post lengths before the normal
  terminal arrow is painted.

## Visual Result

Before this slice, TikZKit included the late SVG stealth-tip wings in its
viewBox, making Case 005 `114.18pt x 4.13pt`. Both local MacTeX and tikztosvg
keep the tight decorated-wave height of `2.50pt`; their arrow tip is painted
after the decorated-path bounding box has been established.

After the fix, TikZKit and tikztosvg are both `153 x 4px` at the fixture
renderer scale. The visible red wave has the same fixed startup crest,
2mm wavelength, 0.3mm amplitude, 0.01mm initial straight segment, 1.5mm
final straight segment, and terminal stealth paint. The PNG diff contains
17 changed pixels (2.78%), confined to thin-stroke and arrow rasterization;
there is no remaining canvas-height or endpoint discrepancy. The native
MacTeX PNG was also inspected and shows the same tight decoration boundary.

Artifacts are kept together in
`outputs/qa-case005-snake-after/{mactex-png,tikzkit-svg,tikzkit-png,tikztosvg-svg,tikztosvg-png,diff}/`.

## Verification

```bash
node --test --test-name-pattern='snake' test/interpreter.test.js test/snake-arrow-lengths.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output outputs/qa-case005-snake-after \
  --only decorations-snake-arrow-lengths --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa-case005-snake-after
```

All eight focused snake tests pass. The full repository suite remains a
separate work-in-progress gate with existing failures outside this slice.

## Remaining Work

This does not claim complete `decorations.pathmorphing` support. In particular,
zigzag calibration and exact state behavior across polyline corners remain
partial and require separate visual drivers.

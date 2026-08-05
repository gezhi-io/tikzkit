# Snake Polyline Continuity QA

## Scope

- Library: `decorations.pathmorphing`.
- Accepted slice: `snake` state continuity across one decorated polyline subpath, including whole-subpath `pre length` and `post length`.
- Out of scope: complete `zigzag`, custom decorations, exact PGF normal interpolation at acute corners, and arbitrary curve-state precision.

## Local implementation reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`: snake begins with a `.3125 segment length` crest, alternates PGF cosine/sine states, and finishes through end-up/end-down states.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`: `pre length` and `post length` are meta-decoration keys applied once around the main decorated path.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`: the decoration automaton advances across source segments while retaining its current state and updating path rotation.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`; PNG conversion: `/opt/homebrew/bin/rsvg-convert`.
- Baseline sheet: `outputs/qa-snake-polyline-before/diff/decorations-snake-polyline-continuity-sheet.png`.
- MacTeX native PNG: `outputs/qa-snake-polyline-after/mactex-png/decorations-snake-polyline-continuity.png`.
- TikZKit SVG/PNG: `outputs/qa-snake-polyline-after/tikzkit-{svg,png}/decorations-snake-polyline-continuity.*`.
- tikztosvg SVG/PNG: `outputs/qa-snake-polyline-after/tikztosvg-{svg,png}/decorations-snake-polyline-continuity.*`.
- Comparison sheet: `outputs/qa-snake-polyline-after/diff/decorations-snake-polyline-continuity-sheet.png`.
- Real corpus sheet: `outputs/qa-snake-graph-circles-after/diff/latex-examples-graph-circles-sheet.png`.

The reference SVG has one continuous `<path>` with cubic `C` segments that change direction at each corner; it keeps butt caps, miter joins, a tight viewBox, and emits the stealth arrow as a separate filled path. The prior JS image restarted a startup crest after every `--`, producing visibly wrong peaks and duplicated endpoint reservations. The repaired JS image has continuous phase through both corners, a single front straight, and a single end straight before the arrow. The remaining diff is mainly control-point and antialiasing detail around corners, not missing or restarted wave geometry.

## Change and verification

- `src/engine/evaluate.js`: batches each snake input subpath before applying the existing native-style state machine.
- `src/tikz/libraries/decorations.pathmorphing.js`: records the verified partial capability and local-source review.
- `test/snake-polyline-continuity.test.js`: guards against added corner restarts and repeated endpoint lengths.
- `test/fixtures/examples/decorations/snake-polyline-continuity.tex`: permanent real rendering driver with two corners, endpoint lengths, and a stealth arrow.

Commands run:

```sh
node --test --test-name-pattern='snake' test/interpreter.test.js test/snake-polyline-continuity.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa-snake-polyline-after --only decorations-snake-polyline-continuity --strict-tikztosvg --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output outputs/qa-snake-polyline-after
```

All focused snake tests pass. The unrelated broad `test/interpreter.test.js` run has pre-existing failures in current dirty worktree areas (coordinate systems, text/color calibration, and earth scaling); this snake slice adds no diagnostics in the focused fixture.

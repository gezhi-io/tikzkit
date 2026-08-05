# Current Full Corpus Audit

## Scope

- Corpus manifest: `test/fixtures/examples/manifest.json`.
- Rendered on 2026-07-22 into `outputs/qa-all-current/`.
- Reference renderer: local `/Library/TeX/texbin/tikztosvg`; its SVG is rasterized with local `rsvg-convert`.
- Visual sheets: `outputs/qa-all-current/diff/<case-id>-sheet.png`. Each sheet places TikZKit, tikztosvg, and their pixel diff side by side. The numeric diff is triage data only, not an acceptance decision.

## Current Result

| Check | Result |
| --- | ---: |
| Manifest cases | 250 |
| TikZKit SVG and PNG generated | 250 / 250 |
| tikztosvg SVG and PNG generated | 243 / 250 |
| Pixel-identical rendered pairs | 21 |
| Same canvas, visual difference remains | 66 |
| Canvas dimension mismatch | 156 |
| Missing reference artifact | 7 |
| Cases with TikZKit diagnostics | 4 |
| Total TikZKit diagnostics | 6 warnings, 0 errors |

**Acceptance status: not passed.** Generation coverage is complete on the JS side, but 222 of 243 comparable pairs still need visual acceptance or repair. The 21 pixel-identical images are not extrapolated to the remainder.

## Reference Failures

These seven cases have a JS image but no usable local `tikztosvg` PNG, so they cannot receive visual acceptance yet.

| Case | Local reference failure |
| --- | --- |
| `latex-examples-3d-gaussian-distribution` | `tikztosvg` timed out after 30 seconds. |
| `latex-examples-b-tree-3-evolution` | XeLaTeX reports `Missing \\endgroup inserted` at the final `tikzpicture`. |
| `latex-examples-bellman-ford-algorithm` | XeLaTeX reports `Missing \\endcsname inserted` after producing two pages. |
| `latex-examples-cache-4-way-associative` | XeLaTeX reports `Missing \\endgroup inserted` at an inline `\\tikzmark`. |
| `latex-examples-chemistry-example` | `\\setatomsep` is undefined because its chemistry package is absent from the captured source/preamble. |
| `latex-examples-hyberbolische-geometrie-1` | Local package load order rejects `tkz-fct` after `tkz-euclide`. |
| `latex-examples-hyberbolische-geometrie-2` | Same local `tkz-fct` / `tkz-euclide` load-order error. |

The per-case compiler output is preserved under `outputs/qa-all-current/tikztosvg-log/`.

## JS Diagnostics

| Case | Diagnostic | Current owner |
| --- | --- | --- |
| `latex-examples-bellman-ford-algorithm` | `Unknown coordinate \\source` twice | `src/tikz/commands/foreach.js` |
| `latex-examples-cache-4-way-associative` | `Unknown coordinate a` and `b` | `src/engine/evaluate.js` |
| `latex-examples-cfb-mode-decryption` | `Unsupported TikZ statement: TODO` | TeX-lite statement handling |
| `latex-examples-chemistry-example` | `Unsupported command \\begin` | package/environment handling |

## Visual Triage Seen

The following four-panel evidence was manually viewed, rather than ranked from pixel numbers alone.

- `pgf-pattern-form-only-primitives`: this driver covers only dots and checkerboard, and both forms are present in the TikZKit panel. Its red diff is a tile-phase/antialiasing calibration issue rather than a missing custom-pattern feature. It is not the next implementation target.
- `latex-examples-b-tree-2-small-3`: node partitions, centered labels, fill regions, and parent links are close; remaining red diff concentrates on one-pixel text, divider, and arrow geometry. It is a calibration candidate, not currently an accepted exact match.
- `latex-examples-csv-2d-gaussian-multivarate-distributions`: point geometry is present, but the TikZKit panel still differs in color-model treatment and text metrics/axis-label placement. This falls under shared PGFPlots font/color/label work.
- `latex-examples-activation-functions`: curves and legend are present, but label and text metric differences remain and must not be called accepted until inspected against the reference after the shared font work.

## Repair Order

1. Remove the four remaining JS diagnostics, beginning with shared inline tikzmark/coordinate evaluation in `cache-4-way-associative` and macro coordinates in `foreach`.
2. Repair shared canvas/bounding-box rules, starting with high-frequency PGFPlots axes and core node/path extents. The current 156 dimension mismatches are too large a group to accept case by case.
3. Implement custom PGF pattern primitives and other isolated unsupported feature families, using a real reference sheet and a focused regression test for each slice.
4. Re-run the entire 250-case render/diff suite after every shared change. A case becomes passed only after its current JS/reference/grid sheet is visually inspected and diagnostics remain empty.

## Recent Verified Improvement

The separate 3D PGFPlots perspective-bounds slice is verified in `outputs/qa-pgfplots-patchplots-after/`: explicit-width `3d-cmos-loss-diagram` now has the same 587 px width as tikztosvg (from 596 px), and `3d-gradient-cos` moved from 553 px to 529 px against a 532 px reference. This is a visible improvement, but it does not make the full 3D family accepted; vertical text and bounding-box residuals remain.

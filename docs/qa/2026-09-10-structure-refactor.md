# Path Decoration Structure Audit

## Scope

Move path decoration algorithms out of `src/engine/evaluate.js` into their named
TikZ library modules without changing rendering behavior. This is a structural
refactor, not a claim of improved visual compatibility or a new package release.

- `decorations.pathmorphing.js`: snake, zigzag, straight zigzag, coil, saw, bumps,
  bent and random steps, including pre/post lengths, mirror, raise and curve frames.
- `decorations.pathreplacing.js`: brace, ticks, border, waves and expanding waves.
- `decorations.fractals.js`: the existing Koch snowflake slice.
- `snakes.js`: the existing legacy option and segment compatibility adapter.
- `tikz/decorations/path.js`: dispatch, support checks and snake arrow-bbox policy.
- `tikz/decorations/pathGeometry.js`: shared PGF-style path traversal.
- `engine/geometry.js`, `engine/units.js`, `engine/options.js`: existing shared
  cubic, finite-length and boolean helpers moved without semantic changes.

Removed an unreachable per-command morphing fallback and its private helpers.
The four library descriptors and extension registry CSV now identify the actual
implementation files. Their support statuses remain unchanged.

## Local Source Review

Read the installed TeX Live 2025 sources under
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/`:

- `libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`: zigzag's
  startup, alternating states and finish behavior must remain distinct.
- `libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`: brace
  geometry and amplitude determine the curve controls, not a generic SVG glyph.
- `modules/pgfmoduledecorations.code.tex`: cubic traversal uses recursive
  subdivision with a 1pt coordinate tolerance and state-local tangent frames.
  The initial subdivision must still occur for curves whose endpoints coincide.

Preserved these existing algorithms and constants while changing their ownership.

## Regression Evidence

The local audit directory is `outputs/structure-audit-2026-09-10/` (generated,
not an npm or GitHub documentation asset).

- Rendered all 693 discovered fixture cases before and after the refactor.
- 692 SVGs were byte-identical. The remaining case,
  `datavisualization-scatter-south-east-outside`, uses an unseeded random stream.
  Running both the untouched baseline and refactored runtime with an explicit
  seed of 100 produced identical SVGs. The fixture itself was not modified.
- All 693 diagnostic lists were unchanged.
- Added 16 direct-library/dispatch tests and 4 module-boundary tests.
- All 115 focused decoration and architecture tests passed.
- Full test run: 2,629 tests, 2,473 passed, 142 failed, 14 skipped. No new failed
  test names compared with the pre-refactor baseline. The initial sandboxed run
  had six additional failures because local server ports were unavailable; those
  six passed with local-port permission. The 142 remaining failures are not fixed.
- The architecture guard checks 459 runtime modules and reports one known legacy
  text-to-frontend dependency. It does not conceal that dependency as resolved.
- The packed-package consumer/font check passed with 53 font faces and no
  diagnostics. No font assets, package dependencies or public exports changed.

Reproduction commands from the repository root:

```sh
npm run check:architecture
node --test test/decoration-modules.test.js test/module-boundaries.test.js
node --test test/pathmorphing*.test.js test/pathreplacing*.test.js test/snakes-legacy-options.test.js test/zigzag-decoration.test.js test/decorations-fractals.test.js
node --test
node scripts/check-font-package.js
npm run docs:links
node scripts/render-example-fixtures.js --output outputs/structure-audit-2026-09-10/after --skip-tikztosvg --skip-png --no-comparison-grid --quiet-progress
node scripts/render-example-fixtures.js --output outputs/structure-audit-2026-09-10/references --only decorations-pathreplacing-fixed-waves-flowchart --only decorations-pathmorphing-curve-physics --native-reference --tikztosvg-engine pdflatex --strict-tikztosvg --quiet-progress
```

Before/after renders are under `before/` and `after/`; the controlled random
comparison is recorded in `seeded-comparison.json`. Per-case hashes, diagnostics
comparison and test failure names are recorded in `regression-report.json`.
The baseline is untouched commit `745b13a5d30a5ddaa754eef6d7020e4953d60349`,
not cached reference geometry used as JS output.

## Visual Inspection

Found and used `/Library/TeX/texbin/tikztosvg`. Generated SVGs and PNGs for both
real cases, along with independently compiled MacTeX PNGs. Inspected all six PNGs:

- `decorations-pathmorphing-curve-physics`: the orange source circle, blue wave
  phase along the curved path, terminal arrow and labels stay aligned. Small
  raster edge differences remain; the refactor did not change the JS SVG.
- `decorations-pathreplacing-fixed-waves-flowchart`: both node boxes, separated
  wave strokes, straight leads and lower arrow retain their relative positions.
  Thin stroke and rasterization differences remain relative to the native PNG.

Artifacts are under `references/tikzkit-svg/`, `references/tikztosvg-svg/`,
`references/tikzkit-png/`, `references/tikztosvg-png/` and `references/mactex-png/`,
with the case ID as the filename. The comparison page is `references/index.html`.
No visual improvement is claimed. Output invariance for 693 cases is not equivalent
to native visual acceptance of 693 cases; only these two triples were viewed here.

## Remaining Work

The evaluator still exceeds 19,000 lines. Its remaining node/path execution
responsibilities need similar test-backed extraction. The legacy nested-axis text
fallback still forms a static import cycle through `frontend/latex-shell.js`.
Address that dependency separately, with nested-picture and text-layout fixtures,
before tightening the architecture guard. Existing failing tests need their own
failure triage and fixes; this refactor deliberately does not relabel them as passing.

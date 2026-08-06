# Patterns: Preamble Parameterized Flexible Hatch QA - 2026-08-07

## Scope

This slice implements one `patterns` capability only: a form-only pattern
declared in the document preamble whose geometry is driven by simple TikZ
`/.store in` macros. It does not claim mutable PGF pattern arguments or
general TeX execution.

The driver is `test/fixtures/examples/patterns/parameterized-flexible-hatch.tex`.
Its declaration is taken from the real `bias-variance` gallery source, including
the original `\hatchdistance`, `\hatchthickness`, `\pgfpoint`, and
`\pgfsetlinewidth` use. A filled rectangle makes the otherwise-unused gallery
declaration visually inspectable.

## Local MacTeX Review

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepatterns.code.tex`, lines 55 onward: `\pgfdeclarepatternformonly` accepts an optional variable list before recording the bounds, repeat vector, and procedure.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibrarypatterns.code.tex`, lines 15-52: built-in line patterns set their own line width, construct tile-local paths, and repeat with a distinct step vector.

The flexible-hatch declaration uses a paint bound of `10pt x 10pt`, a repeat
step of `9pt x 9pt`, and a `2pt` stroke. The repeat step, not the paint bound,
controls line spacing.

## Implementation

- `src/frontend/parser.js` preserves pre-picture `/.store in` assignments and
  preamble `\pgfdeclarepatternformonly` statements on every `tikzpicture` AST.
- `src/engine/evaluate.js` seeds the picture variable environment before it
  evaluates those declarations, so macro-derived bounds, steps, coordinates,
  and line widths are numeric scene data.
- Existing clipped SVG tile expansion remains responsible for painting the
  declared paths only inside the consuming fill.

## Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was converted
with `/opt/homebrew/bin/rsvg-convert`.

Artifacts:

- Before: `/private/tmp/tikzkit-qa-pattern-flexible-hatch-preamble-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-pattern-flexible-hatch-preamble-after-2026-08-07/`
- After four-way native sheet: `/private/tmp/tikzkit-qa-pattern-flexible-hatch-preamble-after-2026-08-07/diff/pgf-pattern-parameterized-flexible-hatch-native-sheet.png`

All four panels were inspected. Before the change, TikZKit painted only the
generic faint fallback hatch because the preamble declaration and its stored
macros never reached the picture interpreter. After the change, the TikZKit
panel shows the same wide, 45-degree red hatches as both MacTeX native and
tikztosvg: same direction, repeat spacing, stroke weight, clipping, and border.
The remaining pixel-diff classification comes from TikZKit's slightly wider
canvas and its comparison-grid rasterization, not from a missing pattern.

The tikztosvg SVG uses individual stroked paths from `(0,0)` to `(10pt,10pt)`
with a 2pt stroke and a 9pt tiling vector. TikZKit retains those coordinates in
the pattern definition, then emits the same line paths in an SVG clip group.

## Verification

```sh
node --test test/pattern-declarations.test.js
node scripts/gallery-audit.js --only pgf-pattern-parameterized-flexible-hatch --strict
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pattern-flexible-hatch-preamble-after-2026-08-07 \
  --only pgf-pattern-parameterized-flexible-hatch --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-pattern-flexible-hatch-preamble-after-2026-08-07
```

## Remaining Boundary

The library remains partial. It does not yet reproduce dynamic changes to a
pattern's optional variable list after declaration, pattern transforms,
inherently-colored or mutable patterns, polar/curve procedures, or arbitrary
macro execution inside a pattern procedure.

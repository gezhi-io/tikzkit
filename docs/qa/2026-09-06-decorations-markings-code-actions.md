# Decorations Markings Code Actions QA (2026-09-06)

## Scope

This slice implements ordinary TikZ code inside a `decorations.markings`
action. The acceptance boundary is:

- `\node`, `\coordinate`, `\draw`, `\path`, `\fill`, `\filldraw`, and
  related shared path evaluation inside `mark=... with {...}`;
- a local coordinate frame whose origin is the marking point and whose
  positive x-axis follows the path tangent;
- repeated marks in declaration and traversal order;
- `/pgf/decoration/mark info/sequence number` and `distance from start`;
- current-color inheritance from the decorated path;
- direct and postaction decoration activation through the existing markings
  pipeline.

This slice does not claim `mark connection node`, arbitrary low-level PGF
path construction, or arbitrary TeX callbacks in marking actions.

The permanent drivers are:

- `decorations-markings-code-manual`, copied from the PGF manual's mixed-path
  node-marking example;
- `decorations-markings-code-flowchart`, with two status nodes attached to a
  curved process route;
- `decorations-markings-code-physics`, with repeated tangent ticks and
  sequence-number labels on a field curve.

## Local MacTeX Review

Reviewed these local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.markings.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.markings.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, especially the marking-code and mark-information sections around lines 720-880.

The PGF decoration state moves to each requested path distance, installs a
local frame tangent to the decorated path, increments the sequence number,
updates the distance-from-start key, and then executes the stored marking
code. The TikZ frontend permits high-level drawing commands and nodes in this
frame. A node rotates only when its own options request `transform shape`;
ordinary marking nodes keep page-oriented text while their positions still
use the tangent frame.

TikZKit now emits an internal marking-code action at each sampled point and
hands its body back to the shared parser and evaluator under the same local
affine transform. The result remains renderer-neutral scene data; the markings
library does not build SVG directly.

## Implemented Syntax

| Syntax | Parameters verified |
| --- | --- |
| `mark=at position P with {CODE}` | fractional, absolute dimension, negative end-relative position, curved and mixed paths |
| `mark=between positions A and B step S with {CODE}` | repeated path and node code, source ordering, path tangents |
| `\node[options]{text}` | color, draw, fill, font size, anchor offsets, `transform shape` |
| `\draw[options] ...` | local coordinates, color, line width, transformed line geometry |
| `\pgfkeysvalueof{.../sequence number}` | one-based sequence across emitted marks |
| `\pgfkeysvalueof{.../distance from start}` | TeX-point value derived from the traveled path distance |

Still unsupported in this slice:

- `mark connection node` and its pre/post connection construction;
- arbitrary `\pgfpath...` and `\pgfusepath...` programs inside a mark;
- arbitrary TeX macro execution whose result is not handled by the shared
  parser/evaluator;
- full PGF mark-info key mutability beyond the two documented read values.

## Reference Tools And SVG Structure

Local tools used:

- tikztosvg: `/Library/TeX/texbin/tikztosvg`;
- MacTeX: `/Library/TeX/texbin/pdflatex`;
- SVG-to-PNG: `/opt/homebrew/bin/rsvg-convert`.

The inspected tikztosvg SVG uses ordinary transformed path and glyph elements.
The transform matrix combines translation to the marking point, tangent
rotation, and the page y-axis inversion. Text that requests `transform shape`
inherits the tangent rotation; ordinary text remains upright. Strokes use
explicit butt caps and miter joins.

TikZKit's SVG follows the same structure at the renderer boundary: marking
ticks are explicit paths with `stroke-linecap` and `stroke-linejoin`, while
rotated labels are grouped under a tangent `rotate(...)` transform. No SVG
marker shortcut or fixture-specific coordinates are used.

## Visual Result

Before the change:

- the manual example contained its grid and mixed line/arc path, but all three
  red, green, and blue marking labels were absent;
- the flowchart route rendered, but both queued/running status nodes were
  absent;
- the physics curve and grid rendered, but all nine orange tangent ticks and
  all sequence labels were absent.

After the change:

- the manual labels appear at 1cm, the path midpoint, and 1cm from the end;
  the final blue label follows the curved-path tangent as requested;
- both flowchart status nodes appear above the correct portions of the curve
  with their requested borders and colors;
- all nine physics ticks follow their local curve tangents, labels are
  numbered in traversal order, and bare label color inherits the blue path;
- all three fixtures render with zero TikZKit diagnostics and zero external
  renderer failures.

The remaining visible differences are font rasterization and a few pixels of
tight-crop whitespace. No requested element, color, path position, tangent
orientation, or layer is missing in the accepted drivers.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-06-decorations-markings-code-before/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-06-decorations-markings-code-after/`

Both directories contain TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
registered diffs, and native four-way sheets. The generated artifacts are
ignored by Git according to the repository artifact policy.

## Verification

```bash
node --test test/decorations-markings.test.js

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-06-decorations-markings-code-after \
  --only decorations-markings-code-manual \
  --only decorations-markings-code-flowchart \
  --only decorations-markings-code-physics \
  --continue-on-external-failure --strict-tikztosvg \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-06-decorations-markings-code-after --register

npm run extension-registry
```

The nine dedicated markings tests pass. The full suite reports 2,505 tests
with 2,355 passing, 136 failing, and 14 skipped. The committed pre-change
baseline reported 2,502 tests with 2,352 passing, 136 failing, and 14 skipped:
all three added tests pass and the existing failure count does not increase.
The manifest-integrity test still reports the pre-existing missing
`semanticOwner` on `circuitikz-varcap-diodes`; that unrelated baseline entry
was not changed in this focused slice.

# TikZ `topaths` Custom Path Templates

Date: 2026-09-04

## Scope

This slice implements reusable path-only `to path={...}` templates for both
`to` and `edge` operations:

- `\tikztostart`, `\tikztotarget`, and `\tikztonodes`
- straight `--`, horizontal-then-vertical `-|`, and vertical-then-horizontal
  `|-` replacements
- relative prelegs such as `-- ++(0,1cm) -| (\tikztotarget)`
- explicit cubic `.. controls ... and ... ..` replacements
- template-owned nodes and the original nodes collected by `to` or `edge`
- ordinary edge styles, node-border clipping, and terminal arrow tangents

Arbitrary `\pgfextra`, execution hooks, nested `to`/`edge`, `arc`, and `plot`
inside a replacement body remain outside this slice.

## Local TeX Live Review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-paths.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tutorial-chains.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-edges.tex`

`tikz.sty` is a thin frontend that loads `tikz.code.tex`. In the generic
source, `to path` stores a replacement body. `\tikz@do@to` and
`\tikz@do@edge` collect the original nodes, bind the stored start and target,
and then execute that body. `\tikztostart` and `\tikztotarget` are coordinate
payloads without parentheses; `\tikztonodes` expands the collected nodes at
the position chosen by the replacement. The default line replacement is
`-- (\tikztotarget) \tikztonodes`.

The tutorial's `hv path`, `vh path`, and `skip loop` styles confirm that
orthogonal operators and relative prelegs are ordinary path syntax inside the
replacement. The path manual's custom cubic example confirms that a control
prefixed with `+` is relative to the endpoint beside it. Positioning selects
opposite node-border anchors before route construction, while arrow geometry
uses the terminal path tangent and current line width.

## Reference Tools And Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`
- `pdflatex`: `/Library/TeX/texbin/pdflatex`
- Before: `outputs/qa-custom-to-path-2026-09-04-before`
- Accepted: `outputs/qa-custom-to-path-2026-09-04-final`
- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- Four-panel sheets and diffs: `diff/`, `diff-png/`
- Strict semantic audits: `custom-to-path-*-audit.md`

The tikztosvg SVGs use real cubic `C` path data, separate filled arrow paths
with transforms, `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and
outlined TeX glyphs. TikZKit now emits the same path topology and tangent-
aligned arrow geometry, using live SVG text and the bundled TikZKit fonts.
The math case has the same 178.85pt width in both SVGs; their heights differ
by 0.8pt because of live-text bounds.

## Visual Results

### Flowchart

Before, all three custom routes were diagonal straight lines. After the fix,
the review branches form the expected T-shaped `-|` and `|-` routes, labels
sit on the selected vertical or horizontal legs, and arrow tips land on the
rectangle and diamond borders. The remaining overall dimension difference is
from positioning and shape metrics, not missing route geometry.

### Mathematics

Before, the two custom morphisms collapsed onto one straight arrow and their
labels overlapped. After the fix, the upper and lower cubic morphisms have the
same control geometry and terminal tangents as MacTeX and tikztosvg. The PNG
is 239x105px versus the 239x106px reference.

### Physics

Before, both signal paths ignored their 1cm relative prelegs and became
horizontal lines. After the fix, the raised and lowered legs are preserved,
then turn orthogonally into their targets; arrow directions and labels match
the reference geometry. The two SVG widths are identical, with a 2px PNG
height difference caused mainly by text bounds.

Changed-pixel ratios against tikztosvg are 6.43%, 5.96%, and 6.69%. These
figures support the panel inspection; acceptance is based on the visible
route, label, clipping, and arrow improvements above.

## Source Audit

The three strict audits cover every package, library, command, environment,
option, declaration, numeric literal, and expression in the new fixtures:

- `custom-to-path-flowchart-audit.md`
- `custom-to-path-math-audit.md`
- `custom-to-path-physics-audit.md`

All three are accepted with zero todos and zero blockers. The focused tests
cover `to`, `edge`, `\tikztostart`, `\tikztotarget`, `\tikztonodes`, straight,
orthogonal, relative-preleg, cubic, inline-node, arrow, and real-corpus
endpoint-marker behavior. All three visual renders emit zero diagnostics.

## Verification

- `node --test test/to-path-template.test.js test/to-path-controls.test.js test/to-path-distance.test.js test/chains-curved-joins.test.js test/chains-multiple-joins.test.js`
- `node scripts/case-semantic-audit.js <fixture> --review <review> --strict`
- `node scripts/render-example-fixtures.js --output outputs/qa-custom-to-path-2026-09-04-final --only custom-to-path-flowchart --only custom-to-path-math --only custom-to-path-physics --native-reference --strict-tikztosvg`
- `node scripts/diff-example-pngs.js --output outputs/qa-custom-to-path-2026-09-04-final`
- `npm run extension-registry`
- `npm test` (1959 total: 1822 passed, 123 existing baseline failures,
  14 skipped; no failure increase)

Acceptance: passed for this bounded custom path-template family.

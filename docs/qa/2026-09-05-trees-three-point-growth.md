# TikZ Trees Three-Point Growth

## Scope

This slice implements the `trees` library's `grow via three points` growth
function. The acceptance boundary is:

- parse `one child at (...) and two children at (...) and (...)`;
- place one child at the first point and two children at the declared pair;
- linearly extrapolate three or more siblings using the installed PGF macro;
- expand the option through named, picture, and per-level styles;
- preserve independent nested level styles, TikZ coordinate units and basis
  vectors, and the active affine canvas transform.

Graph drawing, collision avoidance, arbitrary user-defined growth callbacks,
and arbitrary edge-from-parent callback code are outside this slice.

The permanent visual drivers are:

- `test/fixtures/examples/trees-three-point/flowchart.tex`
- `test/fixtures/examples/trees-three-point/math.tex`
- `test/fixtures/examples/trees-three-point/physics.tex`

Their adjacent review files and generated audit reports inventory every
dependency, command, environment, option, and numeric literal.

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex`
at lines 18-54. `\tikzoption{grow via three points}` installs
`\tikz@grow@three`; `\tikz@parse@three` stores all three complete TikZ
coordinates. The growth macro first computes the vectors `left - one` and
`right - left`, then uses the total child count and one-based current-child
counter. In zero-based JavaScript indices the installed-source formula is:

```text
one + (childCount - 1) * (left - one)
    + childIndex * (right - left)
```

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
around the child collection and placement code. TikZ determines the complete
sibling count before calling the selected growth function, applies the growth
shift in the active child scope, then creates and clips the parent edge against
the parent and child node borders.

Reviewed
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-trees.tex`
at the Growth Functions section. It defines the one-child and two-child
reference contracts and a collinear extrapolation for larger sets. The prose
formula on lines 32-33 contains a division by two that is absent from the
installed macro. The native MacTeX output follows the installed macro, so this
implementation and its tests use the installed-source behavior.

The source parser is delimiter-sensitive: direct option values must begin with
the literal `one child at`. The fixtures use native-valid formatting, while the
browser parser accepts harmless surrounding whitespace after semantic parsing.

## Visual References

Local reference tools:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX `pdflatex`: `/Library/TeX/texbin/pdflatex`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`

MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, one-centimeter grid views,
diffs, and four-panel sheets are stored in:

- `outputs/qa/2026-09-05-trees-three-point-before`
- `outputs/qa/2026-09-05-trees-three-point-after`

Before the fix, TikZKit ignored the library growth option and used its default
tree layout. The workflow and polynomial children were much too close to the
root, the output bounds were too narrow, and the particle decay's second-level
nodes and edges overlapped.

After the fix:

- the workflow uses the native three-child extrapolated centers and width;
- the polynomial terms use the same horizontal centers and vertical level as
  both native references despite their different math-label widths;
- both particle levels select their own two-child reference coordinates, so
  the four decay products no longer collide;
- all three TikZKit renders retain zero diagnostics;
- the TikZKit PNG dimensions become 346x142, 301x133, and 301x163 pixels,
  versus tikztosvg's 347x142, 301x133, and 301x163 pixels.

The changed-pixel ratios against tikztosvg fall from 55.2% to 4.6% for the
workflow, 20.1% to 3.5% for the polynomial, and 27.6% to 5.7% for the decay
diagram. These values support the visually inspected structural improvement;
they are not the acceptance criterion by themselves. Remaining visible
differences are font glyph rasterization, subpixel border coverage, and a
one-pixel workflow crop width.

## SVG Structure

The tikztosvg SVGs emit TeX glyphs as reusable path outlines and use
`matrix(1,0,0,-1,...)` to flip the PGF coordinate system. Tree nodes and edges
are ordinary path data with `fill-rule=nonzero`, `stroke-linecap=butt`,
`stroke-linejoin=miter`, and a 0.3985pt default stroke. For example, the
workflow's left edge runs from `(-14.829,-11.539)` to
`(-87.224,-67.832)` in its translated local coordinates.

TikZKit keeps text as scoped SVG text with bundled Computer Modern faces and
uses renderer-neutral path commands for node borders and clipped tree edges.
Its internal viewBox is expressed in TikZKit units and its physical width and
height are emitted in points. Since both outputs now contain the same child
centers and clipped edge geometry, the growth calculation correctly belongs in
the interpreter/library layer rather than in the SVG renderer.

## Command And Parameter Coverage

Implemented and verified in these cases:

- document shell: `\documentclass`, `\usepackage`, `\begin`, and `\end`;
- library and style declarations: `\usetikzlibrary{trees}` and `\tikzset`;
- tree syntax: `\node`, nested `child`, picture-level growth, named styles,
  `level 1/.style`, and `level 2/.style`;
- growth parameter: `grow via three points={one child at (...) and two
  children at (...) and (...)}` with unitless and `mm`/`cm` coordinates;
- node and edge parameters: `draw`, `circle`, `rounded corners`, `minimum
  width`, `minimum height`, `inner sep`, mixed colors, `thick`, and
  `-stealth` through `every edge from parent/.style`;
- all coordinate, color-mix, border, size, and style numeric literals listed in
  the three generated semantic-audit reports.

No command or parameter used by the three selected fixtures remains
unreviewed. Remaining library-level work is limited to the out-of-scope items
listed above.

## Implementation And Verification

- `src/tikz/libraries/trees.js` owns the syntax parser and exact extrapolation
  formula.
- `src/engine/evaluate.js` selects growth directives by TikZ option order,
  resolves the three coordinates in the local basis, applies the active affine
  vector transform, and preserves per-level inheritance.
- `test/trees-three-point-growth.test.js` covers parsing, one/two/three-child
  arithmetic, style expansion, end-to-end node centers, and rotation.
- The three strict semantic audits pass and are stored beside this report in
  `docs/qa`.

Focused verification passes 26 tests: the 6 growth and audit tests added or
directly exercised by this slice plus the 20 semantic-audit regressions. The
full suite reports 2187 passing tests, 137 failures, and 14 skipped tests in
the filesystem sandbox. Five of those failures are the workbench tests being
denied permission to bind `127.0.0.1`; the same five pass when rerun with local
socket permission. The normalized result is therefore 2192 passing tests, the
unchanged baseline of 132 known failures, and 14 skipped optional-corpus
tests. Visual acceptance passed for all three selected cases.

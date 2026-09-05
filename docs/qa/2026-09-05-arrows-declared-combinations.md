# Legacy Declared Arrow Combinations

## Scope

This round covers one `arrows` feature family only: legacy declaration
composition through `\pgfarrowsdeclarecombine`, its starred form,
`\pgfarrowsdeclaredouble`, and `\pgfarrowsdeclaretriple`. It includes literal
and active-line-width separation, recursive component placement, complete
shaft shortening, and combined bounds. It does not claim the modern general
`\pgfdeclarearrow` interface or arbitrary TeX programs.

The slice was selected because `arrows` remained partial and occurs in more
than 150 registered examples. Before this change, valid declarations were
removed during preprocessing but their combined tips were not painted.

## Local Source Review

The implementation was checked against MacTeX/TeX Live 2025 PGF 3.1.11a:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`, lines 1079-1116: the legacy compatibility macros lower combination, double, and triple declarations to arrow sequences.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`, lines 1462-1570: `sep` advances rigid tips and the dot records the shaft line end without painting an arrow.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-base-arrows.tex`, lines 115-156 and 635-670: an arrow sequence paints each component separately and computes endpoint shortening from the assembled extents.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/bondgraph/bondgraph.sty`, line 32: a real package combines the legacy `left to` tip with a bar.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/bondgraph/bondgraph_example.tex`: real usage context for that declaration.

The key source rule is that a component advances by its logical
`tip end - back end`, followed by the requested separation. The starred
combine inserts a non-painting dot between the two components so the shaft
ends at that intermediate position. A separation equal to exactly
`\pgflinewidth` is active, not frozen at declaration time.

## Commands And Parameters

Implemented in this slice:

- `\pgfarrowsdeclarecombine[<separation>]{<new start>}{<new end>}{<first start>}{<first end>}{<second start>}{<second end>}`
- `\pgfarrowsdeclarecombine*` with the intermediate dot line-ending rule
- `\pgfarrowsdeclaredouble[<separation>]`
- `\pgfarrowsdeclaretriple[<separation>]`
- nested declared sequences, start-end reversal, literal dimensions, and `\pgflinewidth`
- component-local paint, stroke width, cap, join, transformed bounds, and terminal shortening

Still partial:

- nonlinear or macro-driven separation expressions
- arbitrary branches and macros inside declaration setup/drawing programs
- transformed/intersection/scaled point constructors in declarations
- harpoon-specific one-sided upper hulls and complete clip-region rendering
- saved-register callbacks and the complete modern `\pgfdeclarearrow` language

## Visual Evidence

Before artifacts:

- `outputs/qa/2026-09-05-arrows-declared-combinations-before/`

After artifacts:

- `outputs/qa/2026-09-05-arrows-declared-combinations-after/`

Each directory contains TikZKit SVG/PNG, local `tikztosvg` SVG/PNG, MacTeX
PNG, grid overlays, and comparison sheets. The local executable was
`/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The three permanent drivers are:

- `arrows-declared-combine-bondgraph`: before, all three combined terminals were missing; after, the left-to head and independently stroked terminal bar are both present.
- `arrows-declared-combine-flowchart`: before, commit, rollback, and queue links lost their declared compositions; after, double chevrons, chevron-plus-bar, and bidirectional ordering are visible.
- `arrows-declared-double-triple-math`: before, double/triple and reversed combinations collapsed; after, two or three tips paint in the source order at the correct endpoint.

Inspection of `tikztosvg` output confirmed that each component is a separate
transformed SVG path with its own stroke width, line cap, and line join. The
TikZKit output now follows the same structure. The flowchart reference retains
extra crop whitespace from the old declaration hull behavior; the arrows,
paths, labels, and node positions are not displaced.

## Verification

```bash
node --test test/arrows-declared-combinations.test.js test/arrows-declared*.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-arrows-declared-combinations-after --only arrows-declared-combine-flowchart --only arrows-declared-double-triple-math --only arrows-declared-combine-bondgraph --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --comparison-grid-mode svg --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-arrows-declared-combinations-after --only arrows-declared-combine-flowchart --only arrows-declared-double-triple-math --only arrows-declared-combine-bondgraph
```

All three fixtures render through TikZKit, MacTeX, and `tikztosvg` with zero
TikZKit diagnostics and zero external-reference failures. Visual acceptance is
based on the restored arrow components and their placement, not only on image
diff scores.

The full repository run completed 2,400 tests: 2,250 passed, 136 remained in
the existing failure baseline, and 14 were skipped because optional corpora
were unavailable. A clean run of parent commit `6847d445` in the same local
environment completed 2,395 tests with 2,243 passing, 138 failing, and 14
skipped. The current run has no failure name absent from that parent baseline;
all four arrow tests and the new semantic-audit ownership test pass.

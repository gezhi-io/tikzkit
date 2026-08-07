# QA: declared coordinate-system dynamic macros

## Scope

This slice fixes `\tikzdeclarecoordinatesystem` bodies whose `\pgfmathsetmacro`
expression refers to TikZ's runtime `#1` coordinate-system argument. It is a
shared parser/preprocessor rule, not a timeline-specific coordinate patch. The
supported result remains the existing focused `\pgfpointxy` / `\pgfpoint`
coordinate-system subset.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, `\tikzdeclarecoordinatesystem` around lines 4979-4986 and coordinate-system dispatch around lines 5233-5279.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-coordinates.tex`, lines 640-679.

The manual states that `(<name> cs:<arguments>)` passes its complete payload
to the declaration body as `#1`; the body must leave its final canvas point in
`\pgf@x` and `\pgf@y`. The source resolves any `cs:` form through the declared
system before considering ordinary polar colon syntax. Thus a pre-picture
macro pass must not evaluate a `\pgfmathsetmacro` containing `#1` as if it
were a document constant.

## Fixture And References

Driver: `test/fixtures/examples/coordinates/declared-timeline-coordinate-system.tex`.
It maps each year with `(#1-1975)/3`, draws the 1975--2020 axis, and places
every five-year tick and `\tiny` label through `timeline cs:`.

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`. All three outputs completed:

- Before: `/private/tmp/tikzkit-qa-declared-coordinate-system-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-declared-coordinate-system-after-2026-08-07/`

Both directories retain TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
registered diff PNG, and a native comparison sheet. tikztosvg emits the
timeline as direct SVG path and glyph elements with a 275.33pt-wide viewBox;
TikZKit's matching output uses its standard path/text groups and reports
275.71pt after text measurement.

## Visual Result

Before the fix, preprocessing treated `(#1-1975)/3` as a static expression
and reduced `\timelinex` to zero. TikZKit therefore rendered only a 28px-wide
origin stack containing one tick/label, while tikztosvg and MacTeX showed the
full 368px timeline.

After the fix, dynamic macros are retained until `timeline cs:<year>` is
resolved. The JavaScript panel now has the same 368px horizontal extent as
tikztosvg, and every axis tick and year label appears at its individual
position. The MacTeX, tikztosvg, and TikZKit panels were inspected together;
the remaining four-pixel JavaScript height reserve comes from browser `\tiny`
text metrics, not collapsed coordinates.

## Implementation And Verification

Changed:

- `src/frontend/latex-shell.js`
- `src/packages/tikz.js`
- `test/fixtures/examples/coordinates/declared-timeline-coordinate-system.tex`
- `test/fixtures/examples/manifest.json`
- `README.md`
- `docs/extension-registry.csv` and `docs/extension-registry.md`
- `docs/qa/2026-08-07-declared-coordinate-system-dynamic-macro.md`

Commands:

```bash
node --test --test-name-pattern='declared timeline coordinate systems' test/interpreter.test.js
node --test test/coordinates-section13.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only coordinates-declared-timeline-system \
  --output /private/tmp/tikzkit-qa-declared-coordinate-system-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-declared-coordinate-system-after-2026-08-07 \
  --register --alignment-radius 3
```

The pre-existing failing dynamic-coordinate regression now passes. The
fixture has no TikZKit diagnostics.

## Implemented And Remaining

Implemented and validated: `\tikzdeclarecoordinatesystem{name}{code}`, a
runtime `#1` argument, `\pgfmathsetmacro` expressions using that argument,
and a final `\pgfpointxy` or `\pgfpoint` result under the current coordinate
basis.

Not implemented in this slice: arbitrary `\pgfkeys`/`\define@key` parsing,
multi-command PGF point arithmetic such as `\pgfpointadd`, aliases, shape
border side effects, and general TeX macros inside coordinate-system bodies.

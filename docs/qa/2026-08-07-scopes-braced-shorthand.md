# Scopes Braced Shorthand QA

## Scope

This pass accepts one focused `scopes` library slice only: the documented
braced local-scope shorthand

```tex
{ [<TikZ options>]
  <TikZ statements>
}
```

The driver is
`test/fixtures/examples/scopes/braced-local-scopes.tex`. It deliberately uses
whitespace after `{`, two nested shorthand groups, `ultra thick`, `red`,
`green`, and a path-local `blue` override. That makes style restoration visible:
the red nested lines are thick, the following black line stays thick inside the
outer scope, and the later green/blue/black lines return to the expected outer
line width and color.

Out of scope: invoking the shorthand from every native TikZ after-command hook,
category-code-sensitive TeX groups, and non-TikZ TeX grouping semantics.

## Local MacTeX Reading

Read local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryscopes.code.tex`.
  The library makes `{` special only when it is immediately followed by an
  option list, then lowers the construct to `\scope[<options>]\bgroup ...
  \endscope`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-scopes.tex`,
  lines 358-383. The manual states that the option-bearing braced spelling is
  equivalent to a scope environment and that its options apply only until the
  matching close brace.

TikZKit now follows that semantic lowering. The parser detects an opening
brace whose next non-whitespace token is `[`, parses the local options, and
recursively parses only the balanced body. Existing scope evaluation owns
style, transform, basis, variable, and chain-state isolation, so no renderer
special case was introduced.

## Command And Parameter Audit

`node scripts/case-semantic-audit.js test/fixtures/examples/scopes/braced-local-scopes.tex`
records one package, one library, six `\draw` commands, and the path options
`help lines` and `blue`. The direct scope parameters are parsed from braced
groups rather than command options:

| Source syntax | Status | Result |
| --- | --- | --- |
| `{ [ultra thick] ... }` | implemented | Applies `1.6pt` local stroke width. |
| `{ [red] ... }` | implemented | Paints only nested paths red. |
| `{ [green] ... }` | implemented | Paints only its two paths green. |
| `\draw[blue] ...` inside green scope | implemented | Path-local blue overrides green without altering later scopes. |
| Nested groups and whitespace after `{` | implemented | Balanced parsing preserves nesting and body boundaries. |
| Scope-end restoration | implemented | The final black path returns to the default 0.4pt black style. |
| Native after-command hook placements | partial | Not treated as braced scope entry points. |

The generated audit remains `incomplete` because it tracks generic document
shell, baseline `\draw`, and literal-number reviews independently. The
feature itself has zero TikZKit diagnostics and a focused regression test.

## Three-Way Visual Check

Local tools found and used:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- rasterizer: `/opt/homebrew/bin/rsvg-convert`
- native reference: local `pdflatex` plus `pdftocairo`

Artifacts are retained at
`/private/tmp/tikzkit-qa-scopes-braced-2026-08-07/`:

- `mactex-png/scopes-braced-local-scopes.png`
- `tikzkit-svg/` and `tikzkit-png/`, including `tikzkit-grid-*`
- `tikztosvg-svg/` and `tikztosvg-png/`, including `tikztosvg-grid-*`
- `diff/scopes-braced-local-scopes-native-sheet.png`
- `diff/scopes-braced-local-scopes-registered.png`

The inspected native sheet shows the same six colored horizontal segments in
MacTeX, tikztosvg, and TikZKit: two red thick lines, one black thick line, two
green thin lines, then one blue thin line. Nothing is missing from TikZKit,
and the grid-relative vertical ordering is the same. The raw TikZKit-to-MacTeX
comparison changes 8.77% of pixels; this is mainly the approximately 4pt crop
reserve and thin-line antialiasing, not a scope or style mismatch.

`tikztosvg` emits individual `<path>` elements with TeX `stroke-width` values
of `1.59404` for the three `ultra thick` paths and `0.3985` for the later thin
paths, an inverted drawing transform, and an `85.94pt x 56.89pt` viewBox.
TikZKit emits the corresponding semantic paths at renderer units
`5.623356857...` and `1.405839214...` with explicit `butt` caps and `miter`
joins. The physical line-width ratio and color/ordering agree; its slightly
larger `89.92pt x 60.88pt` crop remains a general bbox calibration issue.

## Verification

```sh
node --test --test-name-pattern='braced scope shorthand|bare TeX groups|continue-chain scopes' \
  test/interpreter.test.js test/petarv-compat.test.js
node --test test/library-modules.test.js
npm run extension-registry
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-scopes-braced-2026-08-07 \
  --only scopes-braced-local-scopes --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-scopes-braced-2026-08-07 \
  --register --alignment-radius 3
```

Focused parser, interpreter, and module tests pass; all three external visual
references render; registry now records `scopes` as one reviewed partial core
case. This is an accepted visual improvement, not a claim of full `scopes`
library parity.

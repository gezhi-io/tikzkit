# Declared arrow saved setup state

## Scope

This slice implements setup-to-drawing state transfer for legacy
`\pgfarrowsdeclare` programs:

- `\pgfarrowssavethe` for dimension registers;
- `\pgfarrowssave` for simple numeric or dimension macros;
- source-ordered assignment, `\advance`, and save commands on one line;
- saved values in point dimensions and `\pgfpatharc` angles.

It deliberately does not implement arbitrary token-list macros, TeX branches,
or `\pgfmath`-generated saved macros.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`
  lines 654-700 instantiate an arrow once, cache setup results, and restore the
  saved program before drawing. Lines 742-752 show that `\pgfarrowssavethe`
  freezes a register's `\the` value while `\pgfarrowssave` freezes a macro's
  current replacement text.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`
  was checked at Straight Barb, Hooks, and Tee Barb. Those declarations show
  dimension-only snapshots, a scalar arc macro, and derived temporary registers.

The implementation follows the important isolation rule: drawing receives only
values explicitly saved by setup, never the whole temporary register table.

## Visual evidence

Drivers:

- `arrows-declared-saves-algorithm`
- `arrows-declared-saves-math`
- `arrows-declared-saves-physics`

Before:

`outputs/qa/2026-09-05-arrows-declared-saves-before/`

All three TikZKit renders emitted one unsupported-declaration diagnostic. Their
colored shafts rendered, but every custom arrow tip was missing. MacTeX and
tikztosvg rendered the tips.

After:

`outputs/qa/2026-09-05-arrows-declared-saves-after/`

All nine custom tips are visible and diagnostics are zero. The process arrows,
map arrows, and force vectors agree with MacTeX/tikztosvg on direction, relative
aperture, active-line-width growth, cap/join paint, and endpoint shortening.
Residual raster differences are text antialiasing and one-to-two-pixel outer
bounds, not saved-state geometry.

Local reference tools:

- `/Library/TeX/texbin/tikztosvg`
- `/Library/TeX/texbin/pdflatex`
- `/opt/homebrew/bin/rsvg-convert`

The QA directories contain TikZKit SVG/PNG, tikztosvg input/SVG/PNG, MacTeX PNG
and log files, 1 cm grid variants, diff PNGs, and comparison HTML.

## Tests

Focused tests cover register snapshots, scalar macro snapshots, same-line source
ordering, macro-plus-unit dimensions, saved arc angles, unsaved-state isolation,
alias/double composition, and three full graphics.

```sh
node --test test/arrows-declared-saves.test.js
node --test test/arrows-declared*.test.js
```

The focused files pass 7/7 and 32/32 tests respectively. The complete suite
reports 2,439 tests: 2,296 passed, 129 existing failures, and 14 skipped. The
failure count is unchanged from the 2,432-test baseline before this slice.

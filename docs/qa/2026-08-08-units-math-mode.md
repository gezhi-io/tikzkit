# Units Math-Mode Scope

## Scope

This focused `units` package slice covers only math-mode `\unit` and
`\unitfrac` output in ordinary SVG text. The real driver is
`test/fixtures/examples/units/math-mode-units.tex`:

```tex
$d=\unit[12]{m}$
$v=\unitfrac[36]{km}{h}$
$a=\unitfrac{m}{s^2}$
```

It does not claim complete `units` support: text mode and the package's
`loose` option remain outside this slice.

## Local MacTeX Reading

Reviewed TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/units/units.sty`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/units/nicefrac.sty`

`units.sty` expands an optional value followed by tight `\,` spacing, applies
`\mathrm` only to the unit argument in math mode, and sends `\unitfrac` to
`\nicefrac[\mathrm]{...}{...}`. `nicefrac.sty` raises the numerator, uses
negative mu kerns around the solidus, and typesets the denominator at a script
size. The crucial point is that `\mathrm` is a local math alphabet: it must
not make the preceding variable upright.

## Three-Way Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are in
`outputs/qa-units-math-mode-after-2026-08-08/`:

- `tikzkit-svg/units-math-mode-units.svg` and `tikzkit-png/...`
- `tikztosvg-svg/units-math-mode-units.svg` and `tikztosvg-png/...`
- `mactex-png/units-math-mode-units.png`
- `diff/units-math-mode-units-native-sheet.png` and grid variants

The tikztosvg SVG has a tight `62.89pt x 47.67pt` viewBox and converts text to
separate positioned glyph paths. Its glyph sequence visibly keeps `d`, `v`,
and `a` in the math-italic face, while `m`, `km`, `h`, and `s` are upright;
the final `2` is a smaller, raised glyph. TikZKit therefore models the same
semantics as nested SVG `tspan` scopes rather than attempting to infer a
single font style for the entire line.

## Visual Result

Before the change, TikZKit flattened every formula containing `\mathrm` into
one roman SVG line. In the real three-line node, `d`, `v`, and `a` were
upright, the `d` unit lost its narrow separation, and the denominator appeared
as literal `s^2` on the baseline.

After the change, the four-panel inspection shows:

- variables `d`, `v`, and `a` in math italic, matching MacTeX and tikztosvg;
- local upright unit spans for `m`, `km`, `h`, and `s` without leaking roman
  style to the variables;
- a retained 3mu gap before the unit/fraction and a raised script-sized `2`.

The TikZKit-to-MacTeX registered mean absolute RGBA residual changed from
`0.08791` to `0.08633`. The image still differs in glyph rasterization and a
small crop difference, but the actual missing mathematical typography is gone.

## Implementation And Verification

- `src/renderers/svg/mathFallbackSyntax.js`: decide inherited math italic from
  the content outside local upright alphabet scopes.
- `src/renderers/svg/mathUprightFallback.js`: serialize scoped upright math as
  nested SVG spans and preserve trailing `\,` spacing.
- `src/renderers/svg/mathNiceFractionFallback.js`: preserve upright fraction
  parts and render nested denominator scripts.
- `src/renderers/svg/textLineContent.js`: normalize package macros before
  choosing a text fallback path.
- `test/text-package-macros.test.js`: locks direct and multi-line `units`
  behavior.

Commands run:

```sh
node --test test/text-package-macros.test.js test/circle-multiline-nicefrac.test.js
npm run examples:render -- --output outputs/qa-units-math-mode-after-2026-08-08 --only units-math-mode-units --tikztosvg --native-reference --grid
npm run examples:diff -- --output outputs/qa-units-math-mode-after-2026-08-08 --register --alignment-radius 3
```

All 14 focused tests passed. TikZKit, tikztosvg, and MacTeX rendered the real
fixture with zero diagnostics and no external-render failures.

## Remaining Work

`units` text-mode behavior, its `loose` option, arbitrary package redefinitions,
and exact TeX glyph-path/crop parity remain unsupported or partial.

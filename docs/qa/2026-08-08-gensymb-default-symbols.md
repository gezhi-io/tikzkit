# gensymb default math symbols

## Scope

This focused slice implements the default, no-`textcomp` math behavior of
`gensymb`: `\degree`, `\celsius`, and `\ohm`. It also corrects shared
`\quad` and `\qquad` fallback spacing exposed by the same real formula.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/latex/gensymb/gensymb.sty`, lines
  22-107: without `textcomp`, `\degree` becomes `^\circ`, `\celsius` becomes
  `^\circ\mathrm{C}`, and `\ohm` selects `\Omega` unless an explicit package
  option changes the branch.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx`, lines
  9435-9436: `\quad` and `\qquad` are one- and two-em horizontal skips.

## Three-way artifacts

- TikZKit SVG/PNG: `outputs/qa-gensymb-default-symbols-2026-08-08/after-hspace-token/tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `outputs/qa-gensymb-default-symbols-2026-08-08/after-hspace-token/tikztosvg-svg/` and `tikztosvg-png/`
- MacTeX PNG: `outputs/qa-gensymb-default-symbols-2026-08-08/after-hspace-token/mactex-png/`
- Four-panel sheet and registered diff: `outputs/qa-gensymb-default-symbols-2026-08-08/after-hspace-token/diff/`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

## Visual result

Before the fix, TikZKit painted `celsius`, `ohm`, and `quad` as literal text.
MacTeX and tikztosvg instead showed `25°C`, `10Ω`, and real horizontal gaps.
After the fix, TikZKit paints the degree as a superscript, keeps the Celsius
`C` upright, renders `Ω`, and retains the one-em gaps. The remaining visible
difference is Computer Modern SVG rasterization plus a six-pixel aggregate
width variance (TikZKit 205px versus tikztosvg 211px); no formula element is
missing and diagnostics remain 0.

## Validation

```sh
node --test test/text-package-macros.test.js
node --test test/example-render-script.test.js
npm run examples:render -- --fixtures test/fixtures/examples --only gensymb-default-math-symbols --output outputs/qa-gensymb-default-symbols-2026-08-08/after-hspace-token --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-gensymb-default-symbols-2026-08-08/after-hspace-token --register --alignment-radius 3
```

The focused tests and all three renderers pass.

## Remaining scope

The `textcomp` branch, `\perthousand`, `\micro`, and `Upomega`/`upmu` options
are intentionally still partial.

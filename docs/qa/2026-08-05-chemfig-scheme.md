# Chemfig Reaction Scheme QA

## Scope

This review covers one bounded `chemfig` / `chemmacros` slice used by
`latex-examples-chemistry-example`: horizontal reaction schemes with aromatic
six-member rings, carbonyl double bonds, an O--O peroxide bridge, reaction
arrows, coefficients, radical dots, and the `\ch{2 CO2 ^}` product formula.
It does not claim general Chemfig compatibility.

## Local implementation reading

- Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/chemfig/chemfig.tex`,
  especially the `\schemestart` / `\arrow` setup around lines 2818--2904. The
  implementation scans scheme tokens left to right, while compounds themselves
  remain independently laid out.
- Reviewed `/usr/local/texlive/2025/texmf-dist/doc/generic/chemfig/chemfig-en.tex`:
  bond tokens, branches, rings, and `atom sep` establish molecule geometry.
- Reviewed `/usr/local/texlive/2025/texmf-dist/tex/latex/chemmacros/chemmacros.sty`
  and its manual. Current TeX Live uses `\chlewis`; the corpus uses legacy
  `\lewis`, so the reference source explicitly loads `chemfig-lewis.tex`.

## Artifacts

All generated, ignored artifacts live in `outputs/qa-chemfig-scheme/`:

- `native-png/latex-examples-chemistry-example.png`: MacTeX native PNG with a
  small legacy-command compatibility shim.
- `tikztosvg-svg/latex-examples-chemistry-example.svg` and
  `tikztosvg-png/latex-examples-chemistry-example.png`: third-party reference
  from `/Library/TeX/texbin/tikztosvg`, rasterized using
  `/opt/homebrew/bin/rsvg-convert -b white`.
- `tikzkit-svg/` and `tikzkit-png/`: JavaScript output.
- `diff-png/` and `diff/latex-examples-chemistry-example-sheet.png`: pixel
  difference plus a native / JS / tikztosvg / diff panel.

`rsvg-convert -b white` is intentional: the tikztosvg SVG has a transparent
background, which otherwise displayed as an opaque black PNG in this toolchain.

## Visual result

Before the change the JavaScript renderer emitted an unsupported-environment
diagnostic and no reaction scheme. After the change it visibly renders all
three aromatic rings, alternating inner double bonds, the two carbonyl O atoms,
the peroxide O--O bridge, both reaction arrows, the Delta annotation,
coefficients, radical dots, plus sign, and `CO2` product with subscript and
up-arrow.

The remaining differences are intentionally recorded: TikZKit uses its own
text metrics and has slightly different molecule-to-arrow spacing and ring
stroke placement. The reference images are 681x112 (tikztosvg) and 860x122
(native), while the current JS PNG is 714x90. The diff is therefore evidence
for a partial compatibility slice, not proof of pixel-identical output.

## Verification

```bash
node --test test/chemfig.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-chemfig-scheme \
  --only latex-examples-chemistry-example \
  --skip-tikztosvg
```

The `chemfig` regression test passes. A broader package-module test remains
blocked by an unrelated dirty `pgfplots` source-path expectation and is not
used as this slice's acceptance gate.

## Remaining work

- General Chemfig atom and bond grammar, branch placement, stereochemical
  bonds, and custom atom styles.
- Full chemmacros reaction and formula environments.
- TeX-equivalent text measurement for chemical labels and exact scheme spacing.

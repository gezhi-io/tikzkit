# `arrows.meta` Straight Barb

## Scope

This round implements the `Straight Barb` family as one bounded arrows.meta
slice. It covers the dependent `length`, `width`, `width'`, `line width`, and
`line width'` forms; `scale`, `scale length`, and `scale width`; `harpoon`,
`left`, `right`, `swap`, and `reversed`; `round` and `sharp`; `slant`; exact
shaft shortening; and transformed arrow bounds. Arc Barb, Tee Barb, polar or
angle-based bending, arbitrary arrow declarations, and the complete arrows.meta
key space remain outside this slice.

The permanent real-case driver is:

- `test/fixtures/examples/arrows/meta-straight-barb-circuit-blocks.tex`

It adapts the opposing one-sided block-span barbs documented by CircuitikZ and
also includes a default full Straight Barb between two stage nodes.

## Local MacTeX Study

The implementation was derived from the installed TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`,
  Straight Barb lines 129-204. Its defaults are `length=+1.5pt 2`,
`width'=+0pt 2`, and `line width=+0pt 1 1`. The paint path is one connected
three-point stroke, not two independent legs.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`,
  dependent dimensions, option transforms, sequence shortening, and drawing.
  Fixed dimensions and line-width or arrow-length factors resolve before scale;
  reversal reflects x and exchanges both logical and visual extents, while swap
  reflects y. Double paths expose their full outer width and inner width to the
  third dependent-dimension factor.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`,
  Straight Barb examples and arrow classification. `left` and `right` are
  one-sided harpoons, `right` also swaps the side, and `round` changes both cap
  and join unless a more specific key overrides one of them.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  the block-definition style around lines 845-900. Opposing reversed harpoons
  form a blue span with the centered white label masking the shaft.

For a normal single 0.4pt shaft, the default source formulas give a 2.3pt
length, 4.6pt width, and 0.4pt arrow stroke. The sharp forward tip end is
2.5828427pt, its line end is 2.1pt, and the shaft therefore stops 0.4828427pt
before the terminal. TikZKit now uses those logical extents for both painting
and bounds instead of estimating from a generic V marker.

## Three-Way Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; the native reference used local MacTeX.

Artifacts are stored in:

- `outputs/qa-arrows-meta-straight-barb-2026-09-05/tikzkit-svg/`
- `outputs/qa-arrows-meta-straight-barb-2026-09-05/tikztosvg-svg/`
- `outputs/qa-arrows-meta-straight-barb-2026-09-05/{tikzkit,tikztosvg,mactex}-png/`
- `outputs/qa-arrows-meta-straight-barb-2026-09-05/diff/`

The tikztosvg SVG confirms butt caps and miter joins, a single connected V path,
and local arrow-tip stroke widths of 0.3985pt and 0.7970pt. Its lower harpoon
paths include the short axial miter segment and mirror it at the opposite end.
TikZKit now emits the same topology and source dimensions in its internal unit
scale.

The standard and native sheets were inspected. Before this change, boolean-only
tip options could be parsed as a generic `Bar`, and the fallback drew two
disconnected legs without source shortening. Afterward, the upper arrow is a
connected full barb, the two lower reversed harpoons face the native directions,
their axial segments are present, and the blue shafts terminate before the tip
apices. The centered white label masks the lower shaft in all references.

The follow-up bounds pass also checked the asymmetric upper/lower harpoon hulls,
standalone markers, rigid flex transforms, and explicit `shorten <=`/`shorten
>=` placement. Exact PGF hulls now carry their stroke coverage once, and SVG
local y is converted back to TikZ's upward-positive normal before the viewBox is
formed. This removes the former side inversion and edge clipping risk.

The remaining visible difference is mainly global text and node-box metrics:
the MacTeX crop is about 5px wider than both SVG references. No arrow element is
missing, reversed, disconnected, or penetrated by its shaft.

## Commands And Parameters

Implemented and verified in this case:

- `\usepackage{circuitikz}` and its arrows.meta dependency
- `\tikzset`, style definitions, `\node`, `\coordinate`, `\draw`, and `\path`
- `Straight Barb` default geometry
- `length`, `width`, `width'`, `line width`, and `line width'` dependent forms
- `scale`, `scale length`, `scale width`, `harpoon`, `left`, `right`, `swap`,
  `reversed`, `round`, `sharp`, `line cap`, `line join`, and `slant`
- full/inner double-line dimension factors, exchanged visual tip/back ends,
  terminal shortening, and transformed arrow hull bounds

Not claimed by this slice:

- Arc Barb and Tee Barb source geometry
- angle/polar/flex deformation of Straight Barb
- arbitrary `\pgfdeclarearrow` setup programs and custom option keys
- repeated `reversed` cancellation in every composite spelling
- exact global TeX text and standalone crop metrics

## Verification

```sh
node --test test/arrows-meta-straight-barb.test.js
node --test test/arrows*.test.js
npm run case:audit -- test/fixtures/examples/arrows/meta-straight-barb-circuit-blocks.tex \
  --review test/fixtures/examples/arrows/meta-straight-barb-circuit-blocks.review.json --strict
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-arrows-meta-straight-barb-2026-09-05 \
  --only arrows-meta-straight-barb-circuit-blocks --strict-tikztosvg \
  --native-reference --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-arrows-meta-straight-barb-2026-09-05
```

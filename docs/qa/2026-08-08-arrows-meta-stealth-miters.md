# `arrows.meta` Stealth Miter Geometry

## Scope

This slice implements one bounded `arrows.meta` family: capitalized
`Stealth` with the default line-width-dependent dimensions and the
`scale`, `scale length`, and `scale width` keys. It also applies the same
PGF line-end calculation to path shortening. Lower-case classic `stealth` is
intentionally unchanged.

The real driver is
`test/fixtures/examples/arrows/meta-tip-scaling.tex`. Its source uses:

```tex
\usetikzlibrary{arrows.meta}
\begin{tikzpicture}[very thick]
\draw[-{Latex[]}]
\draw[-{Latex[scale length=1.8]}]
\draw[-{Latex[scale width=1.8]}]
\draw[-{Stealth[scale=1.5]}]
\draw[-{Stealth[scale length=1.8,scale width=.65]}]
\draw[-{Latex[scale length=1.5]},shorten <=4mm,shorten >=3mm]
```

The `Latex` rows are retained as a regression guard. This change only alters
the two `Stealth` rows.

## Local MacTeX Study

Read these TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`,
  Stealth declaration around lines 945-1060. It defines `length=+3pt 4.5 .8`,
  `width'=+0pt .75`, `inset'=+0pt .325`, caps the arrow outline width, and
  builds its four-point tip from front, back, top, and inset miter values.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`,
  lines 779-833. Arrow shortening is calculated from the semantic `tip end`,
  `back end`, and `line end`, not from a generic SVG marker width.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`,
  size/scaling sections around lines 280-360 and 551-592. `scale` changes
  length, width, and inset; `scale length` changes only length/inset; `scale
  width` changes only width.

Implementation follows that sequence in
`src/tikz/metrics.js:stealthMetaArrowGeometryFromLineWidth`, and the SVG
renderer uses the derived local mitered quadrilateral rather than a marker.
The source paints it through `qfillstroke`, so the SVG uses black fill plus
the capped tip outline with butt caps and miter joins.

## Three-Way Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`. MacTeX native PNGs are rendered with
the installed TeX Live 2025 `pdflatex`.

Artifacts are intentionally local and ignored by Git:

- `outputs/qa-arrows-meta-stealth-after-2026-08-08/tikzkit-svg/`
- `outputs/qa-arrows-meta-stealth-after-2026-08-08/tikztosvg-svg/`
- `outputs/qa-arrows-meta-stealth-after-2026-08-08/{tikzkit,tikztosvg,mactex}-png/`
- `outputs/qa-arrows-meta-stealth-after-2026-08-08/diff/arrows-meta-tip-scaling-native-sheet.png`
- `outputs/qa-arrows-meta-stealth-after-2026-08-08/diff/arrows-meta-latex-reverse-line-end-native-sheet.png`

I inspected both native sheets and the registered diff. The raw `tikztosvg`
SVG confirms that Stealth is a filled four-point path followed by a clipped
butt/miter stroke path; it does not use an SVG marker.

## Visible Change

Before this slice, capitalized `Stealth` reused the classic empirical tip:
the `scale=1.5` row was too wide/short and the long-narrow row used a generic
inset. The rendered path did not use the source-defined miter geometry.

Afterwards, the scaled tip has the native mitered outline and the final
long-narrow tip visibly changes longitudinal and transverse dimensions in
opposite directions. The painted stems now end at the PGF-derived line end.
The two Stealth rows in the three-way sheet are visibly closer to MacTeX and
tikztosvg; the unchanged Latex reverse-end guard still renders with zero
diagnostics.

The registered TikZKit/tikztosvg changed-pixel ratio for the scaling fixture
improved from `0.100127` before to `0.098352` after. This is supporting
evidence only: the acceptance evidence is the mitered tip shape and the
correctly independent length/width behavior in the inspected panel. A
remaining two-pixel canvas-height discrepancy and anti-aliasing along the
six horizontal stems are not claimed as fixed.

## Verification

```bash
node --test --test-name-pattern='uses PGF Stealth miter geometry' test/renderer.test.js
npm run case:audit -- test/fixtures/examples/arrows/meta-tip-scaling.tex \
  --output outputs/qa-arrows-meta-stealth-after-2026-08-08/audit.md \
  --init-review outputs/qa-arrows-meta-stealth-after-2026-08-08/review.json
npm run examples:render -- --only arrows-meta-tip-scaling,arrows-meta-latex-reverse-line-end \
  --output outputs/qa-arrows-meta-stealth-after-2026-08-08 \
  --native-reference --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-arrows-meta-stealth-after-2026-08-08 --register
```

The focused test passes. The render creates 2/2 TikZKit SVG/PNG, 2/2
tikztosvg SVG/PNG, and 2/2 MacTeX PNG artifacts with zero TikZKit diagnostics
and zero external-renderer failures. The semantic audit lists every source
command, option, and numeric literal; its generic review template remains
`incomplete` until a case reviewer marks all non-arrow shell features, so it
is not used as a claim of full-document support.

## Remaining Boundary

This does not implement composite arrow specifications, custom `setup code`,
padding/separation, open/harpoon/reversed Stealth variants, arbitrary arrow
line-width/double-line outer-factor rules, or custom arrow declarations.
The next arrow slice should address one of those families, not broaden this
implementation without a new native fixture.

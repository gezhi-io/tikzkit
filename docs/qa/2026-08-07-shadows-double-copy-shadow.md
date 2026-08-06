# `shadows` Double Copy Shadow Visual QA (2026-08-07)

## Scope

This focused slice implements local PGF's `double copy shadow` for ordinary
path and node preactions. It creates two inherited-paint copies: the farther
double-offset copy is painted first, then the nearer single-offset copy, then
the foreground object.

The real driver is
`test/fixtures/examples/shadows/double-copy-shadow-path.tex` (Case 310):

```tex
\filldraw[double copy shadow={shadow xshift=1ex,shadow yshift=1ex,opacity=.5},
  fill=blue!20,draw=blue,thick]
  (0,0) rectangle (2,1);
```

Implemented commands and keys:

- `\usetikzlibrary{shadows}`, `\draw`, `\filldraw`, `grid`, and `rectangle`;
- `double copy shadow={...}`;
- `shadow xshift=1ex`, `shadow yshift=1ex`, and `opacity=.5`;
- foreground `fill=blue!20`, `draw=blue`, and `thick` inheritance;
- ordered far `2ex/2ex` preaction followed by near `1ex/1ex` preaction;
- ordinary node double-copy shadows through the same paint resolution.

## Local MacTeX Study

Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshadows.code.tex`, lines 120-153, and
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shadows.tex`, lines 184-217.

The local style supplies two `general shadow` values. The first captures the
foreground fill/draw colours, expands caller keys, then doubles its final
x/y shifts. The second captures the same colours and uses the single caller
shift. SVG paint order therefore matters: far, near, foreground. The source
does not inject `every shadow` in this style, unlike `copy shadow`; TikZKit
preserves that distinction.

## Three-Way References

- MacTeX PNG: `/private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07/mactex-png/shadows-double-copy-shadow-path.png`;
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07/tikzkit-svg/shadows-double-copy-shadow-path.svg` and `/private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07/tikzkit-png/shadows-double-copy-shadow-path.png`;
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07/tikztosvg-svg/shadows-double-copy-shadow-path.svg` and `/private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07/tikztosvg-png/shadows-double-copy-shadow-path.png`;
- native sheet and registered diff: `/private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07/diff/shadows-double-copy-shadow-path-native-sheet.png` and `/private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07/diff-png/shadows-double-copy-shadow-path-registered.png`.

`tikztosvg` stores the offsets directly in two blue rectangle paths. TikZKit
uses two `tikz-path-shadow` transform groups: the first is `2ex/2ex`, the
second is `1ex/1ex`, both precede the full-width foreground outline. This
different SVG representation preserves PGF's paint and geometric semantics.

## Visual Result

Before the change only the foreground blue rectangle appeared. After it, the
JS panel has three staggered blue outlines/fills: a faint far copy, a faint
near copy, and the opaque foreground. MacTeX and tikztosvg show the same
up-right cascade, with the farther copy behind the nearer one.

TikZKit/MacTeX records 5.29% changed pixels and mean absolute RGBA 0.00804.
After 3px registration TikZKit/tikztosvg is 11.43% and 0.01095. These are
only calibration evidence; visual acceptance is the recovered two-copy order,
offset, inherited paint, and opacity.

## Verification

```bash
node --test --test-name-pattern='copy shadows|double-copy|drop-shadow defaults|every shadow|general shadows as path preactions' \
  test/interpreter.test.js test/petarv-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07 \
  --only shadows-double-copy-shadow-path --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-shadows-double-copy-path-after-2026-08-07 \
  --register --alignment-radius 3
```

All eight focused shadow regressions pass; MacTeX, TikZKit, and tikztosvg
generated their SVG/PNG artifacts without TikZKit diagnostics.

## Remaining Work

This completes the simple preaction shadow family for normal paths/nodes.
Circular fading/glow, special path/node shadows, style arguments/code hooks,
shading/pattern propagation, and marker tips still need their own source-led
visual QA before being claimed.

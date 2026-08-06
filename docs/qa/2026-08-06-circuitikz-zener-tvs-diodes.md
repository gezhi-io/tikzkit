# Circuitikz Zener, ZZener, and TVS Diodes Visual QA (2026-08-06)

## Scope

This pass extends the existing two-terminal diode interpreter with one shared
cathode-whisker family:

- Zener: `zD`, `zD*`, `zDo`, `zD-` and the long names;
- ZZener: `zzD`, `zzD*`, `zzDo`, `zzD-` and the long names;
- TVS/transorb: `tvsD`, `tvsD*`, `tvsDo`, `tvsD-` and the long names;
- `diode straight whiskers` and `diode sloped whiskers`;
- inherited `diodes/scale`, `diodes/fill`, and `l=` labels.

The driver is `test/fixtures/examples/circuitikz/zener-tvs-diodes.tex`. It
uses two Zeners, two ZZeners, two TVS diodes, every full/empty/stroke rendering
mode, both whisker modes, a local fill, a scale, and six component labels.

Deferred: tunnel, photo/laser, varcap, Shockley, bidirectional, thyristor,
triac, and other three-terminal/custom diode families.

## Local MacTeX Review

Reviewed local TeX Live 2025 source and manual:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 4069-4074: `diode straight whiskers` toggles the same boolean used by
  ZZener and TVS; sloped is the default.
- The same file, lines 4141-4191 and 4424-4478: Zener keeps a cathode bar and
  one top return; ZZener routes a bottom-right and top-left extension at
  `1.5 * height` when sloped, or at the bar endpoints when straight.
- The same file, lines 4622-4679: TVS uses two opposing half-scale diode
  triangles over a `bipoles/ddiode/width=.80` body, then one shared central
  whisker with a `1.3 * height` sloped extent or a `1.0 * height` straight
  extent.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 2680-2730 and 2890-2901: the short aliases and full/empty/stroke
  suffixes are documented, as is the whisker option.

TikZKit adds device-kind parsing once, then reuses the prior diode scale/fill,
lead splitting, rotation, and label machinery. The only device-specific paths
are the Zener/ZZener cathodes and the TVS opposing-triangle body.

## Three-Way Artifacts

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; its SVG/PNG
reference and MacTeX native PNG were generated alongside the browser SVG.
Artifacts are intentionally outside Git:

- before sheet: `/private/tmp/tikzkit-qa-circuitikz-zener-tvs-before-2026-08-06/diff/circuitikz-zener-tvs-diodes-native-sheet.png`;
- final JS SVG: `/private/tmp/tikzkit-qa-circuitikz-zener-tvs-after-2026-08-06/tikzkit-svg/circuitikz-zener-tvs-diodes.svg`;
- final tikztosvg SVG: `/private/tmp/tikzkit-qa-circuitikz-zener-tvs-after-2026-08-06/tikztosvg-svg/circuitikz-zener-tvs-diodes.svg`;
- final MacTeX PNG: `/private/tmp/tikzkit-qa-circuitikz-zener-tvs-after-2026-08-06/mactex-png/circuitikz-zener-tvs-diodes.png`;
- final native sheet: `/private/tmp/tikzkit-qa-circuitikz-zener-tvs-after-2026-08-06/diff/circuitikz-zener-tvs-diodes-native-sheet.png`.

Inspection of the tikztosvg SVG showed separate paths for the body triangle(s)
and whisker: Zener's top return is `0.4` half-width; ZZener's two returns are
`0.8` half-width; TVS has two mirrored triangles plus a central whisker. The
JS scene graph now serializes those same distinct roles.

## Visual Result

The before and after native sheets were viewed. Before the change, the JS
panel showed only six uninterrupted wires. MacTeX and tikztosvg visibly showed
the Zener return, the ZZener zigzag, and the double-body TVS symbol.

After the change, the JS panel has all six device bodies and labels:

- filled Zener has its cathode-top return; empty Zener preserves the requested
  orange body fill;
- the lower-left ZZener has sloped whiskers while the upper-right one terminates
  at right angles after `diode straight whiskers`;
- each TVS is a full double-width pair of opposing triangles, with the
  configured straight or sloped central whisker;
- the scaled filled TVS remains shorter while retaining its own whisker shape.

The diff still includes text rasterization and SVG antialiasing, but the
missing-symbol defect is gone; acceptance rests on the inspected geometry and
the exact aliases/options covered by regression tests rather than a global
pixel metric.

## Verification

```bash
node --test test/circuitikz-diodes.test.js \
  test/circuitikz-zener-tvs-diodes.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuitikz-zener-tvs-after-2026-08-06 \
  --only circuitikz-zener-tvs-diodes --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- \
  --output /private/tmp/tikzkit-qa-circuitikz-zener-tvs-after-2026-08-06 \
  --only circuitikz-zener-tvs-diodes
```

The focused regression passes and every reference artifact is generated with
no new diagnostics. `circuitikz` remains `partial` because this is a narrow
diode-family expansion rather than a full circuitikz implementation.

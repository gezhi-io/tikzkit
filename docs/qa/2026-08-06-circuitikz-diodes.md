# Circuitikz Diode Bipoles Visual QA (2026-08-06)

## Scope

This pass implements one narrow `circuitikz` feature family: two-terminal
diodes. It accepts the normal, filled, and empty diode forms; the Schottky and
LED variants; component labels; `diodes/scale`; `diodes/fill`; and horizontal
or vertical paths.

The driver is
`test/fixtures/examples/circuitikz/diodes.tex`. Its complete command and
option inventory is:

- package: `\usepackage[siunitx,RPvoltages]{circuitikz}`;
- environment: `circuitikz`;
- command: `\draw ... to[<bipole options>] ...`;
- aliases: `D*`, `Do`, `sD*`, and `leD*`;
- parameters: `l=$...$`, `diodes/scale=.65`, and
  `diodes/fill=orange!30`;
- placements: four horizontal bipoles and one vertical LED bipole.

This is not a claim of full diode support. Zener, ZZener, tunnel, photo/laser,
varcap, TVS, Shockley, bidirectional, tripole, and custom diode-shape families
remain outside the accepted slice.

## Local MacTeX Review

Reviewed local TeX Live 2025 sources before implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 694-798 and 1038-1040: bipole width/height are scale-class dimensions;
  diode defaults are width `.40`, height `.50`, `diodes/scale=1`, and no fill.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 2920-3260: the triangle points toward the cathode bar; the Schottky
  form bends the cathode into a hook; LED arrows use two short `latexslim`
  paths above the body.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 1642-1648 and 2674-2727: `D*` is filled, `Do` is empty, `D-` is
  stroked, and the `sD`/`leD` families use the same suffix convention.

The renderer therefore uses a `0.40 * Rlen` body width and a
`0.50 * Rlen` body height before `diodes/scale`, splits the wire at the
component ends, and places the LED label beyond the emission-arrow direction.

## Three-Way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was rasterized
with local `rsvg-convert`. Native PNG came from local MacTeX. Artifacts are
outside Git:

- before: `/private/tmp/tikzkit-qa-circuitikz-diodes-before-2026-08-06/diff/circuitikz-diodes-native-sheet.png`;
- final JS SVG: `/private/tmp/tikzkit-qa-circuitikz-diodes-final-2026-08-06/tikzkit-svg/circuitikz-diodes.svg`;
- final tikztosvg SVG: `/private/tmp/tikzkit-qa-circuitikz-diodes-final-2026-08-06/tikztosvg-svg/circuitikz-diodes.svg`;
- final MacTeX PNG: `/private/tmp/tikzkit-qa-circuitikz-diodes-final-2026-08-06/mactex-png/circuitikz-diodes.png`;
- final three-way sheet: `/private/tmp/tikzkit-qa-circuitikz-diodes-final-2026-08-06/diff/circuitikz-diodes-native-sheet.png`.

The tikztosvg output is structured as separate wire, diode-body, cathode, and
LED-arrow paths, with text positioned outside the component normal. TikZKit
now follows that breakdown rather than treating the bipole as a single
straight wire. Its LED arrow tips explicitly use the scalable arrows-meta
`Latex` form so the manual's small emission tips do not inherit the ordinary
path-arrow size.

## Visual Result

The before and final native sheets were inspected. Before this pass, the JS
panel contained only five straight lead wires: all diode bodies, labels,
Schottky hook, LED emission arrows, and the orange filled small diode were
missing. The final JS panel visibly contains:

- a filled standard diode, an empty diode, and the scaled orange empty diode;
- the Schottky cathode hook rather than a plain vertical cathode bar;
- a vertical filled LED with two small outgoing arrows and an outer-side label;
- all five math labels in the same component-relative positions as MacTeX and
  tikztosvg.

The remaining difference panel is mostly glyph rasterization, text metrics,
and SVG antialiasing. Its global changed-pixel ratio is not used as the
acceptance criterion here: adding previously absent geometry necessarily makes
more non-white pixels while producing the required semantic and visual repair.

## Verification

```bash
node --test test/circuitikz-diodes.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuitikz-diodes-final-2026-08-06 \
  --only circuitikz-diodes --native-reference --comparison-grid-mode svg \
  --strict-tikztosvg
npm run examples:diff -- \
  --output /private/tmp/tikzkit-qa-circuitikz-diodes-final-2026-08-06 \
  --only circuitikz-diodes
```

The new focused regression passes and the fixture produces TikZKit,
tikztosvg, MacTeX, and diff artifacts without new diagnostics. `circuitikz`
remains `partial` because this change intentionally adds only the reviewed
diode-bipole family.

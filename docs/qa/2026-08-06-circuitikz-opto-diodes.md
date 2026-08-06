# Circuitikz Photo and Laser Diodes Visual QA (2026-08-06)

## Scope

This pass extends the shared circuitikz diode bipole slice with the optical
diode family only:

- photodiode aliases `pD`, `pD*`, `pDo`, `pD-` and their long names;
- laser-diode aliases `lasD`, `lasD*`, `lasDo`, `lasD-` and their long names;
- `pd arrows to anode` and `pd arrows to cathode` state changes;
- local/global `opto arrows/color` and `opto arrows/relative thickness`;
- inherited `diodes/scale`, `diodes/fill`, full/empty/stroke rendering, and
  outer `l=` labels.

Deferred deliberately: arbitrary `opto arrows/dash` and end-arrow syntax,
photoresistors, phototransistors, solar cells, tunnel diodes, varcaps,
Shockley/bidirectional diodes, and all tripole/custom-device families.

The driver is `test/fixtures/examples/circuitikz/opto-diodes.tex`. It includes
filled and empty photodiodes, filled and empty laser diodes, a scaled
photodiode with cathode-bound arrows, and an independently blue component with
red, 1.5x-thick optical arrows.

## Local MacTeX Review

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 4076-4093: LED and photodiode arrow directions are independent
  booleans. A photodiode defaults to arrows going to the anode; the cathode
  option flips its two source/target pairs.
- The same file, lines 4244-4279: default photodiode arrows run from
  `(0.6 right,2 up)` and `(1.2 right,1.8 up)` toward the diode; laser arrows
  are two vertical strokes from `1.1 up` to `2.1 up` at `-0.4` and `0.2`
  right, all using the optical arrow style.
- The same file, lines 4316-4360 and 4539-4585: laser diodes add a second
  cathode bar one half-width left of the regular cathode, and full/empty forms
  share the same optical marks.
- The same file, lines 5177-5180 and 5219-5222: `lasD` and `pD` map to the
  documented full/empty device names.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 2676-2730 and 2824-2875: aliases, the two photodiode direction keys,
  and `opto arrows/color` / `relative thickness` are documented.

The interpreter therefore reuses prior diode scale/fill/body/lead logic, adds a
separate laser cathode path, and emits renderer-neutral optical-arrow paths
with the normal SVG arrow marker. The shared outer optical-label placement now
also prevents `l=` text from colliding with the arrow pair.

## Three-Way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` is at
`/opt/homebrew/bin/rsvg-convert`. Both were used with local MacTeX. Artifacts
are intentionally outside Git:

- before native sheet: `/private/tmp/tikzkit-qa-circuitikz-opto-diodes-before-2026-08-06/diff/circuitikz-opto-diodes-native-sheet.png`;
- final JS SVG: `/private/tmp/tikzkit-qa-circuitikz-opto-diodes-after-2026-08-06/tikzkit-svg/circuitikz-opto-diodes.svg`;
- final tikztosvg SVG: `/private/tmp/tikzkit-qa-circuitikz-opto-diodes-after-2026-08-06/tikztosvg-svg/circuitikz-opto-diodes.svg`;
- final MacTeX PNG: `/private/tmp/tikzkit-qa-circuitikz-opto-diodes-after-2026-08-06/mactex-png/circuitikz-opto-diodes.png`;
- final native sheet: `/private/tmp/tikzkit-qa-circuitikz-opto-diodes-after-2026-08-06/diff/circuitikz-opto-diodes-native-sheet.png`.

The tikztosvg SVG has a filled/empty diode triangle, a normal cathode bar, a
second laser bar at half a body width, and each light ray as a distinct marker
path. The browser scene graph now preserves the same device/body/arrow split.

## Visual Result

The before and after sheets were viewed. Before the change, TikZKit drew only
the six interrupted component leads while MacTeX and tikztosvg showed all
triangles, bars, light rays, arrow tips, labels, and the local red optical
arrows.

After the change, the JS panel visibly contains:

- both inward photodiode rays, with arrow tips pointing toward the standard
  diode body;
- the outward pair after `pd arrows to cathode`;
- two laser emission arrows and a second internal cathode bar for each laser
  diode;
- empty-body orange/green fills and the smaller scaled photodiode;
- a blue component body/lead whose light rays alone are red and 1.5x thick;
- labels moved to the optical outer side instead of overlapping the arrow pair.

Residual diff pixels are text rasterization, line antialiasing, and exact arrow
tip outline differences. The missing-optical-symbol defect is gone, which is
the acceptance criterion for this scoped pass.

## Verification

```bash
node --test test/circuitikz-diodes.test.js \
  test/circuitikz-zener-tvs-diodes.test.js \
  test/circuitikz-opto-diodes.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuitikz-opto-diodes-after-2026-08-06 \
  --only circuitikz-opto-diodes --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- \
  --output /private/tmp/tikzkit-qa-circuitikz-opto-diodes-after-2026-08-06 \
  --only circuitikz-opto-diodes
```

The focused regressions pass, and the renderer wrote each native/JS/tikztosvg
artifact with no diagnostic. `circuitikz` remains `partial`.

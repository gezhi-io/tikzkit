# Circuitikz Extended Diodes Visual QA (2026-08-07)

## Scope

This accepted `circuitikz` slice is limited to the documented two-terminal
tunnel, Shockley, and bidirectional diode families. It adds:

- `tD`, `tD*`, and `tD-` tunnel diodes;
- `shD` and `shD*` Shockley diodes;
- `biD` and `biD*` bidirectional diodes;
- `diodes/scale`, `diodes/fill`, `l=` labels, and horizontal or vertical
  bipole orientation for this family.

The real fixture is
[`test/fixtures/examples/circuitikz/extended-diodes.tex`](../../test/fixtures/examples/circuitikz/extended-diodes.tex).
It uses `\usepackage{circuitikz}`, `\begin{circuitikz}`, `\draw`, `to[...]`,
and all aliases above. It deliberately exercises an empty cyan scaled `biD`,
an orange filled `shD`, a stroked `tD`, and a vertical full `biD`.

Not included: tripoles, thyristors, triacs, custom diode-shape definitions,
or the broader circuitikz bipole catalog.

## Local MacTeX Reading

I read the installed TeX Live 2025 sources before implementing the geometry:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 4000-4078, gives the base diode, double-diode, and bidirectional
  scale-class width and height settings.
- The same file, lines 4440-4770, constructs the tunnel cathode as a U shaped
  path, Shockley as a left vertical plus triangular body, and `biD` from two
  opposing local-coordinate paths with separate inner leads.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 2660-2755, documents the accepted aliases and confirms that only
  tunnel has a stroke variant in this slice.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirclabel.tex`,
  lines 33, 111, and 125-300, shows that component labels begin at the outer
  shape anchor and use a `.75ex` gap. This motivated the shared inner-edge
  label anchor fix in `appendCircuitikzComponentLabel`.

TikZKit implements the paths in component-local tangent/normal coordinates,
so horizontal and vertical forms use the same geometry instead of per-case
coordinates.

## Local References

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; its SVG was
rasterized with `/opt/homebrew/bin/rsvg-convert`. Native reference PNG came
from local MacTeX. The final artifact bundle is outside Git at
`/private/tmp/tikzkit-qa-circuitikz-extended-diodes-after-label-2026-08-07`:

- TikZKit SVG/PNG: `tikzkit-svg/circuitikz-extended-diodes.svg` and
  `tikzkit-png/circuitikz-extended-diodes.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/circuitikz-extended-diodes.svg` and
  `tikztosvg-png/circuitikz-extended-diodes.png`;
- MacTeX PNG: `mactex-png/circuitikz-extended-diodes.png`;
- comparison grids: `tikzkit-grid-png/circuitikz-extended-diodes.png` and
  `tikztosvg-grid-png/circuitikz-extended-diodes.png`;
- inspected four-way sheet and difference panel:
  `diff/circuitikz-extended-diodes-native-sheet.png` and
  `diff-png/circuitikz-extended-diodes-registered.png`.

The tikztosvg SVG confirmed separate path data for the normal triangle and
U cathode, the unclosed filled compound paths of `biD`, explicit inner lead
segments, `stroke-linecap=butt`, `stroke-linejoin=miter`, and the component
rotation used by the vertical diode.

## Visual Result

I inspected the MacTeX, tikztosvg, TikZKit, and diff panels before and after
the implementation. Before, TikZKit displayed all eight examples as ordinary
straight wires: the bodies, U cathodes, internal bidirectional leads, fills,
and labels were absent. After the change, the TikZKit panel visibly contains:

- open, filled, and stroked tunnel symbols with their U cathodes;
- orange empty and black filled Shockley bodies with their cathode bars;
- cyan empty and black filled bidirectional bodies, including their two
  separate inner lead segments;
- the vertical bidirectional body rotated with its wire; and
- labels positioned beyond the component boundary instead of overprinting it.

After registration, the TikZKit-to-MacTeX changed-pixel ratio is `5.59%`,
down from `7.81%` before the geometry/label repair. This number is supporting
evidence only; acceptance is based on the formerly missing symbols now being
visibly present and corresponding to both local references. Remaining visible
differences are TeX-versus-SVG glyph rasterization and small line-width/label
metric deviations.

## Validation

```bash
node --test test/circuitikz-diodes.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only circuitikz-extended-diodes \
  --output /private/tmp/tikzkit-qa-circuitikz-extended-diodes-after-label-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- \
  --output /private/tmp/tikzkit-qa-circuitikz-extended-diodes-after-label-2026-08-07 \
  --register --alignment-radius 3
```

The focused regression passes. All TikZKit, tikztosvg, MacTeX, PNG, grid, and
diff artifacts render without new fixture diagnostics. `circuitikz` remains
`partial` because this is intentionally a narrow diode family.

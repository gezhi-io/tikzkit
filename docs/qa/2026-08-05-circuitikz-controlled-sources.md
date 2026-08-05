# `circuitikz` Controlled Sources QA

## Scope

This is one focused `circuitikz` slice: controlled voltage/current sources
(`cV`/`cI`, `cvsource`/`cisource`, and explicit European/American aliases),
their diamond geometry, and `csources/scale`. It deliberately excludes
batteries, sinusoidal controlled sources, source mirroring/rotation, and the
broader bipole catalogue.

The real driver is
`test/fixtures/examples/circuitikz/controlled-sources.tex`. It exercises
American `cV` and `cI`, explicit European controlled sources, `l=...`, and
`\ctikzset{csources/scale=1.2}` in one picture.

## Local MacTeX Reading

Reviewed in TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`
  at lines 2950-2970 and 3125-3130. `cV`/`cI` select the configured source
  styles, while `csources/scale` is a distinct controlled-source scale.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`
  at lines 694-798, 1058-1064, and 1944-1953. Controlled sources use the
  `csources` scale class and base height/width `.7`, which gives the verified
  `.49cm * csources/scale` half extent.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`
  at lines 3404-3586 and 3824-3998. The source is a diamond; European
  controlled voltage/current sources add a local line, while American voltage
  sources add `+/-` and American current sources add an internal arrow. The
  aliases also explain why `cV=value` is voltage syntax but `cI=value` is
  current syntax.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirclabel.tex`
  at lines 110-298. A generic `l=` label starts from the rotated source
  outline's `shape.90` anchor, adds `.75ex`, and faces outward. It is not a
  fixed center offset.

## Implemented Syntax

Implemented in this slice:

- `to[cV=<voltage label>]` and its direction suffixes;
- `to[cI=<current label>]`, including its post-source current arrow/label;
- `to[controlled voltage source,...]`, `cvsource`, `cvsourceEU`, and
  `cvsourceAM`;
- `to[controlled current source,...]`, `cisource`, `cisourceEU`, and
  `cisourceAM`;
- `l=<component label>` on controlled sources;
- `\ctikzset{csources/scale=<number>}`;
- inherited `[american]` selection and explicit European/American overrides.

Still partial: batteries; controlled sinusoidal sources; source mirroring and
arbitrary rotations; the complete source-label, voltage-current, and flow
grammar; and the remaining `circuitikz` bipoles.

## Visual Review

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg` and
`rsvg-convert` at `/opt/homebrew/bin/rsvg-convert`. Native rendering used
MacTeX `pdflatex`; tikztosvg used its local XeLaTeX engine.

Artifacts are intentionally generated under the ignored root
`outputs/qa-circuitikz-controlled-sources-2026-08-05/`:

- MacTeX native PNG:
  `mactex-png/circuitikz-controlled-sources.png`;
- TikZKit SVG/PNG:
  `tikzkit-svg/circuitikz-controlled-sources.svg` and
  `tikzkit-png/circuitikz-controlled-sources.png`;
- tikztosvg SVG/PNG:
  `tikztosvg-svg/circuitikz-controlled-sources.svg` and
  `tikztosvg-png/circuitikz-controlled-sources.png`;
- inspected three-way sheet:
  `diff/circuitikz-controlled-sources-native-sheet.png`;
- JS/tikztosvg/diff sheet:
  `diff/circuitikz-controlled-sources-sheet.png`.

The tikztosvg SVG has a `271.4pt x 85.84pt` viewBox. Its clipped lead paths,
diamond `path` data, internal current-arrow path, and outline-glyph `<use>`
elements show the target structure directly. In particular, `cV=value` places
its text from the source perimeter and `cI=value` produces a separate
post-source current-arrow label.

Before the label correction, TikZKit's controlled-source labels were centered
with a fixed offset: `g v_x`, `mu v_x`, and `beta i_x` overlapped their
diamonds, while `g i_x` was treated as an ordinary component label. After the
shared source-outline placement and `cI` current-label lowering:

- all four diamonds and their split wires are present;
- AM `cV` contains the `+/-` pair and AM `cI` contains the internal arrow;
- EU `cV` and `cI` contain their respective internal line orientations;
- `g v_x`, `mu v_x`, and `beta i_x` sit outside the left source boundary;
- `g i_x` follows its external current arrow above the second source.

MacTeX and tikztosvg are visually close. TikZKit now preserves the same
component/label relationships; residual glyph outline and rasterization
differences remain. The JS/tikztosvg supporting diff improved from a
`0.1281` changed-pixel ratio and `0.05737` mean absolute RGBA before this
label correction to `0.09964` and `0.03778` afterward. Those values are not
the acceptance criterion; the inspected sheet confirms the formerly missing
and overlapping visual relationships are now present.

## Verification

```bash
node --test test/circuitikz-controlled-sources.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-controlled-sources-2026-08-05 \
  --only circuitikz-controlled-sources --native-reference \
  --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-circuitikz-controlled-sources-2026-08-05
npm run extension-registry
```

The focused regression passes with no diagnostics. The regenerated registry
now records four `circuitikz` fixture cases, the new implementation entry,
and the local-source review.

## Next Slice

Keep the next change narrow: controlled sinusoidal sources or battery cells,
with their own MacTeX/tikztosvg visual sheet. Do not claim the remaining source
catalogue from this controlled-source result.

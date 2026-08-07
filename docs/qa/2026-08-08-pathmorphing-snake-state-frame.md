# Pathmorphing Snake State-Frame QA (2026-08-08)

## Scope

This slice corrects the standard `snake` decoration when one PGF decoration
state crosses a sharp polyline corner. It covers the `decorate` action,
`decoration={snake,...}`, `pre length`, `segment length`, `amplitude`, `post
length`, ordinary `--` polylines, and late `-stealth` shortening. It does not
claim `zigzag`, `coil`, `bumps`, arbitrary flattened curves, or legacy
`snakes` variants with `mirror`/`raise`.

The direct user driver is
`test/fixtures/examples/decorations/snake-arrow-lengths.tex`, which contains
the Case 005 command with `pre length=0.01mm`, `segment length=2mm`,
`amplitude=0.3mm`, `post length=1.5mm`, and `-stealth`. The visual regression
driver is `test/fixtures/examples/decorations/snake-polyline-continuity.tex`.

## Local PGF Review

Reviewed MacTeX/TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathmorphing.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`.

The native `snake` declaration defines the states `initial`, `down`, `up`,
`end down`, `end up`, and `final`. Unlike corner-aware decorations, it does
not enable `auto corner on length`. The decorator selects the current transform
frame at a state boundary and emits the whole state there; a later path tangent
does not rotate control points already belonging to that state. `pre length`
and `post length` are meta-decoration sections, while terminal arrows shorten
the completed path afterward.

## Source Inventory

| Source construct | Result |
| --- | --- |
| `decorate` + `decoration={snake,...}` | Implemented for the bounded native snake state machine. |
| `pre length`, `segment length`, `amplitude`, `post length` | Implemented; the Case 005 fixture covers phase and length. |
| `-stealth` | Applied after decoration, so it does not alter the snake phase. |
| Sharp `--` corners | Standard snake keeps the entry tangent/normal for the whole crossing state. |
| `snake` with `mirror` or `raise` | Still partial at sharp corners. |
| `zigzag` sharp corners | Outside this change; exact native normal changes stay partial. |
| `coil`, `bumps`, `random steps`, arbitrary curves | Not accepted by this slice. |

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVGs were
converted with `/opt/homebrew/bin/rsvg-convert`. Both paths contain native
MacTeX PNG, TikZKit JS SVG/PNG, tikztosvg SVG/PNG, 1cm-grid panels, diffs, and
four-panel sheets:

- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pathmorphing-snake-lengths-before-2026-08-08/`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pathmorphing-snake-lengths-after-2026-08-08/`

The tikztosvg SVG uses cubic wave path data and places the terminal marker
after the decorated geometry. At sharp corners its path agrees with native
MacTeX on preserving the state frame; TikZKit now does the same instead of
rotating a cubic's normal at the elbow.

## Visual Result

Before the change, the red snake in
`decorations-snake-polyline-continuity` visibly doubled and kinked at the two
elbows: JavaScript chose a new normal for later control points inside one
native snake state. The four-panel diff showed a concentrated red trace at
both turns, while the MacTeX and tikztosvg panels followed the same state-frame
wave.

After the change, the JavaScript and MacTeX panels are visually coincident:
the horizontal/vertical transition retains the native state geometry until the
next state boundary. The registered native comparison reports zero changed
pixels across the 20,592-pixel aligned panel; this corroborates direct visual
review. The Case 005 straight snake retains its reserved pre/post segments and
terminal arrow. `decorations-zigzag-native-state` remains unchanged and is
explicitly outside this acceptance boundary.

## Verification

```bash
node --test test/snake-polyline-continuity.test.js \
  test/snake-arrow-lengths.test.js \
  test/snakes-legacy-options.test.js

npm run examples:render -- --only decorations-snake-arrow-lengths,decorations-snake-polyline-continuity,decorations-zigzag-native-state \
  --output outputs/qa-pathmorphing-snake-lengths-after-2026-08-08 \
  --native-reference --strict-tikztosvg

npm run examples:diff -- --output outputs/qa-pathmorphing-snake-lengths-after-2026-08-08 --register
```

The focused suite passes 8/8 and all three three-way renders complete with
zero TikZKit diagnostics. The broad `test/interpreter.test.js` regression was
also run: 276/294 pass, while 18 pre-existing failures remain in unrelated
color-string, node-style, and scale assertions. The snake tests inside that
broad run (including this new state-frame assertion) pass. The sharp-corner
snake panel is accepted; the remaining variants stay partial as listed above.

## Files Changed

- `src/engine/evaluate.js`
- `test/snake-polyline-continuity.test.js`
- `docs/extension-registry.md`
- `docs/extension-registry.csv`

# Two-terminal CircuitikZ resistor modifiers

[Annotated native / parent / corrected proof](../../../docs/qa/assets/native-circuitikz-resistor-modifiers.png)

[Manual](manual-thickness.tex): the complete American `vR` / `sR` drawing from
the installed TeX Live 2025 manual, example 2362 (drawing lines 2363-2369,
byte-checked), with only a standalone document wrapper.
[Control](angled-anchors.tex): oblique mirrored European variable/sensor bodies,
old European and American tunable directions, four named anchors, and one
ordinary R. The old European has an explicit red stroke and component-local
blue fill. Native paints its head **black**. No potentiometers or other families.

| Recorded Chrome 158 run | Physical comparisons | Observation |
|---|---:|---|
| Parent `6f251f72`, renderer `d4de40db` | 68/170 | Only native cross-checks passed; 0/10 modified bodies. Manual page height 21.546 vs 30.087 mm. All four ring centers collapsed to one point. |
| Failed renderer `aa98bf18` | 164/170 | Wrong head fill, `#5959ff` instead of black, in editor/download/CLI against both references. Original evidence retained. |
| Final renderer `5c943e9c` | **170/170** | No diagnostics. 8/8 reference hashes unchanged. Both downloaded SVGs and their PNGs are byte-identical to their CLI counterparts. |

The 170 comparisons cover 11 bodies, four named rings and two pages: 102
JS-to-native and 68 reference cross-checks. Maximum linear residual: **0.00131 mm
vs PDF**, **0.00172 mm vs converter**. Maximum named-anchor distance: 0.00112
and 0.00158 mm, respectively. Page error at most 0.00016 mm. Native body /
modifier pens in the three rows (mm): 0.28116/0.28116, 0.56233/0.56233,
0.56233/0.28116. In the fixed head window, the final download, CLI and
converter-in-Chrome each have 125 pure-black pixels and no box-blue pixels.

**What is checked.** The shared harness clicks Render, verifies the previous
SVG detached and the editor retained the fixture, then clicks Download SVG.
Two references: original-source pdfLaTeX and actual MacTeX `tikztosvg` (only
its wrapper and standalone border are adapted). Chrome and librsvg each paint
the converter SVG; these are not two independent vector oracles. Physical
paths check body kind/zigs, leads, modifier endpoints, sensor bend/foot,
tip and head dimensions/area, separate stroke/fill colors, anchors and page.
Limits: 0.02 mm linear, 0.035 mm2 area, exact color/count/type; pre-rounding.
384 dpi raster witnesses and overlays use fixed page coordinates without
registration. Pixel identity across different rasterizers is not required.

**Replay** with local Chrome, MacTeX, Poppler, librsvg, the project dependencies
and the positioning audit's Python libraries. Set `PLAYWRIGHT_INDEX_MJS` to
the absolute path of your installed Playwright's `index.mjs`. Use fresh output
names; the script refuses to replace a prior run:

```sh
ROOT="$(git rev-parse --show-toplevel)"
F="$ROOT/test/fixtures/native-circuitikz-resistor-modifiers"
OUT="$ROOT/outputs/qa/2026-11-25-circuitikz-resistor-modifiers"
bash "$F/replay.sh" before "$OUT/replay-before"
bash "$F/replay.sh" after "$OUT/replay-after" "$OUT/replay-before"
```

Recorded directories: `before-fill` (archived parent with the final control),
`final-aa98bf18` (failed) and `final-5c943e9c` (official). Each retains the
actual editor screenshot, SVG download, PDF and converter SVG. See
`features.csv`, `residuals.csv`, `reference-locks.csv`, `overlays/`, and
`head-crop.csv` in the final directory. To regenerate the recorded sheet
including the failed head, run:

```sh
python3 -B "$F/proof.py" "$OUT/final-5c943e9c" --before "$OUT/before-fill" --failed "$OUT/final-aa98bf18"
```

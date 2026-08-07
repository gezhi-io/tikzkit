# Legacy Snakes Controls QA (2026-08-07)

## Scope

This correction covers the deprecated `\usetikzlibrary{snakes}` path-option
family only: default `snake`/`snake=zigzag`, `snake=snake`, `segment amplitude`,
`segment length`, `mirror snake`, `raise snake`, and
`line/gap before|after|around snake`. It does not expand modern
`decorations.pathmorphing` semantics.

The visual driver used the locally supported legacy form:

```tex
\draw[snake, segment length=4mm, segment amplitude=1mm,
  line before snake=5mm, line after snake=4mm,
  mirror snake, raise snake=.4mm, -stealth, thick, blue]
  (0,0) -- (4,0) -- (4,2);
```

## Local MacTeX Reading

Reviewed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarysnakes.code.tex`:
  the compatibility library loads decorations but keeps `snake`, mirror/raise,
  and four endpoint lead/gap options. Its default old snake is `zigzag`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`:
  `tikz@path@lineto` calls `pgfpathsnakesto` for each individual `--`; phase
  therefore restarts at a corner.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`:
  legacy segment amplitude/length map onto the decoration values.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`:
  supplied the native snake start, alternating state, and final-state geometry.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native rendering used local `pdflatex`.

Artifacts for the modern real-gallery sanity cases are retained at the ignored
directory `/private/tmp/tikzkit-qa-snakes-length-2026-08-07/`:

- `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`, and
  `mactex-png/` contain all three renderers.
- `diff/*-native-sheet.png` contains the inspected JS/MacTeX/tikztosvg/diff
  panels for Case 005, the polyline driver, and the MDP gallery case.

The dedicated legacy-source artifacts are in `/private/tmp/` as
`tikzkit-legacy-snakes-controls-{after-js,tikztosvg,native}.{svg,png}`.
The `tikztosvg` SVG uses a single blue path without SVG marker elements, but its
legacy gap/crop result differs from the native reference; MacTeX was therefore
the acceptance reference.

## Visual Review

Before the correction, TikZKit drew only the two straight blue path segments:
the old `snake` key was parsed but never entered the path morphing layer.

After the correction, the first segment visibly contains a 5mm straight lead,
a mirrored and raised zigzag, and a 4mm straight terminal lead. The vertical
segment starts its own zigzag phase after the corner, matching the native
`tikz@path@lineto` behavior. The MacTeX and TikZKit rasters now share the two
independent zigzag runs and arrowed endpoint; tikztosvg remains a useful SVG
structure reference but not the geometry authority for this deprecated form.

## Change And Verification

- `src/engine/evaluate.js`: lowers legacy path keys before modern decoration
  handling, processes individual line/close segments, and applies the local
  normal mirror/raise transformation.
- `src/tikz/libraries/snakes.js`: records the focused partial support and local
  source review.
- `test/snakes-legacy-options.test.js`: guards direct legacy geometry,
  independent corner restart, `snake=none`, smooth `snake=snake`, and gaps.
- `docs/extension-registry.csv`: regenerated after the library update. The
  priority summary in `docs/extension-registry.md` does not list this
  seven-case entry.

```sh
node --test test/snakes-legacy-options.test.js test/snake-arrow-lengths.test.js \
  test/snake-polyline-continuity.test.js test/library-modules.test.js
npm run extension-registry
```

All focused tests pass. Remaining work is intentionally limited to arbitrary
custom `\pgfdeclaresnake` states and the old triangle object variants.

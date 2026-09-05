# Beamer multi-frame and delayed foreach QA

## Scope

This slice covers one feature family driven by `latex-examples-bellman-ford-algorithm`:

- preserve consecutive `frame` bodies instead of retaining only the first one;
- replay earlier pictures as semantic-only state when a later figure is selected;
- resolve foreach-bound variables inside expanded style keys, values, labels, and edge options;
- apply dynamically supplied `bend right` before edge geometry is built.

It does not claim complete Beamer overlay, fragile-frame, theme, or page-layout support.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/latex/beamer/beamerbaseframe.sty`: Beamer collects each frame body and ships each selected overlay as an independent page.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`: each picture is grouped, but named-node registration is designed for later references.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`: node shape records are registered globally and a later definition of the same name replaces the prior record.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgffor.code.tex`: slash-list variables are local to an iteration and are available while that iteration's body is executed.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex`: `bend right` installs relative out/in angles before the curve-to path is generated.

The implementation consequence is that selected-frame rendering must retain earlier node registrations without painting earlier frames, while loop-provided options must remain delayed until the edge statement executes.

## Reference tools and artifacts

- MacTeX engine: `/Library/TeX/texbin/pdflatex`
- tikztosvg: `/Library/TeX/texbin/tikztosvg`
- PNG conversion: `/opt/homebrew/bin/rsvg-convert`

Per-frame artifacts:

- `outputs/qa/2026-09-05-beamer-bellman-frame-1`
- `outputs/qa/2026-09-05-beamer-bellman-frame-2`
- `outputs/qa/2026-09-05-beamer-bellman-frame-3`

Each directory contains TikZKit SVG/PNG, tikztosvg input/SVG/PNG, MacTeX PNG, 1 cm grid variants, registered diffs, and a four-panel native comparison sheet.

## Visual result

Before this slice, only the first Beamer picture survived preprocessing. Loop-provided `bend right` was treated as a literal unknown option, so the two directed edges between `b` and `e` collapsed onto straight geometry. Label macros could remain literal, and selecting the third frame reported an unknown source node because `a` is intentionally defined only in an earlier frame.

After the change:

- all three graph states render;
- every frame has two visibly separated cubic `b`/`e` edges with arrow tips following the terminal tangent;
- weights and predecessor labels contain resolved values rather than `\weight` or `\pred`;
- the second and third frames show 16 infinity labels in total with the configured opposite horizontal shifts and common downward shift;
- the third frame uses the earlier `a` coordinate for its outgoing edges without painting the omitted `a` node;
- diagnostics remain empty.

TikZKit and tikztosvg differ by one raster pixel in outer dimensions. After registration, about 7-8 percent of pixels differ, concentrated in glyph antialiasing and the outer crop. The graph topology, curve direction, labels, arrows, colors, and relative geometry agree on the inspected panels. The original three-page Beamer PDF was also compiled locally to verify that the third page's omitted `a` node and retained outgoing edges are genuine PGF behavior.

## SVG structure

The TikZKit frame-1 SVG contains explicit cubic path data for both curved edges, explicit arrow-tip paths, butt/miter edge strokes, and round arrow-tip caps/joins. tikztosvg emits glyph `<use>` elements and more outline paths, while TikZKit emits SVG text with packaged Computer Modern faces. Both preserve the same curve orientation and terminal-arrow direction; MacTeX remains the visual authority.

## Verification

Focused tests cover frame unwrapping, active-picture semantic replay, delayed style substitution, dynamic edge options, all three Bellman-Ford frames, native-input normalization, and the render CLI's `--active-figure` option.

```sh
node --test test/beamer-multi-frame.test.js test/frontend.test.js test/options.test.js test/example-render-script.test.js
# 90 passed, 0 failed

node --test --test-name-pattern='Bellman-Ford frames retain named vertices' test/example-fixtures.test.js
# 1 passed, 0 failed

npm test
# 2418 tests: 2269 passed, 135 failed, 14 skipped
```

The full-suite baseline before this slice was 2404 tests with 2254 passed, 136 failed, and 14 skipped. This slice adds passing coverage and introduces no new full-suite failures. The remaining failures are existing unsupported or stale expectations elsewhere in the project and are not presented as passing.

## Remaining limits

- Beamer overlay specifications are removed rather than evaluated as separate overlay pages.
- Command-form `\frame`, fragile verbatim collection, themes, navigation chrome, and Beamer page placement are not rendered.
- Selected-picture MacTeX/tikztosvg normalization supports earlier top-level `tikzpicture` state; arbitrary cross-frame TeX side effects are not replayed.

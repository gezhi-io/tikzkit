# arrows.spaced geometric terminal QA (2026-09-04)

## Scope

This slice implements `spaced o`, `spaced *`, `spaced diamond`, `spaced open diamond`, `spaced square`, and `spaced open square`. The acceptance boundary covers active line width, filled and open paint, start and end terminals, explicit shaft cap and join state, straight and orthogonal paths, and curved terminal tangents. `spaced left to`, `spaced right to`, and `spaced serif cm` remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`: lines 55-60 declare all six names as starred zero-separation combinations of the ordinary geometric tip and `space`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: `*` and `o` share line-width-dependent circular geometry; diamonds and squares have line-width-dependent extents and round joins. Filled variants call `fillstroke`, while open variants call `stroke`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: `space` is invisible and contributes `0.88pt + 0.3 * line width` to the arrow assembly.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`: `line width`, `line cap`, and `line join` are installed in the path graphic state before terminal rendering.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoregraphicstate.code.tex` and `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-base-arrows.tex`: explicit shaft cap and join state remains distinct from cap and join choices used to paint an arrow tip.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: the manual lists the six spaced compatibility names with their ordinary circle, diamond, and square counterparts.

TikZKit now wraps the existing ordinary circle, diamond, and square metrics. The wrapper preserves every visible geometry and paint field and adds the invisible space only to placement, terminal placement, and assembly length. The SVG renderer also preserves explicit path `line cap` and `line join` values on arrowed shafts; individual tip paths still use their declaration-specific cap and join.

## Reference tools and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`
- MacTeX `pdflatex`: `/Library/TeX/texbin/pdflatex`
- QA root: `outputs/qa/2026-09-04-arrows-spaced-shapes`
- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX: `mactex-png/`
- Four-way sheets and raster differences: `diff/*-native-sheet.png` and `diff-png/`

The tikztosvg SVG uses separate transformed paths for each terminal. Open variants have no fill; filled variants have fill and stroke; diamond and square terminals use round joins; circles retain their declaration geometry. Transforms follow each terminal tangent. TikZKit emits the same topology and keeps shaft and tip graphic states separate.

## Visual acceptance

- `arrows-spaced-shapes-flowchart`: all six tips are present. Filled and open paint, blue and green diamonds, red and purple squares, and orange and gray circles agree with MacTeX and tikztosvg. Orthogonal and curved routes rotate their terminals to the final tangent.
- `arrows-spaced-shapes-math`: the four-node diagram exercises all polygonal forms and both circle forms. Bidirectional curved terminals remain clear of node borders and retain their start/end orientation.
- `arrows-spaced-shapes-physics`: horizontal, vertical, diagonal, and curved force paths retain explicit round shaft caps and joins while each terminal keeps its source-defined paint and join behavior.

Before this change, the six spaced geometric names were not recognized as complete arrow-tip names. During comparison, the physics case also exposed a shared renderer bug: any arrow terminal forced its shaft to butt caps and miter joins. After the fix, all six names render with zero diagnostics and explicit round shaft state matches tikztosvg. TikZKit raster dimensions are 398x175, 163x130, and 181x162; MacTeX dimensions are 398x176, 163x131, and 183x164. Remaining differences are limited to one-to-two-pixel crop rounding and text rasterization, with no missing or misplaced geometric terminal.

Mean absolute RGBA differences are 0.01582 for the flowchart, 0.02466 for the mathematical map, and 0.01644 for the physics diagram. These values are secondary to direct four-panel inspection.

## Semantic coverage

Every dependency, command, environment, option, literal number, and expression in the three fixtures is covered by the adjacent `.review.json` files and strict semantic audit. Focused regression coverage lives in `test/arrows-spaced-shapes.test.js`.

# arrows.spaced side-to terminal QA (2026-09-04)

## Scope

This slice implements `spaced left to`, `spaced left to reversed`, `spaced right to`, and `spaced right to reversed`. The acceptance boundary covers active line width, upper/lower half selection, reversed multi-part paint, start and end terminals, straight and orthogonal paths, and curved terminal tangents. `spaced serif cm` remains outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`: lines 62-65 declare the four public names as starred zero-separation combinations of the corresponding side-to tip and `space`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: `left to` and `right to` use `d=.28pt+.3*line width`, paint one reflected cubic half at `.8*line width`, and select round caps and joins. Their backend is `-.84pt-1.3*line width` and tip end is `.21pt+.625*line width`.
- The same arrows source defines reversed tips with backend `-.1*line width`, tip end `3.75d+.9*line width`, a full-width butt-cap stem, and two `.8*line width` round-cap cubics translated by `.625*line width`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: `space` is invisible and contributes `.88pt+.3*line width` to the assembly.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: the partial-arrow section lists all ordinary and spaced left/right variants.

TikZKit now has shared ordinary side-to metrics and a spaced wrapper that changes only placement, terminal placement, and assembly length. The renderer can paint one arrow tip as multiple SVG paths, allowing the reversed stem and curves to retain their independent line widths and caps.

## Reference tools and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`
- MacTeX `pdflatex`: `/Library/TeX/texbin/pdflatex`
- QA root: `outputs/qa/2026-09-04-arrows-spaced-side-to`
- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX: `mactex-png/`
- Four-way sheets and raster differences: `diff/*-native-sheet.png` and `diff-png/`

The tikztosvg SVG confirms separate transformed terminal paths. At a 1.2pt shaft width it paints normal and reversed cubic portions at 0.9564pt, while each reversed stem remains 1.19553pt. Curves use round caps and joins; stems use butt caps. TikZKit emits the same topology, width ratio, paint state, and tangent transform.

## Visual acceptance

- `arrows-spaced-side-to-flowchart`: all four aliases are visible. Upper and lower halves are not reflected incorrectly; vertical rejection, orthogonal retry, and curved override routes keep their terminal tangents and node gaps.
- `arrows-spaced-side-to-math`: the quotient map covers horizontal, vertical, curved, start, and end terminals. Left/right half selection, reversed stems, labels, and node-border spacing agree with MacTeX and tikztosvg.
- `arrows-spaced-side-to-physics`: normal-force, gravity, diagonal force, tension, and curved impulse vectors preserve the correct half-plane and endpoint spacing at every direction.

Before this change, these multi-word names fell through arrow parsing and had no source-specific geometry. After the change, all four render with zero diagnostics. TikZKit raster dimensions are 420x126, 257x143, and 227x174; tikztosvg dimensions are 421x128, 258x147, and 229x176. Direct inspection attributes the remaining one-to-four-pixel crop and glyph differences to text rasterization and canvas rounding; no arrow element is missing or misplaced.

Mean absolute RGBA differences are 0.01830 for the flowchart, 0.02113 for the mathematical map, and 0.01533 for the physics diagram. These values are secondary to direct four-panel inspection.

## Semantic coverage

Every dependency, command, environment, option, literal number, and expression in the three fixtures is covered by the adjacent `.review.json` files and strict semantic audit. Focused regression coverage lives in `test/arrows-spaced-side-to.test.js`.

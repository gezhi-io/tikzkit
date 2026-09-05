# `decorations.text`: repeat state machine and character counters

## Scope and priority

This pass covers one visual slice: `repeat text` for `text effects along path`.
The previous renderer treated a soft trailing value space as a real glyph,
stopped only after a complete character advance fitted, did not bind the
documented character counters, and let `draw=gray` color the text. The real
repeat fixture consequently drew only six `AB` cycles where both references
drew eight, and the PGF manual spiral had one constant size and gray text.

The accepted boundary is:

- soft key-value boundary whitespace versus explicit TeX control space `\ `;
- finite and path-filling repeat cycles;
- PGF's prewidth terminal check;
- `character count=\m`, `character total=\n`, and numeric per-character
  `scale` expressions;
- repeat combinations with grouping/reverse and circle replacements;
- text current color independent of `draw=` and `fill=` paint.

Arbitrary TeX token expansion, arbitrary per-character styles/replacement
pictures, asymmetric node pre/post widths, exact painted text bounds, and
repeat combined with PGF's undefined fit/scale modes remain outside this pass.

## Local MacTeX study

Reviewed these TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`, especially `repeat text`,
  `\tikz@lib@dec@te@preparetext`, `\tikz@lib@dec@te@scancharacters`, the
  character measurement states, and the repeat state at lines 650-679.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`, especially state widths, remaining-distance checks,
  and state movement around lines 887-960, 1020-1035, and 1164-1208.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgfkeys.code.tex`, where `\pgfkeys@spdef` trims soft outer value whitespace.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, repeat documentation and the spiral example around lines 2043-2066.

The implementation follows the local algorithm: character boxes have pre and
post widths, a repeat restarts both counters, and the character is painted when
its prewidth fits even if the postwidth exhausts the path. A control space is a
real token; a soft terminal value space is removed before scanning.

## Commands and parameters audited

Implemented for the driver and combinations:

- `\usetikzlibrary{decorations.text}`;
- `\begin{tikzpicture}`, `\path`, `draw`, `ultra thin`, and `postaction=decorate`;
- `decoration={text effects along path,...}`, `text`, `repeat text`,
  `character count`, `character total`, and `characters={text along path,scale=...}`;
- `\foreach` with `\a`, integer ranges, arithmetic in arc angles/radii, and
  chained `arc` operations;
- `group letters`, `reverse text`, `word separator`, and supported circle
  `replace characters` combined with repeat;
- `text color`, `text=<color>`, bare/current color, and separate `draw=<color>`.

Still partial or unsupported in this slice:

- arbitrary TeX control sequences and active-character tokenization in `text`;
- general TikZ pictures in `replace characters` beyond the supported circles;
- arbitrary code in per-character/every-character styles;
- exact asymmetric PGF node prewidth/postwidth and glyph outline bounds;
- repeat with `fit text to path` or `scale text to path`, which the local manual
  documents as undefined.

## Third-party and native artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`. The retained artifacts are under:

`outputs/qa/2026-09-06-decorations-text-repeat-after/`

It contains four TikZKit SVG/PNG pairs, four `tikztosvg` SVG/PNG pairs, four
MacTeX PNGs, registered diffs, and four-way native sheets. The manual spiral's
`tikztosvg` SVG uses 141 `<use>` nodes backed by 141 glyph paths plus one path
transform; TikZKit uses 141 `<text>` nodes, each with its own rotation, plus one
spiral path. The structural difference explains residual browser-font outline
pixels, but both now have the same character count and scale sequence.

## Visual result

The inspected sheets are:

- `diff/decorations-text-repeat-native-sheet.png`;
- `diff/decorations-text-repeat-group-reverse-native-sheet.png`;
- `diff/decorations-text-repeat-replacements-native-sheet.png`;
- `diff/decorations-text-repeat-manual-spiral-native-sheet.png`.

Visible changes:

- soft `text={AB }` now yields eight tightly spaced cycles like MacTeX and
  `tikztosvg`, while `text={AB\ }` retains the larger regular control-space gap;
- the final character appears when its prewidth fits instead of disappearing
  one half-box early;
- grouped/reversed words and alternating circle replacements restart cleanly;
- the spiral grows through 21 distinct character sizes on every cycle instead
  of painting one constant size;
- the spiral text is black while the auxiliary path remains gray.

The remaining visible difference is the SVG text outline/rasterization and a
tighter TikZKit decoration-text bounding box (86.29pt by 80.62pt versus the
97.672pt by 97.396pt `tikztosvg` output). The glyph sequence and placement are
no longer missing; exact painted decoration bounds remain recorded as partial.

## Verification

The focused suite covers the minimal terminal case, two combination fixtures,
and the exact PGF manual spiral. Rendering completed with zero diagnostics and
zero external failures for all four fixtures. The full Node test suite reports
2502 tests: 2352 passed, 136 known failures, and 14 skipped. The known-failure
count is unchanged from the pre-slice baseline, so this pass adds no regression.

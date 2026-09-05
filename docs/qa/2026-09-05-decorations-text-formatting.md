# decorations.text default format delimiters QA

## Scope

This slice implements the default `|...|` formatting state used by the
`text along path` decoration:

- `|format|` replaces the active character-box format;
- `|+format|` appends to the active format;
- `||` resets the active format;
- font size, family, weight, style, and `\color` are carried by each glyph run;
- `text color` remains the decoration-wide fallback.

Custom `text format delimiters`, arbitrary TeX grouping, and exact bold or
italic TeX advance metrics are outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex`, especially the formatter scanner and `\pgf@lib@dec@text@dobox`: each character is placed in its own TeX box, after the current format and decoration text color have been applied.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`: TikZ loads the PGF text decoration and adds the text-effects layer; `text along path` uses base-anchored transformed character nodes.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, Text Decorations: documents the default delimiter, additive `+` form, reset form, character-box placement, baseline-center positioning, and `raise` behavior.

The implementation consequence is that formatter commands cannot remain in the
display string. They must become state attached to subsequent glyph boxes until
the next delimiter changes that state.

## Reference tools and artifacts

- MacTeX engine: `/Library/TeX/texbin/pdflatex`
- tikztosvg: `/Library/TeX/texbin/tikztosvg`
- PNG conversion: `/opt/homebrew/bin/rsvg-convert`
- Artifact directory: `outputs/qa/2026-09-05-decorations-text-formatting`

The directory contains the TikZKit SVG/PNG, tikztosvg input/SVG/PNG, MacTeX
PNG and log, 1 cm grid variants, registered diff images, and comparison sheets.

## Visual result

Before the fix, a leading formatter such as
`|\footnotesize\bf\color{white}|` was painted literally as backslash and command
letters. Its white color was also replaced by an accidental black fallback.
Mid-string format delimiters and reset delimiters were likewise visible text.

After the fix, the PGF manual apple example shows only
`a big green juicy apple.`. The word `green` alone is green, the surrounding
text returns to black, and every glyph follows the same curve and tangent as
MacTeX and tikztosvg. The grid, path extent, character centers, rotations, and
SVG viewBox agree visually. TikZKit and tikztosvg use the same 119 by 82 raster
extent; after zero-offset registration, 1.43 percent of pixels differ, mainly
along antialiased glyph edges. MacTeX raster differences are comparable for
TikZKit and tikztosvg, so MacTeX remains the authority while the two SVG paths
are visually equivalent for this slice.

## SVG structure

tikztosvg converts each TeX glyph to an outline path in a transformed group and
switches fill state to green for the formatted word. TikZKit emits one SVG
`text` element per glyph, with explicit `x`, `y`, rotation, packaged Computer
Modern font family, font size, and per-run fill. Both outputs use a butt linecap
and miter linejoin for the help grid; the decorated source path itself remains
unpainted.

## Verification

The focused tests cover a leading white/bold/small format, replace/append/reset,
postaction plus reverse path/center/signed raise, and the exact PGF manual case.

```sh
node --test --test-name-pattern='places text decorations|applies and resets default decorations|combines formatted decoration|renders the PGF manual decorations|keeps pgfmathsetmacro inside foreach-expanded text decorations' test/interpreter.test.js
# 6 passed, 0 failed (including the existing postaction companion selected by the pattern)

npm test
# 2421 tests: 2278 passed, 129 failed, 14 skipped
```

The focused slice adds no failures. The full-suite failures remain in the
repository's existing unsupported/stale-expectation baseline; one independent
manifest failure is the missing semantic owner for `circuitikz-varcap-diodes`.

## Remaining limits

- Custom opening and closing characters from `text format delimiters` are not parsed.
- Nested/general TeX format groups and arbitrary formatting macros are partial.
- Bold and italic runs select the correct packaged face but still use the regular CMR advance table for path spacing.
- Arbitrary character replacement TikZ programs and native-undefined repeat plus scale/fit combinations remain partial.

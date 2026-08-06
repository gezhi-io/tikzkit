# bchart `bcfontstyle`: Visual QA

## Scope

This accepted slice implements the documented zero-argument
`\renewcommand{\bcfontstyle}{...}` hook for the `bchart` package. It covers
the default `\sffamily` style, an explicit style such as `\bfseries`, and an
empty definition that restores the document font. `scale` remains geometric:
it changes the bars, axes, and coordinates but not the font size.

The real visual driver is
[`test/fixtures/examples/bchart/font-style.tex`](../../test/fixtures/examples/bchart/font-style.tex),
derived from the installed bchart manual's font-style and scale examples. It
uses a `.7` chart scale and `\bfseries` so an ignored font hook is immediately
visible: the old JavaScript output silently used normal CMU Sans; the current
one uses bold CM Roman, like the native renderers.

## Local MacTeX Reading

I read the installed TeX Live 2025 sources and documentation:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/bchart/bchart.sty`, lines
  22-24, defines `\bcfontstyle` as `\sffamily` globally. Lines 74-120 apply
  it to values, bar text, labels, and skip labels while keeping the fixed
  `5mm` row height and `2.5mm` center offset.
- The same file, lines 127-165, sets `scale` only on `tikzpicture`; the text
  nodes carry `\bcfontstyle` themselves. This is why text stays at the
  document size when the chart geometry is scaled.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/bchart/bchart.tex` documents
  redefining the hook to `\bfseries` or to an empty body, and explicitly states
  that `scale` does not alter text size.

TikZKit preserves only this package-specific declaration before general TeX-lite
macro expansion, converts it to a private marker, and consumes markers in source
order while lowering each `bchart` environment. A later font redefinition
therefore cannot leak backwards into an earlier chart.

## Local References And SVG Structure

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The complete artifact bundle is
`/private/tmp/tikzkit-qa-bchart-font-style-2026-08-06`:

- MacTeX PNG: `mactex-png/bchart-font-style.png`
- TikZKit SVG/PNG: `tikzkit-svg/bchart-font-style.svg` and
  `tikzkit-png/bchart-font-style.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/bchart-font-style.svg` and
  `tikztosvg-png/bchart-font-style.png`
- aligned difference and four-way panel:
  `diff-png/bchart-font-style-registered.png` and
  `diff/bchart-font-style-native-sheet.png`

The tikztosvg SVG has a `174.63pt x 43.31pt` viewBox and converts its CM bold
text to glyph paths. It paints the lavender `blue!20` rectangle and then a
separate black outline; its `.7` transform gives the `7.5` bar a roughly
`4.2cm` physical width and the axis a `5.6cm` physical width. TikZKit keeps
browser text as `<text>` nodes, but now emits `font-weight="700"` with
`TikZKitCMBX10` for the bar text, value, ticks, and x-label. Its geometry is
scaled to the same proportions without shrinking the `35.14598` SVG font size.

I inspected the MacTeX/JS/tikztosvg/diff sheet. The repaired JS panel now has
the same bold `Bold`, `7.5`, ticks, and `score` label as the two references;
the bar and horizontal axis have the expected compact `.7` geometry. Remaining
pixel differences are font-raster and crop differences between live SVG text
and TeX glyph paths, not a missing bar, tick, label, or font-style command.

## Validation

```bash
npm test -- test/bchart.test.js test/example-render-script.test.js
npm run gallery:audit
npm run extension-registry
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-bchart-font-style-2026-08-06 \
  --only bchart-font-style --native-reference --comparison-grid-mode svg \
  --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-bchart-font-style-2026-08-06 \
  --register --alignment-radius 3
```

Focused tests: 60 passed. `gallery:audit`: `297/297 rendered, 0 diagnostics`.
The registry now lists `bchart` with two real cases and this implementation
path. `bchart` remains an extension-level compatibility slice, not a full TeX
macro engine: scoped/group-local redefinitions, argument-bearing font macros,
length-register expansion, and untested bchart APIs remain outside this
acceptance.

# Implementation Example Workspace

This workspace is the small, structured example set used to test TikZKit against
the target compiler-style directory layout:

```txt
source fixture
  -> frontend parser
  -> engine evaluator
  -> TikZ command/library modules
  -> SceneGraph
  -> SVG renderer
```

The folders mirror the semantic seams used by the implementation:

```txt
basic/       minimal smoke examples for the public conversion pipeline
paths/       path grammar, path builder, stroke/fill options
nodes/       node text, math text, shape and anchor behavior
foreach/     TeX-lite/PGF foreach expansion
pgfplots/    PGFPlots axis model, addplot, ticks, grid and labels
real-world/  compact real examples that combine multiple modules
output/      generated SVG/PNG/reference artifacts
```

Every stable case must be listed in `manifest.json` with a semantic owner module
and the exact features it exercises. This makes the example set useful for
implementation work instead of becoming a loose pile of screenshots.

## Render

Render this workspace with TikZKit and local `tikztosvg`:

```sh
npm run implementation-examples:render
```

Render one case:

```sh
npm run implementation-examples:render -- --only pgfplots-axis-basic-range
```

Render the first 30 cases directly from the local LaTeX-examples corpus:

```sh
node scripts/render-example-fixtures.js \
  --fixtures /Users/kaiwu/Downloads/LaTeX-examples-master/tikz \
  --output test/fixtures/implementation-examples/output/latex-examples-local \
  --limit 30
```

Then generate PNG diff reports for that local corpus output:

```sh
node scripts/diff-example-pngs.js \
  --output test/fixtures/implementation-examples/output/latex-examples-local
```

Compare generated PNGs:

```sh
npm run implementation-examples:diff
```

## Add A Case

1. Add the `.tikz` or `.tex` source under the folder that owns the semantics.
2. Add a `manifest.json` entry with `id`, `source`, `semanticOwner`, and
   `features`.
3. Render just that case and inspect TikZKit SVG/PNG against the `tikztosvg`
   output before calling the case improved.

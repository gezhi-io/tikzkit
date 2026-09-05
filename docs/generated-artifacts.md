# Generated Artifacts

TikZKit compares browser-rendered SVG with local `tikztosvg` and MacTeX
references. These runs can produce thousands of SVG, PNG, log, and diff files,
so generated output directories are intentionally excluded from Git.

## Generate the Example Gallery

From the repository root:

```bash
npm install
npm run web:output
npm run examples:diff
```

The primary output directory is:

```text
test/fixtures/examples/output/
  tikzkit-svg/
  tikzkit-png/
  tikztosvg-svg/
  tikztosvg-png/
  diff/
  summary.json
```

For example, the local files for `latex-examples-aggregation-blocks` are:

```text
test/fixtures/examples/output/tikzkit-svg/latex-examples-aggregation-blocks.svg
test/fixtures/examples/output/tikztosvg-svg/latex-examples-aggregation-blocks.svg
test/fixtures/examples/output/diff/latex-examples-aggregation-blocks-sheet.png
```

Those paths are local build products, not permanent GitHub URLs.

Do not turn a local output path into a GitHub URL. For example, this URL is
intentionally invalid:

```text
https://github.com/gezhi-io/tikzkit/blob/main/test/fixtures/examples/output/tikzkit-svg/latex-examples-aggregation-blocks.svg
```

The committed replacement for documentation is:

```text
docs/images/examples/aggregation-blocks.svg
```

The [public example gallery](examples.md) links the stable SVG, PNG, source,
and comparison image.

## Open the Workbench

```bash
PORT=5174 npm run web
```

Then open <http://127.0.0.1:5174/>. The workbench reads the generated files and
shows TikZKit and `tikztosvg` side by side.

## Files That Belong in Git

Commit source fixtures, semantic review files, QA notes, and small curated
documentation images. Stable README images belong in `docs/images/`. Do not
commit complete renderer output trees merely to make a documentation link
work.

Use this separation consistently:

| Purpose | Location | Tracked by Git |
| --- | --- | --- |
| TikZ source and review data | `test/fixtures/examples/` | Yes |
| Complete local renderer output | `test/fixtures/examples/output/` | No |
| Selected public SVG and PNG files | `docs/images/examples/` | Yes |
| README-only images | `docs/images/readme/` | Yes |

When referring to generated evidence in a QA note, write the local path as
inline code. Use a Markdown link only for a committed source, review record, or
curated image.

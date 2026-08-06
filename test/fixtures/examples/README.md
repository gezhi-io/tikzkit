# Example Fixture Corpus

This directory is the small, curated example corpus used while moving TikZKit
toward the compiler-style layout documented in `docs/architecture.md`.

Each stable case should be listed in `manifest.json` and stored under a semantic
subdirectory such as `pgfplots/`, `tikz/`, or `real-world/`. New snippets can
start in `workbench/` while their semantic owner and expected rendering behavior
are still being investigated.

The intent is:

1. Keep input examples small enough to diagnose.
2. Map every example to its semantic owner module.
3. Compare TikZKit output with local `tikztosvg` or MacTeX output outside the
   source tree when doing visual calibration.

Generated artifacts should go under `test/fixtures/examples/output/` only when
they are deliberately curated. Bulk rendered SVG/PNG files should stay outside
git.

## Render Locally

Render all examples with TikZKit and local `tikztosvg`:

```sh
npm run examples:render
```

Render one case:

```sh
npm run examples:render -- --only axis-basic-range
```

Skip the external reference renderer:

```sh
npm run examples:render -- --skip-tikztosvg
```

Compare generated PNGs:

```sh
npm run examples:diff
```

For a multi-case audit that should keep going after a local reference timeout,
combine `--strict-tikztosvg` with `--continue-on-external-failure`. It writes a
complete `summary.json`, per-case logs, and the comparison page before exiting
nonzero for the failed strict references:

```sh
npm run examples:render -- --only case-one case-two \
  --strict-tikztosvg --continue-on-external-failure
```

For an individual high-sample 3D surface that times out in that intentionally
short batch budget, preserve the original source and retry only that fixture
with a longer external-reference limit. For example:

```sh
npm run examples:render -- --only latex-examples-3d-gaussian-distribution \
  --native-reference --strict-tikztosvg --external-timeout-ms 120000
```

An external timeout is reference availability evidence, not a TikZKit visual
acceptance or rejection by itself. Inspect the completed three-way sheet after
the retry.

The script writes:

```txt
output/
  tikztosvg-input/<case-id>.tex
  tikzkit-svg/<case-id>.svg
  tikztosvg-svg/<case-id>.svg
  tikzkit-png/<case-id>.png
  tikztosvg-png/<case-id>.png
  diff/summary.json
  diff-png/<case-id>.png
  summary.json
```

## Adding A New Example

1. Put the source under `workbench/` first, using a small descriptive filename.
2. Add a `manifest.json` entry with a stable `id`, `source`, `semanticOwner`,
   and the exact TikZ/PGF features being tested.
3. Render only that case while working:

```sh
npm run examples:render -- --only <case-id>
npm run examples:diff
```

4. Once the case is understood, move it from `workbench/` into its semantic
   folder, for example `pgfplots/`, `latex-examples/`, `paths/`, or `nodes/`.

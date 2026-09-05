# TikZKit Documentation

TikZKit is an experimental JavaScript interpreter for supported TikZ, PGF,
PGFPlots, and selected package syntax. Start with the tutorial, then use the
compatibility and QA documents when checking a specific feature.

## Use TikZKit

- [Getting started](getting-started.md): Node.js, browser, Markdown, and CLI
  examples.
- [Usage reference](usage.md): supported syntax and package-specific examples.
- [Architecture](architecture.md): parser, evaluator, scene graph, and SVG
  renderer boundaries.

## Compatibility

- [Extension registry](extension-registry.md): package and library status,
  reviewed local TeX sources, and known boundaries.
- [Machine-readable registry](extension-registry.csv): the same registry in CSV
  form.
- [Case-driven acceptance](case-driven-acceptance.md): the required visual QA
  workflow.
- [Generated artifacts](generated-artifacts.md): where local SVG, PNG, diff,
  and comparison files are created.

## QA Records

The [`qa/`](qa/) directory contains dated implementation and visual-review
records. These records may mention local generated paths as code, but public
links point only to files committed to the repository.

The [historical milestone ledger](qa/milestone-1-status.md) documents the
original 30-case snapshot. The active milestone manifest now contains more
cases and remains the machine-readable source of truth.

## Link Integrity

Run this before committing documentation changes:

```bash
npm run docs:links
```

The check rejects local links that resolve only to ignored or missing files.
It also validates absolute `github.com/gezhi-io/tikzkit` and
`raw.githubusercontent.com/gezhi-io/tikzkit` URLs against tracked repository
files. Public examples belong in `docs/images/`; paths under
`test/fixtures/examples/output/` exist only after a local gallery build.

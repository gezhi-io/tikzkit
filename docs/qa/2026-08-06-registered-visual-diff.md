# Registered Visual Diff Triage

## Boundary

This change improves visual-QA triage only. It does not alter TikZ parsing,
evaluation, scene geometry, or SVG rendering, and it never changes the raw
pixel comparison used as evidence.

## Why

The same TikZ geometry can rasterize one or two pixels apart between the SVG
renderer used for TikZKit and `rsvg-convert` rasterizing `tikztosvg` output.
The old report put that harmless canvas offset in the same ranking as missing
paths or wrong node geometry, which made the full corpus slow to investigate.

`scripts/diff-example-pngs.js --register` now keeps the raw result and adds a
bounded `dx`/`dy` search (default `-3..3` pixels). It samples every candidate,
fully rechecks the strongest candidates, and only retains an aligned result
when **both** changed-pixel ratio and mean absolute RGBA error are no worse
than the raw zero-offset comparison. The optional aligned red-mask PNG is
linked from the generated comparison page.

This is diagnostic information, not acceptance: a nonzero translation means
the canvas or bounding-box contract still needs review. A residual that stays
high after registration is a stronger signal to inspect renderer semantics.

## Full-Corpus Check

Artifacts were regenerated from the existing 271-case three-way baseline at:

`/private/tmp/tikzkit-qa-full-2026-08-06/`

Command:

```bash
npm run examples:diff -- --output /private/tmp/tikzkit-qa-full-2026-08-06 --register --alignment-radius 3
```

Results: 263 TikZKit/tikztosvg PNG pairs compared, eight external-reference
PNG pairs unavailable, and zero registered rows worse than their raw result.
For example, `circuitikz-controlled-sinusoidal-sources` drops from mean
absolute RGBA `0.0968` to `0.0275` after a `(1,3)` alignment, so it is not the
highest-value circuit renderer target. In contrast,
`pgf-rectangle-split-ignore-empty` remains at `0.0828` with `(0,0)`, making
it a genuine residual for semantic visual inspection rather than a canvas
translation artifact.

## Regression Coverage

```bash
node --test test/example-diff-script.test.js
```

The tests cover raw comparison preservation, a known one-pixel translation,
and the rule that registration never worsens either reported metric.

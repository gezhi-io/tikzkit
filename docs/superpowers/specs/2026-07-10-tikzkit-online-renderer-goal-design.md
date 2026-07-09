# TikZKit Online Renderer Goal Design

Date: 2026-07-10

## 1. North-star goal

TikZKit is a browser-side, pure JavaScript semantic interpreter for practical
TikZ and PGF drawing programs. It parses source into a source-aware AST,
evaluates TikZ semantics into a renderer-neutral SceneGraph, and renders that
SceneGraph as SVG.

For every capability declared stable, TikZKit output must match MacTeX TikZ in
visible structure, geometry, typography, paint, line style, arrows, clipping,
layer order, and bounding box. Unsupported syntax must produce actionable
diagnostics rather than disappear silently.

The browser runtime must not invoke MacTeX, `tikztosvg`, `dvisvgm`, or another
server-side compiler. Those tools are development and verification oracles
only.

## 2. Milestone 1 objective

Milestone 1 is complete only when all 30 frozen LaTeX-examples fixtures below:

1. render in the browser through TikZKit's JavaScript pipeline;
2. contain no missing or spurious visible elements;
3. have no blocking diagnostics for syntax required by the fixture;
4. pass focused structural and semantic tests;
5. have regenerated TikZKit SVG/PNG and `tikztosvg` SVG/PNG artifacts;
6. have been visually reviewed side by side against the reference output;
7. satisfy the visual acceptance rules in this document.

The eight small PGFPlots fixtures under `test/fixtures/examples/pgfplots/` are
feature tests and do not count toward the 30 real-case milestone. The five
later geometry fixtures (`arc`, `circle-diameter-radius`, `line-segments-t1`,
`path`, and `rectangle-1`) remain regression tests but do not change the frozen
Milestone 1 count.

### Frozen 30-case manifest

1. `latex-examples-2048`
2. `latex-examples-2d-chi-squared-cdf`
3. `latex-examples-2d-chi-squared-pdf`
4. `latex-examples-2d-epochs-overfitting`
5. `latex-examples-2d-light-bulb`
6. `latex-examples-2d-parted-function`
7. `latex-examples-2d-x-square-with-circle`
8. `latex-examples-3d-cmos-loss-diagram`
9. `latex-examples-3d-function-2`
10. `latex-examples-3d-function-3`
11. `latex-examples-3d-function-4`
12. `latex-examples-3d-function-5`
13. `latex-examples-3d-function-6`
14. `latex-examples-3d-function-7`
15. `latex-examples-3d-function-8`
16. `latex-examples-3d-function-9`
17. `latex-examples-3d-function-continuous`
18. `latex-examples-3d-function-semicubical-parabola`
19. `latex-examples-3d-gaussian-distribution`
20. `latex-examples-3d-gradient-colored`
21. `latex-examples-3d-gradient-cos`
22. `latex-examples-3d-helix`
23. `latex-examples-3d-manhattan-bar-plot`
24. `latex-examples-3d-vector`
25. `latex-examples-activation-functions`
26. `latex-examples-agent-environment-diagram-mdp`
27. `latex-examples-agent-environment-diagram-pomdp`
28. `latex-examples-agent-environment-diagram-rl`
29. `latex-examples-aggregation-blocks`
30. `latex-examples-arbelos`

## 3. Product boundary

Milestone 1 delivers an online workbench and a compatibility-tested library. It
does not claim to be a complete TeX engine or a byte-identical replacement for
the complete PGF/TikZ distribution.

Included:

- browser-side source editing and immediate SVG rendering;
- syntax and semantic diagnostics with source locations where available;
- TikZ core paths, coordinates, styles, nodes, anchors, transforms, arrows,
  scopes, loops, and libraries required by the frozen fixtures;
- PGFPlots features required by the frozen fixtures, implemented through an
  Axis Model rather than renderer shortcuts;
- KaTeX-backed formula rendering behind a TikZ text measurement contract;
- local MacTeX and `tikztosvg` artifact generation for development QA;
- an explicit capability matrix with support level, owner, fixture, oracle,
  tests, and caveats.

Excluded from the browser runtime:

- shelling out to TeX or `tikztosvg`;
- arbitrary TeX macro execution;
- claiming support for a command merely because it emits no diagnostic;
- case-specific coordinate substitutions that do not implement shared TikZ
  semantics;
- using the QA grid as part of the rendered picture or its bounding box.

## 4. Architecture contract

The mandatory data flow is:

```text
LaTeX/TikZ source
  -> document adapter and lexer/parser
  -> source-aware TikZ AST
  -> semantic evaluator
  -> package-specific models such as PGFPlots Axis Model
  -> renderer-neutral SceneGraph
  -> SVG renderer
```

The central seam is:

```text
TikZ AST -> SceneGraph -> SVG
```

The parser must not generate SVG. SVG modules must not interpret TikZ source.
Package-specific behavior must be owned by the package or library module that
defines the semantics.

Canonical ownership:

```text
src/frontend/       LaTeX shell, tokenization, parsing, AST, diagnostics
src/engine/         scopes, evaluation, units, math, options, transforms, paths
src/tikz/           core commands, libraries, metrics, text semantics
src/pgfplots/       Axis Model, plots, coordinates, ticks, grids, labels, legends
src/scene/          renderer-neutral item types and bounds
src/renderers/svg/  SVG serialization, defs, paths, text, KaTeX HTML, clipping
src/adapters/       filesystem and external verification tools
src/capabilities/   explicit implementation and verification status
```

Compatibility adapters may remain during migration, but new behavior must be
implemented behind canonical ownership seams.

## 5. Coordinate and unit contract

TikZKit must use one canonical internal coordinate system and one unit
conversion table. TikZ/TeX dimensions are converted once at the semantic
boundary; SVG's inverted y-axis is applied only by the renderer.

The QA grid represents exactly `1cm` in TikZ canvas coordinates. TikZKit and
reference grids must share the same origin, scale, and clipping rectangle. Grid
alignment is a diagnostic overlay only and must not alter picture layout.

PGFPlots data coordinates follow this pipeline:

```text
data coordinate
  -> axis range/domain normalization
  -> plot-area coordinate
  -> TikZ canvas coordinate
  -> SceneGraph coordinate
  -> SVG coordinate
```

## 6. Text and KaTeX contract

KaTeX is an implementation detail behind a TikZ-owned text engine. The engine
must expose measured width, height, baseline, midline, render payload, and a
cache key that includes all render-affecting style inputs.

Node geometry uses the measured text box plus TikZ `inner sep`, `outer sep`,
minimum dimensions, shape geometry, and explicit text width. Anchor and border
intersection calculations use that final node box. CSS must be scoped so host
page KaTeX rules and TikZKit math rules cannot change each other.

Acceptance includes visible checks for:

- formula completeness, including scripts, matrices, accents, and delimiters;
- no unintended line wrapping;
- font family, size, weight, and slant;
- baseline and multiline alignment;
- node border clearance and anchor placement;
- consistent measurement in browser rendering and SVG bounds calculation.

## 7. Online workbench

The cleaned repository no longer contains the old `web/` implementation, so
Milestone 1 must restore a small, real workbench rather than point `npm run web`
at a missing file.

The workbench must provide:

- a TikZ source editor populated from the frozen fixture manifest;
- an explicit Render command and a useful keyboard shortcut;
- TikZKit SVG as the primary result;
- diagnostics grouped by severity and source location;
- fixture navigation with stable URL anchors;
- source/result visibility controls;
- a development-only reference view for previously generated `tikztosvg`
  artifacts;
- optional 1cm grid overlays with a shared origin;
- containment rules so large SVGs cannot overflow the result surface.

The workbench consumes the public library interface. It must not import parser,
engine, PGFPlots, or renderer internals directly.

## 8. Verification oracles

Correctness priority is:

1. MacTeX TikZ/PGF output is the semantic and visual source of truth.
2. Local `tikztosvg` output is a useful SVG-structure reference.
3. Focused unit and integration tests protect shared behavior.
4. Raster diff metrics help locate changes but never decide completion alone.

Every real-case review must inspect the source, TikZKit SVG/PNG, reference
SVG/PNG, and a composite or diff view. The review records differences in:

- missing or extra elements;
- coordinate origin, scale, dimensions, and bounding box;
- path geometry, clipping, fill rule, and layer order;
- stroke width, dash pattern, joins, caps, and arrows;
- node size, border intersection, anchors, and spacing;
- text content, font, formula layout, baseline, and wrapping;
- color, opacity, gradients, patterns, and shading.

## 9. Visual acceptance rules

A case does not pass merely because `meanAbsDiff` is low. It passes only when
all of the following are true:

- every semantically required element is present exactly once;
- no label, formula, arrow, path, mark, surface, or legend is visibly clipped;
- corresponding control points and node centers align to the common 1cm grid;
- after common-origin alignment, major geometry differs by no more than `0.5pt`;
- picture bounding-box edges differ by no more than `1pt` unless the difference
  is documented as a renderer-only antialiasing margin;
- line width differs by no more than `0.2pt`, and dash phase/count is visibly
  equivalent;
- text baselines differ by no more than `1pt`, and text is not incorrectly
  wrapped or condensed;
- arrow tips meet the same endpoint and have the correct family, fill, scale,
  line join, and shaft shortening;
- colors use the same model/mix and are visually equivalent;
- layer order and occlusion match the reference;
- a human side-by-side review finds no material visual difference.

Antialiasing and font rasterization differences may remain in PNGs when SVG
geometry and text metrics satisfy the requirements above. Any accepted
exception must be recorded per fixture; it cannot be hidden by a global diff
threshold.

## 10. Diagnostics and failure behavior

Unsupported commands, environments, libraries, options, expressions, and TeX
constructs must produce structured diagnostics. A diagnostic includes severity,
feature identifier, source range when known, owning subsystem, and a concise
message.

Strict mode fails conversion on unsupported semantics required for correct
output. Browser mode renders recoverable content and displays diagnostics. It
must not silently substitute unrelated geometry or report a case as passing
when a required feature remains approximate.

## 11. Testing strategy

Each implementation slice follows this sequence:

1. inventory every command, environment, library, option, unit, and TeX feature
   used by the target fixture;
2. inspect the relevant local MacTeX source or manual to identify state changes,
   generated primitives, and semantic ownership;
3. create the smallest failing semantic or renderer test;
4. implement the shared capability behind its owning module;
5. run focused tests, then the affected subsystem suite;
6. regenerate TikZKit and `tikztosvg` artifacts;
7. inspect the visual comparison and repeat until the case passes;
8. update the capability matrix and case review record.

Required gates for Milestone 1:

- the complete Node test suite passes;
- all 30 frozen cases render without blocking diagnostics;
- all 30 have current TikZKit and reference artifacts;
- all 30 have a recorded visual review;
- the online workbench renders each fixture through the public API;
- browser console has no errors during fixture navigation and rendering.

## 12. Definition of done

Milestone 1 is done only when the frozen 30-case manifest is fully green under
the semantic, structural, browser, and visual gates above. Partial progress is
reported as a count such as `18/30 accepted`; it is not described as completion.

After Milestone 1, the next milestone may add the five later geometry fixtures
and then expand through `/Users/kaiwu/Downloads/LaTeX-examples-master/tikz` in
manifested batches. The acceptance rules do not become weaker as the corpus
grows.

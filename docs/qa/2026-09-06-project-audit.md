# Project Audit: 2026-09-06

## Scope and Verdict

Reviewed commit: `5d41b2fecaad76244a0735f963b0289b9e2aa6b5` (`0.1.4`).
Subsequent repairs are recorded separately in [the repair log](2026-09-06-audit-repairs.md).
This was a repository-wide risk audit of the runtime, compiler boundaries, package,
browser embedding, CLI, Markdown extraction, and acceptance tooling. It was not
a line-by-line proof or a visual acceptance of all 658 manifest cases.

The project has a working JavaScript conversion pipeline, substantial library
implementations, a useful workbench, and extensive local-reference infrastructure.
It is still experimental. Untrusted-input execution, unreliable acceptance gates,
and basic semantic inconsistencies should be addressed before another general
release or a claim of LaTeX-equivalent rendering.

No renderer implementation was changed, and nothing was committed, pushed, or
published during this audit. P1 means high priority; P2 means normal priority.

## Verified Findings

### R1. P1: Math expressions can execute host JavaScript

Location: `src/engine/math.js:47-57`; also `src/pgfplots/expressions.js:27-28`.

The character whitelist allows member access, assignment, and calls, then passes
the expression to `Function`. Through the public API, the harmless coordinate
`({globalThis.tikzAuditFlag=29},1)` changed the host global to 29. Conversion returned
`ok: true` with no diagnostics. This is not a sandbox for pasted TikZ or Markdown.

Replace string execution with a restricted expression AST and explicit mathematical
functions/variables. Disallow host object access and assignment. Test both coordinate
and PGFPlots evaluators, and rendering under a CSP that disallows dynamic evaluation.

### R2. P1: Zero-step foreach expansion does not terminate normally

Location: `src/tikz/commands/foreach.js:68-75`; `src/index.js:30-37`.

`\foreach \x in {1,1,...,3}` computes a zero step but enters a loop whose condition
never becomes false. An isolated public-API subprocess threw `RangeError: Invalid
array length`. The async API also begins parsing and evaluation synchronously;
making it async does not isolate this work from a browser's UI thread.

Reject non-progressing ranges, enforce shared work/output budgets, and provide
cancellable browser execution. Return a structured diagnostic rather than an
unbounded loop or an uncaught allocation error.

### R3. P1: Macro definitions lose source order and scope

Location: `src/frontend/latex-shell.js:2303-2312`, `2599-2612`.

Definitions across the source are collected into one map before expansion. In a
picture that defines `\d=1`, draws a line of length `\d`, then defines `\d=2` and
draws another line, both JS lines have length 2. A definition inside `scope` also
changes the value used outside the scope. Both conversions report no diagnostics.

MacTeX confirmed sequential values 1 then 2, and scoped values 2 inside / 1 outside.
Evaluate definition nodes in source order using group/environment stacks. This is
a shared semantic defect, not a case-specific coordinate offset.

### R4. P1: Packed browser deployments do not resolve required fonts

Location: `src/renderers/svg/defaultFontCss.js:1-6`,
`src/renderers/svg/mathScopedCss.js:26`, `package.json:7`.

Generated CSS references `/fonts/` and `/node_modules/katex/dist/fonts/` as fixed
site-root URLs. Bundlers cannot discover these assets inside generated strings.
`fontUrlPrefix` does not update the KaTeX paths; resolving the package's font
subpath through its exports also fails.

An independently unpacked package, bundled and opened in Chromium without the
workbench's custom font routes, produced 15 font-request 404s and seven font faces
in error state for a mixed text/math label. Conversion diagnostics remained empty.

Provide an explicit, exported asset-loading contract for both text and math fonts,
or a self-contained SVG mode. Verify a production consumer under a non-root base
URL and wait for font loading before visual acceptance.

### R5. P2: Invalid mathematics silently becomes valid zero coordinates

Location: `src/engine/math.js:23-34`, `44-58`.

Coordinates containing `sqrt(-1)`, `1/0`, or an undefined `\doesnotexist` all
became x=0, with `ok: true` and an empty diagnostic list. Users cannot distinguish
an intended zero from an unsupported or invalid expression.

Preserve evaluation failure as a distinct result. Report the offending source
expression and use an explicit invalid-point policy instead of silently drawing
invented geometry.

### R6. P2: Font-relative coordinate units are fixed to 10pt metrics

Location: `src/engine/math.js:132-138`.

Changing the document class from 10pt to 12pt leaves `(1em,1ex)` unchanged in JS:
`(0.351459803583,0.151322424272)` cm. In the installed MacTeX 12pt article, `1em`
is 11.74988pt and `1ex` is 5.16667pt, not 10pt and 4.30554pt.

Resolve em/ex against the active TeX font context. Do not assume that the TikZ
`font=` option and an active TeX font declaration have identical scoping semantics.
MacTeX's `tikz.code.tex` stores `font=` for node text; that distinction matters.

### R7. P2: Explicit default plot-box ratio changes geometry

Location: `src/pgfplots/geometry.js:335-340`.

For an 8cm oblique 3D plot, omission versus explicit `plot box ratio=1 1 1` changes
the JS plot width from 6.461660439719 to 6.418430883878cm. The branch selects a
43.77pt versus 45pt reserve merely because the option exists.

The installed PGFPlots declares `1 1 1` as the default. Native compilation of the
two variants produced exactly the same box: 219.39412pt by 167.77351pt.
Normalize defaults before sizing; add equivalence tests that vary option spelling,
font, dimensions, view, and label presence instead of calibrating only one fixture.

### R8. P2: Multiple inline SVGs share clip IDs

Location: `src/renderers/svg/defs.js:79-92`.

Independent conversions emit IDs such as `tikz-form-pattern-clip-0`. A second dotted
rectangle of width 3 renders correctly alone, but its dots occupy only one-third
of the rectangle after a width-1 SVG is inserted before it in the same document.
The second image resolves the first image's clip definition. Before/after browser
screenshots were inspected; neither conversion reports an error.

Namespace every generated definition/reference per SVG. Test multiple independent
conversions in the same DOM, including patterns, clips, gradients, and markers.

### R9. P2: Markdown fences fail on ordinary document variations

Location: `src/frontend/code-blocks.js:1`.

The same TikZ fenced block is extracted with LF but ignored with Windows CRLF
line endings. A triple-backtick example inside an outer four-backtick Markdown
code block is incorrectly extracted and rendered. The language prefix
`tikzlibrary` is also treated as `tikz`.

Use fence-aware Markdown parsing or a stateful fence scanner. Test CRLF, fence
length, enclosing code examples, and exact info-string recognition.

### R10. P2: CLI accepts invalid option values and writes bad output

Location: `src/cli/main.js:48-53`, `73-82`.

`tikz2svg input.tex -o --strict` exits successfully and writes a file named
`--strict`. `--unit -1` also exits successfully and can emit an SVG with negative
viewBox dimensions. Validate required values and numeric domains before writing.

### Q1. P2: Old reviews approve newly added unsupported parameters

Location: `scripts/case-semantic-audit.js:787-810`.

All 228 inspected fixture review files contain broad wildcard rules. Reusing the
review for `custom-to-path-math` after appending a draw with
`totally-unsupported-audit-option=123` marked that new option `verified` and returned
`gate.accepted: true`. No actual implementation or review of the new option exists.

Bind approvals to source/feature values, relevant implementation fingerprints,
and evidence. Invalidate approval when the reviewed input changes.

### Q2. P2: Strict reference generation succeeds without reference tools

Location: `scripts/render-example-fixtures.js:1603`.

With an empty executable search path, requesting `--strict-tikztosvg
--native-reference` returned exit 0, no reference images, and zero external
failures. Unavailable tools are counted separately from failed conversions, but
the strict exit condition checks only failed tikztosvg conversions.

Strict acceptance must require all requested reference tools and outputs. Missing,
skipped, failed, and stale artifacts must not count as a successful gate.

### Q3. P2: The image-diff command cannot enforce an acceptance gate

Location: `scripts/diff-example-pngs.js:577-585`.

A run with one visibly different image pair and one missing reference printed
`1 different, 1 missing` and exited 0. A shell/CI step using this command alone
cannot reject the changes. Add an explicit strict policy with documented thresholds.

### Q4. P2: Comparison pages can display stale passing results

Location: `scripts/render-example-fixtures.js:1524-1534`.

After rerendering changed source, the generated page reused an old diff summary
and displayed `diff: same / raw 0.00%`, even though current PNG generation was
skipped. The report is joined by case ID without validating the image generation.

Fingerprint source, renderer, reference tool/version, fonts, and both images.
Invalidate old diff summaries on regeneration, and show pending rather than pass.

### Q5. P2: Pixel registration can hide missing geometry at the edge

Location: `scripts/diff-example-pngs.js:309-321`.

A blank 20x20 actual image versus a reference with a black left-edge line differs
by 5% before alignment. Registered comparison reports `same`, 0%, after shifting
one pixel and comparing only 380 overlapping pixels. All 20 missing black pixels
are discarded from the comparison.

Compare the union canvas with background padding. Retain bounds/scale/translation
errors separately; registration must not erase missing content.

### Q6. P2: Some native references share the implementation under test

Location: `scripts/render-example-fixtures.js:423-428`;
`src/pgfplots/addplotParser.js:95`.

Raw gnuplot expressions are sampled by the same JavaScript implementation before
both JS rendering and reference TeX compilation. The probe `plot x*x` becomes
precomputed coordinates in the reference input. This checks TeX painting of the
supplied points, not an independent validation of function sampling.

The transformation is documented, but machine-readable acceptance should mark
the dependent oracle. Add independent mathematical expectations or a genuine
gnuplot reference for sampling/function correctness.

## Test Evidence

- `npm test`: 2,512 reported tests; 2,350 passed, 148 failed, 14 skipped; 47.49s.
- Five failures were sandbox-denied local port listeners. Repeating
  `node --test test/web-server.test.js` with local-listener permission passed 5/5.
- The remaining 143 reported failures are not equivalent to 143 broken pictures:
  Node includes failing parent tests, and several assertions are stale.
- Six surface acceptance first-failures expect ASCII minus, although U+2212 labels
  are present. This does not prove later assertions in those tests would pass.
- The capability test contains an obsolete artifact-path expectation.
- `circuitikz-varcap-diodes` genuinely lacks required semantic-owner metadata.
- Other failures include tick/label positions, drawing IR expectations, node bounds,
  and text rendering. Each needs classification against a fresh reference, not
  wholesale snapshot replacement or blanket dismissal as a baseline.
- Offline `npm pack`: 486 files. An independently unpacked consumer passed Node
  quick start, basic CLI conversion, browser bundling, and six CLI/Markdown tests.
  Its production browser/font and multi-SVG probes exposed R4/R8.
- No GitHub Actions workflow is tracked in the inspected checkout. Remote branch
  protection or external CI settings were not inspected.

## Architecture Assessment

The requested frontend / engine / scene / renderer folders exist, and the public
API does pass an AST through interpretation to an IR and SVG rendering. Keep that
foundation; a wholesale rewrite is not justified by this audit.

However, `engine/evaluate.js` contains 21,333 lines and `frontend/latex-shell.js`
11,363 lines. The latter performs substantial plotting semantics and generates
replacement TikZ before parsing. Definitions, source positions, and unsupported
syntax can be lost before the evaluator can reason about them. `draw.js` is mainly
metadata; `registerCoreTikz.js` catalogs descriptors rather than dispatching all
command execution. Directory separation is ahead of responsibility separation.

Extract behavior along tested ownership boundaries: scoped macro evaluation,
dimension/font context, expression evaluation, path construction, and library
lowering. Avoid adding new per-case coordinate constants to the shared pipeline.
The project already contains local-source study and numerical PGF emulation;
the issue is making those semantics coherent and testing their invariants.

## Recommended Repair Order and Acceptance

1. **Input safety:** R1/R2. Mathematical inputs cannot access host globals; invalid
   ranges terminate with diagnostics within an explicit budget. Test in Node and
   a browser, not just through internal helper calls.
2. **Trustworthy gates:** Q1-Q5 and full-test triage. Mutating a reviewed source,
   removing a reference, or introducing missing geometry must fail acceptance.
   Record tool/version/source/image provenance, including Q6.
3. **Core semantics:** R3/R5/R6/R7. Test source order, scope restoration, invalid
   math, font-relative dimensions, and explicit-default equivalence against MacTeX.
4. **Real consumer support:** R4/R8/R9/R10. Test an unpacked package in a production
   web build, multiple inline SVGs, Markdown variants, and invalid CLI arguments.
5. **Resume library expansion:** Use a small representative suite per shared
   capability, then the full corpus. A passing example is not proof that all its
   parameters or the whole library are implemented.

## Local Evidence

Audit artifacts are local generated output, not npm package contents:

- `outputs/project-audit-2026-09-06/full-tests.log`
- `outputs/project-audit-2026-09-06/runtime-probes.mjs` and `runtime-probes.json`
- `outputs/project-audit-2026-09-06/qa-probes.mjs` and `qa-probes.log`
- `outputs/project-audit-2026-09-06/tikzkit-audit-native.tex` and `.log`
- `outputs/project-audit-2026-09-06/multi-before.png` and `multi-after.png`

Runtime: Node 22.18.0; installed TeX Live 2025 / pdfTeX 1.40.28.
Local commands found: `/Library/TeX/texbin/pdflatex`,
`/Library/TeX/texbin/kpsewhich`, `/Library/TeX/texbin/tikztosvg`.
Native dimension/default tests used pdflatex directly; this audit did not generate
a new full-corpus tikztosvg/MacTeX visual baseline.

Local reference files inspected:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex:2429`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex:1129`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/size12.clo:47`

Fresh network installation, Safari/Firefox, every test's root cause, every corpus
image, remote release configuration, and exhaustive security properties remain
outside the verified scope. The probes demonstrate concrete defects; they are not
a proof that no other defects exist.

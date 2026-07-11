# TikZ FontSpec And Math Sizing Design

## Goal

Make TikZKit resolve text and formula sizes through the same TeX-compatible font model while preserving library-specific defaults from local MacTeX 2025. A resolved size must drive node measurement, anchors, SVG text, browser math, SVG-text fallback, and bounding boxes consistently.

The first implementation targets the 10pt `article`/`standalone` baseline used by the current fixture corpus. The model must allow later 11pt, 12pt, and custom document-class profiles without changing renderer interfaces again.

## Confirmed Native Behavior

The design follows these local MacTeX files:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/size10.clo`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/circuitikz/circuitikz-1.2.7-body.tex`

For a 10pt document, the canonical text sizes are:

| TeX command | Size | Baseline skip | Scale from normal |
| --- | ---: | ---: | ---: |
| `\tiny` | 5pt | 6pt | 0.5 |
| `\scriptsize` | 7pt | 8pt | 0.7 |
| `\footnotesize` | 8pt | 9.5pt | 0.8 |
| `\small` | 9pt | 11pt | 0.9 |
| `\normalsize` | 10pt | 12pt | 1.0 |
| `\large` | 12pt | 14pt | 1.2 |
| `\Large` | 14.4pt | 18pt | 1.44 |
| `\LARGE` | 17.28pt | 22pt | 1.728 |
| `\huge` | 20.74pt | 25pt | 2.074 |
| `\Huge` | 24.88pt | 30pt | 2.488 |

TikZ core leaves `every node` empty, so ordinary nodes inherit the active TeX font. PGFPlots also leaves ordinary tick, label, and legend fonts inherited unless the source applies a style profile. Its named profiles alter roles independently: `small` uses 8pt ticks and 9pt labels; `footnotesize` uses 8pt ticks/legend and 9pt labels/title; `tiny` uses 5pt ticks/legend/labels and an 8pt title. Datavisualization defaults ticks and inside-legend labels to 8pt and axis/data-set labels to 9pt. Circuitikz additionally uses role-specific absolute 6pt, 10pt, and 12pt fonts for selected symbols.

## Confirmed TikZKit Defects

1. `src/tikz/text.js` maps `\tiny` to `0.42`, while MacTeX and `src/tikz/textMetrics.js` require `0.5`.
2. `src/pgfplots/ticks.js` defaults boxed-axis tick labels to `\scriptsize`; native PGFPlots inherits `\normalsize` unless a profile or explicit style changes it.
3. Several PGFPlots 3D and extension paths emit literal font commands rather than resolving a role through one policy.
4. Text measurement and rendering use overlapping size tables and ad hoc scales. They can disagree before output reaches SVG.
5. Browser math uses a compensated KaTeX root scale (`host / 1.21`, root `1.21em`). The net glyph size is correct in simple cases, but formula box sizing, fallback sizing, and anchor bounds do not share one explicit physical-size contract.

Two deterministic diagnostic commands already reproduce the first two defects: the default boxed PGFPlots tick emits `font=\scriptsize` instead of `font=\normalsize`, and `fontScaleFromTikzFont("\tiny")` returns `0.42` instead of `0.5`.

## Chosen Architecture

### Canonical FontSpec

Introduce one renderer-neutral font value:

```js
{
  sizePt: 10,
  baselineSkipPt: 12,
  family: "serif",
  weight: 400,
  style: "normal",
  variant: "normal",
  mathStyle: "text",
  source: "document"
}
```

`sizePt` and `baselineSkipPt` are physical TeX points. `source` records which layer last selected the size (`document`, `scope`, `library-role`, `node-option`, or `content-command`) for diagnostics and tests. Renderers may derive CSS pixels or SVG user units only at their boundary.

### Font Resolution Order

Resolve one FontSpec in this order:

1. document-class base profile;
2. picture and scope font state;
3. library role default;
4. node/path-local `font=...` option;
5. leading or scoped content font commands such as `\small` or `\fontsize{6}{7}\selectfont`.

Later layers override only properties they explicitly set. For example, `font=\bfseries` changes weight without resetting a `small` size inherited from the library role.

### Library Font Policies

Libraries expose data, not renderer branches. A policy registry maps semantic roles to FontSpec patches:

```js
registerFontPolicy("pgfplots", {
  tick: "normalsize",
  axisLabel: "normalsize",
  legend: "normalsize",
  title: "normalsize"
});
```

Named profiles apply role patches. Datavisualization registers its native 8pt/9pt defaults. Circuitikz registers inherited label roles and the absolute symbol sizes proven by its source. Unknown roles inherit their parent FontSpec and produce no visual mutation.

The registry must remain independent of SVG. PGFPlots, datavisualization, and circuitikz lowering request a role and attach the resolved FontSpec to IR text items.

### Shared Text And Formula Metrics

The text metrics layer accepts a FontSpec and returns width, height, depth, and baseline in physical units. Plain text, inline math, display math, structured matrix fallback, and browser math all consume that result.

The browser math adapter may retain KaTeX's internal `1.21em` convention, but it must expose a simple contract:

```js
renderMath(tex, fontSpec) -> {
  html,
  box: { widthPt, heightPt, depthPt, baselinePt }
}
```

The adapter owns any internal compensation. No caller may multiply or divide by `1.21`. `foreignObject`, fallback SVG text, node measurement, and bbox calculation use the returned box and the same resolved `sizePt`.

### IR Boundary

Text-bearing IR items receive a normalized `font` object. Existing style fields remain readable during migration, but renderer code prefers `item.font`. A compatibility adapter converts legacy `fontScale`, `fontFamily`, `fontWeight`, and `fontStyle` into FontSpec once; new library code must not introduce more raw scale constants.

## Data Flow

```text
source and document class
  -> TeX font context
  -> TikZ scope inheritance
  -> library semantic role
  -> explicit node/content overrides
  -> resolved FontSpec in IR
  -> shared text or math metrics
  -> SVG text / browser math / SVG fallback
  -> bbox and anchors from the same measured box
```

## Error Handling

- Unknown font-family commands preserve the inherited family and add an informational diagnostic only when visible source would otherwise be lost.
- Unsupported `\fontsize` expressions preserve the inherited size and emit a warning with the original expression.
- Missing library role policies inherit the parent FontSpec; they do not fall back to a guessed `scriptsize`.
- Non-finite or non-positive sizes are rejected before IR creation and replaced with the active inherited size.
- The math adapter must return a fallback box even when formula parsing is partial, so formulas remain visible and anchors remain stable.

## Scope And Non-Goals

This slice includes:

- the canonical 10pt size table and resolver;
- core TikZ inheritance and explicit font overrides;
- PGFPlots default and `small`, `footnotesize`, and `tiny` profiles;
- datavisualization tick/label/inside-legend roles;
- the circuitikz absolute symbol-font roles already present in real fixtures;
- one shared formula size and box contract for browser and SVG fallback rendering.

This slice does not implement a complete TeX font-selection engine, arbitrary NFSS substitutions, every document class, arbitrary math alphabets, or pixel-identical glyph outlines. It does not change plot geometry except where corrected text boxes alter the correct native bbox.

## Testing Strategy

### Unit Gates

1. Canonical size table exactly matches `size10.clo`, including `tiny=5pt`.
2. Resolver precedence covers inheritance, library roles, explicit size, weight-only override, and `\fontsize`.
3. Plain text and math receive identical physical size for the same FontSpec.
4. Browser math's outer box and SVG fallback box agree within `0.1pt` for supported simple formulas.

### Library Gates

1. Plain TikZ node inherits 10pt.
2. Default boxed and middle PGFPlots ticks inherit 10pt.
3. PGFPlots named profiles produce their native role-specific sizes.
4. Datavisualization produces 8pt tick/inside-legend and 9pt axis/data labels.
5. Circuitikz selected symbols preserve native 6pt/10pt/12pt absolute sizes.
6. Explicit local font options override every library default.

### Visual Gates

Use local MacTeX and tikztosvg references for:

- `latex-examples-activation-functions`;
- `latex-examples-3d-function-9`;
- one datavisualization function/legend fixture;
- one circuitikz fixture containing a label and an absolute-size symbol.

For supported text and formulas, measured visible-box width and height must be within `1pt` of the native reference, anchor centers within `1pt`, and no scripts, delimiters, tick labels, legends, or axis labels may be clipped or missing. Pixel diffs remain supporting evidence; visual inspection and physical box measurements are mandatory.

## Delivery Sequence

1. Add canonical FontSpec and size resolution without changing rendered output except the proven `tiny` correction.
2. Move core node text and formula metrics to FontSpec.
3. Correct PGFPlots role defaults and named profiles.
4. Add datavisualization and circuitikz role policies.
5. Unify browser-math and SVG-fallback boxes.
6. Regenerate all four visual gates and inspect native/TikZKit/diff panels.

Each step is test-first and independently reviewable. The experiment service remains on port 5174 while port 5173 remains untouched.

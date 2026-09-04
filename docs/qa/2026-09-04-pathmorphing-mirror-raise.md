# Pathmorphing Mirror And Raise QA

## Scope

This slice implements the shared `mirror` and `raise` decoration transforms for the already supported `snake`, `zigzag`, and `coil` pathmorphing state machines. It also corrects the equivalent legacy `mirror snake` and `raise snake` combination. Other pathmorphing names are outside this slice.

## Local Source Review

- `pgflibrarydecorations.pathmorphing.code.tex`: `zigzag` uses absolute quarter-segment apex states and a transformed center-finish state; `snake` starts with an absolute cubic, continues with relative cosine/sine states, and finishes at the untransformed path endpoint; `coil` uses four cubic curves per full state and two in its last state.
- `tikzlibrarydecorations.code.tex`: `mirror` installs `\pgftransformyscale{-1}` before the `raise` y-shift and applies the transform to the pre, main, and post decorations.
- `tikzlibrarysnakes.code.tex`: legacy `mirror snake` and `raise snake` install the same mirror-then-shift ordering.
- `pgfmoduledecorations.code.tex`: every state resets to its input-segment tangent frame before applying the additional transform; `\pgfpointdecoratedpathlast` cancels that transform so final endpoints remain on the source path.
- `pgfcoretransformations.code.tex`: PGF post-multiplies the y-shift through the current y-scale. Consequently, combined mirror and raise obey `y' = -(raise + y)`, not `raise - y`.
- `pgfmanual-en-library-decorations.tex`: amplitude and segment length are shared decoration parameters, while the state machine controls how they are consumed.

## Reference And Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- QA root: `outputs/qa-pathmorphing-transforms-2026-09-04`
- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- Registered diffs and four-panel sheets: `diff-png/`, `diff/`

The straight zigzag probe now matches the reference direction and phase for plain, mirrored, raised, and mirrored-plus-raised rows. The curved snake and coil probes retain the analytic tangent frame while moving to the correct side of the source curve. The legacy probe now connects its straight pre-section directly to the first transformed apex instead of drawing an extra vertical entry segment.

## Real Examples

- `flowchart.tex`: raised and mirrored zigzag signal links between three process nodes.
- `math.tex`: raised and mirrored snake curves around one cubic input path.
- `physics.tex`: two oppositely transformed coil state machines around one curved spring trajectory.

All three examples rendered through TikZKit, tikztosvg, and MacTeX with zero diagnostics or external-render failures. Visual inspection found matching element presence, state phase, local normal direction, endpoints, line width, color, and layering. Remaining raster differences are text/edge antialiasing rather than missing or displaced geometry.

## Implemented Syntax

- Commands: `\draw`, `\path`, `decorate`, legacy `snake`
- Decoration names: `snake`, `zigzag`, `coil`
- Shared parameters: `amplitude`, `segment length`, `pre length`, `post length`, `mirror`, `raise`
- Coil parameter: `aspect`
- Legacy parameters: `segment amplitude`, `segment length`, `line before snake`, `line after snake`, `gap before snake`, `gap after snake`, `mirror snake`, `raise snake`
- Geometry: straight lines, polyline subpaths, cubic curves, per-state tangent/normal frames, raw final endpoints

## Not Implemented In This Slice

- Decoration-level arbitrary `transform={...}`
- `pre` and `post` decoration names other than the existing line/gap subsets
- `saw`, `random steps`, `bent`, `bumps`, `straight zigzag`, and remaining pathmorphing declarations
- Full legacy snakes catalog beyond the existing zigzag and smooth snake subset

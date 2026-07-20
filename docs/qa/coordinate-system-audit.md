# Coordinate System Audit

## Scope

This audit covers the shared coordinate chain used by TikZKit:

```text
source coordinate
  -> coordinate-system parser
  -> picture basis (x/y/z vectors)
  -> ordered affine transforms
  -> scene coordinates in cm
  -> renderer unit conversion and y-axis flip
  -> SVG viewBox/bbox
```

PGFPlots adds one stage between the picture basis and scene coordinates:

```text
axis data value -> axis range transform -> 2D/3D axis projection -> scene coordinate
```

## Canonical Units

- Engine and Scene Graph coordinates are centimeters.
- TeX dimensions are converted using `1cm = 28.4527559pt`.
- Bare coordinate factors use the active `x`, `y`, and `z` basis vectors.
- Bare transform shifts (`xshift=10`) are TeX dimensions and therefore mean `10pt`.
- SVG conversion is performed only by the renderer using `TIKZ_UNIT`; the engine does not store pixels.

## Verified Semantics

The core checks were compared with the local TeX Live 2025 implementation, especially `tikz.code.tex` lines 3294-3330 (grid step vectors), 5101-5108 (explicit perpendicular coordinates), and 5506-5525 (`+` versus `++`), plus `tikzlibrarycalc.code.tex` from line 95 onward (factor and `!modifier!` parsing).

- The default PGF xyz basis is `x=(1cm,0)`, `y=(0,1cm)`, and `z=(-0.385cm,-0.385cm)`. A missing z vector must never collapse `(0,0,1)` onto the origin.
- TikZ's scalar `z=<dimension>` key expands to the diagonal vector `(<dimension>,<dimension>)`, matching `\tikz@handle@z` in `tikz.code.tex`.
- Explicit `node cs` and `barycentric cs` results are already canvas coordinates. The current picture transform is not applied to them a second time.
- Anchorless explicit node coordinates such as `(node cs:name=A)` retain node identity in the path layer and are clipped to the shape boundary exactly like `(A)`. Supplying `anchor=center` deliberately preserves the center point.
- A declared coordinate system returning `\pgfpointxy` produces x/y basis factors; one returning `\pgfpoint` produces canvas dimensions. Both still pass through the current affine transform exactly once.
- Mixed implicit coordinates distinguish basis factors from dimensions: `(1,1)`, `(1cm,1cm)`, `(1,1cm)`.
- `canvas cs`, `xyz cs`, `canvas polar cs`, and `xyz polar cs` use their documented unit rules.
- Implicit elliptical polar coordinates split `angle:x radius and y radius`: dimensional radii use canvas lengths, while dimensionless radii scale the active x/y basis vectors independently.
- Coordinate-option prefixes use the full local affine transform, conjugated through the parent transform. Thus `([rotate=60]1,0)`, coordinate-local scale/slant/`cm`, and style-expanded transforms work without applying the parent's translation twice. Prefix shifts remain vectors: a parent rotation/scale affects the shift but parent translation does not.
- Transform options are composed in declaration order. `rotate=30,xshift=2cm` is intentionally different from `xshift=2cm,rotate=30`.
- Styles preserve that declaration order after expansion.
- `rotate around`, `scale around`, `cm`, nested scopes, `transform canvas`, and `reset cm` use the same affine matrix pipeline.
- Single-plus coordinates do not update the relative-coordinate base. Thus all points in `(0,0) -- +(1,0) -- +(1,1)` remain relative to `(0,0)`, while `++` advances the base after every coordinate.
- Relative-coordinate vectors pass through the full linear part of the picture transform. A rotated or slanted picture must rotate or slant `++(1,0)` as well; only the transform translation is excluded.
- Relative Bezier coordinates follow TikZ's special endpoint rules: the first `+(...)` control is relative to the curve start, the second is relative to the curve end, and a relative curve endpoint is relative to the curve start.
- Grid generation happens in the path's local coordinate space and each grid-line endpoint then passes through the same affine transform as ordinary path points. Constructing an axis-aligned grid from the already-transformed corner bbox is incorrect under rotation or slant.
- Calc offsets use the same coordinate rules as ordinary coordinates before becoming vectors. Dimensionless `($(A)+(1,0)$)` and `($(A)+(90:1)$)` use the active picture basis; explicit `1cm` components are canvas dimensions. The current affine transform is then applied to the resulting vector exactly once.
- Calc modifiers support factor interpolation, fixed canvas distances, rotated targets, orthogonal projection coordinates, and repeated `!modifier!target` chains. These operations run on resolved canvas points, so their Euclidean distances and perpendicular projections are not distorted by a modified x/y basis.
- The explicit `perpendicular cs` combines the canvas x coordinate of `vertical line through` with the canvas y coordinate of `horizontal line through`, matching the implicit `-|` / `|-` syntax even when the picture basis is rotated or skewed.
- The `[turn]` coordinate option shifts the local origin to the current path point and rotates it to the incoming path tangent. Straight, orthogonal, Bezier, and arc segments retain enough incoming-tangent state for the following turned coordinate.
- `tangent cs` uses the node center and circle border radius to solve the two ray-circle tangencies. Its solution order follows PGF's `theta + acos(r/d)` / `theta - acos(r/d)` convention, including the node's outer separation in the effective border radius.
- `transform shape` nodes inherit the external affine rotation in addition to their node-local rotation. Nodes without this option keep their page-facing orientation even though their placement coordinate is transformed.
- SVG bounds for rotated node boxes, text, and node shadows are computed from their rotated corners. A correctly transformed node must not be clipped by an axis-aligned pre-rotation viewBox.
- Numeric angle anchors and automatic node-edge attachment solve the border intersection in the node's local shape frame and rotate the result back to canvas coordinates. This is required for `(node.0)`, `(node.45)`, curved edge tangents, and plain `(node)--(target)` paths on rotated rectangles, ellipses, diamonds, and polygonal shapes.
- The internal `current bounding box` and the final SVG viewBox both include rotated node/text corners; layout code must not observe a different bbox from the renderer.

Visual calibration artifacts used during this audit include:

- `/private/tmp/tikzkit-coordinate-transform-body.tikz` for ordered affine transforms;
- `/private/tmp/tikzkit-node-cs-audit.tikz` for explicit node centers versus automatic border attachment;
- `/private/tmp/tikzkit-relative-coordinate-audit.tikz` for `+` versus `++`;
- `/private/tmp/tikzkit-calc-coordinate-audit.tikz` for basis-relative versus canvas-dimensional calc offsets;
- `/private/tmp/tikzkit-tangent-coordinate-audit.tikz` for both `tangent cs` solutions;
- `/private/tmp/tikzkit-transform-shape-audit.tikz` for external versus node-local rotation;
- `/private/tmp/tikzkit-rotated-bbox-audit.tikz` for rotated node and formula paint bounds;
- `/private/tmp/tikzkit-rotated-anchor-audit.tikz` for numeric, named, and automatic border anchors;
- `/private/tmp/tikzkit-elliptical-polar-audit.tikz` for canvas and xyz elliptical polar radii;
- `/private/tmp/tikzkit-coordinate-prefix-audit.tikz` for coordinate-local rotation and scale under a transformed parent;
- `/private/tmp/tikzkit-coordinate-modifiers-audit-body.tikz` and `/private/tmp/tikzkit-coordinate-modifiers-qa/` for explicit perpendicular coordinates and calc factor/distance/angle/projection chains;
- `/private/tmp/tikzkit-turn-coordinate-audit.tikz` and the `turn-native` / `turn-js` artifacts in the same QA directory for tangent-relative path coordinates;
- `/private/tmp/tikzkit-relative-bezier-audit.tikz` and the `bezier-native` / `bezier-js` artifacts for relative Bezier controls and transformed grids;
- `/private/tmp/tikzkit-3d-axis-coordinate-audit.tikz` for 3D `axis cs`, `rel axis cs`, `axis direction cs`, and `addplot3 coordinates`;
- `/private/tmp/tikzkit-reversed-axis-coordinate-audit.tikz` for reversed x/z data, relative, and direction coordinates;
- `/private/tmp/tikzkit-3d-near-coords-audit.tikz` for projected 3D marks and their z-valued near-coordinate labels;
- `/private/tmp/tikzkit-axis-direction-audit.tikz` for PGFPlots absolute positions versus direction vectors.

Their MacTeX/tikztosvg and TikZKit outputs place the tested geometry on the same grid intersections. Text and automatic tick density are assessed separately from coordinate correctness.

## PGFPlots Boundary

PGFPlots does not use raw TikZ coordinates directly. Its `width` and `height` options describe an axis target box; data values are normalized by the axis ranges and then mapped into that box. A 3D axis additionally creates view-dependent x/y/z projection vectors and scales the projected plot-box bounding box.

Inside 2D axes, `axis cs` produces an absolute data position, `rel axis cs` and `axis description cs` produce normalized plot-box positions, and `axis direction cs` produces a vector with no plot-origin translation. The last distinction is required for constructs such as `(axis cs:1000,0) -- ++(axis direction cs:1000,0)`.

Three-dimensional axis overlays follow the same PGFPlots state machine with an optional z component. `axis cs:x,y,z` passes through the data range transform and view projection, `rel axis cs:x,y,z` and `normalized axis cs:x,y,z` project normalized box coordinates, while `axis direction cs:x,y,z` subtracts the projected origin so it remains a direction. The implementation was checked against `pgfplots.code.tex` lines 9696-9751 and 9814-9940. Coordinate-list `\addplot3` paths must use the same `mapPoint3d` projection; using the 2D mapper loses z and creates apparently global scale errors.

Axis-direction settings are part of the coordinate transform, not renderer styling. `x dir=reverse`, `y dir=reverse`, and `z dir=reverse` reverse data coordinates and direction-vector signs. With PGFPlots' default `allow reversal of rel axis cs=true`, `rel axis cs` compensates for the reversed basis and therefore stays at the same visual plot-box position; disabling that key lets it follow the reversed basis. `normalized axis cs` follows the axis basis, while `axis description cs` remains tied to the final 2D description box. This behavior was checked against `pgfplots.code.tex` lines 2391-2428 and 9885-9940.

The current 3D projection directions match the PGFPlots view equations and the visible box corners in the `3d-function-2`, `3d-function-4`, and `3d-function-8` references. Remaining differences in those cases are owned by:

- axis-description reserves when `scale only axis` is absent;
- tick-label, axis-label, and colorbar layout around the projected plot box;
- final SVG bbox contribution from those descriptions and the Preview border;
- text metrics and paint bounds.

These must not be corrected by changing the global centimeter-to-SVG scale or by hard-coding per-case coordinate offsets.

## Remaining Transform Boundary

General non-conformal node transforms are still partial. The current node layout can preserve external rotation and uniform area scale, but a matrix with unequal `xscale`/`yscale`, reflection, or shear requires the node border function, every anchor, text paint, shadow, and bbox to share the same full local affine matrix. Treating such a matrix as one determinant-derived scalar is not geometrically exact and must not be used as calibration for global coordinates.

Inline path scopes with `current point is local=true` still need an explicit path-state stack. Ordinary scopes, `+`, `++`, and transformed relative vectors are covered, but this local current-point escape hatch is not yet a completed coordinate feature.

## Regression Gates

Run:

```sh
node --test test/coordinates-section13.test.js
node --test test/engine.test.js test/interpreter.test.js test/pgfplots-seams.test.js test/svg-renderer.test.js
```

For visual changes, regenerate the affected fixture with both TikZKit and tikztosvg and inspect the same-origin 1cm grids. Passing only a numeric image-diff threshold is insufficient.

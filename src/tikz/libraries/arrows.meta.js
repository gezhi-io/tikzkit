import { lineWidthFromPt } from "../metrics.js";

export function loadsModernArrowDefaults(libraries = [], packages = []) {
  // bending adds flex/bend keys but does not load arrows.meta or replace To.
  return libraries.some(library => ["arrows.meta", "cd"].includes(library.name || library))
    // Verified imports in the installed package entry points; tkz-fct uses tkz-base.
    || packages.some(pkg => ["tikz-cd", "circuitikz", "tkz-euclide", "tkz-base", "tkz-fct"].includes(pkg.name || pkg));
}

// pgflibraryarrows.meta.code.tex: Computer Modern Rightarrow setup and hull.
// Dimensions are resolved before independent scaling, not fitted to a raster.
export function computerModernArrowGeometry(lineWidth, options = {}) {
  const inner = Number(options.innerLineWidth) || 0;
  const dependent = (spec, fallback) => {
    const { dimension = 0, lineWidthFactor = 0, outerFactor = 0 } = spec || fallback;
    return dimension + lineWidthFactor * (inner > 0 ? lineWidth - outerFactor * (lineWidth + inner) / 2 : lineWidth);
  };
  const prime = (spec, length) => spec.dimension + spec.lineWidthFactor * length + spec.outerFactor * lineWidth;
  const length = dependent(options.lengthSpec, { dimension: lineWidthFromPt(1.6), lineWidthFactor: 2.2 });
  const width = options.widthPrimeSpec ? prime(options.widthPrimeSpec, length)
    : options.widthSpec ? dependent(options.widthSpec) : 2.096774 * length;
  const w = options.lineWidthPrimeSpec ? prime(options.lineWidthPrimeSpec, length)
    : dependent(options.lineWidthSpec, { lineWidthFactor: 1, outerFactor: 1 });
  const a = length * (options.scale || 1) * (options.lengthScale || 1) - w;
  const b = width * (options.scale || 1) * (options.widthScale || 1) - w;
  const roundJoin = options.roundJoin !== false;
  const roundCap = options.roundCap !== false;
  const harpoon = options.harpoon === true;
  const reversed = options.reversed === true;
  const miter = .5 * w * Math.sqrt(1 + 49.44662 * (a / b) ** 2);
  const extra = 3.51591 * a / b * w;
  const front = roundJoin ? .5 * w : miter + (harpoon ? extra : 0);
  const back = -a - .5 * w;
  const line = reversed && harpoon ? .5 * w : -.5 * w;
  const transform = (x, y) => {
    y *= options.swap ? -1 : 1;
    return { x: (reversed ? -x : x) + (options.slant || 0) * y, y };
  };
  const controls = [[-a, .5*b], [-.81731*a, .2*b], [-.41019*a, .05833333*b], [0, 0]];
  if (!harpoon) controls.push([-.41019*a, -.05833333*b], [-.81731*a, -.2*b], [-a, -.5*b]);
  const points = controls.map(([x, y]) => transform(x, y));
  const hull = [[front, .5*w], [front, -.5*w], [-a+.5*w, .5*b+.5*w], [-a-.5*w, .5*b+.5*w]];
  if (harpoon) hull.push([-w, -.5*w], [-a-.5*w, .5*b-.5*w]);
  else hull.push([-a+.5*w, -.5*b-.5*w], [-a-.5*w, -.5*b-.5*w]);
  const transformedHull = hull.map(([x, y]) => transform(x, y));
  const bounds = {
    minX: Math.min(...transformedHull.map(p => p.x)), maxX: Math.max(...transformedHull.map(p => p.x)),
    minY: Math.min(...transformedHull.map(p => -p.y)), maxY: Math.max(...transformedHull.map(p => -p.y))
  };
  const tipEnd = reversed ? -back : front;
  const backEnd = reversed ? -front : back;
  const lineEnd = reversed ? -line : line;
  return { points, ...(harpoon ? { axialPoint: transform(reversed ? .5*w : -w, 0) } : {}),
    bounds, tipEnd, backEnd, lineEnd, placement: tipEnd, terminalPlacement: tipEnd - lineEnd,
    shorten: tipEnd - lineEnd, assemblyLength: tipEnd - backEnd, lineWidth: w,
    visualTipEnd: reversed ? -.5*w : front, visualBackEnd: reversed ? -front : .5*w,
    visualSpan: front - .5*w,
    strokeBoundsIncluded: true, hasExplicitHull: true,
    lineCap: roundCap ? "round" : "butt", lineJoin: roundJoin ? "round" : "miter" };
}

export const tikzLibrary = {
  "name": "arrows.meta",
  "status": "builtin",
  "implementedBy": "src/engine/options.js:parseArrowOption/parseArrowTipSpec/parseArrowTipDimensionSpec/parseArrowTipBending + src/tikz/metrics.js:createArrowTip/latexArrowGeometryFromLineWidth/stealthMetaArrowGeometryFromLineWidth/straightBarbArrowGeometryFromLineWidth/arcBarbArrowGeometryFromLineWidth/teeBarbArrowGeometryFromLineWidth + src/renderers/svg/paths.js:renderArrowedPath/resolveInlineArrowTipSequence/placeResolvedInlineArrowTips + src/renderers/svg/arrowBending.js:curvedArrowPaint + src/renderers/svg/bounds.js:arrowEndpointBounds",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex",
  "localSourceReviewed": true,
  "features": [
    "Stealth",
    "Latex",
    "Triangle",
    "arrow tip dimensions",
    "scale",
    "scale length",
    "scale width",
    "Stealth open",
    "Stealth harpoon",
    "Stealth swap",
    "Stealth reversed",
    "Straight Barb dependent length, width, width', line width, and line width'",
    "Straight Barb harpoon, left, right, swap, reversed, round, sharp, and slant",
    "Straight Barb double-line outer-factor dimensions and exchanged visual endpoints",
    "Arc Barb and Parenthesis dependent geometry, exact cubic arcs, extents, shortening, hulls, and transforms",
    "Arc Barb harpoon, left, right, swap, reversed, round, sharp, slant, and custom arc",
    "Tee Barb, Bar, and Bracket dependent geometry, exact path branches, extents, shortening, and hulls",
    "Tee Barb harpoon, left, right, swap, reversed, round, sharp, slant, inset, and independent stroke",
    "built-in composite arrow tip sequences",
    "per-tip sep dimension and line-width factors",
    "default, positive, and negative tip separation",
    "start-sequence order inversion",
    "double-line separation outer-factor arithmetic",
    "flex and flex' curved-tip placement",
    "bend orthogonal arrow deformation"
  ],
  "implements": [
    "Stealth",
    "Latex",
    "Triangle",
    "arrow tip dimensions",
    "scale",
    "scale length",
    "scale width",
    "Stealth open",
    "Stealth harpoon",
    "Stealth swap",
    "Stealth reversed",
    "Straight Barb dependent length, width, width', line width, and line width'",
    "Straight Barb harpoon, left, right, swap, reversed, round, sharp, and slant",
    "Straight Barb double-line outer-factor dimensions and exchanged visual endpoints",
    "Arc Barb and Parenthesis dependent geometry, exact cubic arcs, extents, shortening, hulls, and transforms",
    "Arc Barb harpoon, left, right, swap, reversed, round, sharp, slant, and custom arc",
    "Tee Barb, Bar, and Bracket dependent geometry, exact path branches, extents, shortening, and hulls",
    "Tee Barb harpoon, left, right, swap, reversed, round, sharp, slant, inset, and independent stroke",
    "built-in composite arrow tip sequences",
    "per-tip sep dimension and line-width factors",
    "default, positive, and negative tip separation",
    "start-sequence order inversion",
    "double-line separation outer-factor arithmetic",
    "flex and flex' curved-tip placement",
    "bend orthogonal arrow deformation"
  ],
  "notes": "Reviewed locally on 2026-08-06 through 2026-08-08 against TeX Live 2025. Capitalized Latex uses line-width-dependent length=+3pt 4.5 .8, width'=+0pt .75, and a capped miter outline. Capitalized Stealth now independently resolves length, width', and inset' before applying scale/scale length/scale width, then follows PGF's front/back/inset miter, tip-end, line-end, and qfillstroke construction. `Stealth[open]` changes that construction to qstroke; `harpoon` omits one outer corner and derives its tip-end/line-end from the harpoon miter; `swap` reflects it across the shaft; and `reversed` turns the mitered tip around while retaining its original attachment endpoint. Lower-case core latex and stealth remain distinct classic tips. Latex retains its distinct arrow assembly base, covered line end, and visible point; feed-forward-perceptron confirms `Latex[scale=0.5]-` at circular nodes. The 2026-08-08 `arrows-meta-tip-scaling` and `arrows-meta-stealth-variants` QA fixtures validate scaling, open, harpoon, swap, reversed, and native/tikztosvg artifacts. On 2026-09-04, pgfcorearrows sequence assembly and `sep` were reviewed again. TikZKit now parses built-in symbolic/named tip sequences, reverses source sequences at the start endpoint, advances each rigid tip by its logical assembly length plus the following tip's separation, and includes terminal separation in line shortening. Bare `sep` uses PGF's 0.88pt + 0.3 effective-line-width default; explicit dimension/factor forms, negative overlap, and double-line outer-factor arithmetic are supported. Evidence is in docs/qa/2026-09-04-arrows-meta-tip-separation.md. The same day's bending slice adds source-driven `flex`, `flex'`, and orthogonal `bend` on terminal cubic paths, including sequence sibling promotion and shared transformed bounds; evidence is in docs/qa/2026-09-04-arrows-meta-bending.md. On 2026-09-05, Straight Barb gained its source-defined connected stroked path, dependent default dimensions, front and harpoon miter corrections, independent arrow-tip stroke, exact tip/back/line extents, terminal shaft shortening, round or sharp cap/join, harpoon/left/right/swap/reversed reflection, slant, and transformed hull bounds. A follow-up source audit aligned double-line dimensions with PGF's full outer line width, exchanged visual tip/back ends during reversal, preserved width-prime isolation from unrelated tips, and removed duplicate stroke padding from exact rigid hull bounds. The CircuitikZ block-span fixture renders with zero diagnostics and was inspected against MacTeX and local tikztosvg; evidence is in docs/qa/2026-09-05-arrows-meta-straight-barb.md. Later on 2026-09-05, Arc Barb and its Parenthesis alias gained the source-defined dependent dimensions, exact PGF arc segmentation, cubic ellipse control points, tip/back/line/visual extents, terminal shortening, source hull thresholds, independent stroke, harpoon/left/right/swap/reversed reflection, round or sharp cap/join, slant, and custom arc. The state-estimator fixture validates curved flow, mathematical interval ends, and physical vectors against MacTeX and local tikztosvg; evidence is in docs/qa/2026-09-05-arrows-meta-arc-barb.md. Tee Barb and its Bar and Bracket aliases now resolve PGF's line-width-dependent length, width, inset, and arrow stroke, choose the single-line, connected-bracket, or three-subpath source branch, preserve source hulls and visual ends, and apply exact shaft shortening, independent length/width scaling, double-line outer-factor arithmetic, harpoon/left/right/swap/reversed reflection, round or sharp cap/join, and slant. The flowchart, interval, and physical-vector fixture was inspected against MacTeX and local tikztosvg; evidence is in docs/qa/2026-09-05-arrows-meta-tee-barb.md. Arbitrary setup-code keys and bending declarations, polar bending, repeated `reversed` cancellation, arbitrary pgfmath arc expressions, and arbitrary user-declared names inside composite sequences remain partial."
};

tikzLibrary.features.push("PGF-math scale expressions, exact Latex cubic coefficients, inherited paint opacity and PGF miter limit");
tikzLibrary.implementedBy += " + src/tikz/libraries/arrows.meta.js:computerModernArrowGeometry/loadsModernArrowDefaults + src/engine/options.js:resolveToAliases";
tikzLibrary.features.push("source-dependent To alias, native Computer Modern Rightarrow geometry, affine slanted pen and visual endpoints");
tikzLibrary.notes += " Reviewed on 2026-10-25: To selects classical or modern geometry according to the source libraries and known package imports; bending alone does not load arrows.meta. Computer Modern Rightarrow uses native dependent length/width/stroke, round/sharp joins, harpoon, reversed, swap, slant and independent scaling. SVG slant transforms the pen as well as the centerline. Zero visual span uses the terminal tangent for flex. Seven browser controls pass; the modern-options case retains a 0.228 CSS-pixel shaft discrepancy at 3x display scale and is not fully accepted. Arbitrary custom dependency/load-order semantics remain partial. See docs/qa/2026-10-25-core-to-arrows.md.";
tikzLibrary.notes += " On 2026-10-23, local pgflibraryarrows.meta.code.tex Latex cubic control coefficients and pgfcoregraphicstate.code.tex miter limit 10 were checked. Per-point scale expressions use restricted PGF math; filled and open inline tips retain path paint opacity and miter settings. Real gradient quiver plots and focused browser controls compare against MacTeX/tikztosvg. Full arbitrary setup programs remain unsupported; see docs/qa/2026-10-23-pgfplots-quiver-colors.md.";

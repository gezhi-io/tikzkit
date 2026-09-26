import { flattenPath, pathLength } from "../../engine/geometry.js";
import { evaluateMath, parseDimension, roundNumber, roundPoint } from "../../engine/math.js";
import { parseFinitePgfLength } from "../../engine/units.js";
import { tikzBoolean } from "../../engine/options.js";
import { moveToCommand, lineToCommand, curveToCommand } from "../../engine/pathBuilder.js";
import { flattenDecorationPath, pointOnPolyline } from "../decorations/pathGeometry.js";

export const tikzLibrary = {
  "name": "decorations.pathreplacing",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/decorations.pathreplacing.js:applyBraceDecoration/appendBraceLine/applyTicksDecoration/appendTicksOnPolyline/applyBorderDecoration/appendBorderOnPolyline/applyWavesDecoration/appendPathReplacingWaves/resolvePathReplacingBoundary/appendPathReplacingFinalAndPost + src/tikz/decorations/pathGeometry.js:flattenDecorationPath/pointOnPolyline + src/engine/evaluate.js:addShowPathConstructionItems/addPostactionShowPathConstructionItems/postactionDecorationPathItems/showPathConstructionCallbackEnvironment",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathreplacing.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "brace path replacement",
    "mirror",
    "raise",
    "amplitude",
    "aspect",
    "whole remaining subpath length in the initial tangent direction",
    "recursive cubic brace length with exact initial tangent",
    "ticks path replacement",
    "ticks segment length",
    "ticks amplitude",
    "ticks local line and curve tangents",
    "ticks final complete state origin",
    "border path replacement",
    "border segment length",
    "border amplitude",
    "border angle",
    "border tick, last, and final states",
    "border last-state amplitude boundary",
    "border pre length and post length",
    "border mirror and raise transforms",
    "border local line and curve tangents",
    "path-replacing consumed-state post boundary",
    "fixed-radius waves path replacement",
    "fixed waves pre length and post length",
    "fixed waves mirror and raise transforms",
    "fixed waves complete-state boundary",
    "expanding waves path replacement",
    "waves segment length",
    "waves radius",
    "waves angle",
    "expanding waves pre length and post length",
    "expanding waves mirror and raise transforms",
    "expanding waves exact-endpoint state boundary",
    "show path construction callbacks",
    "moveto/lineto/curveto/closepath code",
    "input segment first/last/support coordinates",
    "supported decorate postactions preserve source path",
    "named postaction styles",
    "source paint-state inheritance for callbacks",
    "callback every node/nodes font inheritance"
  ],
  "implements": [
    "brace path replacement",
    "mirror",
    "raise",
    "amplitude",
    "aspect",
    "whole remaining subpath length in the initial tangent direction",
    "recursive cubic brace length with exact initial tangent",
    "ticks path replacement",
    "ticks segment length",
    "ticks amplitude",
    "ticks local line and curve tangents",
    "ticks final complete state origin",
    "border path replacement",
    "border segment length",
    "border amplitude",
    "border angle",
    "border tick, last, and final states",
    "border last-state amplitude boundary",
    "border pre length and post length",
    "border mirror and raise transforms",
    "border local line and curve tangents",
    "path-replacing consumed-state post boundary",
    "fixed-radius waves path replacement",
    "fixed waves pre length and post length",
    "fixed waves mirror and raise transforms",
    "fixed waves complete-state boundary",
    "expanding waves path replacement",
    "waves segment length",
    "waves radius",
    "waves angle",
    "expanding waves pre length and post length",
    "expanding waves mirror and raise transforms",
    "expanding waves exact-endpoint state boundary",
    "show path construction callbacks",
    "moveto/lineto/curveto/closepath code",
    "input segment first/last/support coordinates",
    "supported decorate postactions preserve source path",
    "named postaction styles",
    "source paint-state inheritance for callbacks",
    "callback every node/nodes font inheritance"
  ],
  "notes": "Brace replacement mirrors PGF's remaining-distance state: it measures the complete decorated subpath, then draws the replacement in the initial tangent frame. Curved input now reuses PGF's always-split, recursive 1pt chord-threshold measurement and takes the initial direction from the cubic's first support point, rather than from a sampled chord. mirror, raise, amplitude, and aspect are supported. Permanent flowchart, mathematics, and physics evidence is in docs/qa/2026-09-04-pathreplacing-brace-curves.md. `ticks` replaces a complete decorated line/curve subpath with independent normal strokes at each full segment-length state origin; amplitude is the half-length and the final partial path remainder does not receive an endpoint tick. `border` follows PGF's tick/last/final automaton: full segment-length states emit single-sided strokes, a positive terminal remainder runs `last` only when it is at least one amplitude wide, and `final` moves to the child endpoint. Segment length, amplitude, angle, pre/post line sections, mirror, raise, and local straight/cubic tangent frames are supported. When a positive post section is active, the post line begins at the actual consumed child-state distance rather than the nominal end of the main section; with no post section, final remains at the source endpoint. Evidence: docs/qa/2026-09-04-pathreplacing-border-states.md. Fixed-radius `waves` uses the state's `width=segment length` boundary: exact complete states render, while a terminal remainder shorter than one segment switches directly to final. It honors TikZ's internal pre/main/post line sections, consumed-state post boundary, and local tangent-frame mirror/raise transforms on straight or curved paths. Evidence: docs/qa/2026-09-04-pathreplacing-fixed-waves.md. `expanding waves` consumes its initial empty state, then uses completed decoration distance as both arc radius and native local x offset; growing states run strictly before the main-section endpoint, so an exact multiple does not gain a false terminal arc. `expanding waves` honors the same boundary meta-decoration and local transforms. Evidence: docs/qa/2026-09-04-pathreplacing-expanding-waves.md. `show path construction` invokes moveto/lineto/curveto/closepath callback code against original input-segment first, last, and cubic support points, reusing the normal TikZ command interpreter with the decoration transform disabled. It resolves the documented named `postaction=style` form, preserves the foreground source path, and lets callback draw/fill commands inherit the source paint state while stripping nested decoration/registration behavior. Callback labels materialize inherited `every node` and `nodes` fonts into their SVG FontSpec, so the documented `font=\\tiny` callback style controls physical text size rather than only layout scale. Arbitrary TeX-only callback bodies, low-level PGF point macros, arbitrary postaction keys, and custom decoration transforms remain partial."
};

export function applyBraceDecoration(commands, decoration, env) {
  const replaced = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }

    // PGF's brace state consumes the whole remaining decorated subpath. Its
    // coordinate frame stays aligned to the initial tangent, even for a
    // polyline, so the replacement endpoint is the total traversal length
    // along that initial direction rather than the source subpath endpoint.
    const points = flattenDecorationPath(subpath);
    const start = points[0];
    const length = pathLength(points);
    const initial = pointOnPolyline(points, 0);
    const tangent = initial?.normal
      ? { x: initial.normal.y, y: -initial.normal.x }
      : null;
    if (!start || !tangent || Math.hypot(tangent.x, tangent.y) <= 1e-12 || length <= 1e-12) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    appendBraceLine(replaced, start, {
      x: start.x + tangent.x * length,
      y: start.y + tangent.y * length
    }, decoration, env);
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    replaced.push(command);
  }
  flushSubpath();
  return replaced.length ? replaced : commands;
}

export function applyTicksDecoration(commands, decoration, env) {
  const replaced = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }

    // `ticks` is a path-replacing decoration. The PGF state machine advances
    // through the complete decorated subpath, so a tick after a corner uses
    // the following segment's local tangent rather than restarting there.
    const points = flattenPath(subpath, 0.02);
    const length = pathLength(points);
    if (points.length < 2 || length <= 1e-12) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    appendTicksOnPolyline(replaced, points, length, decoration, env);
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    replaced.push(command);
  }
  flushSubpath();
  return replaced.length ? replaced : commands;
}

export function applyBorderDecoration(commands, decoration, env) {
  const replaced = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    const points = flattenPath(subpath, 0.02);
    const length = pathLength(points);
    if (points.length < 2 || length <= 1e-12) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    appendBorderOnPolyline(replaced, points, length, decoration, env);
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    replaced.push(command);
  }
  flushSubpath();
  return replaced.length ? replaced : commands;
}

export function applyWavesDecoration(commands, decoration, env) {
  const replaced = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    const points = flattenPath(subpath, 0.02);
    const length = pathLength(points);
    if (points.length < 2 || length <= 1e-12) {
      replaced.push(...subpath);
      subpath = [];
      return;
    }
    appendPathReplacingWaves(replaced, points, length, decoration, env);
    subpath = [];
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      flushSubpath();
      subpath.push(command);
      continue;
    }
    if (subpath.length && ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type)) {
      subpath.push(command);
      if (command.type === "closePath") flushSubpath();
      continue;
    }
    flushSubpath();
    replaced.push(command);
  }
  flushSubpath();
  return replaced.length ? replaced : commands;
}

function appendBorderOnPolyline(commands, points, length, decoration, env) {
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const segmentLength = Math.max(
    1e-9,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  const amplitude = Math.max(
    0,
    parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, defaultAmplitude)
  );
  const rawAngle = evaluateMath(String(decoration.angle ?? "45"), env.variables || {});
  const angle = Number.isFinite(rawAngle) ? (rawAngle * Math.PI) / 180 : Math.PI / 4;
  const boundary = resolvePathReplacingBoundary(length, decoration, env);
  appendPathReplacingPreLine(commands, points, boundary.preLength);

  const completeSegments = Math.floor((boundary.activeLength + 1e-9) / segmentLength);
  const completeDistance = Math.min(boundary.activeLength, completeSegments * segmentLength);
  const remainder = Math.max(0, boundary.activeLength - completeDistance);
  const stateDistances = Array.from({ length: completeSegments }, (_, index) => index * segmentLength);
  const runsLastState = remainder > 1e-9 && remainder + 1e-9 >= amplitude;
  if (runsLastState) stateDistances.push(completeDistance);

  for (const distance of stateDistances) {
    const point = pointOnPolyline(points, boundary.preLength + distance);
    const tangent = { x: point.normal.y, y: -point.normal.x };
    const normal = {
      x: point.normal.x * boundary.normalSign,
      y: point.normal.y * boundary.normalSign
    };
    const origin = {
      x: point.x + normal.x * boundary.normalRaise,
      y: point.y + normal.y * boundary.normalRaise
    };
    commands.push(
      moveToCommand(roundPoint(origin)),
      lineToCommand({
        x: roundNumber(origin.x + amplitude * (tangent.x * Math.cos(angle) + normal.x * Math.sin(angle))),
        y: roundNumber(origin.y + amplitude * (tangent.y * Math.cos(angle) + normal.y * Math.sin(angle)))
      })
    );
  }

  const completedDistance = completeDistance + (runsLastState ? amplitude : 0);
  appendPathReplacingFinalAndPost(commands, points, length, boundary, completedDistance);
}

function appendTicksOnPolyline(commands, points, length, decoration, env) {
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const segmentLength = Math.max(
    1e-9,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  const amplitude = Math.max(
    0,
    parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, defaultAmplitude)
  );
  const offsets = [];
  for (let distance = 0; distance < length - 1e-9; distance += segmentLength) offsets.push(distance);
  // PGF's `final` state runs at the current decoration-state origin. It does
  // not relocate the tick to the raw path endpoint when a partial segment is
  // left over, so only fully reached segment origins receive tick marks.

  for (const distance of offsets) {
    const point = pointOnPolyline(points, distance);
    const positive = {
      x: roundNumber(point.x + point.normal.x * amplitude),
      y: roundNumber(point.y + point.normal.y * amplitude)
    };
    const negative = {
      x: roundNumber(point.x - point.normal.x * amplitude),
      y: roundNumber(point.y - point.normal.y * amplitude)
    };
    commands.push(moveToCommand(positive), lineToCommand(negative));
  }
}

function appendPathReplacingWaves(commands, points, length, decoration, env) {
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const defaultRadius = parseDimension("2.5pt", env.variables);
  const segmentLength = Math.max(
    1e-9,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  const angleDegrees = evaluateMath(String(decoration.angle ?? "45"), env.variables || {});
  const angle = Number.isFinite(angleDegrees) ? (angleDegrees * Math.PI) / 180 : Math.PI / 4;
  const expanding = tikzBoolean(decoration["expanding waves"]);
  const radius = Math.max(
    0,
    parseFinitePgfLength(decoration.radius ?? decoration["start radius"] ?? "2.5pt", env, defaultRadius)
  );
  const boundary = resolvePathReplacingBoundary(length, decoration, env);
  appendPathReplacingPreLine(commands, points, boundary.preLength);

  // `waves` starts immediately: every full state has a fixed circle radius.
  // `expanding waves` consumes its initial empty state first, then uses the
  // completed decoration distance as both its radius and local x offset. The
  // latter is the native `-\pgfdecoratedcompleteddistance` transform.
  const firstDistance = expanding ? segmentLength : 0;
  // A state at the exact endpoint never runs: the automaton switches to its
  // final state as soon as the remaining distance reaches zero. Expanding
  // waves therefore draw at segmentLength, 2*segmentLength, ... strictly
  // before the main-section endpoint. Fixed waves start at distance zero,
  // but their width key switches to final unless a complete segment remains.
  for (let distance = firstDistance; ; distance += segmentLength) {
    const stateFits = expanding
      ? distance < boundary.activeLength - 1e-9
      : distance + segmentLength <= boundary.activeLength + 1e-9;
    if (!stateFits) break;
    const state = pointOnPolyline(points, boundary.preLength + distance);
    const tangent = { x: state.normal.y, y: -state.normal.x };
    const waveRadius = expanding ? distance : radius;
    if (!(waveRadius > 1e-12)) continue;
    const centerOffset = expanding ? -distance : segmentLength - waveRadius;
    const center = {
      x: state.x + tangent.x * centerOffset + state.normal.x * boundary.normalSign * boundary.normalRaise,
      y: state.y + tangent.y * centerOffset + state.normal.y * boundary.normalSign * boundary.normalRaise
    };
    const transformedNormal = {
      x: state.normal.x * boundary.normalSign,
      y: state.normal.y * boundary.normalSign
    };
    appendOrientedCircularArc(commands, center, tangent, transformedNormal, waveRadius, angle, -angle);
  }

  const completeSegments = Math.floor((boundary.activeLength + 1e-9) / segmentLength);
  const completedDistance = Math.min(boundary.activeLength, completeSegments * segmentLength);
  appendPathReplacingFinalAndPost(commands, points, length, boundary, completedDistance);
}

function resolvePathReplacingBoundary(length, decoration, env) {
  const preLength = Math.min(
    length,
    Math.max(0, parseFinitePgfLength(decoration["pre length"] ?? "0", env, 0))
  );
  const postLength = Math.min(
    Math.max(0, length - preLength),
    Math.max(0, parseFinitePgfLength(decoration["post length"] ?? "0", env, 0))
  );
  return {
    preLength,
    postLength,
    activeLength: Math.max(0, length - preLength - postLength),
    normalSign: tikzBoolean(decoration.mirror) ? -1 : 1,
    normalRaise: parseFinitePgfLength(decoration.raise ?? "0", env, 0)
  };
}

function appendPathReplacingPreLine(commands, points, preLength) {
  if (preLength <= 1e-12) return;
  commands.push(
    moveToCommand(roundPoint(points[0])),
    lineToCommand(roundPoint(pointOnPolyline(points, preLength)))
  );
}

function appendPathReplacingFinalAndPost(commands, points, length, boundary, completedDistance) {
  const finalDistance = boundary.postLength > 1e-12
    ? Math.min(length, boundary.preLength + completedDistance)
    : length;
  commands.push(moveToCommand(roundPoint(pointOnPolyline(points, finalDistance))));
  if (boundary.postLength > 1e-12) {
    commands.push(lineToCommand(roundPoint(points.at(-1))));
  }
}

function appendOrientedCircularArc(commands, center, tangent, normal, radius, startAngle, endAngle) {
  const steps = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 2)));
  const pointAt = (angle) => ({
    x: center.x + radius * (tangent.x * Math.cos(angle) + normal.x * Math.sin(angle)),
    y: center.y + radius * (tangent.y * Math.cos(angle) + normal.y * Math.sin(angle))
  });
  const derivativeAt = (angle) => ({
    x: radius * (-tangent.x * Math.sin(angle) + normal.x * Math.cos(angle)),
    y: radius * (-tangent.y * Math.sin(angle) + normal.y * Math.cos(angle))
  });
  commands.push(moveToCommand(roundPoint(pointAt(startAngle))));
  for (let index = 1; index <= steps; index += 1) {
    const fromAngle = startAngle + ((endAngle - startAngle) * (index - 1)) / steps;
    const toAngle = startAngle + ((endAngle - startAngle) * index) / steps;
    const k = (4 / 3) * Math.tan((toAngle - fromAngle) / 4);
    const from = pointAt(fromAngle);
    const to = pointAt(toAngle);
    const fromDerivative = derivativeAt(fromAngle);
    const toDerivative = derivativeAt(toAngle);
    commands.push(curveToCommand(
      roundPoint({ x: from.x + k * fromDerivative.x, y: from.y + k * fromDerivative.y }),
      roundPoint({ x: to.x - k * toDerivative.x, y: to.y - k * toDerivative.y }),
      roundPoint(to)
    ));
  }
}

function appendBraceLine(commands, from, to, decoration, env) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) {
    commands.push({ type: "moveTo", x: from.x, y: from.y });
    return;
  }
  const raise = parseFinitePgfLength(decoration.raise || "0", env, 0);
  const mirrored = decoration.mirror === true || String(decoration.mirror).trim() === "true";
  const side = mirrored ? -1 : 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy * side;
  const ny = ux * side;
  const amplitude = Math.max(
    0,
    parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, parseDimension("2.5pt", env.variables))
  );
  if (amplitude <= 1e-12) {
    const p0 = bracePoint(from, ux, uy, nx, ny, 0, raise);
    const p1 = bracePoint(from, ux, uy, nx, ny, length, raise);
    commands.push({ type: "moveTo", x: p0.x, y: p0.y });
    commands.push({ type: "lineTo", x: p1.x, y: p1.y });
    return;
  }

  const aspectRaw = evaluateMath(decoration.aspect ?? "0.5", env.variables);
  const aspect = Number.isFinite(aspectRaw) ? Math.min(0.95, Math.max(0.05, aspectRaw)) : 0.5;
  const apexDistance = length * aspect;
  const beforeCurl = Math.min(amplitude, Math.max(0, apexDistance / 2));
  const afterCurl = Math.min(amplitude, Math.max(0, (length - apexDistance) / 2));
  const point = (distance, normalOffset) => bracePoint(from, ux, uy, nx, ny, distance, raise + normalOffset);
  const pushLineTo = (distance, normalOffset) => {
    const previous = commands.at(-1);
    const p = point(distance, normalOffset);
    if (previous && Math.hypot((previous.x ?? 0) - p.x, (previous.y ?? 0) - p.y) < 1e-9) return;
    commands.push({ type: "lineTo", x: p.x, y: p.y });
  };
  const pushCurveTo = (c1Distance, c1Normal, c2Distance, c2Normal, endDistance, endNormal) => {
    const c1 = point(c1Distance, c1Normal);
    const c2 = point(c2Distance, c2Normal);
    const end = point(endDistance, endNormal);
    commands.push({
      type: "curveTo",
      x1: c1.x,
      y1: c1.y,
      x2: c2.x,
      y2: c2.y,
      x: end.x,
      y: end.y
    });
  };

  const start = point(0, 0);
  commands.push({ type: "moveTo", x: start.x, y: start.y });
  pushCurveTo(
    beforeCurl * 0.15,
    amplitude * 0.3,
    beforeCurl * 0.5,
    amplitude * 0.5,
    beforeCurl,
    amplitude * 0.5
  );
  pushLineTo(apexDistance - beforeCurl, amplitude * 0.5);
  pushCurveTo(
    apexDistance - beforeCurl * 0.5,
    amplitude * 0.5,
    apexDistance - beforeCurl * 0.15,
    amplitude * 0.7,
    apexDistance,
    amplitude
  );
  pushCurveTo(
    apexDistance + afterCurl * 0.15,
    amplitude * 0.7,
    apexDistance + afterCurl * 0.5,
    amplitude * 0.5,
    apexDistance + afterCurl,
    amplitude * 0.5
  );
  pushLineTo(length - afterCurl, amplitude * 0.5);
  pushCurveTo(
    length - afterCurl * 0.5,
    amplitude * 0.5,
    length - afterCurl * 0.15,
    amplitude * 0.3,
    length,
    0
  );
}

function bracePoint(origin, ux, uy, nx, ny, distance, normalDistance) {
  return roundPoint({
    x: origin.x + ux * distance + nx * normalDistance,
    y: origin.y + uy * distance + ny * normalDistance
  });
}

import { evaluateMath, parseDimension, roundNumber, roundPoint } from "../../engine/math.js";
import { createPgfRandom } from "../../engine/pgfRandom.js";
import { tikzBoolean } from "../../engine/options.js";
import { parseFinitePgfLength } from "../../engine/units.js";
import { polylineLength, flattenDecorationPath, pointOnPolyline, createPgfDecorationPathWalker } from "../decorations/pathGeometry.js";

export const tikzLibrary = {
  "name": "decorations.pathmorphing",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/decorations.pathmorphing.js:applyPathMorphingDecoration/applyPathMorphingToSubpaths/appendNativeSnakePolylineInStateFrames/appendNativeZigzagPolyline/appendNativeStraightZigzagPolyline/appendNativeCoilPolyline/appendNativeSawPolyline/appendNativeBumpsPolyline/appendNativeBentPolyline/appendNativeRandomStepsPolyline + src/tikz/decorations/pathGeometry.js:flattenDecorationPath/pointOnPolyline/createPgfDecorationPathWalker/pgfDecorationCurveTimeAfterDistance + src/engine/pgfRandom.js:createPgfRandom",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarysnakes.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "native-style snake startup/cycle/end states",
    "snake phase continuity across line/curve subpaths",
    "snake analytic cubic tangent frames",
    "whole-subpath pre length/post length independent of terminal arrow shortening",
    "native zigzag quarter-apex, alternating-state, and center-finish phase",
    "zigzag phase continuity across line/curve subpaths",
    "zigzag state-origin tangent frames",
    "PGF-style recursive cubic length sampling with 1pt coordinate tolerance",
    "PGF iterative curved-path distance-to-time search",
    "native coil four-cubic cycle and two-cubic final state",
    "coil aspect projection, amplitude, segment length, pre length, and post length",
    "native saw full-tooth and automatic-end states",
    "saw signed amplitude, explicit path has corners, pre length, and post length",
    "native bumps two-cubic half-ellipse state and 0.51 segment automatic-end threshold",
    "bumps signed amplitude, explicit path has corners, pre length, and post length",
    "native bent one-cubic state per straight input segment",
    "bent aspect, signed amplitude, pre length, post length, mirror, and raise",
    "native random steps PGF-seeded two-axis perturbation state",
    "random steps automatic end and persistent automatic corner threshold",
    "random steps segment length, amplitude, pre length, post length, mirror, and raise",
    "native straight zigzag alternating curveto and zigzag meta states",
    "straight zigzag meta-segment length, segment length, amplitude, and child-state remainders",
    "straight zigzag direct-meta pre/post bypass and first-child transform reset",
    "shared mirror and raise state transforms for snake, zigzag, and coil",
    "shared mirror and raise state transforms for saw",
    "shared mirror and raise state transforms for bumps",
    "legacy mirror snake and raise snake transformation order"
  ],
  "implements": [
    "snake pathmorphing subset",
    "zigzag pathmorphing subset",
    "coil pathmorphing subset",
    "saw pathmorphing subset",
    "bumps pathmorphing subset",
    "bent straight-segment pathmorphing subset",
    "random steps pathmorphing subset",
    "straight zigzag metadecoration subset",
    "mirror/raise transform subset"
  ],
  "notes": "Snake and zigzag follow their local PGF state machines across a complete input subpath. Explicit pre/post lengths control only the decoration; late terminal-arrow shortening does not shift the wave phase. Standard snake retains each PGF state's entry tangent/normal when that state crosses a sharp polyline corner; evidence: docs/qa/2026-08-08-pathmorphing-snake-state-frame.md. Curved pathmorphing uses recursive cubic subdivision with the native 1pt per-axis stopping tolerance, while exact cubic points and analytic tangents install each state's local coordinate frame; PGF's signed-chord iterative search refines distance to curve time. Coil follows the installed TeX Live four-cubic cycle and two-cubic final state, including aspect-projected radius, amplitude, segment length, pre length, and post length on straight and curved paths. Modern mirror and raise keys now use PGF's segment-transform order for snake, zigzag, and coil, including curved tangent frames. Saw follows PGF's full-tooth state and automatic short final state, preserves signed amplitude, optionally restarts at input corners when path has corners is explicit, and applies the same tangent-frame mirror/raise transform. Bumps follows PGF's half-segment two-cubic state, 0.51-segment automatic-end and automatic-corner thresholds, raw-endpoint final state, signed amplitude, and tangent-frame mirror/raise transforms on straight and curved paths. Bent follows PGF's one-cubic state over each remaining straight input segment: aspect places the two controls at aspect and 1-aspect, signed amplitude offsets both controls, pre length shortens the first state, and a post length that makes a state too wide leaves that segment line-like. Mirror and raise use the shared state-frame transform, including the transformed final endpoint. PGF documents bent as unsuitable for curved input paths, so that combination is not claimed. Random steps now consumes two independent PGF rand values per full state for local x/y perturbation, uses the declaration's persistent path-has-corners behavior with the 1.5-segment automatic-end/corner threshold, and honors source-order pgfmathsetseed, pre/post length, signed amplitude, mirror, and raise. Its generator is shared with datavisualization and seeded starburst support. Straight zigzag now follows the installed meta-decoration: it alternates curveto and zigzag child decorations at meta-segment length boundaries, preserves each child's complete-state remainder, always finishes with curveto, and reproduces TikZ's direct-meta pre/post bypass plus first-child-only mirror/raise behavior. The legacy mirror snake/raise snake spelling follows the reflected translation rule and no longer inserts a false entry segment. Evidence: docs/qa/2026-09-04-pathmorphing-curve-frames.md, docs/qa/2026-09-04-pathmorphing-coil.md, docs/qa/2026-09-04-pathmorphing-mirror-raise.md, docs/qa/2026-09-04-pathmorphing-saw.md, docs/qa/2026-09-04-pathmorphing-bumps.md, docs/qa/2026-09-04-pathmorphing-bent.md, docs/qa/2026-09-04-pathmorphing-random-steps.md, and docs/qa/2026-09-04-pathmorphing-straight-zigzag.md."
};

export function applyPathMorphingDecoration(commands, decoration, env) {
  const mode = decoration.snake
    ? "snake"
    : decoration.zigzag
      ? "zigzag"
      : decoration["straight zigzag"]
        ? "straight zigzag"
        : decoration.coil
          ? "coil"
          : decoration.saw
            ? "saw"
            : decoration.bumps
              ? "bumps"
              : decoration.bent
                ? "bent"
                : decoration["random steps"]
                  ? "random steps"
                  : null;
  if (!mode) return commands;
  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const defaultMetaSegmentLength = parseDimension("1cm", env.variables);
  const minimumSegmentLength = parseDimension("1pt", env.variables);
  const amplitude = parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, defaultAmplitude);
  const segmentLength = Math.max(
    minimumSegmentLength,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  const metaSegmentLength = Math.max(
    minimumSegmentLength,
    parseFinitePgfLength(decoration["meta-segment length"] ?? "1cm", env, defaultMetaSegmentLength)
  );
  // TikZ decorates the path before the arrow-tip shortening pass.  In
  // particular, adding an arrow must not alter the snake's phase or the
  // caller-provided pre/post lengths; the SVG renderer shortens only the
  // final painted line when it places the tip.
  const preLength = Math.max(0, parseFinitePgfLength(decoration["pre length"] ?? "0", env, 0));
  const postLength = Math.max(0, parseFinitePgfLength(decoration["post length"] ?? "0", env, 0));
  const aspectValue = evaluateMath(decoration.aspect ?? "0.5", env.variables);
  const aspect = Number.isFinite(aspectValue) ? aspectValue : 0.5;
  const normalSign = tikzBoolean(decoration.mirror) ? -1 : 1;
  const normalRaise = parseFinitePgfLength(decoration.raise ?? "0", env, 0);
  const pathHasCorners = tikzBoolean(decoration["path has corners"]);
  // PGF runs path-morphing decorations over the complete input subpath and
  // applies pre/post lengths only at its endpoints. Individual declarations
  // decide whether states span or restart at input-segment boundaries.
  return applyPathMorphingToSubpaths(
    commands,
    amplitude,
    segmentLength,
    mode,
    preLength,
    postLength,
    aspect,
    normalSign,
    normalRaise,
    pathHasCorners,
    env.pgfRandom,
    metaSegmentLength
  );
}

function applyPathMorphingToSubpaths(
  commands,
  amplitude,
  segmentLength,
  mode,
  preLength,
  postLength,
  aspect = 0.5,
  normalSign = 1,
  normalRaise = 0,
  pathHasCorners = false,
  pgfRandom = createPgfRandom(),
  metaSegmentLength = parseDimension("1cm", {})
) {
  const morphed = [];
  let subpath = [];

  const flushSubpath = () => {
    if (!subpath.length) return;
    const startsWithMove = subpath[0]?.type === "moveTo";
    const hasDrawableSegment = subpath.some((command) => ["lineTo", "quadTo", "curveTo", "closePath"].includes(command.type));
    if (!startsWithMove || !hasDrawableSegment) {
      morphed.push(...subpath);
      subpath = [];
      return;
    }

    const points = flattenDecorationPath(subpath);
    if (points.length < 2) {
      morphed.push(...subpath);
      subpath = [];
      return;
    }

    const start = points[0];
    morphed.push({ type: "moveTo", x: start.x, y: start.y });
    appendMorphedPolyline(
      morphed,
      points,
      amplitude,
      segmentLength,
      mode,
      preLength,
      postLength,
      aspect,
      normalSign,
      normalRaise,
      pathHasCorners,
      pgfRandom,
      metaSegmentLength
    );
    if (subpath.at(-1)?.type === "closePath") morphed.push({ type: "closePath" });
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
    morphed.push(command);
  }
  flushSubpath();
  return morphed;
}

function appendMorphedPolyline(
  commands,
  points,
  amplitude,
  segmentLength,
  mode,
  preLength = 0,
  postLength = 0,
  aspect = 0.5,
  normalSign = 1,
  normalRaise = 0,
  pathHasCorners = false,
  pgfRandom = createPgfRandom(),
  metaSegmentLength = parseDimension("1cm", {})
) {
  const length = polylineLength(points);
  const to = points.at(-1);
  if (!to) return;
  if (length < 1e-12) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  // TikZ starts a meta-decoration directly, bypassing its internal pre/main/
  // post wrapper. Consequently straight zigzag ignores pre/post lengths.
  const directMetaDecoration = mode === "straight zigzag";
  const activeStart = directMetaDecoration ? 0 : Math.min(Math.max(0, preLength), length);
  const activeEnd = directMetaDecoration
    ? length
    : Math.max(activeStart, length - Math.min(Math.max(0, postLength), Math.max(0, length - activeStart)));
  const activeLength = activeEnd - activeStart;
  if (activeStart > 1e-12) {
    const startPoint = pointOnPolyline(points, activeStart);
    commands.push({ type: "lineTo", x: roundNumber(startPoint.x), y: roundNumber(startPoint.y) });
  }
  if (activeLength < 1e-12) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "zigzag") {
    appendNativeZigzagPolyline(
      commands,
      points,
      amplitude,
      segmentLength,
      activeStart,
      activeLength,
      normalSign,
      normalRaise
    );
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "straight zigzag") {
    appendNativeStraightZigzagPolyline(
      commands,
      points,
      amplitude,
      segmentLength,
      metaSegmentLength,
      activeStart,
      activeLength,
      normalSign,
      normalRaise
    );
    return;
  }
  if (mode === "snake") {
    appendNativeSnakePolyline(
      commands,
      points,
      amplitude,
      segmentLength,
      activeStart,
      activeLength,
      normalSign,
      normalRaise
    );
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "coil") {
    appendNativeCoilPolyline(
      commands,
      points,
      amplitude,
      segmentLength,
      aspect,
      activeStart,
      activeLength,
      normalSign,
      normalRaise
    );
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "saw") {
    appendNativeSawPolyline(
      commands,
      points,
      amplitude,
      segmentLength,
      activeStart,
      activeLength,
      normalSign,
      normalRaise,
      pathHasCorners
    );
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "bumps") {
    appendNativeBumpsPolyline(
      commands,
      points,
      amplitude,
      segmentLength,
      activeStart,
      activeLength,
      normalSign,
      normalRaise,
      pathHasCorners
    );
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "bent") {
    appendNativeBentPolyline(
      commands,
      points,
      amplitude,
      aspect,
      activeStart,
      activeLength,
      normalSign,
      normalRaise
    );
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  if (mode === "random steps") {
    appendNativeRandomStepsPolyline(
      commands,
      points,
      amplitude,
      segmentLength,
      activeStart,
      activeLength,
      normalSign,
      normalRaise,
      pgfRandom
    );
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
  }
}

function appendNativeStraightZigzagPolyline(
  commands,
  points,
  amplitude,
  segmentLength,
  metaSegmentLength,
  activeStart,
  activeLength,
  normalSign = 1,
  normalRaise = 0
) {
  const pathLength = polylineLength(points);
  const finishDistance = activeStart + activeLength;
  const pointAt = (distance, transformed = false) => {
    const sample = pointOnPolyline(points, Math.max(0, Math.min(pathLength, distance)));
    if (!transformed || Math.abs(normalRaise) < 1e-12) return roundPoint(sample);
    const offset = normalSign * normalRaise;
    return {
      x: roundNumber(sample.x + sample.normal.x * offset),
      y: roundNumber(sample.y + sample.normal.y * offset)
    };
  };
  const pushLine = (next) => {
    const previous = commands.at(-1);
    if (previous && Math.hypot((previous.x ?? 0) - next.x, (previous.y ?? 0) - next.y) < 1e-9) return;
    const before = commands.at(-2);
    if (before && previous?.type === "lineTo" && Number.isFinite(before.x) && Number.isFinite(before.y)) {
      const ax = previous.x - before.x;
      const ay = previous.y - before.y;
      const bx = next.x - previous.x;
      const by = next.y - previous.y;
      const cross = ax * by - ay * bx;
      const scale = Math.max(1, Math.hypot(ax, ay) * Math.hypot(bx, by));
      if (Math.abs(cross) <= 1e-9 * scale && ax * bx + ay * by >= 0) {
        commands[commands.length - 1] = { type: "lineTo", x: next.x, y: next.y };
        return;
      }
    }
    commands.push({ type: "lineTo", x: next.x, y: next.y });
  };

  // `curveto` advances by one hundredth of the original input segment.
  // A nested invocation exposes only complete states to the next meta state;
  // its unconsumed fraction is recovered by the meta-decoration's final state.
  const curveStep = Math.max(pathLength / 100, 1e-12);
  let cursor = activeStart;
  const appendCurvetoChild = (requestedWidth, transformed) => {
    const available = Math.max(0, finishDistance - cursor);
    const width = Math.min(Math.max(0, requestedWidth), available);
    const stateCount = Math.floor((width + 1e-10) / curveStep);
    const consumed = Math.min(available, stateCount * curveStep);
    for (let index = 0; index < stateCount; index += 1) {
      pushLine(pointAt(cursor + index * curveStep, transformed));
    }
    cursor += consumed;
    pushLine(pointAt(cursor));
  };

  const appendZigzagChild = (requestedWidth) => {
    const available = Math.max(0, finishDistance - cursor);
    const halfSegment = segmentLength / 2;
    const width = Math.min(Math.max(0, requestedWidth), available);
    const stateCount = Math.floor((width + 1e-10) / halfSegment);
    for (let index = 0; index < stateCount; index += 1) {
      const stateOrigin = cursor + index * halfSegment;
      const sample = pointOnPolyline(points, stateOrigin);
      const tangent = { x: sample.normal.y, y: -sample.normal.x };
      const phase = index % 2 === 0 ? 1 : -1;
      pushLine({
        x: roundNumber(sample.x + tangent.x * segmentLength / 4 + sample.normal.x * phase * amplitude),
        y: roundNumber(sample.y + tangent.y * segmentLength / 4 + sample.normal.y * phase * amplitude)
      });
    }
    cursor += Math.min(available, stateCount * halfSegment);
    pushLine(pointAt(cursor));
  };

  let nominalRemaining = activeLength;
  let useCurveto = true;
  let firstChild = true;
  while (nominalRemaining + 1e-10 >= metaSegmentLength) {
    if (useCurveto) appendCurvetoChild(metaSegmentLength, firstChild);
    else appendZigzagChild(metaSegmentLength);
    nominalRemaining = Math.max(0, nominalRemaining - metaSegmentLength);
    useCurveto = !useCurveto;
    firstChild = false;
  }

  // The meta-decoration always finishes with curveto. Its final endpoint is
  // the raw decorated-path endpoint, which also cancels a first-child raise.
  appendCurvetoChild(nominalRemaining, firstChild);
  pushLine(pointAt(finishDistance));
}

function appendNativeRandomStepsPolyline(
  commands,
  points,
  amplitude,
  segmentLength,
  activeStart,
  activeLength,
  normalSign = 1,
  normalRaise = 0,
  pgfRandom = createPgfRandom()
) {
  const pathLength = polylineLength(points);
  const walker = createPgfDecorationPathWalker(points, pathLength);
  walker.advance(activeStart);
  let remaining = activeLength;
  const automaticThreshold = 1.5 * segmentLength;

  const statePoint = (sample, xOffset, yOffset) => {
    const tangent = { x: sample.normal.y, y: -sample.normal.x };
    const transformedY = normalSign * (normalRaise + yOffset);
    return {
      x: roundNumber(sample.x + tangent.x * xOffset + sample.normal.x * transformedY),
      y: roundNumber(sample.y + tangent.y * xOffset + sample.normal.y * transformedY)
    };
  };
  const pushLine = (point) => commands.push({ type: "lineTo", x: point.x, y: point.y });

  while (remaining > 1e-12) {
    const stateOrigin = walker.frame();
    if (remaining <= automaticThreshold + 1e-12) {
      pushLine(statePoint(stateOrigin, remaining, 0));
      walker.advance(remaining);
      break;
    }

    // The declaration persistently enables path-has-corners, so every input
    // segment boundary uses the same 1.5-segment automatic-corner threshold.
    const segmentRemaining = walker.inputSegmentRemainingDistance();
    if (segmentRemaining > 1e-12 && segmentRemaining <= automaticThreshold + 1e-12) {
      pushLine(statePoint(stateOrigin, segmentRemaining, 0));
      walker.advance(segmentRemaining);
      remaining -= segmentRemaining;
      continue;
    }

    pushLine(statePoint(
      stateOrigin,
      segmentLength + pgfRandom.rand() * amplitude,
      pgfRandom.rand() * amplitude
    ));
    walker.advance(segmentLength);
    remaining -= segmentLength;
  }
}

function appendNativeSawPolyline(
  commands,
  points,
  amplitude,
  segmentLength,
  activeStart,
  activeLength,
  normalSign = 1,
  normalRaise = 0,
  pathHasCorners = false
) {
  const pathLength = polylineLength(points);
  const walker = createPgfDecorationPathWalker(points, pathLength);
  walker.advance(activeStart);
  let remaining = activeLength;

  const statePoint = (sample, xOffset, yOffset) => {
    const tangent = { x: sample.normal.y, y: -sample.normal.x };
    const transformedY = normalSign * (normalRaise + yOffset);
    return {
      x: roundNumber(sample.x + tangent.x * xOffset + sample.normal.x * transformedY),
      y: roundNumber(sample.y + tangent.y * xOffset + sample.normal.y * transformedY)
    };
  };
  const pushLine = (point) => commands.push({ type: "lineTo", x: point.x, y: point.y });

  while (remaining > 1e-12) {
    const stateOrigin = walker.frame();
    // `auto end on length` executes before the state's code. It paints the
    // short remainder along the current tangent, with the additional TikZ
    // transform still installed, then enters saw's empty final state.
    if (remaining <= segmentLength + 1e-12) {
      pushLine(statePoint(stateOrigin, remaining, 0));
      walker.advance(remaining);
      break;
    }

    // PGF only activates `auto corner on length` when the caller explicitly
    // sets `path has corners`. The automaton reaches the corner without a
    // tooth and restarts the same state in the next input segment's frame.
    const segmentRemaining = walker.inputSegmentRemainingDistance();
    if (pathHasCorners && segmentRemaining > 1e-12 && segmentRemaining <= segmentLength + 1e-12) {
      pushLine(statePoint(stateOrigin, segmentRemaining, 0));
      walker.advance(segmentRemaining);
      remaining -= segmentRemaining;
      continue;
    }

    pushLine(statePoint(stateOrigin, segmentLength, amplitude));
    pushLine(statePoint(stateOrigin, segmentLength, 0));
    walker.advance(segmentLength);
    remaining -= segmentLength;
  }
}

function appendNativeBumpsPolyline(
  commands,
  points,
  amplitude,
  segmentLength,
  activeStart,
  activeLength,
  normalSign = 1,
  normalRaise = 0,
  pathHasCorners = false
) {
  const pathLength = polylineLength(points);
  const walker = createPgfDecorationPathWalker(points, pathLength);
  walker.advance(activeStart);
  let remaining = activeLength;
  const stateWidth = 0.5 * segmentLength;
  const automaticThreshold = 0.51 * segmentLength;

  const statePoint = (sample, xOffset, yOffset) => {
    const tangent = { x: sample.normal.y, y: -sample.normal.x };
    const transformedY = normalSign * (normalRaise + yOffset);
    return {
      x: roundNumber(sample.x + tangent.x * xOffset + sample.normal.x * transformedY),
      y: roundNumber(sample.y + tangent.y * xOffset + sample.normal.y * transformedY)
    };
  };
  const pushLine = (point) => commands.push({ type: "lineTo", x: point.x, y: point.y });
  const pushCurve = (sample, control1, control2, end) => {
    const c1 = statePoint(sample, ...control1);
    const c2 = statePoint(sample, ...control2);
    const target = statePoint(sample, ...end);
    commands.push({
      type: "curveTo",
      x1: c1.x,
      y1: c1.y,
      x2: c2.x,
      y2: c2.y,
      x: target.x,
      y: target.y
    });
  };

  while (remaining > 1e-12) {
    const stateOrigin = walker.frame();
    if (remaining <= automaticThreshold + 1e-12) {
      pushLine(statePoint(stateOrigin, remaining, 0));
      walker.advance(remaining);
      remaining = 0;
      break;
    }

    const segmentRemaining = walker.inputSegmentRemainingDistance();
    if (pathHasCorners && segmentRemaining > 1e-12 && segmentRemaining <= automaticThreshold + 1e-12) {
      pushLine(statePoint(stateOrigin, segmentRemaining, 0));
      walker.advance(segmentRemaining);
      remaining -= segmentRemaining;
      continue;
    }

    pushCurve(
      stateOrigin,
      [0, 0.555 * amplitude],
      [0.11125 * segmentLength, amplitude],
      [0.25 * segmentLength, amplitude]
    );
    pushCurve(
      stateOrigin,
      [0.38875 * segmentLength, amplitude],
      [stateWidth, 0.5 * amplitude],
      [stateWidth, 0]
    );
    walker.advance(stateWidth);
    remaining -= stateWidth;
  }

  // Unlike saw's empty final state, bumps explicitly reconnects to the
  // undecorated endpoint after the additional mirror/raise transform.
  const finishWalker = createPgfDecorationPathWalker(points, pathLength);
  finishWalker.advance(activeStart + activeLength);
  const finish = finishWalker.frame();
  pushLine({ x: roundNumber(finish.x), y: roundNumber(finish.y) });
}

function appendNativeBentPolyline(
  commands,
  points,
  amplitude,
  aspect,
  activeStart,
  activeLength,
  normalSign = 1,
  normalRaise = 0
) {
  const pathLength = polylineLength(points);
  const walker = createPgfDecorationPathWalker(points, pathLength);
  walker.advance(activeStart);
  let remaining = activeLength;

  const statePoint = (sample, xOffset, yOffset) => {
    const tangent = { x: sample.normal.y, y: -sample.normal.x };
    const transformedY = normalSign * (normalRaise + yOffset);
    return {
      x: roundNumber(sample.x + tangent.x * xOffset + sample.normal.x * transformedY),
      y: roundNumber(sample.y + tangent.y * xOffset + sample.normal.y * transformedY)
    };
  };

  while (remaining > 1e-12) {
    const stateWidth = walker.inputSegmentRemainingDistance();
    if (stateWidth <= 1e-12) break;

    // Bent has no automatic-end state. When a requested post length makes
    // this state wider than the active decoration range, PGF skips its code
    // and the line-like post state paints the remaining source segment.
    if (stateWidth > remaining + 1e-10) break;

    const stateOrigin = walker.frame();
    const control1 = statePoint(stateOrigin, aspect * stateWidth, amplitude);
    const control2 = statePoint(stateOrigin, (1 - aspect) * stateWidth, amplitude);
    const target = statePoint(stateOrigin, stateWidth, 0);
    commands.push({
      type: "curveTo",
      x1: control1.x,
      y1: control1.y,
      x2: control2.x,
      y2: control2.y,
      x: target.x,
      y: target.y
    });
    walker.advance(stateWidth);
    remaining -= stateWidth;
  }
}

function appendNativeCoilPolyline(
  commands,
  points,
  amplitude,
  segmentLength,
  aspect,
  activeStart,
  activeLength,
  normalSign = 1,
  normalRaise = 0
) {
  const pathLength = polylineLength(points);
  const walker = createPgfDecorationPathWalker(points, pathLength);
  walker.advance(activeStart);
  const finishWalker = createPgfDecorationPathWalker(points, pathLength);
  finishWalker.advance(activeStart + activeLength);
  const finishAt = finishWalker.frame();
  const statePoint = (sample, radialX, radialY, twelfths) => {
    const tangent = { x: sample.normal.y, y: -sample.normal.x };
    const xOffset = radialX * aspect * amplitude + twelfths * segmentLength / 12;
    // TikZ installs mirror before raise. PGF's post-multiplied transform
    // therefore mirrors the translation as well: y' = sign * (raise + y).
    const yOffset = normalSign * (normalRaise + radialY * amplitude);
    return {
      x: roundNumber(sample.x + tangent.x * xOffset + sample.normal.x * yOffset),
      y: roundNumber(sample.y + tangent.y * xOffset + sample.normal.y * yOffset)
    };
  };
  const pushCurve = (sample, control1, control2, end) => {
    const c1 = statePoint(sample, ...control1);
    const c2 = statePoint(sample, ...control2);
    const target = statePoint(sample, ...end);
    commands.push({
      type: "curveTo",
      x1: c1.x,
      y1: c1.y,
      x2: c2.x,
      y2: c2.y,
      x: target.x,
      y: target.y
    });
  };
  const appendHalfState = (sample) => {
    pushCurve(sample, [0, 0.555, 1], [0.445, 1, 2], [1, 1, 3]);
    pushCurve(sample, [1.555, 1, 4], [2, 0.555, 5], [2, 0, 6]);
  };
  const appendFullState = (sample) => {
    appendHalfState(sample);
    pushCurve(sample, [2, -0.555, 7], [1.555, -1, 8], [1, -1, 9]);
    pushCurve(sample, [0.445, -1, 10], [0, -0.555, 11], [0, 0, 12]);
  };

  const projectedDiameter = 2 * aspect * amplitude;
  const fullStateThreshold = 1.5 * segmentLength + projectedDiameter;
  let stateOrigin = 0;
  while (activeLength - stateOrigin >= fullStateThreshold - 1e-9) {
    appendFullState(walker.frame());
    walker.advance(segmentLength);
    stateOrigin += segmentLength;
  }

  appendHalfState(walker.frame());
  const previous = commands.at(-1);
  if (!previous || Math.hypot((previous.x ?? 0) - finishAt.x, (previous.y ?? 0) - finishAt.y) > 1e-9) {
    commands.push({ type: "lineTo", x: roundNumber(finishAt.x), y: roundNumber(finishAt.y) });
  }
}

export function appendNativeSnakePolyline(
  commands,
  points,
  amplitude,
  segmentLength,
  activeStart,
  activeLength,
  normalSign = 1,
  normalRaise = 0,
  useStateFrames = true
) {
  // The native snake decoration does not enable `auto corner on length`.
  // A state that crosses a polyline corner is therefore painted entirely in
  // the tangent frame at that state's origin. Sampling every control point
  // against the input polyline rotates a single Bezier segment midway through
  // a corner, which visibly kinks the snake. Keep the legacy snakes path
  // below: its historical endpoint behavior deliberately uses the older
  // per-sample compatibility path.
  if (useStateFrames) {
    appendNativeSnakePolylineInStateFrames(
      commands,
      points,
      amplitude,
      segmentLength,
      activeStart,
      activeLength,
      normalSign,
      normalRaise
    );
    return;
  }

  const point = (distance, normalOffset = 0) => {
    const sample = pointOnPolyline(points, activeStart + distance);
    return {
      x: roundNumber(sample.x + sample.normal.x * normalSign * (normalRaise + normalOffset)),
      y: roundNumber(sample.y + sample.normal.y * normalSign * (normalRaise + normalOffset))
    };
  };
  const pushCurve = (control1, control2, end) => {
    commands.push({ type: "curveTo", x1: control1.x, y1: control1.y, x2: control2.x, y2: control2.y, x: end.x, y: end.y });
  };
  const finishAt = pointOnPolyline(points, activeStart + activeLength);
  if (activeLength < 0.625 * segmentLength) {
    commands.push({ type: "lineTo", x: finishAt.x, y: finishAt.y });
    return;
  }

  // pgflibrarydecorations.pathmorphing: initial state of the native snake.
  pushCurve(
    point(0.125 * segmentLength, 0),
    point(0.1875 * segmentLength, amplitude),
    point(0.3125 * segmentLength, amplitude)
  );

  let distance = 0.3125 * segmentLength;
  let phase = 1;
  while (activeLength - distance >= 0.8125 * segmentLength) {
    const quarter = 0.25 * segmentLength;
    // These are the native PGF \pgfpathcosine / \pgfpathsine coefficients.
    pushCurve(
      point(distance + 0.362 * quarter, phase * amplitude),
      point(distance + 0.674 * quarter, phase * amplitude * 0.512),
      point(distance + quarter, 0)
    );
    pushCurve(
      point(distance + quarter + 0.326 * quarter, -phase * amplitude * 0.512),
      point(distance + quarter + 0.638 * quarter, -phase * amplitude),
      point(distance + 2 * quarter, -phase * amplitude)
    );
    distance += 2 * quarter;
    phase *= -1;
  }

  // pgflibrarydecorations.pathmorphing: end down/end up followed by final.
  pushCurve(
    point(distance + 0.125 * segmentLength, phase * amplitude),
    point(distance + 0.1875 * segmentLength, 0),
    point(distance + 0.3125 * segmentLength, 0)
  );
  distance += 0.3125 * segmentLength;
  if (activeLength - distance > 1e-9) commands.push({ type: "lineTo", x: finishAt.x, y: finishAt.y });
}

function appendNativeSnakePolylineInStateFrames(
  commands,
  points,
  amplitude,
  segmentLength,
  activeStart,
  activeLength,
  normalSign = 1,
  normalRaise = 0
) {
  const inputPoint = (distance) => pointOnPolyline(points, activeStart + distance);
  const finishAt = inputPoint(activeLength);
  const pushCurve = (control1, control2, end) => {
    commands.push({ type: "curveTo", x1: control1.x, y1: control1.y, x2: control2.x, y2: control2.y, x: end.x, y: end.y });
  };
  const statePoint = (stateOrigin, stateStart, xOffset, yOffset, raise = 0) => {
    const sample = inputPoint(stateOrigin);
    const tangent = { x: sample.normal.y, y: -sample.normal.x };
    const transformedY = normalSign * (raise + yOffset);
    return {
      x: roundNumber(stateStart.x + tangent.x * xOffset + sample.normal.x * transformedY),
      y: roundNumber(stateStart.y + tangent.y * xOffset + sample.normal.y * transformedY)
    };
  };
  const currentPoint = () => {
    const current = commands.at(-1);
    return { x: Number(current?.x) || 0, y: Number(current?.y) || 0 };
  };

  if (activeLength < 0.625 * segmentLength) {
    commands.push({ type: "lineTo", x: roundNumber(finishAt.x), y: roundNumber(finishAt.y) });
    return;
  }

  let stateOrigin = 0;
  let stateStart = currentPoint();
  const initialPoint = (xOffset, yOffset) => statePoint(
    stateOrigin,
    stateStart,
    xOffset,
    yOffset,
    normalRaise
  );
  pushCurve(
    initialPoint(0.125 * segmentLength, 0),
    initialPoint(0.1875 * segmentLength, amplitude),
    initialPoint(0.3125 * segmentLength, amplitude)
  );

  stateOrigin = 0.3125 * segmentLength;
  let phase = 1;
  while (activeLength - stateOrigin >= 0.8125 * segmentLength) {
    stateStart = currentPoint();
    const quarter = 0.25 * segmentLength;
    const point = (xOffset, yOffset) => statePoint(stateOrigin, stateStart, xOffset, yOffset);
    // `down` and `up` use two relative cosine/sine halves in this state
    // frame. The y offsets below are relative to the state entry point.
    pushCurve(
      point(0.362 * quarter, 0),
      point(0.674 * quarter, -phase * amplitude * 0.488),
      point(quarter, -phase * amplitude)
    );
    pushCurve(
      point(quarter + 0.326 * quarter, -phase * amplitude * 1.512),
      point(quarter + 0.638 * quarter, -phase * amplitude * 2),
      point(2 * quarter, -phase * amplitude * 2)
    );
    stateOrigin += 2 * quarter;
    phase *= -1;
  }

  stateStart = currentPoint();
  const finalPoint = (xOffset, yOffset) => statePoint(stateOrigin, stateStart, xOffset, yOffset);
  pushCurve(
    finalPoint(0.125 * segmentLength, 0),
    finalPoint(0.1875 * segmentLength, -phase * amplitude),
    finalPoint(0.3125 * segmentLength, -phase * amplitude)
  );
  stateOrigin += 0.3125 * segmentLength;
  if (activeLength - stateOrigin > 1e-9) {
    commands.push({ type: "lineTo", x: roundNumber(finishAt.x), y: roundNumber(finishAt.y) });
  }
}

export function appendNativeZigzagPolyline(commands, points, amplitude, segmentLength, activeStart, activeLength, normalSign = 1, normalRaise = 0) {
  const inputPoint = (distance) => {
    const sample = pointOnPolyline(points, activeStart + Math.max(0, Math.min(activeLength, distance)));
    return sample;
  };
  const statePoint = (stateOrigin, xOffset = 0, yOffset = 0) => {
    const sample = inputPoint(stateOrigin);
    const tangent = { x: sample.normal.y, y: -sample.normal.x };
    return {
      x: roundNumber(sample.x + tangent.x * xOffset + sample.normal.x * normalSign * (normalRaise + yOffset)),
      y: roundNumber(sample.y + tangent.y * xOffset + sample.normal.y * normalSign * (normalRaise + yOffset))
    };
  };
  const pushLineTo = (next) => {
    const previous = commands.at(-1);
    if (previous && Math.hypot((previous.x ?? 0) - next.x, (previous.y ?? 0) - next.y) < 1e-9) return;
    commands.push({ type: "lineTo", x: next.x, y: next.y });
  };
  const finishAt = inputPoint(activeLength);
  const halfSegment = segmentLength / 2;
  if (activeLength < halfSegment - 1e-9) {
    pushLineTo(finishAt);
    return;
  }

  // pgflibrarydecorations.pathmorphing.code.tex declares `zigzag` as an
  // `up from center` state followed by alternating `big down` / `big up`
  // states. Each state has width segmentLength / 2 and places its apex at
  // its local quarter point. If less than a half state remains, PGF emits
  // `center finish` at the state origin, then joins the actual endpoint.
  pushLineTo(statePoint(0, segmentLength / 4, amplitude));
  let stateOrigin = halfSegment;
  let phase = -1;
  while (activeLength - stateOrigin >= halfSegment - 1e-9) {
    pushLineTo(statePoint(stateOrigin, segmentLength / 4, phase * amplitude));
    stateOrigin += halfSegment;
    phase *= -1;
  }
  pushLineTo(statePoint(stateOrigin));
  pushLineTo(finishAt);
}

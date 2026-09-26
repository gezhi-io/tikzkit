import { cubicPointAt, cubicTangentAt } from "../../engine/geometry.js";
import { parseDimension, roundPoint } from "../../engine/math.js";

export function polylineLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

export function flattenDecorationPath(commands) {
  const points = [];
  const tolerance = parseDimension("1pt", {});
  let current = null;
  let start = null;

  const pushLineEnd = (point) => {
    points.push(roundPoint(point));
    current = point;
  };
  const pushCurve = (from, control1, control2, to) => {
    appendDecorationCubicSamples(points, from, control1, control2, to, tolerance);
    current = to;
  };

  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      points.push(roundPoint(current));
      continue;
    }
    if (command.type === "lineTo" && current) {
      pushLineEnd({ x: command.x, y: command.y });
      continue;
    }
    if (command.type === "quadTo" && current) {
      const control = { x: command.x1, y: command.y1 };
      const to = { x: command.x, y: command.y };
      pushCurve(
        current,
        {
          x: current.x + (2 / 3) * (control.x - current.x),
          y: current.y + (2 / 3) * (control.y - current.y)
        },
        {
          x: to.x + (2 / 3) * (control.x - to.x),
          y: to.y + (2 / 3) * (control.y - to.y)
        },
        to
      );
      continue;
    }
    if (command.type === "curveTo" && current) {
      pushCurve(
        current,
        { x: command.x1, y: command.y1 },
        { x: command.x2, y: command.y2 },
        { x: command.x, y: command.y }
      );
      continue;
    }
    if (command.type === "closePath" && current && start) {
      pushLineEnd(start);
    }
  }

  return points;
}

function appendDecorationCubicSamples(points, from, control1, control2, to, tolerance) {
  const curve = { from, control1, control2, to };
  const appendPiece = (piece, t0, t1, depth) => {
    const smallChord = Math.abs(piece.to.x - piece.from.x) < tolerance
      && Math.abs(piece.to.y - piece.from.y) < tolerance;
    if ((depth > 0 && smallChord) || depth >= 18) {
      points.push({
        ...roundPoint(piece.to),
        decorationCurve: curve,
        decorationT0: t0,
        decorationT1: t1
      });
      return;
    }
    const [left, right] = splitDecorationCubic(piece);
    const middle = (t0 + t1) / 2;
    appendPiece(left, t0, middle, depth + 1);
    appendPiece(right, middle, t1, depth + 1);
  };

  // PGF always begins its curve-length calculation with one subdivision,
  // even when the cubic starts and ends at the same point.
  appendPiece(curve, 0, 1, 0);
}

function splitDecorationCubic({ from, control1, control2, to }) {
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const p01 = midpoint(from, control1);
  const p12 = midpoint(control1, control2);
  const p23 = midpoint(control2, to);
  const p012 = midpoint(p01, p12);
  const p123 = midpoint(p12, p23);
  const middle = midpoint(p012, p123);
  return [
    { from, control1: p01, control2: p012, to: middle },
    { from: middle, control1: p123, control2: p23, to }
  ];
}

export function pointOnPolyline(points, distance) {
  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength < 1e-12) continue;
    if (walked + segmentLength >= distance - 1e-12) {
      const local = Math.max(0, Math.min(1, (distance - walked) / segmentLength));
      const curve = current.decorationCurve;
      if (curve) {
        const time = current.decorationT0 + (current.decorationT1 - current.decorationT0) * local;
        const point = cubicPointAt(curve.from, curve.control1, curve.control2, curve.to, time);
        const tangent = cubicTangentAt(curve.from, curve.control1, curve.control2, curve.to, time);
        if (tangent) {
          return {
            ...point,
            walked: walked + segmentLength * local,
            normal: { x: -tangent.y, y: tangent.x }
          };
        }
      }
      return {
        x: previous.x + dx * local,
        y: previous.y + dy * local,
        walked: walked + segmentLength * local,
        normal: { x: -dy / segmentLength, y: dx / segmentLength }
      };
    }
    walked += segmentLength;
  }
  const last = points.at(-1) || { x: 0, y: 0 };
  const previous = points.at(-2) || last;
  const dx = last.x - previous.x;
  const dy = last.y - previous.y;
  const segmentLength = Math.hypot(dx, dy) || 1;
  const curve = last.decorationCurve;
  if (curve) {
    const point = cubicPointAt(curve.from, curve.control1, curve.control2, curve.to, last.decorationT1);
    const tangent = cubicTangentAt(curve.from, curve.control1, curve.control2, curve.to, last.decorationT1);
    if (tangent) {
      return {
        ...point,
        walked,
        normal: { x: -tangent.y, y: tangent.x }
      };
    }
  }
  return {
    x: last.x,
    y: last.y,
    walked,
    normal: { x: -dy / segmentLength, y: dx / segmentLength }
  };
}

export function createPgfDecorationPathWalker(points, currentPathLength) {
  const segments = decorationPathSegments(points);
  let segmentIndex = 0;
  let segmentDistance = 0;
  let curveTime = 0;
  let currentPoint = points[0] || { x: 0, y: 0 };
  let currentNormal = decorationSegmentNormal(segments[0], 0, { x: 0, y: 1 });

  const installFrame = (segment, time) => {
    if (!segment) return;
    if (segment.type === "curve") {
      currentPoint = cubicPointAt(
        segment.curve.from,
        segment.curve.control1,
        segment.curve.control2,
        segment.curve.to,
        time
      );
      currentNormal = decorationSegmentNormal(segment, time, currentNormal);
      return;
    }
    const fraction = segment.length > 1e-12 ? segmentDistance / segment.length : 1;
    currentPoint = {
      x: segment.from.x + (segment.to.x - segment.from.x) * fraction,
      y: segment.from.y + (segment.to.y - segment.from.y) * fraction
    };
    currentNormal = decorationSegmentNormal(segment, fraction, currentNormal);
  };

  const advance = (requestedDistance) => {
    let distance = Math.max(0, requestedDistance);
    while (distance > 1e-12 && segmentIndex < segments.length) {
      const segment = segments[segmentIndex];
      const remaining = Math.max(0, segment.length - segmentDistance);
      if (distance < remaining - 1e-12) {
        segmentDistance += distance;
        if (segment.type === "curve") {
          curveTime = pgfDecorationCurveTimeAfterDistance(
            segment.curve,
            curveTime,
            distance,
            currentPathLength
          );
        }
        installFrame(segment, curveTime);
        distance = 0;
        break;
      }

      distance = Math.max(0, distance - remaining);
      currentPoint = segment.to;
      segmentIndex += 1;
      segmentDistance = 0;
      curveTime = 0;
      const next = segments[segmentIndex];
      if (next) {
        currentPoint = next.from;
        currentNormal = decorationSegmentNormal(next, 0, currentNormal);
      } else {
        currentNormal = decorationSegmentNormal(segment, 1, currentNormal);
      }
    }
  };

  return {
    advance,
    inputSegmentRemainingDistance: () => {
      const segment = segments[segmentIndex];
      return segment ? Math.max(0, segment.length - segmentDistance) : 0;
    },
    frame: () => ({
      x: currentPoint.x,
      y: currentPoint.y,
      normal: { ...currentNormal }
    })
  };
}

function decorationPathSegments(points) {
  const segments = [];
  let index = 1;
  while (index < points.length) {
    const current = points[index];
    if (!current.decorationCurve) {
      const from = points[index - 1];
      const length = Math.hypot(current.x - from.x, current.y - from.y);
      segments.push({ type: "line", from, to: current, length });
      index += 1;
      continue;
    }

    const curve = current.decorationCurve;
    const from = points[index - 1];
    let length = 0;
    let endIndex = index;
    while (endIndex < points.length && points[endIndex].decorationCurve === curve) {
      const previous = points[endIndex - 1];
      const end = points[endIndex];
      length += Math.hypot(end.x - previous.x, end.y - previous.y);
      endIndex += 1;
    }
    segments.push({ type: "curve", from, to: points[endIndex - 1], curve, length });
    index = endIndex;
  }
  return segments;
}

function decorationSegmentNormal(segment, time, fallback) {
  if (!segment) return fallback;
  let tangent;
  if (segment.type === "curve") {
    tangent = cubicTangentAt(segment.curve.from, segment.curve.control1, segment.curve.control2, segment.curve.to, time);
  } else {
    const dx = segment.to.x - segment.from.x;
    const dy = segment.to.y - segment.from.y;
    const length = Math.hypot(dx, dy);
    tangent = length > 1e-12 ? { x: dx / length, y: dy / length } : null;
  }
  return tangent ? { x: -tangent.y, y: tangent.x } : fallback;
}

function pgfDecorationCurveTimeAfterDistance(curve, startTime, requestedDistance, currentPathLength) {
  const oneScaledPoint = 1 / 65536;
  const pt128 = parseDimension("128pt", {});
  const pt512 = parseDimension("512pt", {});
  const pt2048 = parseDimension("2048pt", {});
  let step = currentPathLength < pt128
    ? 1 / 32
    : currentPathLength < pt512
      ? 1 / 64
      : currentPathLength < pt2048
        ? 1 / 256
        : 1 / 1024;
  let direction = 1;
  let time = startTime;
  let walked = 0;
  let previous = cubicPointAt(curve.from, curve.control1, curve.control2, curve.to, time);

  for (let iteration = 0; iteration < 64 && step >= oneScaledPoint; iteration += 1) {
    time += direction * step;
    const point = cubicPointAt(curve.from, curve.control1, curve.control2, curve.to, time);
    const chord = Math.hypot(point.x - previous.x, point.y - previous.y);
    walked += direction * chord;
    previous = point;
    if ((direction > 0 && walked > requestedDistance) || (direction < 0 && walked < requestedDistance)) {
      direction *= -1;
      step /= 2;
    }
  }
  return time;
}

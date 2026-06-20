import { roundNumber, roundPoint } from "./math.js";

const EPSILON = 1e-9;

export function lineLineIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < EPSILON) return null;
  const px =
    ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) /
    denominator;
  const py =
    ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) /
    denominator;
  const point = roundPoint({ x: px, y: py });
  if (!isBetween(point, a, b) || !isBetween(point, c, d)) return null;
  return point;
}

export function lineCircleIntersections(a, b, center, radius) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - center.x;
  const fy = a.y - center.y;
  const qa = dx * dx + dy * dy;
  const qb = 2 * (fx * dx + fy * dy);
  const qc = fx * fx + fy * fy - radius * radius;
  const discriminant = qb * qb - 4 * qa * qc;
  if (discriminant < -EPSILON) return [];
  if (Math.abs(discriminant) < EPSILON) {
    const t = -qb / (2 * qa);
    return t >= -EPSILON && t <= 1 + EPSILON ? [roundPoint({ x: a.x + t * dx, y: a.y + t * dy })] : [];
  }
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)]
    .filter((t) => t >= -EPSILON && t <= 1 + EPSILON)
    .map((t) => roundPoint({ x: a.x + t * dx, y: a.y + t * dy }));
}

export function circleCircleIntersections(c0, r0, c1, r1) {
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy);
  if (d < EPSILON || d > r0 + r1 + EPSILON || d < Math.abs(r0 - r1) - EPSILON) return [];
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const hSquared = r0 * r0 - a * a;
  if (hSquared < -EPSILON) return [];
  const h = Math.sqrt(Math.max(0, hSquared));
  const xm = c0.x + (a * dx) / d;
  const ym = c0.y + (a * dy) / d;
  const rx = -(dy * h) / d;
  const ry = (dx * h) / d;
  const one = roundPoint({ x: xm + rx, y: ym + ry });
  if (h < EPSILON) return [one];
  const two = roundPoint({ x: xm - rx, y: ym - ry });
  return one.y >= two.y ? [one, two] : [two, one];
}

export function flattenPath(commands, tolerance = 0.02) {
  const points = [];
  let current = null;
  let start = null;
  const steps = Math.max(4, Math.ceil(1 / Math.max(0.01, tolerance)));

  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      points.push(current);
    } else if (command.type === "lineTo") {
      current = { x: command.x, y: command.y };
      points.push(current);
    } else if (command.type === "quadTo" && current) {
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        points.push(quadratic(current, command, t));
      }
      current = { x: command.x, y: command.y };
    } else if (command.type === "curveTo" && current) {
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        points.push(cubic(current, command, t));
      }
      current = { x: command.x, y: command.y };
    } else if (command.type === "closePath" && start) {
      current = start;
      points.push(start);
    }
  }

  return dedupeAdjacent(points.map((point) => roundPoint(point)));
}

export function pointAtLength(points, lengthOrRatio) {
  const total = pathLength(points);
  if (total < EPSILON) return { x: points[0]?.x || 0, y: points[0]?.y || 0, angle: 0 };
  const target = lengthOrRatio <= 1 ? total * lengthOrRatio : lengthOrRatio;
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const segmentLength = distance(previous, current);
    if (walked + segmentLength >= target - EPSILON) {
      const local = segmentLength < EPSILON ? 0 : (target - walked) / segmentLength;
      return {
        x: roundNumber(previous.x + (current.x - previous.x) * local),
        y: roundNumber(previous.y + (current.y - previous.y) * local),
        angle: roundNumber((Math.atan2(current.y - previous.y, current.x - previous.x) * 180) / Math.PI)
      };
    }
    walked += segmentLength;
  }
  const last = points.at(-1) || { x: 0, y: 0 };
  const previous = points.at(-2) || last;
  return {
    x: last.x,
    y: last.y,
    angle: roundNumber((Math.atan2(last.y - previous.y, last.x - previous.x) * 180) / Math.PI)
  };
}

export function pathIntersections(commandsA, commandsB) {
  const a = flattenPath(commandsA);
  const b = flattenPath(commandsB);
  const intersections = [];
  for (let i = 1; i < a.length; i += 1) {
    for (let j = 1; j < b.length; j += 1) {
      const point = lineLineIntersection(a[i - 1], a[i], b[j - 1], b[j]);
      if (point && !intersections.some((seen) => distance(seen, point) < 1e-6)) {
        intersections.push(point);
      }
    }
  }
  return intersections;
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

export function circleToPath(cx, cy, r) {
  const k = 0.5522847498307936;
  return [
    { type: "moveTo", x: cx + r, y: cy },
    { type: "curveTo", x1: cx + r, y1: cy + k * r, x2: cx + k * r, y2: cy + r, x: cx, y: cy + r },
    { type: "curveTo", x1: cx - k * r, y1: cy + r, x2: cx - r, y2: cy + k * r, x: cx - r, y: cy },
    { type: "curveTo", x1: cx - r, y1: cy - k * r, x2: cx - k * r, y2: cy - r, x: cx, y: cy - r },
    { type: "curveTo", x1: cx + k * r, y1: cy - r, x2: cx + r, y2: cy - k * r, x: cx + r, y: cy },
    { type: "closePath" }
  ];
}

function quadratic(start, command, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * command.x1 + t * t * command.x,
    y: mt * mt * start.y + 2 * mt * t * command.y1 + t * t * command.y
  };
}

function cubic(start, command, t) {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * start.x +
      3 * mt * mt * t * command.x1 +
      3 * mt * t * t * command.x2 +
      t * t * t * command.x,
    y:
      mt * mt * mt * start.y +
      3 * mt * mt * t * command.y1 +
      3 * mt * t * t * command.y2 +
      t * t * t * command.y
  };
}

function isBetween(point, a, b) {
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  );
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dedupeAdjacent(points) {
  const deduped = [];
  for (const point of points) {
    const previous = deduped.at(-1);
    if (!previous || distance(previous, point) > EPSILON) deduped.push(point);
  }
  return deduped;
}

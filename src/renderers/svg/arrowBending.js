import { formatSvgNumber as format } from "./format.js";

const EPSILON = 1e-9;
const CURVE_SAMPLES = 128;

export function curvedArrowPaint(tip, placed, terminal, side, unit = 1) {
  const bending = tip?.bending;
  if (!bending || !terminal) return null;
  const curve = terminalCurveInSvg(terminal, side, unit);
  if (!curve) return null;
  const lookup = cubicArcLookup(curve);
  const tipDistance = Number(placed?.curveDistance) || 0;
  const tipOffset = Number(tip.geometry?.logicalTipOffset ?? tip.geometry?.placement) || 0;

  if (bending.mode === "bend") {
    const mapped = bendArrowPath(tip.geometry?.path || "", (point) => {
      const sample = cubicAtDistance(lookup, tipDistance + tipOffset - point.x);
      const inward = sample.tangent;
      const normal = { x: inward.y, y: -inward.x };
      return {
        x: sample.point.x + normal.x * point.y,
        y: sample.point.y + normal.y * point.y
      };
    });
    return mapped ? { ...mapped, mode: "bend", strokeBoundsIncluded: false } : null;
  }

  const factor = Number.isFinite(Number(bending.factor)) ? Number(bending.factor) : 1;
  const span = bending.mode === "flexPrime"
    ? Number(tip.assemblyLength) || 0
    : Number(tip.geometry?.visualSpan ?? tip.assemblyLength) || 0;
  const front = cubicAtDistance(lookup, tipDistance);
  const back = cubicAtDistance(lookup, tipDistance + factor * span);
  let outward = normalizedVector(front.point.x - back.point.x, front.point.y - back.point.y);
  if (!outward) outward = { x: -front.tangent.x, y: -front.tangent.y };
  const normal = { x: -outward.y, y: outward.x };
  const origin = {
    x: front.point.x - outward.x * tipOffset,
    y: front.point.y - outward.y * tipOffset
  };
  const transform = {
    a: outward.x,
    b: outward.y,
    c: normal.x,
    d: normal.y,
    e: origin.x,
    f: origin.y
  };
  return {
    mode: bending.mode,
    path: tip.geometry?.path || "",
    transform,
    bounds: transformedBounds(tip.geometry?.bounds, transform),
    strokeBoundsIncluded: tip.geometry?.strokeBoundsIncluded === true
  };
}

export function curvedArrowTransformAttribute(paint) {
  const matrix = paint?.transform;
  if (!matrix) return "";
  return ` transform="matrix(${format(matrix.a)} ${format(matrix.b)} ${format(matrix.c)} ${format(matrix.d)} ${format(matrix.e)} ${format(matrix.f)})"`;
}

function terminalCurveInSvg(segment, side, unit) {
  const start = toSvgPoint(segment.start, unit);
  const end = toSvgPoint(segment.end, unit);
  const startControl = toSvgPoint(segment.startControl || segment.end, unit);
  const endControl = toSvgPoint(segment.endControl || segment.start, unit);
  return side === "start"
    ? [start, startControl, endControl, end]
    : [end, endControl, startControl, start];
}

function toSvgPoint(point, unit) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { x: point.x * unit, y: -point.y * unit };
}

function cubicArcLookup(curve) {
  const samples = [{ t: 0, distance: 0, point: cubicPoint(curve, 0) }];
  let distance = 0;
  for (let index = 1; index <= CURVE_SAMPLES; index += 1) {
    const t = index / CURVE_SAMPLES;
    const point = cubicPoint(curve, t);
    const previous = samples.at(-1).point;
    distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    samples.push({ t, distance, point });
  }
  return { curve, samples, length: distance };
}

function cubicAtDistance(lookup, distance) {
  if (distance < 0) {
    const tangent = normalizedCubicTangent(lookup.curve, 0);
    return {
      point: {
        x: lookup.curve[0].x + tangent.x * distance,
        y: lookup.curve[0].y + tangent.y * distance
      },
      tangent
    };
  }
  if (distance > lookup.length) {
    const tangent = normalizedCubicTangent(lookup.curve, 1);
    const end = lookup.curve[3];
    return {
      point: {
        x: end.x + tangent.x * (distance - lookup.length),
        y: end.y + tangent.y * (distance - lookup.length)
      },
      tangent
    };
  }
  let low = 0;
  let high = lookup.samples.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (lookup.samples[middle].distance < distance) low = middle;
    else high = middle;
  }
  const left = lookup.samples[low];
  const right = lookup.samples[high];
  const span = right.distance - left.distance;
  const ratio = span > EPSILON ? (distance - left.distance) / span : 0;
  const t = left.t + (right.t - left.t) * ratio;
  return { point: cubicPoint(lookup.curve, t), tangent: normalizedCubicTangent(lookup.curve, t) };
}

function cubicPoint([p0, p1, p2, p3], t) {
  const s = 1 - t;
  return {
    x: s * s * s * p0.x + 3 * s * s * t * p1.x + 3 * s * t * t * p2.x + t * t * t * p3.x,
    y: s * s * s * p0.y + 3 * s * s * t * p1.y + 3 * s * t * t * p2.y + t * t * t * p3.y
  };
}

function normalizedCubicTangent([p0, p1, p2, p3], t) {
  const s = 1 - t;
  let dx = 3 * s * s * (p1.x - p0.x) + 6 * s * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  let dy = 3 * s * s * (p1.y - p0.y) + 6 * s * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  if (Math.hypot(dx, dy) < EPSILON) {
    dx = p3.x - p0.x;
    dy = p3.y - p0.y;
  }
  return normalizedVector(dx, dy) || { x: 1, y: 0 };
}

function normalizedVector(x, y) {
  const length = Math.hypot(x, y);
  return length > EPSILON ? { x: x / length, y: y / length } : null;
}

function transformedBounds(bounds, matrix) {
  if (!bounds || !matrix) return null;
  const points = [
    transformPoint({ x: bounds.minX, y: bounds.minY }, matrix),
    transformPoint({ x: bounds.maxX, y: bounds.minY }, matrix),
    transformPoint({ x: bounds.maxX, y: bounds.maxY }, matrix),
    transformPoint({ x: bounds.minX, y: bounds.maxY }, matrix)
  ];
  return boundsFromPoints(points);
}

function transformPoint(point, matrix) {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  };
}

function bendArrowPath(path, mapPoint) {
  const commands = parseAbsolutePath(path);
  if (!commands) return null;
  const output = [];
  const points = [];
  let current = null;
  let subpathStart = null;
  for (const command of commands) {
    if (command.type === "M") {
      current = command.point;
      subpathStart = current;
      const mapped = mapPoint(current);
      points.push(mapped);
      output.push(`M ${format(mapped.x)} ${format(mapped.y)}`);
      continue;
    }
    if (!current) return null;
    if (command.type === "Z") {
      output.push("Z");
      current = subpathStart;
      continue;
    }
    const samples = sampledCommand(current, command);
    for (const point of samples) {
      const mapped = mapPoint(point);
      points.push(mapped);
      output.push(`L ${format(mapped.x)} ${format(mapped.y)}`);
    }
    current = command.point;
  }
  return { path: output.join(" "), bounds: boundsFromPoints(points) };
}

function sampledCommand(start, command) {
  const roughLength = command.type === "C"
    ? distance(start, command.control1) + distance(command.control1, command.control2) + distance(command.control2, command.point)
    : command.type === "Q"
      ? distance(start, command.control) + distance(command.control, command.point)
      : command.type === "A"
        ? Math.PI * Math.max(command.rx, command.ry)
        : distance(start, command.point);
  const count = Math.max(2, Math.min(40, Math.ceil(roughLength / 0.8)));
  const points = [];
  for (let index = 1; index <= count; index += 1) {
    const t = index / count;
    if (command.type === "C") {
      points.push(cubicPoint([start, command.control1, command.control2, command.point], t));
    } else if (command.type === "Q") {
      const s = 1 - t;
      points.push({
        x: s * s * start.x + 2 * s * t * command.control.x + t * t * command.point.x,
        y: s * s * start.y + 2 * s * t * command.control.y + t * t * command.point.y
      });
    } else if (command.type === "A") {
      points.push(arcPoint(start, command, t));
    } else {
      points.push({ x: start.x + (command.point.x - start.x) * t, y: start.y + (command.point.y - start.y) * t });
    }
  }
  return points;
}

function arcPoint(start, command, t) {
  if (Math.abs(command.rotation) > EPSILON || Math.abs(command.rx - command.ry) > EPSILON) {
    return { x: start.x + (command.point.x - start.x) * t, y: start.y + (command.point.y - start.y) * t };
  }
  const radius = Math.max(EPSILON, command.rx);
  const dx = command.point.x - start.x;
  const dy = command.point.y - start.y;
  const chord = Math.min(2 * radius, Math.hypot(dx, dy));
  const halfAngle = Math.asin(chord / (2 * radius));
  let sweep = command.largeArc ? 2 * Math.PI - 2 * halfAngle : 2 * halfAngle;
  if (!command.sweep) sweep = -sweep;
  const chordAngle = Math.atan2(dy, dx);
  const startAngle = chordAngle - sweep / 2 + (sweep > 0 ? -Math.PI / 2 : Math.PI / 2);
  const center = { x: start.x - radius * Math.cos(startAngle), y: start.y - radius * Math.sin(startAngle) };
  const angle = startAngle + sweep * t;
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

function parseAbsolutePath(path) {
  const tokens = String(path || "").match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
  const commands = [];
  let index = 0;
  let type = null;
  const number = () => Number(tokens[index++]);
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) type = tokens[index++].toUpperCase();
    if (type === "Z") {
      commands.push({ type: "Z" });
      type = null;
    } else if (type === "M" || type === "L") {
      commands.push({ type, point: { x: number(), y: number() } });
      if (type === "M") type = "L";
    } else if (type === "H") {
      commands.push({ type: "H", horizontal: number() });
    } else if (type === "V") {
      commands.push({ type: "V", vertical: number() });
    } else if (type === "C") {
      commands.push({ type, control1: { x: number(), y: number() }, control2: { x: number(), y: number() }, point: { x: number(), y: number() } });
    } else if (type === "Q") {
      commands.push({ type, control: { x: number(), y: number() }, point: { x: number(), y: number() } });
    } else if (type === "A") {
      commands.push({
        type,
        rx: Math.abs(number()),
        ry: Math.abs(number()),
        rotation: number(),
        largeArc: number() !== 0,
        sweep: number() !== 0,
        point: { x: number(), y: number() }
      });
    } else {
      return null;
    }
  }
  let current = null;
  for (const command of commands) {
    if (command.type === "M" || command.type === "L" || command.type === "C" || command.type === "Q" || command.type === "A") current = command.point;
    if (command.type === "H") {
      if (!current) return null;
      command.type = "L";
      command.point = { x: command.horizontal, y: current.y };
      current = command.point;
    }
    if (command.type === "V") {
      if (!current) return null;
      command.type = "L";
      command.point = { x: current.x, y: command.vertical };
      current = command.point;
    }
  }
  return commands;
}

function boundsFromPoints(points) {
  if (!points?.length) return null;
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

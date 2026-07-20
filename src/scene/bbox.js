export function emptyBoundingBox() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function includePoint(bounds, point) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
  return bounds;
}

export function finalizeBoundingBox(bounds, fallback = null) {
  return Number.isFinite(bounds.minX) ? bounds : fallback;
}

export function includePathCommandBounds(commands = [], include, options = {}) {
  let current = null;
  let start = null;
  for (const command of commands || []) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      includeFinitePoint(include, command.x, command.y);
      continue;
    }
    if (command.type === "lineTo") {
      current = { x: command.x, y: command.y };
      includeFinitePoint(include, command.x, command.y);
      continue;
    }
    if (command.type === "curveTo") {
      if (current && options.tightBezierBounds) {
        includeCubicBezierBounds(current, command, include);
      } else {
        includeFinitePoint(include, command.x1, command.y1);
        includeFinitePoint(include, command.x2, command.y2);
        includeFinitePoint(include, command.x, command.y);
      }
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "quadTo") {
      includeFinitePoint(include, command.x1, command.y1);
      includeFinitePoint(include, command.x, command.y);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && start) {
      includeFinitePoint(include, start.x, start.y);
      current = start;
      continue;
    }
    if ("x" in command && "y" in command) {
      includeFinitePoint(include, command.x, command.y);
      current = { x: command.x, y: command.y };
    }
  }
}

function includeFinitePoint(include, x, y) {
  if (Number.isFinite(x) && Number.isFinite(y)) include(x, y);
}

export function includeCubicBezierBounds(from, curve, include) {
  const p0 = from;
  const p1 = { x: curve.x1, y: curve.y1 };
  const p2 = { x: curve.x2, y: curve.y2 };
  const p3 = { x: curve.x, y: curve.y };
  includeFinitePoint(include, p0.x, p0.y);
  includeFinitePoint(include, p3.x, p3.y);
  for (const t of cubicExtremaParameters(p0.x, p1.x, p2.x, p3.x)) {
    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    includeFinitePoint(include, point.x, point.y);
  }
  for (const t of cubicExtremaParameters(p0.y, p1.y, p2.y, p3.y)) {
    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    includeFinitePoint(include, point.x, point.y);
  }
}

export function cubicExtremaParameters(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) >= 1e-12) roots.push(-c / b);
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= -1e-12) {
      const sqrt = Math.sqrt(Math.max(0, discriminant));
      roots.push((-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a));
    }
  }
  return roots.filter((t) => t > 1e-9 && t < 1 - 1e-9);
}

export function cubicBezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: p0.x * a + p1.x * b + p2.x * c + p3.x * d,
    y: p0.y * a + p1.y * b + p2.y * c + p3.y * d
  };
}

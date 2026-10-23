// Read the viewport used by the browser, not the interpreter's intended bounds.
// A separate paint-only screenshot keeps labels/legend samples out of the curve gate.
// This audit targets the two long red/blue curves in the cos-fixpoint fixture.
export async function captureClippedCurves(page, file) {
  const viewport = await page.evaluate(() => {
    const paths = [...document.querySelectorAll("svg path")].filter(p => {
      const stroke = getComputedStyle(p).stroke;
      return !p.closest("defs") && ["rgb(0, 0, 255)", "rgb(255, 0, 0)"].includes(stroke)
        && (p.getAttribute("d") || "").length > 100;
    });
    if (paths.length !== 2) throw new Error(`Expected two colored curve paths, found ${paths.length}`);
    const clips = paths.map(p => {
      const group = p.closest("[clip-path]");
      const id = group?.getAttribute("clip-path").match(/url\(#([^)]*)\)/)?.[1];
      const shape = document.getElementById(id)?.firstElementChild;
      if (!shape) throw new Error("Curve clip not found");
      const b = shape.getBBox();
      const matrix = group.getScreenCTM();
      const a = new DOMPoint(b.x, b.y).matrixTransform(matrix);
      const z = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(matrix);
      return { x: Math.min(a.x, z.x), y: Math.min(a.y, z.y), width: Math.abs(a.x - z.x), height: Math.abs(a.y - z.y) };
    });
    if (Object.keys(clips[0]).some(k => Math.abs(clips[0][k] - clips[1][k]) > 0.01)) {
      throw new Error("The two curves have different clipping rectangles");
    }
    for (const e of document.querySelectorAll("svg path,svg rect,svg circle,svg ellipse,svg polygon,svg polyline,svg line,svg text,svg use,svg foreignObject")) {
      if (e.closest("defs") || paths.includes(e)) continue;
      e.setAttribute("data-audit-visibility", e.style.visibility);
      e.style.visibility = "hidden";
    }
    const svg = document.querySelector("svg").getBoundingClientRect();
    return { ...clips[0], x: clips[0].x - svg.x, y: clips[0].y - svg.y };
  });
  let png;
  try {
    png = await page.locator("svg").first().screenshot({ path: file });
  } finally {
    await page.evaluate(() => document.querySelectorAll("[data-audit-visibility]").forEach(e => {
      e.style.visibility = e.getAttribute("data-audit-visibility");
      e.removeAttribute("data-audit-visibility");
    }));
  }
  return { viewport, png };
}

export function curvePaintPoints(image, viewport) {
  const colors = { red: [], blue: [] };
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const [r, g, b, a] = image.data.subarray(i, i + 4);
      if (a < 128 || g > 100) continue;
      const color = r > 180 && b < 100 ? "red" : b > 180 && r < 100 ? "blue" : null;
      if (color) colors[color].push({ x: x + 0.5 - viewport.x, y: y + 0.5 - viewport.y });
    }
  }
  return colors;
}

export function compareCurvePaint(actual, reference, tolerancePx = 2) {
  const coverage = (a, b) => {
    const buckets = new Map();
    for (const p of b) {
      const key = `${Math.floor(p.x / tolerancePx)},${Math.floor(p.y / tolerancePx)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(p);
    }
    const matched = a.filter(p => {
      const x = Math.floor(p.x / tolerancePx), y = Math.floor(p.y / tolerancePx);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (buckets.get(`${x + dx},${y + dy}`)?.some(q => Math.hypot(p.x - q.x, p.y - q.y) <= tolerancePx)) return true;
      }
      return false;
    }).length;
    return a.length ? matched / a.length : 0;
  };
  return Object.fromEntries(["red", "blue"].map(color => [color, {
    actualPixels: actual[color].length, referencePixels: reference[color].length,
    actualCoverage: coverage(actual[color], reference[color]),
    referenceCoverage: coverage(reference[color], actual[color])
  }]));
}

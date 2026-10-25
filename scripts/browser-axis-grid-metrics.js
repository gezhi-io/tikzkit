// Browser geometry in physical CSS pixels. Alignment is a single translation
// by the crossing of the two middle axes, never fitting each label. Cairo can
// tighten a PDF clip to the painted curve's bbox, so it is not an axis origin.
export async function captureAxisGrid(page, { frame = "middle" } = {}) {
  return page.evaluate(({ frame }) => {
    const svg = document.querySelector("svg");
    const datavis = frame.startsWith("datavis-");
    const axisStroke = ["datavis-clean", "datavis-box"].includes(frame) ? "rgb(128, 128, 128)" : "rgb(0, 0, 0)";
    const axes = [...svg.querySelectorAll("path")].flatMap(p => {
      if (p.closest("defs") || getComputedStyle(p).stroke !== axisStroke) return [];
      const match = (p.getAttribute("d") || "").match(/^\s*M\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*L\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*$/i);
      if (!match) return [];
      const matrix = p.getScreenCTM();
      const a = new DOMPoint(Number(match[1]), Number(match[2])).matrixTransform(matrix);
      const b = new DOMPoint(Number(match[3]), Number(match[4])).matrixTransform(matrix);
      return Math.hypot(b.x - a.x, b.y - a.y) > 20 ? [{ a, b }] : [];
    });
    const horizontal = axes.filter(p => Math.abs(p.a.y - p.b.y) < 0.01);
    const vertical = axes.filter(p => Math.abs(p.a.x - p.b.x) < 0.01);
    // A fraction rule is also a black M-L path. Only the actual axes cross
    // within both line segments, so legend fractions cannot move the origin.
    const between = (n, a, b) => n >= Math.min(a, b) - 0.01 && n <= Math.max(a, b) + 0.01;
    const crossings = horizontal.flatMap(h => vertical.filter(v =>
      between(v.a.x, h.a.x, h.b.x) && between(h.a.y, v.a.y, v.b.y)
    ).map(v => ({ x: v.a.x, y: h.a.y })));
    let origin;
    let frameBox;
    if (datavis) {
      // DV clean axes deliberately stop short of their supporting-line
      // crossing. Use the axis shafts, not the data border or picture crop.
      const longest = lines => [...lines].sort((a, b) =>
        Math.hypot(b.b.x - b.a.x, b.b.y - b.a.y) - Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y))[0];
      const h = longest(horizontal), v = longest(vertical);
      const closedBox = frame === "datavis-box" && [...svg.querySelectorAll("path")]
        .filter(p => !p.closest("defs") && getComputedStyle(p).stroke === axisStroke &&
          /z/i.test(p.getAttribute("d") || "") && !/[cqast]/i.test(p.getAttribute("d") || ""))
        .map(p => p.getBoundingClientRect()).filter(b => b.width > 20 && b.height > 20)
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (closedBox) {
        origin = { x: closedBox.left, y: closedBox.bottom };
        frameBox = { width: closedBox.width, height: closedBox.height };
      } else {
        if (!h || !v) throw new Error("Datavisualization axis shafts not found");
        origin = frame === "datavis-box"
          ? { x: Math.min(...vertical.map(v => v.a.x)), y: Math.max(...horizontal.map(h => h.a.y)) }
          : { x: v.a.x, y: h.a.y };
        frameBox = { width: Math.abs(h.b.x - h.a.x), height: Math.abs(v.b.y - v.a.y) };
      }
    } else if (frame === "3d") {
      if (!axes.length) throw new Error("Projected axis edges not found");
      const points = axes.flatMap(edge => [edge.a, edge.b]);
      const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x));
      const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y));
      origin = { x: left, y: bottom };
      frameBox = { width: right - left, height: bottom - top };
    } else if (frame === "box") {
      const frames = [...svg.querySelectorAll("path")].filter(p => {
        if (p.closest("defs") || getComputedStyle(p).stroke !== "rgb(0, 0, 0)") return false;
        const d = p.getAttribute("d") || "";
        if (!/z/i.test(d) || /[cqast]/i.test(d)) return false;
        const box = p.getBoundingClientRect();
        return box.width > 20 && box.height > 20;
      }).map(p => p.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height);
      if (!frames.length) throw new Error("Box axis frame not found");
      frameBox = { width: frames[0].width, height: frames[0].height };
      origin = { x: frames[0].x, y: frames[0].bottom };
    } else if (frame === "middle-extended") {
      // At an upper-limit crossing both shafts stop before their arrow tips.
      // Their supporting lines still define one origin. These fixtures also
      // have shorter annotation/legend rules, so require a unique longest
      // shaft per direction rather than snapping to the picture's crop.
      const longest = lines => {
        const sorted = lines.map(line => ({ ...line, length: Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) }))
          .sort((a, b) => b.length - a.length);
        if (!sorted.length || (sorted[1] && sorted[0].length - sorted[1].length < 0.01)) throw new Error("Ambiguous axis shaft");
        return sorted[0];
      };
      origin = { x: longest(vertical).a.x, y: longest(horizontal).a.y };
    } else {
      if (crossings.length !== 1) throw new Error("Expected exactly one middle axis crossing");
      origin = crossings[0];
    }
    const svgBounds = svg.getBoundingClientRect();
    const result = { alignment: `${frame === "3d" ? "Projected box southwest corner" : frame === "box" ? "Box southwest corner" : "Middle axis crossing"}; translation only`,
      frame: frameBox,
      canvas: frameBox ? { left: svgBounds.left - origin.x, right: svgBounds.right - origin.x,
        top: svgBounds.top - origin.y, bottom: svgBounds.bottom - origin.y } : undefined,
      origin: { x: origin.x - svgBounds.x, y: origin.y - svgBounds.y }, ticks: [], grids: [], glyphs: [] };
    for (const path of svg.querySelectorAll("path")) {
      if (path.closest("defs")) continue;
      const style = getComputedStyle(path);
      const rgb = style.stroke.match(/^rgb\((\d+), (\d+), (\d+)\)$/)?.slice(1).map(Number);
      const isGray = rgb && rgb[0] === rgb[1] && rgb[1] === rgb[2];
      const datavisTick = datavis && style.strokeLinecap === "round";
      if (datavis ? !datavisTick && !(isGray && rgb[0] > 128 && rgb[0] < 255)
        : !isGray || rgb[0] < 128 || rgb[0] >= 255) continue;
      const d = path.getAttribute("d") || "";
      // A gray faceted surface may share the grid color. Closed polygons
      // are mesh paint, never the straight open tick/grid subpaths below.
      if (/z/i.test(d)) continue;
      const pattern = /M\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*L\s*([-\d.e+]+)[ ,]+([-\d.e+]+)/gi;
      if (d.replace(pattern, "").trim()) {
        // Native default arrow barbs are round-cap cubic paths too. This
        // pass measures straight tick/grid segments, not curved arrow paint.
        if (datavis) continue;
        throw new Error("Expected straight tick/grid subpaths");
      }
      const transform = path.getScreenCTM();
      const scale = Math.hypot(transform.a, transform.b);
      for (const match of d.matchAll(pattern)) {
        const start = new DOMPoint(Number(match[1]), Number(match[2])).matrixTransform(transform);
        const end = new DOMPoint(Number(match[3]), Number(match[4])).matrixTransform(transform);
        const segment = { x: (start.x + end.x) / 2 - origin.x, y: (start.y + end.y) / 2 - origin.y,
          length: Math.hypot(start.x - end.x, start.y - end.y),
          ...(frame === "3d" ? { dx: Math.abs(end.x - start.x),
            dy: (Math.abs(end.x - start.x) < 0.001 ? Math.sign(end.y - start.y) : Math.sign(end.x - start.x)) * (end.y - start.y) } : {}),
          vertical: Math.abs(end.x - start.x) < Math.abs(end.y - start.y),
          strokeWidth: parseFloat(style.strokeWidth) * scale, gray: rgb[0],
          ...(datavis ? { color: style.stroke } : {}) };
        result[(datavis ? datavisTick : rgb[0] === 128) ? "ticks" : "grids"].push(segment);
      }
    }
    if (frame === "3d") {
      // Shared corners are painted more than once by PGF's six surface
      // passes. Compare the unique visible segments, not PDF batching.
      for (const key of ["ticks", "grids"]) result[key] = result[key].filter((s, i, all) =>
        !all.slice(0, i).some(other => ["x", "y", "length", "dx", "dy", "gray"].every(k => Math.abs(s[k] - other[k]) < 0.025)));
    }
    result.glyphs = [...svg.querySelectorAll("text, use")].filter(el => !el.closest("defs")).flatMap(el => {
      const matrix = el.getScreenCTM();
      let baselineShift = 0;
      if (el.tagName.toLowerCase() === "text" && getComputedStyle(el).dominantBaseline === "middle") {
        // Chromium's character positions include text-anchor, but not the
        // dominant-baseline adjustment. Measure that adjustment from the
        // same loaded font instead of assuming a particular x-height.
        const originalY = el.getBBox().y;
        const savedStyle = el.getAttribute("style");
        el.style.setProperty("dominant-baseline", "alphabetic", "important");
        baselineShift = originalY - el.getBBox().y;
        if (savedStyle === null) el.removeAttribute("style");
        else el.setAttribute("style", savedStyle);
      }
      const positions = el.tagName.toLowerCase() === "text"
        ? Array.from({ length: el.getNumberOfChars() }, (_, i) => el.getStartPositionOfChar(i))
        : [{ x: Number(el.getAttribute("x")), y: Number(el.getAttribute("y")) }];
      return positions.map(position => {
        const p = new DOMPoint(position.x, position.y + baselineShift).matrixTransform(matrix);
        return { x: p.x - origin.x, y: p.y - origin.y };
      });
    });
    if (!result.glyphs.length) {
      // Tickless plots have no glyph baseline to verify. Check every painted
      // primitive's extent/pen/color and the crop instead. Split fill/stroke
      // records let Cairo's separate paths match SVG's combined primitives.
      result.canvas = { left: svgBounds.left - origin.x, right: svgBounds.right - origin.x,
        top: svgBounds.top - origin.y, bottom: svgBounds.bottom - origin.y };
      result.unlabeledPaint = [...svg.querySelectorAll("path,circle,ellipse,rect,polygon,polyline,line")]
        .filter(el => !el.closest("defs")).flatMap(el => {
          const style = getComputedStyle(el), box = el.getBoundingClientRect(), matrix = el.getScreenCTM();
          if ((!box.width && !box.height) || style.visibility === "hidden" || style.display === "none") return [];
          return ["fill", "stroke"].flatMap(paint => {
            const opacity = Number(style.opacity) * Number(paint === "fill" ? style.fillOpacity : style.strokeOpacity);
            if (style[paint] === "none" || !opacity || (paint === "fill" && (!box.width || !box.height))) return [];
            return [{ paint, color: style[paint], opacity, x: box.x - origin.x, y: box.y - origin.y,
              width: box.width, height: box.height,
              strokeWidth: paint === "stroke" ? parseFloat(style.strokeWidth) * Math.hypot(matrix.a, matrix.b) : 0 }];
          });
        });
    }
    return result;
  }, { frame });
}

export function axisAlignedViewport(panels, padding = 20) {
  const x = Math.ceil(Math.max(...panels.map(p => p.origin.x)) + padding);
  const y = Math.ceil(Math.max(...panels.map(p => p.origin.y)) + padding);
  return { x, y,
    width: Math.ceil(x + Math.max(...panels.map(p => p.width - p.origin.x)) + padding),
    height: Math.ceil(y + Math.max(...panels.map(p => p.height - p.origin.y)) + padding) };
}

export function compareAxisGrid(actual, reference, tolerancePx = 0.35) {
  const compareLines = key => {
    const remaining = [...reference[key]];
    let maxErrorPx = 0;
    let maxGrayError = 0;
    let matchingColors = true;
    for (const segment of actual[key]) {
      let best = -1, distance = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const ref = remaining[i];
        if (ref.vertical !== segment.vertical) continue;
        const keys = ["x", "y", "length", "strokeWidth", ...(segment.dx === undefined ? [] : ["dx", "dy"])];
        const error = Math.max(...keys.map(k => Math.abs(ref[k] - segment[k])));
        if (error < distance) { distance = error; best = i; }
      }
      if (best < 0) { maxErrorPx = Infinity; continue; }
      maxGrayError = Math.max(maxGrayError, Math.abs(segment.gray - remaining[best].gray));
      if (remaining[best].color !== undefined && segment.color !== remaining[best].color) matchingColors = false;
      maxErrorPx = Math.max(maxErrorPx, distance);
      remaining.splice(best, 1);
    }
    // A no-grid axis has an intentionally empty reference line set. Still
    // reject any added/missing lines; glyph/frame checks reject blank output.
    const accepted = actual[key].length === reference[key].length && !remaining.length &&
      maxErrorPx < tolerancePx && maxGrayError <= 1 && matchingColors;
    return { count: actual[key].length, referenceCount: reference[key].length,
      maxErrorPx: Number.isFinite(maxErrorPx) ? maxErrorPx : null, maxGrayError, matchingColors, accepted };
  };
  const matchingGlyphs = reference.glyphs.length > 0 && actual.glyphs.length === reference.glyphs.length;
  const glyphErrorPx = matchingGlyphs ? Math.max(0, ...actual.glyphs.flatMap((p, i) =>
    [Math.abs(p.x - reference.glyphs[i].x), Math.abs(p.y - reference.glyphs[i].y)])) : null;
  const ticks = compareLines("ticks"), grids = compareLines("grids");
  const extentError = (actual, reference) => actual && reference
    ? Math.max(...Object.keys(reference).map(key => Math.abs(actual[key] - reference[key]))) : null;
  const frameErrorPx = extentError(actual.frame, reference.frame);
  const canvasErrorPx = extentError(actual.canvas, reference.canvas);
  const matchingBox = (!reference.frame || (frameErrorPx !== null && frameErrorPx < tolerancePx)) &&
    (!reference.canvas || (canvasErrorPx !== null && canvasErrorPx < tolerancePx));
  let unlabeledPaint;
  if (!reference.glyphs.length) {
    const remaining = [...(reference.unlabeledPaint || [])];
    let maxErrorPx = 0;
    for (const shape of actual.unlabeledPaint || []) {
      let best = -1, distance = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const ref = remaining[i];
        if (ref.paint !== shape.paint || ref.color !== shape.color || ref.opacity !== shape.opacity) continue;
        const error = Math.max(...["x", "y", "width", "height", "strokeWidth"].map(k => Math.abs(shape[k] - ref[k])));
        if (error < distance) { distance = error; best = i; }
      }
      maxErrorPx = Math.max(maxErrorPx, distance);
      if (best >= 0) remaining.splice(best, 1);
    }
    const count = actual.unlabeledPaint?.length || 0, referenceCount = reference.unlabeledPaint?.length || 0;
    unlabeledPaint = { count, referenceCount, maxErrorPx: Number.isFinite(maxErrorPx) ? maxErrorPx : null,
      scope: "Painted primitive extents, colors and pen widths; curve shape still requires visual review",
      accepted: referenceCount > 0 && count === referenceCount && !remaining.length && maxErrorPx < tolerancePx &&
        !actual.glyphs.length && canvasErrorPx !== null && canvasErrorPx < tolerancePx };
  }
  return { ticks, grids, glyphs: actual.glyphs.length, referenceGlyphs: reference.glyphs.length,
    glyphErrorPx, frameErrorPx, canvasErrorPx, unlabeledPaint, tolerancePx,
    accepted: matchingBox && ticks.accepted && grids.accepted &&
      (matchingGlyphs && glyphErrorPx < tolerancePx || unlabeledPaint?.accepted === true) };
}

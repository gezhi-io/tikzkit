import katex from "katex";
import { mathFallbackText, normalizeTikzText } from "./tex-text.js";
import {
  TIKZ_ARROW,
  TIKZ_DISPLAY_MATH_FONT_SIZE,
  TIKZ_FONT_FAMILY,
  TIKZ_MARGIN,
  TIKZ_TEXT_FONT_SIZE,
  TIKZ_UNIT,
  createArrowTip
} from "./tikz-metrics.js";

export function renderSvg(ir, options = {}) {
  const unit = options.unit || TIKZ_UNIT;
  const margin = options.margin ?? TIKZ_MARGIN;
  const bounds = computeBounds(ir.items || []);
  const view = {
    x: bounds.minX * unit - margin,
    y: -bounds.maxY * unit - margin,
    width: (bounds.maxX - bounds.minX) * unit + margin * 2,
    height: (bounds.maxY - bounds.minY) * unit + margin * 2
  };
  const viewBox = [format(view.x), format(view.y), format(view.width), format(view.height)].join(" ");

  const arrowMarkerDefs = collectArrowMarkerDefs(ir.items || []);
  const body = [];
  if (arrowMarkerDefs.length) {
    body.push(`<defs>${arrowMarkerDefs.map(renderArrowMarkerDef).join("")}</defs>`);
  }
  const background = options.background === undefined ? "white" : options.background;
  if (background && background !== "none") {
    body.push(
      `<rect class="tikz-background" x="${format(view.x)}" y="${format(view.y)}" width="${format(
        view.width
      )}" height="${format(view.height)}" fill="${escapeAttribute(String(background))}" />`
    );
  }
  for (const item of ir.items || []) {
    body.push(renderItem(item, unit, options));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${body
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join("\n")}\n</svg>\n`;
}

function renderItem(item, unit, options = {}) {
  if (item.type === "marker") return renderMarker(item, unit);
  if (item.type === "nodeBox") {
    if (item.shape === "circle" || item.shape === "ellipse") {
      return `<ellipse cx="${format(item.x * unit)}" cy="${format(-item.y * unit)}" rx="${format(
        (item.width / 2) * unit
      )}" ry="${format((item.height / 2) * unit)}"${styleAttributes(item.style)} />`;
    }
    if (item.shape === "rectangleSplit") return renderRectangleSplit(item, unit);
    return `<rect x="${format((item.x - item.width / 2) * unit)}" y="${format(
      -(item.y + item.height / 2) * unit
    )}" width="${format(item.width * unit)}" height="${format(item.height * unit)}" rx="${format(
      (item.rx || 0) * unit
    )}"${styleAttributes(item.style)} />`;
  }
  if (item.type === "textNode") {
    const normalized = normalizeTikzText(item.text);
    if (normalized.kind === "image") return renderImagePlaceholder(item, normalized, unit);
    const math = parseMathText(normalized.text);
    if (math) return renderMathNode(item, { ...math, scale: normalized.scale || 1, color: normalized.color }, unit, options);
    if (options.mathRenderer !== "svg-text" && hasInlineMath(normalized)) return renderRichTextNode(item, normalized, unit);
    return renderPlainTextNode(item, normalized, unit);
  }
  if (item.shape === "circle") {
    return `<circle cx="${format(item.cx * unit)}" cy="${format(-item.cy * unit)}" r="${format(
      item.r * unit
    )}"${styleAttributes(item.style)} />`;
  }
  if (item.shape === "ellipse") {
    return `<ellipse cx="${format(item.cx * unit)}" cy="${format(-item.cy * unit)}" rx="${format(
      item.rx * unit
    )}" ry="${format(item.ry * unit)}"${styleAttributes(item.style)} />`;
  }
  if (item.type === "path") {
    return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style)} />`;
  }
  return "";
}

function renderPlainTextNode(item, normalized, unit) {
  if (!normalized.color && hasTextColorSegments(normalized.raw)) return renderSegmentedTextNode(item, normalized, unit);
  const lines = (normalized.lines.length ? normalized.lines : [normalized.text]).map(formatTextLine);
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || TIKZ_FONT_FAMILY);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, lines);
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  if (lines.length <= 1) {
    return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
      fontSize
    )}" font-family="${fontFamily}">${escapeText(lines[0] || "")}</text>`;
  }
  const lineHeight = fontSize * 1.15;
  const startDy = -((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? startDy : lineHeight;
      return `<tspan x="${x}" dy="${format(dy)}">${escapeText(line)}</tspan>`;
    })
    .join("");
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    fontSize
  )}" font-family="${fontFamily}">${tspans}</text>`;
}

function renderSegmentedTextNode(item, normalized, unit) {
  const lines = splitTextLines(normalized.raw || normalized.text);
  const fallbackLines = (normalized.lines.length ? normalized.lines : lines).map(formatTextLine);
  const color = escapeAttribute(item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || TIKZ_FONT_FAMILY);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, fallbackLines);
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  const lineHeight = fontSize * 1.15;
  const startDy = -((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? startDy : lineHeight;
      const segments = parseTextColorSegments(line)
        .map((segment) => {
          const text = escapeText(formatTextLine(segment.text));
          if (!text) return "";
          return segment.color ? `<tspan fill="${escapeAttribute(segment.color)}">${text}</tspan>` : text;
        })
        .join("");
      return `<tspan x="${x}" dy="${format(dy)}">${segments}</tspan>`;
    })
    .join("");
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    fontSize
  )}" font-family="${fontFamily}">${tspans}</text>`;
}

function hasTextColorSegments(source) {
  return /\\textcolor\s*\{[^{}]+\}\s*\{[^{}]*\}/.test(String(source || ""));
}

function splitTextLines(source) {
  return String(source || "")
    .trim()
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bfseries|itshape|slshape|scshape)\b/g, "")
    .split(/\\\\|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);
}

function parseTextColorSegments(line) {
  const segments = [];
  const pattern = /\\textcolor\s*\{([^{}]+)\}\s*\{([^{}]*)\}/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(line))) {
    if (match.index > cursor) segments.push({ text: line.slice(cursor, match.index) });
    segments.push({ color: match[1].trim(), text: match[2] });
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) segments.push({ text: line.slice(cursor) });
  return segments.length ? segments : [{ text: line }];
}

function formatTextLine(line) {
  const math = parseMathText(line);
  if (math) return mathFallbackText(math.tex);
  return String(line).replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
}

function hasInlineMath(normalized) {
  const source = String(normalized.raw || normalized.text || "");
  return /\$[^$]+\$/.test(source);
}

function renderRichTextNode(item, normalized, unit) {
  const source = cleanRichTextSource(normalized.text || normalized.raw || "");
  const rawLines = source.split(/\\\\|\n/).map((line) => line.trim()).filter((line) => line.length);
  const lines = rawLines.length ? rawLines : normalized.lines.length ? normalized.lines : [normalized.text];
  const fallback = renderPlainTextNode(item, normalized, unit);
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || TIKZ_FONT_FAMILY);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, lines.map(formatTextLine));
  const box = estimateRichTextBox(lines, fontSize);
  const x = item.x * unit - box.width / 2;
  const y = -item.y * unit - box.height / 2;
  const htmlLines = lines
    .map((line) => `<div class="tikz-rich-line">${renderInlineMathHtml(line)}</div>`)
    .join("");
  const foreignObject = `<foreignObject requiredExtensions="http://www.w3.org/1999/xhtml" x="${format(x)}" y="${format(
    y
  )}" width="${format(box.width)}" height="${format(
    box.height
  )}"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-rich-text" style="width:${format(
    box.width
  )}px;height:${format(
    box.height
  )}px;color:${color};font-size:${format(
    fontSize
  )}px;line-height:1.05;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;white-space:nowrap;overflow:visible;font-family:${escapeAttribute(
    fontFamily
  )};">${htmlLines}</div></foreignObject>`;
  return `<switch>${foreignObject}${fallback}</switch>`;
}

function cleanRichTextSource(source) {
  return String(source)
    .trim()
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/\\dots/g, "...")
    .replace(/[ \t]+/g, " ");
}

function renderInlineMathHtml(line) {
  const parts = [];
  const pattern = /\$([^$]+)\$/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(line))) {
    if (match.index > cursor) parts.push(escapeHtml(line.slice(cursor, match.index)));
    parts.push(
      katex.renderToString(match[1].trim(), {
        displayMode: false,
        output: "html",
        throwOnError: false,
        strict: "ignore",
        trust: false
      })
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) parts.push(escapeHtml(line.slice(cursor)));
  return parts.join("");
}

function estimateRichTextBox(lines, fontSize) {
  const fallbackLines = lines.map(formatTextLine);
  const width = Math.max(42, Math.max(...fallbackLines.map((line) => line.length), 0) * fontSize * 0.52 + 18);
  const height = Math.max(fontSize * 1.15, lines.length * fontSize * 1.12);
  return { width, height };
}

function renderRectangleSplit(item, unit) {
  const parts = Math.max(1, Math.round(item.parts || 1));
  const x = (item.x - item.width / 2) * unit;
  const y = -(item.y + item.height / 2) * unit;
  const width = item.width * unit;
  const height = item.height * unit;
  const partWidth = width / parts;
  const lineWidth = item.style?.lineWidth ?? 1;
  const stroke = escapeAttribute(item.style?.stroke || "black");
  const fills = item.partFills || [];
  const partRects = Array.from({ length: parts }, (_, index) => {
    const fill = escapeAttribute(fills[index] || "none");
    return `<rect class="tikz-split-part" x="${format(x + index * partWidth)}" y="${format(y)}" width="${format(
      partWidth
    )}" height="${format(height)}" stroke="none" fill="${fill}" />`;
  }).join("");
  const separators = Array.from({ length: parts - 1 }, (_, index) => {
    const lineX = x + (index + 1) * partWidth;
    return `<path d="M ${format(lineX)} ${format(y)} L ${format(lineX)} ${format(
      y + height
    )}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
  }).join("");
  const outer = `<rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
    height
  )}" rx="${format((item.rx || 0) * unit)}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
  return `<g class="tikz-rectangle-split">${partRects}${separators}${outer}</g>`;
}

function renderImagePlaceholder(item, image, unit) {
  const width = image.width * unit;
  const height = image.height * unit;
  const x = item.x * unit - width / 2;
  const y = -item.y * unit - height / 2;
  const label = image.fileName.replace(/\.[^.]+$/, "");
  return `<g class="tikz-image-placeholder"><rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
    height
  )}" rx="${format(Math.min(width, height) * 0.08)}" stroke="#335c85" fill="#edf5ff" stroke-width="1.2" /><text x="${format(
    item.x * unit
  )}" y="${format(-item.y * unit)}" fill="#254b73" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    Math.max(10, Math.min(16, height * 0.22))
  )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(label)}</text></g>`;
}

function renderMathNode(item, math, unit, options = {}) {
  const box = estimateMathBox(math.tex, math.displayMode, unit, math.scale || 1);
  box.fontSize = fitFontSizeToBox(box.fontSize, item.fitBox, unit, [mathFallbackText(math.tex)]);
  const x = item.x * unit - box.width / 2;
  const y = -item.y * unit - box.height / 2;
  const color = escapeAttribute(math.color || item.style?.fill || "black");
  const fallback = `<text x="${format(item.x * unit)}" y="${format(-item.y * unit)}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    box.fontSize * 0.9
  )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(mathFallbackText(math.tex))}</text>`;
  if (options.mathRenderer === "svg-text") return fallback;

  const html = katex.renderToString(math.tex, {
    displayMode: math.displayMode,
    output: "html",
    throwOnError: false,
    strict: "ignore",
    trust: false
  });
  const foreignObject = `<foreignObject requiredExtensions="http://www.w3.org/1999/xhtml" x="${format(x)}" y="${format(
    y
  )}" width="${format(box.width)}" height="${format(
    box.height
  )}"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-math${
    math.displayMode ? " display" : ""
  }" style="width:${format(box.width)}px;height:${format(
    box.height
  )}px;color:${color};font-size:${format(
    box.fontSize
  )}px;line-height:1;display:flex;align-items:center;justify-content:center;overflow:visible;font-family:${escapeAttribute(
    TIKZ_FONT_FAMILY
  )};">${html}</div></foreignObject>`;
  return `<switch>${foreignObject}${fallback}</switch>`;
}

function renderMarker(item, unit) {
  const x = item.x * unit;
  const y = -item.y * unit;
  const angle = -item.angle;
  const fill = escapeAttribute(item.style?.fill || "black");
  return `<path d="${TIKZ_ARROW.standalonePath}" fill="${fill}" transform="translate(${format(x)} ${format(
    y
  )}) rotate(${format(angle)} ${format(x)} ${format(y)})" />`;
}

function pathData(commands, unit) {
  return commands
    .map((command) => {
      if (command.type === "moveTo") return `M ${format(command.x * unit)} ${format(-command.y * unit)}`;
      if (command.type === "lineTo") return `L ${format(command.x * unit)} ${format(-command.y * unit)}`;
      if (command.type === "quadTo") {
        return `Q ${format(command.x1 * unit)} ${format(-command.y1 * unit)} ${format(command.x * unit)} ${format(
          -command.y * unit
        )}`;
      }
      if (command.type === "curveTo") {
        return `C ${format(command.x1 * unit)} ${format(-command.y1 * unit)} ${format(command.x2 * unit)} ${format(
          -command.y2 * unit
        )} ${format(command.x * unit)} ${format(-command.y * unit)}`;
      }
      if (command.type === "closePath") return "Z";
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function parseMathText(value) {
  const text = String(value).trim();
  const displayDollar = text.match(/^\$\$([\s\S]+)\$\$$/);
  if (displayDollar) return { tex: displayDollar[1].trim(), displayMode: true };
  const inlineDollar = text.match(/^\$([^$]+)\$$/);
  if (inlineDollar) return { tex: inlineDollar[1].trim(), displayMode: false };
  const displayBracket = text.match(/^\\\[([\s\S]+)\\\]$/);
  if (displayBracket) return { tex: displayBracket[1].trim(), displayMode: true };
  const inlineParen = text.match(/^\\\(([\s\S]+)\\\)$/);
  if (inlineParen) return { tex: inlineParen[1].trim(), displayMode: false };
  return null;
}

function estimateMathBox(tex, displayMode, unit, scale = 1) {
  const fontSize = (displayMode ? TIKZ_DISPLAY_MATH_FONT_SIZE : TIKZ_TEXT_FONT_SIZE) * scale;
  const width = Math.max(displayMode ? 72 : 42, tex.length * fontSize * 0.62 + 24);
  const height = (displayMode ? 60 : 34) * scale;
  return {
    fontSize,
    width: Math.min(unit * 8, width),
    height
  };
}

function fitFontSizeToBox(baseFontSize, fitBox, unit, lines = [""]) {
  if (!fitBox) return baseFontSize;
  const boxWidth = Number(fitBox.width) * unit;
  const boxHeight = Number(fitBox.height) * unit;
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) return baseFontSize;

  const lineCount = Math.max(1, lines.length);
  const maxLineLength = Math.max(1, ...lines.map((line) => String(line || "").trim().length));
  const heightLimit = (boxHeight * 0.78) / lineCount;
  const widthLimit = boxWidth / (maxLineLength * 0.62);
  return Math.max(6, Math.min(baseFontSize, heightLimit, widthLimit));
}

function styleAttributes(style = {}) {
  const attrs = [
    ["stroke", style.stroke || "none"],
    ["fill", style.fill || "none"],
    ["stroke-width", style.lineWidth ?? 1]
  ];
  if (style.dashArray) attrs.push(["stroke-dasharray", style.dashArray.join(" ")]);
  if ((style.stroke || "none") !== "none") {
    attrs.push(["stroke-linecap", "round"]);
    attrs.push(["stroke-linejoin", "round"]);
  }
  if (Number.isFinite(style.opacity)) attrs.push(["opacity", style.opacity]);
  if (Number.isFinite(style.fillOpacity)) attrs.push(["fill-opacity", style.fillOpacity]);
  if (Number.isFinite(style.strokeOpacity)) attrs.push(["stroke-opacity", style.strokeOpacity]);
  if (style.markerStart) attrs.push(["marker-start", `url(#${arrowMarkerId(style.markerStart, style)})`]);
  if (style.markerEnd) attrs.push(["marker-end", `url(#${arrowMarkerId(style.markerEnd, style)})`]);
  return attrs.map(([key, value]) => ` ${key}="${escapeAttribute(String(value))}"`).join("");
}

function collectArrowMarkerDefs(items) {
  const defs = new Map();
  for (const item of items) {
    for (const key of ["markerStart", "markerEnd"]) {
      if (!item.style?.[key]) continue;
      const marker = resolvedArrowMarker(item.style[key], item.style);
      defs.set(marker.id, marker);
    }
  }
  return [...defs.values()];
}

function renderArrowMarkerDef(marker) {
  const halfWidth = marker.width / 2;
  const path =
    marker.kind === "stealth"
      ? `M 0 0 L ${format(marker.length)} ${format(halfWidth)} L 0 ${format(marker.width)} C ${format(
          marker.length * 0.22
        )} ${format(marker.width * 0.62)} ${format(marker.length * 0.22)} ${format(marker.width * 0.38)} 0 0 Z`
      : `M 0 0 L ${format(marker.length)} ${format(halfWidth)} L 0 ${format(marker.width)}`;
  const fill = marker.kind === "to" ? "none" : marker.fill;
  const strokeWidth = marker.kind === "to" ? Math.max(1, marker.lineWidth * 0.85) : Math.max(0.8, marker.lineWidth * 0.45);
  return `<marker id="${escapeAttribute(marker.id)}" markerWidth="${format(marker.length)}" markerHeight="${format(
    marker.width
  )}" refX="${format(marker.length)}" refY="${format(halfWidth)}" orient="auto-start-reverse" markerUnits="userSpaceOnUse" viewBox="0 0 ${format(
    marker.length
  )} ${format(marker.width)}"><path d="${path}" stroke="${escapeAttribute(marker.stroke)}" fill="${escapeAttribute(
    fill
  )}" stroke-width="${format(strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"/></marker>`;
}

function arrowMarkerId(tip, style = {}) {
  return resolvedArrowMarker(tip, style).id;
}

function resolvedArrowMarker(tip, style = {}) {
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, tip || {});
  const stroke = raw.stroke || (style.stroke === "none" ? "black" : style.stroke) || "black";
  const fill = raw.fill && raw.fill !== "context-stroke" ? raw.fill : stroke;
  const marker = {
    kind: raw.kind,
    length: raw.length,
    width: raw.width,
    lineWidth: style.lineWidth ?? 1,
    stroke,
    fill
  };
  marker.id = [
    "arrow",
    marker.kind,
    format(marker.length),
    format(marker.width),
    markerColorId(marker.stroke),
    markerColorId(marker.fill)
  ].join("-");
  return marker;
}

function markerColorId(value) {
  return String(value || "none")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function computeBounds(items) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  for (const item of items) {
    if (item.type === "nodeBox") {
      include(item.x - item.width / 2, item.y - item.height / 2);
      include(item.x + item.width / 2, item.y + item.height / 2);
    } else if (item.shape === "circle") {
      include(item.cx - item.r, item.cy - item.r);
      include(item.cx + item.r, item.cy + item.r);
    } else if (item.shape === "ellipse") {
      include(item.cx - item.rx, item.cy - item.ry);
      include(item.cx + item.rx, item.cy + item.ry);
    } else if (item.type === "textNode") {
      const normalized = normalizeTikzText(item.text);
      if (normalized.kind === "image") {
        include(item.x - normalized.width / 2, item.y - normalized.height / 2);
        include(item.x + normalized.width / 2, item.y + normalized.height / 2);
        continue;
      }
      const math = parseMathText(normalized.text);
      if (math) {
        const scale = normalized.scale || 1;
        const width = Math.max(math.displayMode ? 0.72 : 0.42, math.tex.length * 0.16 * scale + 0.24);
        const height = (math.displayMode ? 0.6 : 0.34) * scale;
        include(item.x - width / 2, item.y - height / 2);
        include(item.x + width / 2, item.y + height / 2);
      } else {
        const lines = (normalized.lines.length ? normalized.lines : [normalized.text]).map(formatTextLine);
        const width = Math.max(...lines.map((line) => line.length), 0) * 0.15 * (normalized.scale || 1);
        const height = lines.length * 0.35 * (normalized.scale || 1);
        include(item.x - width / 2, item.y - height / 2);
        include(item.x + width / 2, item.y + height / 2);
      }
    } else if (item.type === "marker") {
      include(item.x, item.y);
    } else if (item.type === "path") {
      for (const command of item.commands || []) {
        if ("x" in command && "y" in command) include(command.x, command.y);
        if ("x1" in command && "y1" in command) include(command.x1, command.y1);
        if ("x2" in command && "y2" in command) include(command.x2, command.y2);
      }
    }
  }

  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  if (bounds.minX === bounds.maxX) bounds.maxX += 1;
  if (bounds.minY === bounds.maxY) bounds.maxY += 1;
  return bounds;
}

function format(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

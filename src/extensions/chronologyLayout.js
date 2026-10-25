import { createFontSpec } from "../tex/fontSpec.js";
import { layoutNativeTextRun } from "../tex/textBox.js";
import { normalizeTikzText } from "../tikz/text.js";

const PT_PER_CM = 72.27 / 2.54;
const n = value => Number(value.toFixed(8));
const point = (x, y) => `(${n(x)}pt,${n(y)}pt)`;
const sp = value => Math.floor(value * 65536) / 65536;

// chronology.sty first typesets a complete TikZ picture, then resizebox scales
// that picture (including text, pens and arrows) to the requested width.
export function layoutChronologyBlock(block, options = {}) {
  const font = createFontSpec({ family: options.sans ? "sans-serif" : "serif", sizePt: 10 });
  const sep = 3.333, outer = .2;
  const delta = block.yearStop - block.yearStart;
  if (!(delta > 0) || delta > 10000 || !(block.step > 0) ||
    !Number.isFinite(block.step) || !(block.baseWidthCm > 0) || !(block.widthCm > 0)) return null;
  const unit = sp(block.baseWidthCm * PT_PER_CM / delta);
  const bounds = { minX: -.2, maxX: (delta + 1) * unit + .2, minY: -.2, maxY: .2 };
  const commands = [`\\draw[|->] (0,0) -- ${point((delta + 1) * unit, 0)};`];
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
  };
  const label = (text, x, y, anchor, rotate = 0) => {
    const box = text.trim() ? layoutNativeTextRun(normalizeTikzText(text), font) : { width: 0, height: 0, depth: 0 };
    if (!box) return false;
    const width = box.width + 2 * sep, height = box.height + box.depth + 2 * sep;
    const left = anchor.endsWith("west") ? outer : -width / 2;
    const bottom = anchor.startsWith("south") ? outer : -height - outer;
    const a = rotate * Math.PI / 180;
    for (const dx of [left, left + width]) for (const dy of [bottom, bottom + height]) {
      include(x + dx * Math.cos(a) - dy * Math.sin(a), y + dx * Math.sin(a) + dy * Math.cos(a));
    }
    commands.push(`\\node[anchor=${anchor},rotate=${rotate},inner sep=${sep}pt,outer sep=${outer}pt] at ${point(x, y)} {${text}};`);
    return true;
  };
  for (let year = 1; year <= delta; year++) {
    commands.push(`\\draw ${point(year * unit, -.1 * unit)} -- ${point(year * unit, .1 * unit)};`);
    include(year * unit, -.1 * unit - .2); include(year * unit, .1 * unit + .2);
  }
  const mod = (a, b) => ((a % b) + b) % b;
  const first = block.yearStart + block.step - mod(block.yearStart, block.step);
  const last = block.yearStop - mod(block.yearStop, block.step);
  for (let year = first; year <= last; year += block.step) {
    const x = (year - block.yearStart) * unit;
    commands.push(`\\draw ${point(x, -.3 * unit)} -- ${point(x, .3 * unit)};`);
    include(x, -.3 * unit - .2); include(x, .3 * unit + .2);
    if (!label(String(year), x, (block.flipped ? .2 : -.2) * unit, block.flipped ? "south" : "north")) return null;
  }
  for (const event of block.events) {
    const x = (event.endYear - block.yearStart) * unit, radius = .2 * unit;
    let labelX = x;
    if (Number.isFinite(event.startYear)) {
      const start = (event.startYear - block.yearStart) * unit;
      commands.push(`\\path[draw=none,fill=black,opacity=.5,rounded corners=${n(radius)}pt] ${point(start, -radius)} rectangle ${point(x, radius)};`);
      include(start, -radius); include(x, radius);
      labelX = (start + x) / 2;
    } else {
      commands.push(`\\path[draw=none,fill=black,opacity=.5] ${point(x, 0)} circle (${n(radius)}pt);`);
      include(x - radius, -radius); include(x + radius, radius);
    }
    // Even an empty event label has inner sep and contributes to the picture.
    if (!label(event.label, labelX, (block.flipped ? -1 : 1) * radius,
      block.flipped ? "north west" : "south west", block.flipped ? -45 : 45)) return null;
  }
  const scale = graphicsResizeRatio(block.widthCm * PT_PER_CM, bounds.maxX - bounds.minX);
  return { commands, bounds, scale, unit, width: (bounds.maxX - bounds.minX) * scale,
    height: (bounds.maxY - bounds.minY) * scale, font };
}

// graphics.sty Gscale@div uses integer scaled-point arithmetic. Its result
// differs slightly from floating division and scales every glyph position.
export function graphicsResizeRatio(target, natural) {
  let numerator = Math.round(target * 65536), count = 65536;
  while (count >= 2 && numerator < 8192 * 65536) {
    numerator *= 2;
    count = Math.trunc(count / 2);
  }
  return Math.trunc(numerator / Math.trunc(Math.round(natural * 65536) / count)) / 65536;
}

export function renderChronologyDocument(blocks, options = {}) {
  const boxes = blocks.map(block => layoutChronologyBlock(block, { sans: options.beamer }));
  if (boxes.some(box => !box)) return null;
  const commands = ["\\begin{tikzpicture}[tikzkit native math,tikzkit tex node anchors]"];
  const foreground = [];
  let left = 0, top = 0;
  if (options.beamer && options.metropolis) {
    const w = 12.8 * PT_PER_CM, h = 9.6 * PT_PER_CM;
    const textFont = createFontSpec({ family: "sans-serif", sizePt: 10 });
    const headerFont = { ...textFont, sizePt: 12, weight: 700 };
    const measure = (text, font) => layoutNativeTextRun(normalizeTikzText(text), font);
    const ex = measure("x", textFont).height;
    const padding = 2.2 * ex, titleHeight = options.title ? padding * 2 + measure("X", headerFont).height : 0;
    const progress = options.progress ? .4 : 0;
    const titleBox = titleHeight + progress + (options.title ? 2.5 : 0);
    // Colorbox evaluates its top sep before selecting scriptsize, and its
    // bottom sep afterwards. Beamer then reserves another 4pt for the foot.
    const footTop = 3 * measure("x", { ...textFont, sizePt: 5 }).height;
    const footBottom = 3 * measure("x", { ...textFont, sizePt: 7 }).height;
    const footNumber = measure("1", { ...textFont, sizePt: 7 });
    const footHeight = footTop + footBottom + footNumber.height + 4;
    const raise = 2 * ex, firstSkip = Math.max(1, 12 * 1.15 - raise);
    const gap = 5 + 1; // Metropolis parskip + TeX lineskip between deep boxes.
    const body = firstSkip + boxes.reduce((sum, box) => sum + box.height, 0) + gap * (boxes.length - 1);
    const free = Math.max(0, h - footHeight - titleBox - body);
    top = -titleBox - free / 2 - firstSkip;
    left = PT_PER_CM;
    commands.push(`\\path[fill=black!2] (0,0) rectangle ${point(w, -h)};`);
    if (options.title) {
      commands.push(`\\path[fill=#23373b] (0,0) rectangle ${point(w, -titleHeight)};`);
      commands.push(`\\node[anchor=base west,inner sep=0pt,outer sep=0pt,text=black!2,font=\\sffamily\\large\\bfseries] at ${point(padding, -padding - measure("X", headerFont).height)} {${options.title}};`);
    }
    if (progress) commands.push(`\\path[fill=#eb811b] ${point(0, -titleHeight)} rectangle ${point(w, -titleHeight - progress)};`);
    foreground.push(`\\node[anchor=base east,inner sep=0pt,outer sep=0pt,text=#23373b,font=\\sffamily\\scriptsize] at ${point(w - footTop, -h + footBottom)} {1};`);
    commands.push(`\\path[use as bounding box] (0,0) rectangle ${point(w, -h)};`);
  } else {
    const height = boxes.reduce((sum, box) => sum + box.height, 0) + 6 * (boxes.length - 1);
    commands.push(`\\path[use as bounding box] (0,0) rectangle ${point(Math.max(...boxes.map(box => box.width)), -height)};`);
  }
  for (const box of boxes) {
    commands.push(...renderChronologyBox(box, left, top, options.beamer, options.metropolis ? "#23373b" : "black"));
    top -= box.height + 6;
  }
  commands.push(...foreground, "\\end{tikzpicture}");
  return commands.join("\n");
}

export function renderChronologyBox(box, left, top, sans = false, color = "black") {
  const dx = left - box.bounds.minX * box.scale;
  const dy = top - box.bounds.maxY * box.scale;
  return [
    `\\begin{scope}[color=${color},font=${sans ? "\\sffamily" : "\\rmfamily"},transform canvas={xshift=${n(dx)}pt,yshift=${n(dy)}pt,scale=${n(box.scale)}}]`,
    ...box.commands,
    "\\end{scope}"
  ];
}

import { parseDimension, roundNumber } from "../math.js";
import { parseOptions } from "../options.js";

const PIXEL_FONT = {
  A: "01110/10001/10001/11111/10001/10001/10001",
  B: "11110/10001/10001/11110/10001/10001/11110",
  C: "01111/10000/10000/10000/10000/10000/01111",
  D: "11110/10001/10001/10001/10001/10001/11110",
  E: "11111/10000/10000/11111/10000/10000/11111",
  F: "11111/10000/10000/11110/10000/10000/10000",
  G: "01110/10001/10000/10111/10001/10001/01110",
  H: "10001/10001/10001/11111/10001/10001/10001",
  I: "111/010/010/010/010/010/111",
  J: "00111/00010/00010/00010/00010/10010/01100",
  K: "10001/10010/10100/11000/10100/10010/10001",
  L: "10000/10000/10000/10000/10000/10000/11111",
  M: "10001/11011/10101/10101/10001/10001/10001",
  N: "10001/11001/10101/10011/10001/10001/10001",
  O: "01110/10001/10001/10001/10001/10001/01110",
  P: "11110/10001/10001/11110/10000/10000/10000",
  Q: "01110/10001/10001/10001/10101/10010/01101",
  R: "11110/10001/10001/11110/10100/10010/10001",
  S: "01111/10000/10000/01110/00001/00001/11110",
  T: "11111/00100/00100/00100/00100/00100/00100",
  U: "10001/10001/10001/10001/10001/10001/01110",
  V: "10001/10001/10001/10001/10001/01010/00100",
  W: "10001/10001/10001/10101/10101/10101/01010",
  X: "10001/10001/01010/00100/01010/10001/10001",
  Y: "10001/10001/01010/00100/00100/00100/00100",
  Z: "11111/00001/00010/00100/01000/10000/11111",
  "0": "01110/10001/10011/10101/11001/10001/01110",
  "1": "010/110/010/010/010/010/111",
  "2": "01110/10001/00001/00010/00100/01000/11111",
  "3": "11110/00001/00001/00110/00001/00001/11110",
  "4": "00010/00110/01010/10010/11111/00010/00010",
  "5": "11111/10000/10000/11110/00001/00001/11110",
  "6": "00110/01000/10000/11110/10001/10001/01110",
  "7": "11111/00001/00010/00100/01000/01000/01000",
  "8": "01110/10001/10001/01110/10001/10001/01110",
  "9": "01110/10001/10001/01111/00001/00010/11100",
  "!": "1/1/1/1/1/0/1",
  "?": "01110/10001/00001/00010/00100/00000/00100",
  "+": "00000/00100/00100/11111/00100/00100/00000",
  "-": "00000/00000/00000/11111/00000/00000/00000",
  "=": "00000/00000/11111/00000/11111/00000/00000",
  ".": "00/00/00/00/00/11/11",
  ",": "00/00/00/00/01/11/10",
  "'": "11/11/01/10/00/00/00",
  "*": "00000/00100/10101/01110/10101/00100/00000",
  "/": "00001/00010/00010/00100/01000/01000/10000",
  ":": "00/11/11/00/11/11/00",
  ";": "00/11/11/00/01/11/10",
  "(": "001/010/100/100/100/010/001",
  ")": "100/010/001/001/001/010/100",
  "[": "111/100/100/100/100/100/111",
  "]": "111/001/001/001/001/001/111",
  "|": "1/1/1/1/1/1/1",
  " ": "000/000/000/000/000/000/000"
};

export const tikzDecofontsExtension = {
  name: "tikz-decofonts",
  phase: "preprocess",
  description: "Expands practical tikz-decofonts text decoration commands into ordinary TikZ drawings.",
  commands: [
    "tkzbrush",
    "tkzink",
    "tkzpixl",
    "tkzpixletter",
    "tkzpixlquote",
    "tkzbicolor",
    "tkzcomicbubble",
    "tkzsurround",
    "tkzunderline",
    "tkzfittextinarrow",
    "tkzcircledtxt"
  ],
  preprocess(source, context = {}) {
    return expandTikzDecofonts(source, context.diagnostics || []);
  }
};

export function expandTikzDecofonts(source, diagnostics = []) {
  let output = "";
  let index = 0;
  const text = String(source);
  while (index < text.length) {
    const parsed = parseDecofontsCommand(text, index, diagnostics);
    if (!parsed) {
      output += text[index];
      index += 1;
      continue;
    }
    output += parsed.body;
    index = parsed.end;
  }
  return output;
}

function parseDecofontsCommand(source, index, diagnostics) {
  const match = source.slice(index).match(/^\\(tkzbrush|tkzink|tkzpixlquote|tkzpixletter|tkzpixl|tkzbicolor|tkzcomicbubble|tkzsurround|tkzunderline|tkzfittextinarrow|tkzcircledtxt)\b/);
  if (!match) return null;
  const name = match[1];
  let cursor = index + match[0].length;
  cursor = skipWhitespace(source, cursor);
  const starred = source[cursor] === "*";
  if (starred) cursor = skipWhitespace(source, cursor + 1);

  const optional = readOptional(source, cursor, "[", "]");
  const optionsRaw = optional?.content || "";
  cursor = optional ? skipWhitespace(source, optional.end) : cursor;
  const angle = readOptional(source, cursor, "<", ">");
  const tikzOptions = angle?.content || "";
  cursor = angle ? skipWhitespace(source, angle.end) : cursor;

  let argument = null;
  if (name !== "tkzpixlquote") {
    argument = extractBalanced(source, cursor, "{", "}");
    if (!argument) {
      diagnostics.push({ severity: "warning", message: `Malformed \\${name} command` });
      return { body: "", end: cursor };
    }
    cursor = argument.end;
  }

  const options = parseOptions(optionsRaw);
  const body = renderDecofontsCommand({ name, starred, options, tikzOptions, text: argument?.content || "" }, diagnostics);
  return { body, end: cursor };
}

function renderDecofontsCommand(command, diagnostics) {
  if (command.name === "tkzpixl") return renderPixelText(command, diagnostics);
  if (command.name === "tkzpixletter") return renderPixelText({ ...command, text: command.text.slice(0, 1) || " " }, diagnostics);
  if (command.name === "tkzpixlquote") return renderPixelText({ ...command, text: "'" }, diagnostics);
  if (command.name === "tkzbicolor") return renderBicolor(command);
  if (command.name === "tkzcomicbubble") return renderComicBubble(command);
  if (command.name === "tkzsurround") return renderSurround(command);
  if (command.name === "tkzunderline") return renderUnderline(command);
  if (command.name === "tkzfittextinarrow") return renderFitTextInArrow(command);
  if (command.name === "tkzcircledtxt") return renderCircledText(command);
  if (command.name === "tkzbrush") return renderBrushText(command, "brush");
  if (command.name === "tkzink") return renderBrushText(command, "ink");
  return "";
}

function renderPixelText({ options, tikzOptions, text }, diagnostics) {
  const height = length(options.height, 1.1);
  const offsetH = numeric(options.offseth, 1);
  const offsetV = numeric(options.offsetv, 2);
  const unit = height / (7 + offsetV * 2);
  const color = value(options.color, "black");
  const gridColor = value(options.gridcolor, "gray");
  const thick = length(options.thick, 0.01);
  const showGrid = booleanOption(options.gridafter);
  let x = 0;
  const commands = [];

  for (const char of String(text || "")) {
    const glyph = glyphRows(char, diagnostics);
    const width = glyph[0].length;
    if (showGrid) commands.push(...pixelGrid(x, width, unit, offsetH, offsetV, gridColor, thick));
    glyph.forEach((row, rowIndex) => {
      for (let col = 0; col < row.length; col += 1) {
        if (row[col] !== "1") continue;
        const x1 = x + col * unit;
        const y1 = (6 - rowIndex) * unit;
        commands.push(`\\fill[fill=${color},decofonts pixl] (${fmt(x1)},${fmt(y1)}) rectangle (${fmt(x1 + unit)},${fmt(y1 + unit)});`);
      }
    });
    x += (width + 1) * unit;
  }

  if (booleanOption(options.border)) {
    commands.push(`\\draw[decofonts pixl,line width=${fmt(thick)},draw=${color}] (${fmt(-offsetH * unit)},${fmt(-offsetV * unit)}) rectangle (${fmt(x)},${fmt((7 + offsetV) * unit)});`);
  }
  return picture(commands.join("\n"), tikzOptions);
}

function renderBicolor({ options, text }) {
  const [first = "red", second = "blue"] = String(options.colors || "red/blue").split("/");
  const cleaned = cleanupText(text);
  const style = String(options.style || "midh");
  const accent = style === "ellips" || style === "rect" ? `,draw=${second}` : "";
  const box = style === "ellips" ? "ellipse" : style === "rect" ? "rectangle,rounded corners=0.03cm" : "rectangle";
  return picture([
    `\\node[text=${first},inner sep=1pt] at (0,0) {${cleaned}};`,
    `\\node[text=${second},${box},inner sep=1pt${accent}] at (0,-0.42) {${cleaned}};`
  ].join("\n"));
}

function renderComicBubble({ starred, options, tikzOptions, text }) {
  const width = value(options.width, "4cm");
  const color = value(options.coltxt, "black");
  const frame = value(options.colframe, "black");
  const bg = options.colbg ? `,fill=${options.colbg}` : "";
  const rounded = booleanOption(options.rcorners) ? ",rounded corners" : "";
  const node = `\\node[rectangle,draw=${frame}${bg},very thick,text=${color},text width=${width},align=center,inner sep=1mm${rounded},decofonts comicbubble,${tikzOptions}] {${cleanupText(text)}};`;
  return starred ? node : picture(node);
}

function renderSurround({ options, text }) {
  const color = value(options.color, "red");
  const width = value(options.width, "1.25pt");
  const node = value(options.node, "AAAAZ");
  const cleaned = cleanupText(text);
  return picture([
    `\\node[inner sep=1pt] (${node}) at (0,0) {${cleaned}};`,
    `\\draw[decofonts surround,draw=${color},line width=${width},rounded corners=0.08cm] (${node}.north west) -- (${node}.south west) -- (${node}.south east) -- (${node}.north east) -- (${node}.north west);`
  ].join("\n"));
}

function renderUnderline({ options, text }) {
  const color = value(options.color, "red");
  const width = value(options.width, "1.25pt");
  const height = length(options.height, 1);
  const node = value(options.node, "AAAAZ");
  return picture([
    `\\node[inner sep=1pt] (${node}) at (0,0) {${cleanupText(text)}};`,
    `\\draw[decofonts underline,draw=${color},line width=${width}] (${node}.south west) .. controls (${fmt(-height * 0.18)},${fmt(-height * 0.28)}) and (${fmt(height * 0.18)},${fmt(-height * 0.44)}) .. (${node}.south east);`
  ].join("\n"));
}

function renderFitTextInArrow({ options, tikzOptions, text }) {
  const width = length(options.width, 2);
  const bigHeight = length(options.bheight, 0.8);
  const smallHeight = length(options.sheight, 0.4);
  const head = bigHeight * 0.866;
  const color = value(options.color, "gray");
  const txtColor = value(options.txtcolor, "white");
  const points = [
    [0, 0],
    [width, (bigHeight - smallHeight) / 2],
    [width, 0],
    [width + head, bigHeight / 2],
    [width, bigHeight],
    [width, (bigHeight + smallHeight) / 2],
    [0, bigHeight]
  ];
  return picture([
    `\\fill[fill=${color},draw=none,decofonts fit arrow] ${polygon(points)} -- cycle;`,
    `\\node[text=${txtColor},inner sep=0pt] at (${fmt(width * 0.52)},${fmt(bigHeight / 2)}) {${cleanupText(text)}};`
  ].join("\n"), tikzOptions);
}

function renderCircledText({ options, tikzOptions, text }) {
  const auto = numeric(options.auto, 0);
  const width = auto > 0 ? Math.max(0.42, (String(text).length + 0.8) * 0.22 * auto) : length(options.width, 0.805);
  const height = auto > 0 ? Math.max(0.45, 0.45 * numeric(options.vstretch, 1.5)) : length(options.height, 0.7);
  const fill = booleanOption(options.fill, true);
  const fillColor = value(options["fill color"], "lightgray!30");
  const ruleColor = value(options["rule color"], "black");
  const thickness = options["absolute thickness"] ? value(options["absolute thickness"], "1pt") : `${fmt(length(options.thickness, 0.05) * height)}cm`;
  return picture([
    `\\node[ellipse,draw=${ruleColor},line width=${thickness}${fill ? `,fill=${fillColor}` : ""},minimum width=${fmt(width)}cm,minimum height=${fmt(height)}cm,inner sep=0pt,decofonts circledtxt,${tikzOptions}] at (0,0) {${cleanupText(text)}};`
  ].join("\n"));
}

function renderBrushText({ options, tikzOptions, text }, variant) {
  const color = value(options.color, "black");
  const scale = numeric(options.scale, 1);
  const thickness = variant === "ink" ? value(options.thick, "3pt") : `${Math.max(0.6, numeric(options.lines, 12) / 8)}pt`;
  const cleaned = cleanupText(text).toUpperCase();
  return picture([
    `\\node[text=${color},inner sep=1pt] at (0,0) {\\Large\\bfseries ${cleaned}};`,
    `\\draw[draw=${color},line width=${thickness},opacity=0.35,decofonts ${variant}] (${fmt(-0.14 * cleaned.length * scale)},-0.22) -- (${fmt(0.14 * cleaned.length * scale)},-0.18);`
  ].join("\n"), tikzOptions);
}

function pixelGrid(x, width, unit, offsetH, offsetV, gridColor, thick) {
  const commands = [];
  const x1 = x - offsetH * unit;
  const x2 = x + (width + offsetH) * unit;
  const y1 = -offsetV * unit;
  const y2 = (7 + offsetV) * unit;
  for (let col = -offsetH; col <= width + offsetH; col += 1) {
    const gx = x + col * unit;
    commands.push(`\\draw[draw=${gridColor},line width=${fmt(thick)}] (${fmt(gx)},${fmt(y1)}) -- (${fmt(gx)},${fmt(y2)});`);
  }
  for (let row = -offsetV; row <= 7 + offsetV; row += 1) {
    const gy = row * unit;
    commands.push(`\\draw[draw=${gridColor},line width=${fmt(thick)}] (${fmt(x1)},${fmt(gy)}) -- (${fmt(x2)},${fmt(gy)});`);
  }
  return commands;
}

function glyphRows(char, diagnostics) {
  const key = PIXEL_FONT[char] ? char : PIXEL_FONT[char.toUpperCase()] ? char.toUpperCase() : null;
  if (!key) {
    diagnostics.push({ severity: "warning", message: `tikz-decofonts pixel glyph not supported: ${char}` });
    return PIXEL_FONT[" "].split("/");
  }
  return PIXEL_FONT[key].split("/");
}

function picture(body, options = "") {
  const rawOptions = String(options || "").trim();
  return `\\begin{tikzpicture}${rawOptions ? `[${rawOptions}]` : ""}\n${body}\n\\end{tikzpicture}`;
}

function polygon(points) {
  return points.map(([x, y]) => `(${fmt(x)},${fmt(y)})`).join(" -- ");
}

function cleanupText(text) {
  return String(text || "")
    .replace(/\\relax\b/g, "")
    .replace(/\\vphantom\s*\{[^{}]*\}/g, "")
    .trim();
}

function readOptional(source, cursor, open, close) {
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] !== open) return null;
  return extractBalanced(source, cursor, open, close);
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === open && source[index - 1] !== "\\") depth += 1;
    if (char === close && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}

function value(input, fallback) {
  if (input === undefined || input === null || input === true || input === "") return fallback;
  return String(input).trim();
}

function numeric(input, fallback) {
  const number = Number(value(input, fallback));
  return Number.isFinite(number) ? number : fallback;
}

function length(input, fallback) {
  if (input === undefined || input === null || input === true || input === "") return fallback;
  const parsed = parseDimension(String(input), {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanOption(input, fallback = false) {
  if (input === undefined || input === null) return fallback;
  if (input === true || input === "") return true;
  return !/^(?:false|0|no|off)$/i.test(String(input).trim());
}

function fmt(value) {
  return String(roundNumber(value, 6));
}

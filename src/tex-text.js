import { TIKZ_FONT_FAMILY, TIKZ_MONOSPACE_FONT_FAMILY, TIKZ_SANS_SERIF_FONT_FAMILY } from "./tikz-metrics.js";
import { preprocessTikzSource } from "./preprocess.js";

const TEX_PT_PER_CM = 28.45274;
const TEX_EX_PT = 4.30554;
const TEX_EM_PT = 10;
const FM_WAVE_AXIS_WIDTH_RATIO = 0.655;
const FM_WAVE_AXIS_HEIGHT_RATIO = 0.295;
const FM_WAVE_LABEL_HEIGHT_CM = 0.5;
const TIKZ_HSPACE_START = "\uE100";
const TIKZ_HSPACE_END = "\uE101";
const MATH_FALLBACK_LBRACE = "\uE102";
const MATH_FALLBACK_RBRACE = "\uE103";
const MATHCAL_GLYPHS = {
  A: "𝒜",
  B: "ℬ",
  C: "𝒞",
  D: "𝒟",
  E: "ℰ",
  F: "ℱ",
  G: "𝒢",
  H: "ℋ",
  I: "ℐ",
  J: "𝒥",
  K: "𝒦",
  L: "ℒ",
  M: "ℳ",
  N: "𝒩",
  O: "𝒪",
  P: "𝒫",
  Q: "𝒬",
  R: "ℛ",
  S: "𝒮",
  T: "𝒯",
  U: "𝒰",
  V: "𝒱",
  W: "𝒲",
  X: "𝒳",
  Y: "𝒴",
  Z: "𝒵"
};

const LIPSUM_PARAGRAPHS = [
  "",
  "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Ut purus elit, vestibulum ut, placerat ac, adipiscing vitae, felis. Curabitur dictum gravida mauris. Nam arcu libero, nonummy eget, consectetuer id, vulputate a, magna. Donec vehicula augue eu neque. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Mauris ut leo. Cras viverra metus rhoncus sem. Nulla et lectus vestibulum urna fringilla ultrices. Phasellus eu tellus sit amet tortor gravida placerat. Integer sapien est, iaculis in, pretium quis, viverra ac, nunc. Praesent eget sem vel leo ultrices bibendum. Aenean faucibus. Morbi dolor nulla, malesuada eu, pulvinar at, mollis ac, nulla. Curabitur auctor semper nulla. Donec varius orci eget risus. Duis nibh mi, congue eu, accumsan eleifend, sagittis quis, diam. Duis eget orci sit amet orci dignissim rutrum.",
  "Nam dui ligula, fringilla a, euismod sodales, sollicitudin vel, wisi. Morbi auctor lorem non justo. Nam lacus libero, pretium at, lobortis vitae, ultricies et, tellus. Donec aliquet, tortor sed accumsan bibendum, erat ligula aliquet magna, vitae ornare odio metus a mi. Morbi ac orci et nisl hendrerit mollis. Suspendisse ut massa. Cras nec ante. Pellentesque a nulla. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Aliquam tincidunt urna. Nulla ullamcorper vestibulum turpis. Pellentesque cursus luctus mauris.",
  "Nulla malesuada porttitor diam. Donec felis erat, congue non, volutpat at, tincidunt tristique, libero. Vivamus viverra fermentum felis. Donec nonummy pellentesque ante. Phasellus adipiscing semper elit. Proin fermentum massa ac quam. Sed diam turpis, molestie vitae, placerat a, molestie nec, leo. Maecenas lacinia. Nam ipsum ligula, eleifend at, accumsan nec, suscipit a, ipsum. Morbi blandit ligula feugiat magna. Nunc eleifend consequat lorem. Sed lacinia nulla vitae enim. Pellentesque tincidunt purus vel magna. Integer non enim. Praesent euismod nunc eu purus. Donec bibendum quam in tellus. Nullam cursus pulvinar lectus. Donec et mi. Nam vulputate metus eu enim. Vestibulum pellentesque felis eu massa.",
  "Quisque ullamcorper placerat ipsum. Cras nibh. Morbi vel justo vitae lacus tincidunt ultrices. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. In hac habitasse platea dictumst. Integer tempus convallis augue. Etiam facilisis. Nunc elementum fermentum wisi. Aenean placerat. Ut imperdiet, enim sed gravida sollicitudin, felis odio placerat quam, ac pulvinar elit purus eget enim. Nunc vitae tortor. Proin tempus nibh sit amet nisl. Vivamus quis tortor vitae risus porta vehicula.",
  "Fusce mauris. Vestibulum luctus nibh at lectus. Sed bibendum, nulla a faucibus semper, leo velit ultricies tellus, ac venenatis arcu wisi vel nisl. Vestibulum diam. Aliquam pellentesque, augue quis sagittis posuere, turpis lacus congue quam, in hendrerit risus eros eget felis. Maecenas eget erat in sapien mattis porttitor. Vestibulum porttitor. Nulla facilisi. Sed a turpis eu lacus commodo facilisis. Morbi fringilla, wisi in dignissim interdum, justo lectus sagittis dui, et vehicula libero dui cursus dui. Mauris tempor ligula sed lacus. Duis cursus enim ut augue. Cras ac magna. Cras nulla. Nulla egestas. Curabitur a leo. Quisque egestas wisi eget nunc. Nam feugiat lacus vel est. Curabitur consectetuer.",
  "Suspendisse vel felis. Ut lorem lorem, interdum eu, tincidunt sit amet, laoreet vitae, arcu. Aenean faucibus pede eu ante. Praesent enim elit, rutrum at, molestie non, nonummy vel, nisl. Ut lectus eros, malesuada sit amet, fermentum eu, sodales cursus, magna. Donec eu purus. Quisque vehicula, urna sed ultricies auctor, pede lorem egestas dui, et convallis elit erat sed nulla. Donec luctus. Curabitur et nunc. Aliquam dolor odio, commodo pretium, ultricies non, pharetra in, velit. Integer arcu est, nonummy in, fermentum faucibus, egestas vel, odio."
];

export function normalizeTikzText(value) {
  const rawInput = normalizeTextColorTokenArguments(replaceInlineTikzNodes(stripMinipageWrapper(String(value ?? ""))));
  let text = normalizeTextListEnvironments(rawInput).trim();
  const fontFamily = detectTextFontFamily(rawInput);
  const fontStyle = /\\(?:emph|textit|itshape|slshape)\b/.test(rawInput) ? "italic" : null;
  const fontWeight = hasWholeTextBoldCommand(rawInput) ? 700 : null;
  const nestedGraphic = parseNestedTikzGraphic(text);
  if (nestedGraphic) return nestedGraphic;
  const image = parseIncludeGraphics(text);
  if (image) return image;

  let scale = 1;
  let color = null;
  let invisible = false;
  let explicitFontSize = false;
  const wholeScale = readWholeCommand(text, "scalebox", 2);
  if (wholeScale) {
    const parsed = Number(wholeScale.args[0]);
    if (Number.isFinite(parsed) && parsed > 0) scale = parsed;
    text = wholeScale.args[1].trim();
  }
  const wholeTextColor = readWholeCommand(text, "textcolor", 2);
  if (wholeTextColor) {
    color = wholeTextColor.args[0].trim();
    text = wholeTextColor.args[1].trim();
  }
  const wholePhantom = readWholeCommand(text, "phantom", 1);
  if (wholePhantom) {
    invisible = true;
    text = wholePhantom.args[0].trim();
	  }

	  text = unwrapOptionalAxisScalebox(text);
	  text = unwrapParboxCommands(stripOuterTextBraces(text));
	  text = replaceCommand(text, "scalebox", 2, (args) => args[1]);
  if (!isMathText(text)) text = replaceCommand(text, "textcolor", 2, (args) => args[1]);
  text = replaceCommand(text, "phantom", 1, () => "");
  text = replaceCommand(text, "tikzinlinebox", 2, (args) => args[1]);
  text = replaceCommand(text, "contour", 2, (args) => args[1]);
  text = replaceCommand(text, "texttt", 1, (args) => args[0]);
  text = replaceCommand(text, "textsf", 1, (args) => args[0]);
  text = replaceCommand(text, "textrm", 1, (args) => args[0]);
  text = replaceCommand(text, "textbf", 1, (args) => args[0]);
  text = replaceCommand(text, "textit", 1, (args) => args[0]);
  text = replaceCommand(text, "emph", 1, (args) => args[0]);
  text = replaceCommand(text, "bm", 1, (args) => args[0]);
  text = replaceCommand(text, "mathbf", 1, (args) => args[0]);
  text = replaceCommand(text, "boldsymbol", 1, (args) => args[0]);
  text = replaceCommand(text, "bf", 1, (args) => args[0]);
  text = text.replace(/\\boldsymbol\s*(\\[A-Za-z]+)/g, "$1");
  const largerCount = (text.match(/\\mathlarger\b/g) || []).length;
  if (largerCount) {
    scale *= Math.min(2.8, Math.pow(1.2, largerCount));
    let previous;
    do {
      previous = text;
      text = replaceCommand(text, "mathlarger", 1, (args) => args[0]);
    } while (text !== previous && text.includes(String.raw`\mathlarger`));
  }
  const fontSize = readLeadingFontSize(text);
  if (fontSize) {
    scale *= fontSize.scale;
    explicitFontSize = true;
    text = fontSize.text;
  }
  text = stripZeroWidthTextCommands(text);

  if (isMathText(text)) {
    return {
      kind: "text",
      raw: rawInput,
      text: text.trim(),
      scale,
      color,
      fontFamily,
      fontStyle,
      fontWeight,
      invisible,
      explicitFontSize,
      lines: [text.trim()]
    };
  }

  const styledLines = parseStyledTextLines(text);
  text = styledLines.map((line) => line.text).join("\\\\").trim();
  explicitFontSize = explicitFontSize || styledLines.some((line) => line.explicitFontSize);

  return {
    kind: "text",
    raw: rawInput,
    text,
    scale,
    color,
    fontFamily,
    fontStyle,
    fontWeight,
    invisible,
    explicitFontSize,
    lineStyles: styledLines.map((line) => ({
      scale: line.scale,
      fontWeight: line.fontWeight,
      explicitFontSize: line.explicitFontSize
    })),
    lines: styledLines.map((line) => line.text)
  };
}

export function replaceTikzHspaceMarkers(value, replacer) {
  return String(value ?? "").replace(tikzHspaceMarkerPattern(), (_match, encoded) => {
    let dimension = "";
    try {
      dimension = decodeURIComponent(encoded);
    } catch {
      dimension = encoded;
    }
    return replacer(dimension);
  });
}

export function stripTikzHspaceMarkers(value) {
  return replaceTikzHspaceMarkers(value, () => "");
}

export function readDollarMathSpan(source, start = 0) {
  const text = String(source ?? "");
  if (text[start] !== "$" || isEscapedAt(text, start)) return null;
  const displayMode = text[start + 1] === "$";
  const delimiter = displayMode ? "$$" : "$";
  const contentStart = start + delimiter.length;
  for (let index = contentStart; index < text.length; index += 1) {
    if (text[index] !== "$" || isEscapedAt(text, index)) continue;
    if (displayMode && text[index + 1] !== "$") continue;
    return {
      tex: text.slice(contentStart, index),
      displayMode,
      start,
      end: index + delimiter.length
    };
  }
  return null;
}

export function splitInlineMathSegments(source) {
  const text = String(source ?? "");
  const segments = [];
  let cursor = 0;
  while (cursor < text.length) {
    const dollar = nextUnescapedDollar(text, cursor);
    if (dollar === -1) {
      if (cursor < text.length) segments.push({ type: "text", text: text.slice(cursor) });
      break;
    }
    const span = readDollarMathSpan(text, dollar);
    if (!span) {
      cursor = dollar + 1;
      continue;
    }
    if (dollar > cursor) segments.push({ type: "text", text: text.slice(cursor, dollar) });
    segments.push({ type: "math", tex: span.tex, displayMode: span.displayMode, raw: text.slice(span.start, span.end) });
    cursor = span.end;
  }
  return segments;
}

function nextUnescapedDollar(text, start) {
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "$" && !isEscapedAt(text, index)) return index;
  }
  return -1;
}

function isEscapedAt(text, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function unwrapOptionalAxisScalebox(text) {
  let source = String(text ?? "");
  let index = source.indexOf(String.raw`\scalebox`);
  while (index !== -1) {
    const parsed = readScaleboxWithOptionalAxis(source, index);
    if (!parsed) {
      index = source.indexOf(String.raw`\scalebox`, index + 9);
      continue;
    }
    source = `${source.slice(0, index)}${parsed.content}${source.slice(parsed.end)}`;
    index = source.indexOf(String.raw`\scalebox`, index + parsed.content.length);
  }
  return source;
}

function unwrapParboxCommands(text) {
  let source = String(text ?? "");
  let output = "";
  let cursor = 0;
  while (cursor < source.length) {
    const index = source.indexOf(String.raw`\parbox`, cursor);
    if (index === -1) {
      output += source.slice(cursor);
      break;
    }
    const parsed = readParboxCommand(source, index);
    if (!parsed) {
      output += source.slice(cursor, index + String.raw`\parbox`.length);
      cursor = index + String.raw`\parbox`.length;
      continue;
    }
    output += source.slice(cursor, index);
    output += parsed.content;
    cursor = parsed.end;
  }
  return output;
}

function readParboxCommand(source, start) {
  if (!source.startsWith(String.raw`\parbox`, start)) return null;
  let cursor = start + String.raw`\parbox`.length;
  cursor = skipTextWhitespace(source, cursor);
  if (source[cursor] === "[") {
    const position = readBalancedDelimited(source, cursor, "[", "]");
    if (!position) return null;
    cursor = skipTextWhitespace(source, position.end);
  }
  const width = readBalancedDelimited(source, cursor, "{", "}");
  if (!width) return null;
  cursor = skipTextWhitespace(source, width.end);
  const content = readBalancedDelimited(source, cursor, "{", "}");
  if (!content) return null;
  return { content: content.content, end: content.end };
}

function readScaleboxWithOptionalAxis(source, start) {
  if (!source.startsWith(String.raw`\scalebox`, start)) return null;
  let cursor = start + String.raw`\scalebox`.length;
  cursor = skipTextWhitespace(source, cursor);
  const scale = readBalancedDelimited(source, cursor, "{", "}");
  if (!scale) return null;
  cursor = skipTextWhitespace(source, scale.end);
  const axis = readBalancedDelimited(source, cursor, "[", "]");
  if (!axis) return null;
  cursor = skipTextWhitespace(source, axis.end);
  const content = readBalancedDelimited(source, cursor, "{", "}");
  if (!content) return null;
  return { content: content.content, end: content.end };
}

// Claude: 一个节点里的 \begin{minipage}[pos]{width}...\end{minipage} 只是「文本盒子」语义，
// 对纯 JS 渲染没有额外排版意义，却会挡住内部的 \[ ... \] 被识别成数学块（导致整块退化成
// 逐行文本、把矩阵按 \\ 拆碎）。这里去掉 minipage 的 begin/end 包装，保留其内容。
function stripMinipageWrapper(source) {
  return String(source)
    .replace(/\\begin\s*\{minipage\}\s*(?:\[[^\]]*\])?\s*(?:\{[^{}]*\})?/g, "")
    .replace(/\\end\s*\{minipage\}/g, "");
}

function normalizeTextListEnvironments(source) {
  let text = expandLipsumCommands(String(source || ""));
  text = text.replace(/\\begin\s*\{itemize\}([\s\S]*?)\\end\s*\{itemize\}/g, (_match, body) => normalizeItemizeBody(body));
  return text;
}

function normalizeItemizeBody(body) {
  const items = String(body || "")
    .split(/\\item(?:\s*\[[^\]]*\])?/g)
    .slice(1)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return items.map((item) => `• ${item}`).join(String.raw`\\`);
}

function expandLipsumCommands(source) {
  return String(source || "").replace(/\\lipsum(?:\s*\[([^\]]+)\])?/g, (_match, spec) => {
    const paragraphIds = parseLipsumParagraphSpec(spec || "1-6");
    const paragraphs = paragraphIds.map((id) => {
      if (LIPSUM_PARAGRAPHS[id]) return LIPSUM_PARAGRAPHS[id];
      const wrapped = ((id - 1) % (LIPSUM_PARAGRAPHS.length - 1)) + 1;
      return LIPSUM_PARAGRAPHS[wrapped];
    });
    return paragraphs.join("\n\n");
  });
}

function parseLipsumParagraphSpec(spec) {
  const ids = [];
  for (const part of String(spec || "1").split(",")) {
    const range = part.trim().match(/^(\d+)\s*(?:-|–|\.{2,})\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const step = start <= end ? 1 : -1;
      for (let id = start; step > 0 ? id <= end : id >= end; id += step) ids.push(id);
      continue;
    }
    const value = Number(part.trim());
    if (Number.isFinite(value) && value > 0) ids.push(value);
  }
  return ids.length ? ids : [1];
}

function normalizeTextColorTokenArguments(source) {
  return String(source).replace(/\\textcolor\s*\{([^{}]+)\}(?!\s*\{)\s*([^\\{}$&\r\n]+)/g, (_match, color, text) => {
    const content = String(text || "").trim();
    return content ? String.raw`\textcolor{${color}}{${content}}` : String.raw`\textcolor{${color}}`;
  });
}

function detectTextFontFamily(source) {
  const text = String(source || "");
  if (/\\(?:tt|ttfamily)\b|\\texttt\s*\{/i.test(text)) return TIKZ_MONOSPACE_FONT_FAMILY;
  if (/\\(?:sf|sffamily)\b|\\textsf\s*\{/i.test(text)) return TIKZ_SANS_SERIF_FONT_FAMILY;
  if (/\\(?:rm|rmfamily)\b|\\textrm\s*\{/i.test(text)) return TIKZ_FONT_FAMILY;
  return undefined;
}

function replaceInlineTikzNodes(source) {
  const text = String(source || "");
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(String.raw`\tikz`, cursor);
    if (index === -1) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, index);
    let readCursor = index + String.raw`\tikz`.length;
    while (/\s/.test(text[readCursor] || "")) readCursor += 1;
    if (text[readCursor] === "[") {
      const options = readBalancedDelimited(text, readCursor, "[", "]");
      if (!options) {
        output += text.slice(index, readCursor);
        cursor = readCursor;
        continue;
      }
      readCursor = options.end;
    }
    while (/\s/.test(text[readCursor] || "")) readCursor += 1;
    const body = readBalanced(text, readCursor);
    if (!body) {
      output += text.slice(index, readCursor);
      cursor = readCursor;
      continue;
    }
    output += inlineTikzNodeReplacement(body.content);
    cursor = body.end;
  }
  return output;
}

function inlineTikzNodeReplacement(body) {
  const parsed = extractInlineTikzNode(body);
  if (!parsed) return "";
  const cleaned = normalizeInlineTikzNodeText(parsed.text);
  if (!cleaned) return "";
  return parsed.fill && parsed.fill !== "none" ? String.raw`\tikzinlinebox{${parsed.fill}}{${cleaned}}` : cleaned;
}

function extractInlineTikzNode(body) {
  const text = String(body || "");
  const index = text.indexOf(String.raw`\node`);
  if (index === -1) return null;
  let cursor = index + String.raw`\node`.length;
  let fill = null;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  if (text[cursor] === "[") {
    const options = readBalancedDelimited(text, cursor, "[", "]");
    if (!options) return null;
    fill = options.content.match(/(?:^|,)\s*fill\s*=\s*([^,\]]+)/)?.[1]?.trim() || null;
    cursor = options.end;
  }
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  if (text[cursor] === "(") {
    const name = readBalancedDelimited(text, cursor, "(", ")");
    if (!name) return null;
    cursor = name.end;
  }
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  const content = readBalanced(text, cursor);
  if (!content) return null;
  return { fill, text: content.content };
}

function normalizeInlineTikzNodeText(text) {
  return String(text || "")
    .replace(/\\textcolor\s*\{[^{}]+\}\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:tt|ttfamily|rm|rmfamily|sf|sffamily|normalfont|bf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const FONT_SIZE_SCALES = {
  tiny: 0.42,
  scriptsize: 0.7,
  footnotesize: 0.8,
  small: 0.9,
  normalsize: 1,
  large: 1.2,
  Large: 1.44,
  LARGE: 1.728,
  huge: 2.07,
  Huge: 2.49
};

export function fontScaleFromTikzFont(font) {
  const matches = [...String(font ?? "").matchAll(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g)];
  if (!matches.length) return 1;
  const size = matches[matches.length - 1][1];
  return FONT_SIZE_SCALES[size] || 1;
}

function readLeadingFontSize(text) {
  const match = String(text).trim().match(/^\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b\s*/);
  if (!match) return null;
  return {
    scale: FONT_SIZE_SCALES[match[1]] || 1,
    text: String(text).trim().slice(match[0].length).trim()
  };
}

function hasWholeTextBoldCommand(value) {
  let text = stripOuterTextBraces(String(value || "").trim())
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .trim();
  let changed = true;
  while (changed) {
    changed = false;
    const fontSize = readLeadingFontSize(text);
    if (fontSize) {
      text = fontSize.text;
      changed = true;
    }
    const larger = readWholeCommand(text, "mathlarger", 1);
    if (larger) {
      text = stripOuterTextBraces(larger.args[0]).trim();
      changed = true;
    }
  }
  if (/^\\(?:bf|bfseries)\b/.test(text)) return true;
  if (/^\\(?:bm|boldsymbol|mathbf|textbf)\s*(?:\{[\s\S]*\}|\\[A-Za-z]+|[^\s{}])\s*$/.test(text)) return true;
  return false;
}

function parseStyledTextLines(text) {
  const rawLines = splitStyledTextLines(text)
    .map((line) => cleanStyledTextLine(line))
    .filter((line) => line.text.length);
  return rawLines.length ? rawLines : [{ text: "", scale: 1, fontWeight: null }];
}

function splitStyledTextLines(text) {
  const source = String(text || "").trim();
  if (!source) return [""];
  const lines = [];
  let current = "";
  let cursor = 0;
  while (cursor < source.length) {
    if (source[cursor] === "$" && !isEscapedAt(source, cursor)) {
      const span = readDollarMathSpan(source, cursor);
      if (span) {
        current += compactDollarMathWhitespace(source.slice(span.start, span.end));
        cursor = span.end;
        continue;
      }
    }
    if (source[cursor] === "\\" && source[cursor + 1] === "\\") {
      lines.push(current);
      current = "";
      cursor += 2;
      continue;
    }
    if (source[cursor] === "\n") {
      lines.push(current);
      current = "";
      cursor += 1;
      continue;
    }
    current += source[cursor];
    cursor += 1;
  }
  lines.push(current);
  return lines;
}

function compactDollarMathWhitespace(raw) {
  const text = String(raw || "");
  const delimiter = text.startsWith("$$") ? "$$" : "$";
  if (!text.startsWith(delimiter) || !text.endsWith(delimiter)) return text.replace(/\s+/g, " ");
  const content = text.slice(delimiter.length, -delimiter.length).replace(/\s+/g, " ").trim();
  return `${delimiter}${content}${delimiter}`;
}

function cleanStyledTextLine(line) {
  let text = stripOuterTextBraces(String(line || "").trim());
  let scale = 1;
  let fontWeight = null;
  let explicitFontSize = false;

  text = text.replace(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, (_match, size) => {
    scale = FONT_SIZE_SCALES[size] || scale;
    explicitFontSize = true;
    return "";
  });
  const protectedMath = protectInlineMathSpans(text);
  text = protectedMath.text;
  if (/\\(?:bf|bfseries)\b|\\(?:mathbf|textbf)\s*\{/.test(text)) {
    fontWeight = 700;
  }

	  text = normalizePlainTextAccents(text)
	    .replace(/\\(?:mathbf|textbf)\s*\{([^{}]*)\}/g, "$1")
	    .replace(/\\(?:centering|raggedright|raggedleft|tt|ttfamily|rm|rmfamily|sf|sffamily|normalfont|bf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/\\hspace\s*\{([^}]*)\}/g, (_match, dimension) => hspaceText(dimension))
    .replace(/\\smash\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\dots/g, "…")
    .replace(/\\vdots/g, "⋮")
    .replace(/\\ddots/g, "⋱")
    .replace(/\\times/g, "×")
    .replace(/\\otimes/g, "(x)")
    .replace(/\\oplus/g, "(+)")
    .replace(/\\(?:leq|le)(?![A-Za-z])/g, "≤")
    .replace(/\\(?:geq|ge)(?![A-Za-z])/g, "≥")
    .replace(/\\neq(?![A-Za-z])/g, "≠")
    .replace(/\\sim(?![A-Za-z])/g, "∼")
    .replace(/\\(?:neg|lnot)(?![A-Za-z])/g, "¬")
    .replace(/\\approx(?![A-Za-z])/g, "≈")
    .replace(/\\rightleftharpoons/g, "⇌")
    .replace(/\\leftrightharpoons/g, "⇋")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\Leftarrow/g, "⇐")
    .replace(/\\uparrow/g, "↑")
    .replace(/\\downarrow/g, "↓")
    .replace(/\\to/g, "→")
    .replace(/\\gets/g, "←")
    .replace(/\\star/g, "⋆")
    .replace(/\\pounds/g, "£")
    .replace(/\\clubsuit/g, "♣")
    .replace(/\\diamondsuit/g, "♦")
    .replace(/\\heartsuit/g, "♥")
    .replace(/\\spadesuit/g, "♠")
    .replace(/\^\s*\{?\\circ\}?/g, "°")
    .replace(/\\circ/g, "°")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/[{}]/g, "")
    .replace(/@@TIKZ_MATH_(\d+)@@/g, (_match, index) => protectedMath.spans[Number(index)] || "")
    .replace(/[ \t]+/g, " ")
    .trim();

  return { text, scale, fontWeight, explicitFontSize };
}

function normalizePlainTextAccents(input) {
  const marks = {
    "'": "\u0301",
    "`": "\u0300",
    "^": "\u0302",
    "~": "\u0303",
    '"': "\u0308",
    c: "\u0327"
  };
  const applyMark = (_match, accent, braced, bare) => {
    const base = braced || bare || "";
    return `${base}${marks[accent] || ""}`.normalize("NFC");
  };
  return String(input || "")
    .replace(/\\(['`^~"])\s*(?:\{([^{}])\}|([A-Za-z]))/g, applyMark)
    .replace(/\\c(?![A-Za-z])\s*(?:\{([^{}])\}|([A-Za-z]))/g, (_match, braced, bare) =>
      applyMark(_match, "c", braced, bare)
    );
}

function protectInlineMathSpans(text) {
  const spans = [];
  return {
    spans,
    text: String(text || "").replace(/\$[^$]+\$/g, (match) => {
      const index = spans.length;
      spans.push(match);
      return `@@TIKZ_MATH_${index}@@`;
    })
  };
}

function hspaceText(dimension) {
  const raw = String(dimension || "").trim();
  const match = raw.match(/^([0-9.]+)\s*(cm|mm|em|ex|pt)?$/);
  if (!match) return " ";
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return " ";
  return `${TIKZ_HSPACE_START}${encodeURIComponent(raw)}${TIKZ_HSPACE_END}`;
}

function tikzHspaceMarkerPattern() {
  return new RegExp(`${TIKZ_HSPACE_START}([^${TIKZ_HSPACE_END}]*)${TIKZ_HSPACE_END}`, "g");
}

function stripOuterTextBraces(text) {
  let output = text;
  while (output.startsWith("{") && output.endsWith("}")) {
    const inner = output.slice(1, -1);
    if (!hasBalancedBraces(inner)) break;
    output = inner.trim();
  }
  return output;
}

function stripZeroWidthTextCommands(text) {
  return String(text ?? "").replace(/\\strut(?![A-Za-z])\s*/g, "");
}

function hasBalancedBraces(text) {
  let depth = 0;
  for (const char of text) {
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

export function mathFallbackText(tex) {
  let text = normalizeMathFallbackAccents(
    String(tex)
    .trim()
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
      .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
  );
  text = replaceCommand(text, "textcolor", 2, (args) => args[1]);
  text = text.replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)(?![A-Za-z])\s*/g, "");
  text = replaceMathFractionCommands(text);
  return text
    .replace(/\\strut(?![A-Za-z])\s*/g, "")
    .replace(/\\\$\s*/g, "$")
    .replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)(?![A-Za-z])\s*/g, "")
    .replace(/\\textcolor\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\[,;:!]\s*/g, " ")
    .replace(/\\mathcal\s*\{([^{}]*)\}/g, (_match, value) => mathcalFallbackText(value))
    .replace(/\\mathcal\s*([A-Za-z])/g, (_match, value) => mathcalFallbackText(value))
    .replace(/\\operatorname\*?\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\operatorname\*?\s*([A-Za-z]+)/g, "$1")
    .replace(/\\(?:vec|overrightarrow)\s*\{([^{}]*)\}/g, (_match, value) => `${value}⃗`)
    .replace(/\\vec\s*([A-Za-z])/g, (_match, value) => `${value}⃗`)
    .replace(/\\overline\s*\{([^{}]*)\}/g, (_match, value) => `${value}̄`)
    .replace(/\\overline\s*([A-Za-z])/g, (_match, value) => `${value}̄`)
    .replace(/\\bar\s*\{([^{}]*)\}/g, (_match, value) => `${value}̄`)
    .replace(/\\bar\s*([A-Za-z])/g, (_match, value) => `${value}̄`)
    .replace(/\\hat\s*\{([^{}]*)\}/g, (_match, value) => `${value}̂`)
    .replace(/\\hat\s*([A-Za-z])/g, (_match, value) => `${value}̂`)
    .replace(/\\check\s*\{([^{}]*)\}/g, (_match, value) => `${value}̌`)
    .replace(/\\check\s*([A-Za-z])/g, (_match, value) => `${value}̌`)
    .replace(/\\widetilde\s*\{([^{}]*)\}/g, (_match, value) => `${value}̃`)
    .replace(/\\widetilde\s*([A-Za-z])/g, (_match, value) => `${value}̃`)
    .replace(/\\tilde\s*\{([^{}]*)\}/g, (_match, value) => `${value}̃`)
    .replace(/\\tilde\s*([A-Za-z])/g, (_match, value) => `${value}̃`)
    .replace(/\{\s*\\(?:bf|bfseries)\b\s*([^{}]*)\}/g, "$1")
    .replace(/\\(?:bm|mathbf|boldsymbol|text|textnormal|textbf|textit|mathrm|textrm|texttt|emph|vec|overline|underline|mathlarger|operatorname\*?)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:bm|mathbf|boldsymbol|text|textnormal|textbf|textit|mathrm|textrm|texttt|emph|overline|underline|mathlarger|operatorname\*?)\s*(\\[A-Za-z]+)/g, "$1")
    .replace(/\\(?:bm|mathbf|boldsymbol|text|textnormal|textbf|textit|mathrm|textrm|texttt|emph|overline|underline|mathlarger|operatorname\*?)\s*([A-Za-z])/g, "$1")
    .replace(/\\(?:bf|bfseries|tt|ttfamily|rm|rmfamily|sf|sffamily|normalfont|large|Large|LARGE|Huge|huge|scriptsize|footnotesize|tiny)\b/g, "")
    .replace(/\\(?:sin|cos|tan|cot|sec|csc|log|ln|exp|max|min|det|dim|ker|hom|arg|Pr)(?![A-Za-z])/g, (match) => ` ${match.slice(1)} `)
    .replace(/\\(?:cdots|ldots|dots)/g, "…")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, ".")
    .replace(/\\otimes/g, "(x)")
    .replace(/\\oplus/g, "(+)")
    .replace(/\\partial(?![A-Za-z])/g, "∂")
    .replace(/\\(?:in)(?![A-Za-z])/g, "∈")
    .replace(/\\(?:leq|le)(?![A-Za-z])/g, "≤")
    .replace(/\\(?:geq|ge)(?![A-Za-z])/g, "≥")
    .replace(/\\neq(?![A-Za-z])/g, "≠")
    .replace(/\\sim(?![A-Za-z])/g, "∼")
    .replace(/\\(?:neg|lnot)(?![A-Za-z])/g, "¬")
    .replace(/\\approx(?![A-Za-z])/g, "≈")
    .replace(/\\rightleftharpoons/g, "⇌")
    .replace(/\\leftrightharpoons/g, "⇋")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\Leftarrow/g, "⇐")
    .replace(/\\uparrow/g, "↑")
    .replace(/\\downarrow/g, "↓")
    .replace(/\\to/g, "→")
    .replace(/\\gets/g, "←")
    .replace(/\\star/g, "⋆")
    .replace(/\\pounds/g, "£")
    .replace(/\\clubsuit/g, "♣")
    .replace(/\\diamondsuit/g, "♦")
    .replace(/\\heartsuit/g, "♥")
    .replace(/\\spadesuit/g, "♠")
    .replace(/\\blacktriangleright/g, "▶")
    .replace(/\\blacktriangleleft/g, "◀")
    .replace(/\\(?:lbrace|\{)(?![A-Za-z])/g, MATH_FALLBACK_LBRACE)
    .replace(/\\(?:rbrace|\})(?![A-Za-z])/g, MATH_FALLBACK_RBRACE)
    .replace(/\\sum\s*(?:\\limits\s*)?_\s*\{([^{}]*)\}\s*\^\s*\{([^{}]*)\}/g, (_match, subscript, superscript) =>
      compactLimitOperator("∑", subscript, superscript)
    )
    .replace(/\\sum\s*(?:\\limits\s*)?\^\s*\{([^{}]*)\}\s*_\s*\{([^{}]*)\}/g, (_match, superscript, subscript) =>
      compactLimitOperator("∑", subscript, superscript)
    )
    .replace(/\\(?:left|right)(?![A-Za-z])\s*/g, "")
    .replace(/\\(?:limits|nolimits)(?![A-Za-z])\s*/g, "")
    .replace(/\\sum(?![A-Za-z])/g, "∑")
    .replace(/\\prod(?![A-Za-z])/g, "∏")
    .replace(/\\int(?![A-Za-z])/g, "∫")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\gamma/g, "γ")
    .replace(/\\delta/g, "δ")
    .replace(/\\varepsilon/g, "ϵ")
    .replace(/\\epsilon/g, "ε")
    .replace(/\\vartheta/g, "ϑ")
    .replace(/\\theta/g, "θ")
    .replace(/\\lambda/g, "λ")
    .replace(/\\ell/g, "ℓ")
    .replace(/\\eta/g, "η")
    .replace(/\\kappa/g, "κ")
    .replace(/\\tau/g, "τ")
    .replace(/\\chi/g, "χ")
    .replace(/\\zeta/g, "ζ")
    .replace(/\\mu/g, "μ")
    .replace(/\\nu/g, "ν")
    .replace(/\\pi/g, "π")
    .replace(/\\varrho/g, "ϱ")
    .replace(/\\rho/g, "ρ")
    .replace(/\\varsigma/g, "ς")
    .replace(/\\sigma/g, "σ")
    .replace(/\\varphi/g, "ϕ")
    .replace(/\\phi/g, "φ")
    .replace(/\\psi/g, "ψ")
    .replace(/\\omega/g, "ω")
    .replace(/\\Gamma/g, "Γ")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\Lambda/g, "Λ")
    .replace(/\\Pi/g, "Π")
    .replace(/\\Sigma/g, "Σ")
    .replace(/\\Phi/g, "Φ")
    .replace(/\\Psi/g, "Ψ")
    .replace(/\\Omega/g, "Ω")
    .replace(/\\vdots/g, "⋮")
    .replace(/\\ddots/g, "⋱")
    .replace(/\^\s*\{?\\circ\}?/g, "°")
    .replace(/\\circ/g, "°")
    .replace(/\\\|/g, "||")
    .replace(/_\{([^{}]*)\}/g, (_match, value) => toSubscript(value))
    .replace(/_([A-Za-z0-9+\-=()])/g, (_match, value) => toSubscript(value))
    .replace(/\^\{([^{}]*)\}/g, (_match, value) => `^${value}`)
    .replace(/[_^]([←→⇐⇒])/g, "$1")
    .replace(/\\/g, "")
    .replace(/[{}]/g, "")
    .replace(new RegExp(MATH_FALLBACK_LBRACE, "g"), "{")
    .replace(new RegExp(MATH_FALLBACK_RBRACE, "g"), "}")
    .replace(/\s*([=≤≥≠≈∈∼])\s*/g, " $1 ")
    .replace(/\{\s+/g, "{")
    .replace(/\s+\}/g, "}")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceMathFractionCommands(input) {
  let text = String(input ?? "");
  let previous;
  do {
    previous = text;
    for (const name of ["dfrac", "tfrac", "frac"]) {
      text = replaceCommand(text, name, 2, ([numerator, denominator]) =>
        formatFractionFallback(mathFallbackText(numerator), mathFallbackText(denominator))
      );
    }
  } while (text !== previous && /\\(?:dfrac|tfrac|frac)\s*\{/.test(text));
  return text;
}

function formatFractionFallback(numerator, denominator) {
  const top = maybeParenthesizeFractionPart(numerator, "numerator");
  const bottom = maybeParenthesizeFractionPart(denominator, "denominator");
  return `${top}/${bottom}`;
}

function maybeParenthesizeFractionPart(value, role) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\([^()]*\)$/.test(text)) return text;
  if (/^[A-Za-z0-9α-ωΑ-Ω₀-₉]+$/.test(text)) return text;
  if (role === "denominator" || /[+\-=∈≤≥≠≈∼\s]/.test(text)) return `(${text})`;
  return text;
}

function mathcalFallbackText(value) {
  return [...String(value || "")].map((char) => MATHCAL_GLYPHS[char] || char).join("");
}

function normalizeMathFallbackAccents(tex) {
  let text = String(tex);
  let previous;
  do {
    previous = text;
    text = replaceCommand(text, "widetilde", 1, (args) => `${mathFallbackText(args[0])}̃`);
    text = replaceCommand(text, "tilde", 1, (args) => `${mathFallbackText(args[0])}̃`);
    text = replaceCommand(text, "hat", 1, (args) => `${mathFallbackText(args[0])}̂`);
    text = replaceCommand(text, "check", 1, (args) => `${mathFallbackText(args[0])}̌`);
    text = replaceCommand(text, "vec", 1, (args) => `${mathFallbackText(args[0])}⃗`);
    text = replaceCommand(text, "overrightarrow", 1, (args) => `${mathFallbackText(args[0])}⃗`);
    text = replaceCommand(text, "sqrt", 1, (args) => `√(${mathFallbackText(args[0])})`);
  } while (text !== previous && /\\(?:widetilde|tilde|hat|check|vec|overrightarrow)\s*\{/.test(text));
  return text;
}

const SUBSCRIPT_CHARS = {
  0: "₀",
  1: "₁",
  2: "₂",
  3: "₃",
  4: "₄",
  5: "₅",
  6: "₆",
  7: "₇",
  8: "₈",
  9: "₉",
  a: "ₐ",
  b: "ᵦ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
};

function toSubscript(value) {
  const text = String(value)
    .replace(/\\/g, "")
    .replace(/[{}]/g, "");
  if (/[A-Za-z]/.test(text)) return `_${text}`;
  const chars = text.split("");
  if (chars.every((char) => SUBSCRIPT_CHARS[char])) {
    return chars.map((char) => SUBSCRIPT_CHARS[char]).join("");
  }
  return chars.map((char) => SUBSCRIPT_CHARS[char] || char).join("");
}

const SUPERSCRIPT_CHARS = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
  i: "ⁱ",
  n: "ⁿ",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
};

function compactLimitOperator(operator, subscript, superscript) {
  const compactSuperscript = toCompactScript(superscript, SUPERSCRIPT_CHARS, "^");
  const compactSubscript = toCompactScript(subscript, SUBSCRIPT_CHARS, "_");
  return `${operator}${compactSuperscript}${compactSubscript}`;
}

function toCompactScript(value, charMap, fallbackPrefix) {
  const text = String(value)
    .replace(/\\/g, "")
    .replace(/[{}]/g, "")
    .trim();
  if (!text) return "";
  return text
    .split("")
    .map((char) => charMap[char] || `${fallbackPrefix}${char}`)
    .join("");
}

function isMathText(text) {
  const trimmed = String(text).trim();
  const dollar = readDollarMathSpan(trimmed, 0);
  return (
    (dollar && dollar.end === trimmed.length) ||
    /^\\\([\s\S]+\\\)$/.test(trimmed) ||
    /^\\\[[\s\S]+\\\]$/.test(trimmed)
  );
}

function parseIncludeGraphics(text) {
  const match = text.match(/^\\includegraphics(?:\[([\s\S]*?)\])?\{([^}]+)\}$/);
  if (!match) return null;
  const options = parseGraphicOptions(match[1] || "");
  const width = parseCmDimension(options.width) ?? 2;
  const fileName = match[2].trim();
  const networkDevice = packtNetworkDeviceName(fileName);
  return {
    kind: "image",
    raw: text,
    fileName,
    width,
    height: width * 0.55,
    scale: 1,
    ...(networkDevice ? { plot: "network-device", device: networkDevice } : {}),
    lines: []
  };
}

function packtNetworkDeviceName(fileName) {
  const base = String(fileName || "").split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").toLowerCase();
  return base === "router" || base === "switch" ? base : null;
}

function parseNestedTikzGraphic(text) {
  const rawSource = String(text || "").trim();
  let source = rawSource;
  let wrapperScale = 1;
  const wholeScale = readWholeCommand(source, "scalebox", 2);
  if (wholeScale) {
    const parsed = Number(wholeScale.args[0]);
    if (Number.isFinite(parsed) && parsed > 0) wrapperScale = parsed;
    source = wholeScale.args[1].trim();
  }
  const withWrapperScale = (image) =>
    image
      ? {
          ...image,
          raw: rawSource,
          scale: (Number(image.scale) || 1) * wrapperScale
        }
      : null;
  if (/^\\tikz\b[\s\S]*\\draw[\s\S]*(?:\bsin\b|\bcos\b|--)/.test(source)) {
    const inlineGraphic = extractInlineTikzDrawGraphic(source);
    if (inlineGraphic) return withWrapperScale(inlineGraphic);
    const parts = source.split(/\\\\|\n/).map((part) => part.trim()).filter(Boolean);
    const tikzLineCount = Math.max(1, parts.filter((line) => /^\\tikz\b/.test(line)).length);
    const label = parts
      .filter((line) => !/^\\tikz\b/.test(line))
      .map((line) => mathFallbackText(line))
      .join(" ");
    return withWrapperScale({
      kind: "image",
      raw: source,
      fileName: "inline-tikz",
      width: 1.8,
      height: label ? 0.72 : Math.max(0.36, tikzLineCount * 0.28),
      scale: 1,
      plot: "wave",
      waveCount: tikzLineCount,
      label,
      lines: []
    });
  }
  if (!/\\begin\{tikzpicture\}|\\begin\{axis\}|axis plot|\\addplot/.test(source)) return null;
  if (/\\begin\{axis\}[\s\S]*\\addplot[\s\S]*sin\s*\(/.test(source)) {
    const label = source.match(/\\\\\s*(\$[\s\S]*?\$)\s*$/)?.[1];
    const axisSize = rawPgfplotsAxisSize(source);
    const layout = fmWavePlaceholderLayout(axisSize, { hasLabel: Boolean(label) });
    return withWrapperScale({
      kind: "image",
      raw: source,
      fileName: "pgfplots-fm",
      width: layout.width,
      height: layout.height,
      scale: 1,
      plot: "fm-wave",
      label: label ? mathFallbackText(label) : "",
      labelHeight: layout.labelHeight,
      lines: []
    });
  }
  const axisLabel = source.match(/\\\\\s*(\$[\s\S]*?\$)\s*$/)?.[1];
  if (/axis plot/.test(source) && /\$FM\(t\)\$/.test(axisLabel || "")) {
    const axisGraphic = extractPreprocessedAxisPlotGraphic(source);
    const layout = fmWavePlaceholderLayout(axisGraphic, { hasLabel: true, hasPreprocessedBoundsMargin: true });
    return withWrapperScale({
      kind: "image",
      raw: source,
      fileName: "pgfplots-fm",
      width: layout.width,
      height: layout.height,
      scale: 1,
      plot: "fm-wave",
      label: mathFallbackText(axisLabel),
      labelHeight: layout.labelHeight,
      lines: []
    });
  }
  const expandedAxis = extractExpandedAxisPlotGraphic(source);
  if (expandedAxis) return withWrapperScale(expandedAxis);
  // Claude: 嵌套 tikzpicture 若只是若干 \draw 直线段（如 case 038 的 ReLU 折线
  // "(0,0)--(0.5,0); (0.49,..)--(0.99,0.496)"），原来的 catch-all 会一律画成钟形(gaussian)占位符。
  // 这里改成提取真实线段、按比例画出来。复杂的嵌套(含 \node / pgfplots)仍走下面的占位逻辑。
  const preprocessedAxis = extractPreprocessedAxisPlotGraphic(source);
  if (preprocessedAxis) return withWrapperScale(preprocessedAxis);
  const inlineDraw = extractInlineDrawPolylines(source);
  if (inlineDraw) return withWrapperScale(inlineDraw);
  const miniTikz = extractNestedMiniTikzGraphic(source);
  if (miniTikz) return withWrapperScale(miniTikz);
  const miniNodeStack = extractNestedMiniNodeStackGraphic(source);
  if (miniNodeStack) return withWrapperScale(miniNodeStack);
  const nestedNodeGraphic = extractNestedSingleNodeGraphic(source);
  if (nestedNodeGraphic) return withWrapperScale(nestedNodeGraphic);
  // Claude: 嵌套 tikzpicture 若只是若干 \node{文字}（如 case 019 的 Memory{ROM,RAM}、
  // case 038 的 {softmax}），把它们的文字抽成多行文本来渲染，而不是一律画成钟形占位符。
  const nestedNodes = extractNestedNodeText(source);
  if (nestedNodes) return nestedNodes;
  return withWrapperScale({
    kind: "image",
    raw: source,
    fileName: "pgfplots-axis",
    width: 1.8,
    height: 1.05,
    scale: 1,
    plot: "gaussian",
    grid: /(?:tikzkit compare grid|\\draw[\s\S]*\bgrid\b)/.test(source),
    lines: []
  });
}

function extractInlineTikzDrawGraphic(source) {
  const parts = String(source || "")
    .split(/\\\\|\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.some((part) => /^\\tikz\b/.test(part))) return null;

  const drawingLines = [];
  const labels = [];
  for (const part of parts) {
    if (/^\\tikz\b/.test(part)) {
      const parsed = parseInlineTikzDrawPart(part);
      if (!parsed) return null;
      drawingLines.push(parsed);
    } else {
      const label = mathFallbackText(part);
      if (label) labels.push(label);
    }
  }
  if (!drawingLines.length) return null;

  const label = labels.join(" ");
  const lineGap = drawingLines.length > 1 ? 0.08 : 0;
  const labelHeight = label ? 0.35 : 0;
  const labelGap = label ? 0.08 : 0;
  const pathHeight = drawingLines.reduce((sum, line) => sum + line.height, 0) + Math.max(0, drawingLines.length - 1) * lineGap;
  const height = Math.max(0.12, pathHeight + labelGap + labelHeight);
  const labelWidth = label ? estimateInlineLabelWidth(label) : 0;
  const width = Math.max(0.12, labelWidth, ...drawingLines.map((line) => line.width));

  const polylines = [];
  let top = height;
  for (const line of drawingLines) {
    const bottom = top - line.height;
    const offsetX = (width - line.width) / 2;
    for (const path of line.polylines) {
      polylines.push(
        path.map((point) => ({
          x: (offsetX + (point.x - line.minX)) / width,
          y: (bottom + (point.y - line.minY)) / height
        }))
      );
    }
    top = bottom - lineGap;
  }

  return {
    kind: "image",
    raw: source,
    fileName: "inline-tikz-draw",
    width,
    height,
    scale: 1,
    plot: "polyline",
    polylines,
    label,
    labelHeight,
    lines: []
  };
}

function parseInlineTikzDrawPart(part) {
  const text = String(part || "");
  const drawIndex = text.indexOf(String.raw`\draw`);
  if (drawIndex === -1) return null;
  let cursor = drawIndex + String.raw`\draw`.length;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  let options = {};
  if (text[cursor] === "[") {
    const read = readBalancedDelimited(text, cursor, "[", "]");
    if (!read) return null;
    options = parseGraphicOptions(read.content);
    cursor = read.end;
  }
  const semicolon = text.indexOf(";", cursor);
  const body = text.slice(cursor, semicolon === -1 ? undefined : semicolon);
  const xScale = parseTikzGraphicDimension(options.x) ?? 1;
  const yScale = parseTikzGraphicDimension(options.y) ?? 1;
  const polylines = sampleInlineTikzPath(body, xScale, yScale);
  if (!polylines.length) return null;
  const points = polylines.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    polylines,
    minX,
    minY,
    width: Math.max(0.12, maxX - minX),
    height: Math.max(0.18, maxY - minY)
  };
}

function sampleInlineTikzPath(body, xScale, yScale) {
  const tokens = [...String(body || "").matchAll(/(--|\bsin\b|\bcos\b)?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)];
  const polylines = [];
  let current = null;
  let currentLine = null;
  for (const token of tokens) {
    const op = token[1] || "";
    const target = { x: Number(token[2]) * xScale, y: Number(token[3]) * yScale };
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) continue;
    if (!current || !op) {
      currentLine = [target];
      polylines.push(currentLine);
      current = target;
      continue;
    }
    const samples = op === "sin" || op === "cos" ? sampleSineCosineSegment(current, target, op) : [target];
    currentLine.push(...samples);
    current = target;
  }
  return polylines.filter((line) => line.length >= 2);
}

function sampleSineCosineSegment(from, to, op) {
  const samples = [];
  const count = 8;
  for (let index = 1; index <= count; index += 1) {
    const t = index / count;
    const x = from.x + (to.x - from.x) * t;
    const y =
      op === "sin"
        ? from.y + (to.y - from.y) * Math.sin((Math.PI / 2) * t)
        : to.y + (from.y - to.y) * Math.cos((Math.PI / 2) * t);
    samples.push({ x, y });
  }
  return samples;
}

function parseTikzGraphicDimension(value) {
  const input = String(value || "").trim();
  const match = input.match(/^(-?\d+(?:\.\d+)?)\s*(cm|mm|pt|ex|em)?$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const unit = match[2] || "cm";
  if (unit === "cm") return number;
  if (unit === "mm") return number / 10;
  if (unit === "pt") return number / TEX_PT_PER_CM;
  if (unit === "ex") return (number * TEX_EX_PT) / TEX_PT_PER_CM;
  if (unit === "em") return (number * TEX_EM_PT) / TEX_PT_PER_CM;
  return null;
}

function estimateInlineLabelWidth(label) {
  return Math.max(0, String(label || "").length * 0.105);
}

function extractNestedSingleNodeGraphic(source) {
  const text = String(source);
  if (/\\addplot|\\begin\{axis\}|\bplot\b|\\draw/.test(text) || !/\\node\b/.test(text)) return null;
  const bodyMatch = text.match(/\\begin\{tikzpicture\}([\s\S]*)\\end\{tikzpicture\}/);
  const body = bodyMatch ? bodyMatch[1] : text;
  const nodeIndex = body.indexOf(String.raw`\node`);
  if (nodeIndex === -1) return null;
  let cursor = nodeIndex + String.raw`\node`.length;
  while (/\s/.test(body[cursor] || "")) cursor += 1;

  let options = {};
  if (body[cursor] === "[") {
    const read = readBalancedDelimited(body, cursor, "[", "]");
    if (!read) return null;
    options = parseGraphicOptions(read.content);
    cursor = read.end;
  }

  while (/\s/.test(body[cursor] || "")) cursor += 1;
  if (body[cursor] === "(") {
    const name = readBalancedDelimited(body, cursor, "(", ")");
    if (!name) return null;
    cursor = name.end;
  }

  while (/\s/.test(body[cursor] || "")) cursor += 1;
  if (/^at\b/.test(body.slice(cursor))) {
    cursor += 2;
    while (/\s/.test(body[cursor] || "")) cursor += 1;
    if (body[cursor] === "(") {
      const at = readBalancedDelimited(body, cursor, "(", ")");
      if (!at) return null;
      cursor = at.end;
    }
  }

  while (/\s/.test(body[cursor] || "")) cursor += 1;
  const content = readBalanced(body, cursor);
  if (!content) return null;
  cursor = content.end;
  const trailing = body.slice(cursor).replace(/;/g, "").trim();
  if (trailing) return null;

  const rotate = Number(options.rotate || 0);
  const shouldRenderAsBox = options.draw || options.rectangle || Number.isFinite(rotate) && rotate !== 0;
  if (!shouldRenderAsBox) return null;

  const label = mathFallbackText(content.content);
  const innerSep = parseTikzGraphicDimension(options["inner sep"]) ?? (TEX_EM_PT / TEX_PT_PER_CM) * 0.3333;
  const labelWidth = estimateInlineLabelWidth(label) + innerSep * 2;
  const labelHeight = 0.24 + innerSep * 2;
  const baseWidth = Math.max(parseTikzGraphicDimension(options["minimum width"]) ?? 0, labelWidth, 0.1);
  const baseHeight = Math.max(parseTikzGraphicDimension(options["minimum height"]) ?? 0, labelHeight, 0.1);
  const normalizedRotation = ((rotate % 360) + 360) % 360;
  const swapsAxes = Math.abs(normalizedRotation - 90) < 1e-6 || Math.abs(normalizedRotation - 270) < 1e-6;

  return {
    kind: "image",
    raw: source,
    fileName: "nested-tikz-node",
    width: swapsAxes ? baseHeight : baseWidth,
    height: swapsAxes ? baseWidth : baseHeight,
    scale: 1,
    plot: "boxed-text",
    label,
    rotate,
    boxWidth: baseWidth,
    boxHeight: baseHeight,
    lines: []
  };
}

function extractNestedMiniNodeStackGraphic(source) {
  const text = String(source || "");
  if (/\\addplot|\\begin\{axis\}|\bplot\b|\\draw/.test(text) || !/\\node\b/.test(text)) return null;
  const begin = text.match(/\\begin\{tikzpicture\}\s*(?:\[([^\]]*)\])?/);
  const endIndex = text.lastIndexOf(String.raw`\end{tikzpicture}`);
  if (!begin || endIndex === -1 || endIndex <= begin.index) return null;

  const prefix = text.slice(0, begin.index).trim();
  const body = text.slice(begin.index + begin[0].length, endIndex).replace(/%.*$/gm, "");
  const pictureOptions = parseGraphicOptions(begin[1] || "");
  const nodeSpecs = readMiniTikzNodeSpecs(body);
  if (!nodeSpecs.length) return null;
  if (nodeSpecs.length === 1 && !prefix) return null;

  const defaultDistance = parseTikzGraphicDimension(pictureOptions["node distance"]) ?? 1;
  const positions = new Map();
  const boxes = [];
  for (const spec of nodeSpecs) {
    const relation = resolveMiniNodePosition(spec, positions, defaultDistance);
    const box = buildMiniNodeBox(spec, relation);
    boxes.push(box);
    if (spec.name) positions.set(spec.name, { x: relation.x, y: relation.y });
  }
  if (!boxes.length) return null;

  const boxBounds = boxes.flatMap((box) => [
    { x: box.x - box.width / 2, y: box.y - box.height / 2 },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  ]);
  const label = prefix ? mathFallbackText(prefix) : "";
  const labelHeight = label ? 0.32 : 0;
  const labelGap = label ? 0.08 : 0;
  const labelWidth = label ? estimateInlineLabelWidth(label) + 0.18 : 0;
  const boxMinX = Math.min(...boxBounds.map((point) => point.x));
  const boxMaxX = Math.max(...boxBounds.map((point) => point.x));
  const boxMinY = Math.min(...boxBounds.map((point) => point.y));
  const boxMaxY = Math.max(...boxBounds.map((point) => point.y));
  const boxCenterX = (boxMinX + boxMaxX) / 2;
  const minX = Math.min(boxMinX, boxCenterX - labelWidth / 2);
  const maxX = Math.max(boxMaxX, boxCenterX + labelWidth / 2);
  const labelY = boxMaxY + labelGap + labelHeight / 2;
  const maxY = label ? boxMaxY + labelGap + labelHeight : boxMaxY;

  return {
    kind: "image",
    raw: source,
    fileName: "nested-mini-node-stack",
    width: Math.max(0.1, maxX - minX),
    height: Math.max(0.1, maxY - boxMinY),
    minX,
    maxY,
    scale: 1,
    plot: "mini-node-stack",
    label,
    labelX: boxCenterX,
    labelY,
    labelHeight,
    boxes,
    lines: []
  };
}

function readMiniTikzNodeSpecs(body) {
  const specs = [];
  const text = String(body || "");
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(String.raw`\node`, cursor);
    if (index === -1) break;
    const spec = readMiniTikzNodeSpecAt(text, index);
    if (!spec) {
      cursor = index + String.raw`\node`.length;
      continue;
    }
    specs.push(spec);
    cursor = spec.end;
  }
  return specs;
}

function readMiniTikzNodeSpecAt(text, index) {
  let cursor = index + String.raw`\node`.length;
  while (/\s/.test(text[cursor] || "")) cursor += 1;

  let options = {};
  if (text[cursor] === "[") {
    const read = readBalancedDelimited(text, cursor, "[", "]");
    if (!read) return null;
    options = parseGraphicOptions(read.content);
    cursor = read.end;
  }

  while (/\s/.test(text[cursor] || "")) cursor += 1;
  let name = "";
  if (text[cursor] === "(") {
    const read = readBalancedDelimited(text, cursor, "(", ")");
    if (!read) return null;
    name = read.content.trim();
    cursor = read.end;
  }

  while (/\s/.test(text[cursor] || "")) cursor += 1;
  let at = null;
  if (/^at\b/.test(text.slice(cursor))) {
    cursor += 2;
    while (/\s/.test(text[cursor] || "")) cursor += 1;
    if (text[cursor] === "(") {
      const read = readBalancedDelimited(text, cursor, "(", ")");
      if (!read) return null;
      at = parseMiniNodeCoordinate(read.content);
      cursor = read.end;
    }
  }

  while (/\s/.test(text[cursor] || "")) cursor += 1;
  const content = readBalanced(text, cursor);
  if (!content) return null;
  cursor = content.end;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  if (text[cursor] === ";") cursor += 1;

  return {
    name,
    options,
    at,
    label: mathFallbackText(content.content),
    end: cursor
  };
}

function parseMiniNodeCoordinate(value) {
  const match = String(value || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function resolveMiniNodePosition(spec, positions, defaultDistance) {
  if (spec.at) return spec.at;
  const options = spec.options || {};
  const distance = parseTikzGraphicDimension(options["node distance"]) ?? defaultDistance;
  const relations = [
    ["below right of", 1, -1],
    ["below left of", -1, -1],
    ["above right of", 1, 1],
    ["above left of", -1, 1],
    ["below of", 0, -1],
    ["above of", 0, 1],
    ["right of", 1, 0],
    ["left of", -1, 0]
  ];
  for (const [key, dx, dy] of relations) {
    const target = typeof options[key] === "string" ? options[key].trim() : "";
    if (!target) continue;
    const origin = positions.get(target) || { x: 0, y: 0 };
    return { x: origin.x + dx * distance, y: origin.y + dy * distance };
  }
  const previous = [...positions.values()].at(-1);
  return previous ? { x: previous.x, y: previous.y - distance } : { x: 0, y: 0 };
}

function buildMiniNodeBox(spec, position) {
  const options = spec.options || {};
  const hasBlockStyle = Boolean(options.block || options.block2);
  const innerSep = parseTikzGraphicDimension(options["inner sep"]) ?? (TEX_EM_PT / TEX_PT_PER_CM) * 0.3333;
  const labelWidth = estimateInlineLabelWidth(spec.label) + innerSep * 2;
  const labelHeight = 0.24 + innerSep * 2;
  const styleWidth =
    parseTikzGraphicDimension(options["text width"]) ??
    parseTikzGraphicDimension(options["minimum width"]) ??
    (options.block2 ? parseTikzGraphicDimension("4em") : options.block ? parseTikzGraphicDimension("5em") : null);
  const minHeight =
    parseTikzGraphicDimension(options["minimum height"]) ??
    (options.block2 ? parseTikzGraphicDimension("1em") : options.block ? parseTikzGraphicDimension("4em") : null);
  const rounded = options["rounded corners"] || hasBlockStyle;
  return {
    x: position.x,
    y: position.y,
    width: Math.max(0.1, styleWidth ?? 0, labelWidth),
    height: Math.max(0.1, minHeight ?? 0, labelHeight),
    label: spec.label,
    stroke: optionColorValue(options.color) || optionColorValue(options.draw) || "black",
    fill: optionColorValue(options.fill) || "none",
    textColor: optionColorValue(options.color) || "black",
    rx: rounded ? parseTikzGraphicDimension(options["rounded corners"]) ?? 0.08 : 0
  };
}

function optionColorValue(value) {
  if (!value || value === true) return null;
  return String(value).trim();
}

function extractNestedNodeText(source) {
  const text = String(source);
  if (/\\addplot|\\begin\{axis\}|\bplot\b|\\draw/.test(text) || !/\\node\b/.test(text)) return null;
  const start = text.indexOf("\\begin{tikzpicture}");
  const prefix = start > 0 ? text.slice(0, start).trim() : "";
  const nodeTexts = [];
  const pattern = /\\node\b[^{}]*\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(text))) {
    const value = match[1].trim();
    if (value) nodeTexts.push(value);
  }
  const lines = [prefix, ...nodeTexts].map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  return {
    kind: "text",
    raw: source,
    text: lines.join("\\\\"),
    scale: 1,
    color: null,
    fontFamily: undefined,
    lineStyles: lines.map(() => ({})),
    lines
  };
}

function extractPreprocessedAxisPlotGraphic(source) {
  const text = String(source || "");
  if (!/\\draw\s*\[[^\]]*\baxis plot\b/.test(text)) return null;
  const draws = text.match(/\\draw(?:\[[^\]]*\])?[^;]*;/g) || [];
  const frameDraw = draws.find((draw) => /\baxis frame\b/.test(draw));
  const boundsDraw = frameDraw || draws.find((draw) => /\baxis bounds\b/.test(draw));
  const plotDraws = draws.filter((draw) => /\baxis plot\b/.test(draw));
  if (!plotDraws.length) return null;

  const plotLines = plotDraws
    .map((draw) => extractDrawCoordinates(draw))
    .filter((line) => line.length >= 2);
  if (!plotLines.length) return null;

  const boundsCoordinates = boundsDraw ? extractDrawCoordinates(boundsDraw) : [];
  const boundsPoints = boundsCoordinates.length >= 2 ? boundsCoordinates : plotLines.flat();
  const xs = boundsPoints.map((point) => point.x).filter(Number.isFinite);
  const ys = boundsPoints.map((point) => point.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(0.12, maxX - minX);
  const height = Math.max(0.18, maxY - minY);
  const polylines = plotLines.map((line) =>
    line.map((point) => ({
      x: (point.x - minX) / width,
      y: (point.y - minY) / height
    }))
  );

  return {
    kind: "image",
    raw: source,
    fileName: "pgfplots-axis-plot",
    width,
    height,
    scale: 1,
    plot: "polyline",
    polylines,
    label: "",
    labelHeight: 0,
    lines: []
  };
}

function extractExpandedAxisPlotGraphic(source) {
  if (!/\\begin\{axis\}|\\addplot/.test(String(source || ""))) return null;
  if (!hasRawAxisUnitDimensions(source)) return null;
  const preprocessed = preprocessTikzSource(source).source;
  if (preprocessed === source || !/\\draw\s*\[[^\]]*\baxis plot\b/.test(preprocessed)) return null;
  return extractPreprocessedAxisPlotGraphic(preprocessed);
}

function hasRawAxisUnitDimensions(source) {
  const match = String(source || "").match(/\\begin\{axis\}\s*\[([\s\S]*?)\]/);
  if (!match) return false;
  const options = parseGraphicOptions(match[1]);
  return Boolean(options.x && options.y);
}

function rawPgfplotsAxisSize(source) {
  const match = String(source || "").match(/\\begin\{axis\}\s*\[([\s\S]*?)\]/);
  if (!match) return {};
  const options = parseGraphicOptions(match[1]);
  return {
    width: parseTikzGraphicDimension(options.width),
    height: parseTikzGraphicDimension(options.height)
  };
}

function fmWavePlaceholderLayout(axisSize = {}, options = {}) {
  const boundsMargin = options.hasPreprocessedBoundsMargin ? 0.12 : 0;
  const rawAxisWidth = Number(axisSize?.width);
  const rawAxisHeight = Number(axisSize?.height);
  const axisWidth = Number.isFinite(rawAxisWidth) ? Math.max(0.1, rawAxisWidth - boundsMargin) : null;
  const axisHeight = Number.isFinite(rawAxisHeight) ? Math.max(0.1, rawAxisHeight - boundsMargin) : null;
  const width = axisWidth ? axisWidth * FM_WAVE_AXIS_WIDTH_RATIO : 2.62;
  const waveHeight = axisHeight ? axisHeight * FM_WAVE_AXIS_HEIGHT_RATIO : 0.59;
  const labelHeight = options.hasLabel ? FM_WAVE_LABEL_HEIGHT_CM : 0;
  return {
    width,
    height: waveHeight + labelHeight,
    labelHeight
  };
}

function extractDrawCoordinates(draw) {
  return [...String(draw || "").matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

// Claude: 从「只含直线段 \draw」的嵌套图里提取折线，归一化到 [0,1]，供渲染器按框比例还原。
// 含 \node / \addplot / axis / plot 等复杂元素的不在此处理（返回 null，走占位逻辑）。
function extractInlineDrawPolylines(source) {
  if (/\\addplot|\\begin\{axis\}|\\node\b|\bplot\b/.test(source)) return null;
  const draws = String(source).match(/\\draw[^;]*;/g);
  if (!draws) return null;
  const polylines = [];
  for (const draw of draws) {
    if (!draw.includes("--")) continue;
    const coords = [...draw.matchAll(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2])
    }));
    if (coords.length >= 2) polylines.push(coords);
  }
  if (!polylines.length) return null;
  const all = polylines.flat();
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(0.1, maxX - minX);
  const height = Math.max(0.1, maxY - minY);
  const normalized = polylines.map((line) => line.map((point) => ({ x: (point.x - minX) / width, y: (point.y - minY) / height })));
  return {
    kind: "image",
    raw: source,
    fileName: "inline-tikz-draw",
    width,
    height,
    scale: 1,
    plot: "polyline",
    polylines: normalized,
    lines: []
  };
}

function extractNestedMiniTikzGraphic(source) {
  const text = String(source || "");
  if (!/\\begin\{tikzpicture\}/.test(text) || /\\addplot|\\begin\{axis\}/.test(text)) return null;
  const bodyMatch = text.match(/\\begin\{tikzpicture\}(?:\[[^\]]*\])?([\s\S]*)\\end\{tikzpicture\}/);
  if (!bodyMatch) return null;
  const body = expandMiniTikzForeach(stripMiniTikzDebugLayers(bodyMatch[1].replace(/%.*$/gm, "")));
  const polylines = extractMiniTikzPolylines(body);
  const rectangles = extractMiniTikzRectangles(body);
  const circles = [
    ...extractMiniTikzNodeCircles(body),
    ...extractMiniTikzDrawNodeCircles(body)
  ];
  if (!polylines.length && !rectangles.length && !circles.length) return null;

  const bounds = [];
  for (const polyline of polylines) {
    for (const point of polyline.points || []) bounds.push(point);
  }
  for (const circle of circles) {
    bounds.push({ x: circle.x - circle.r, y: circle.y - circle.r });
    bounds.push({ x: circle.x + circle.r, y: circle.y + circle.r });
  }
  for (const rect of rectangles) {
    bounds.push({ x: Math.min(rect.x1, rect.x2), y: Math.min(rect.y1, rect.y2) });
    bounds.push({ x: Math.max(rect.x1, rect.x2), y: Math.max(rect.y1, rect.y2) });
  }
  const xs = bounds.map((point) => point.x).filter(Number.isFinite);
  const ys = bounds.map((point) => point.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    kind: "image",
    raw: source,
    fileName: "nested-mini-tikz",
    width: Math.max(0.1, maxX - minX),
    height: Math.max(0.1, maxY - minY),
    minX,
    maxY,
    scale: 1,
    plot: "mini-tikz",
    circles,
    rectangles,
    polylines,
    lines: []
  };
}

function expandMiniTikzForeach(text) {
  let output = "";
  let cursor = 0;
  const source = String(text || "");
  while (cursor < source.length) {
    const index = source.indexOf(String.raw`\foreach`, cursor);
    if (index === -1) {
      output += source.slice(cursor);
      break;
    }
    const parsed = readMiniTikzForeach(source, index);
    if (!parsed) {
      output += source.slice(cursor, index + String.raw`\foreach`.length);
      cursor = index + String.raw`\foreach`.length;
      continue;
    }
    output += source.slice(cursor, index) + parsed.expanded;
    cursor = parsed.end;
  }
  return output;
}

function stripMiniTikzDebugLayers(text) {
  return String(text || "")
    .replace(/\\begin\{scope\}\s*\[[^\]]*\bon background layer\b[^\]]*\][\s\S]*?\\end\{scope\}/g, "")
    .replace(/\\draw(?:\s*\[[^\]]*\])?[^;]*current bounding box[^;]*\bgrid\b[^;]*;/g, "");
}

function readMiniTikzForeach(text, start) {
  let cursor = start + String.raw`\foreach`.length;
  cursor = skipTextWhitespace(text, cursor);
  if (text[cursor] !== "\\") return null;
  cursor += 1;
  const variableMatch = text.slice(cursor).match(/^[A-Za-z]+/);
  if (!variableMatch) return null;
  const variable = variableMatch[0];
  cursor += variable.length;
  cursor = skipTextWhitespace(text, cursor);
  if (!/^in\b/.test(text.slice(cursor))) return null;
  cursor += 2;
  cursor = skipTextWhitespace(text, cursor);
  const list = readBalanced(text, cursor);
  if (!list) return null;
  cursor = skipTextWhitespace(text, list.end);
  const body = readMiniTikzForeachBody(text, cursor);
  if (!body) return null;
  const values = miniTikzForeachValues(list.content);
  const expanded = values
    .map((value) => expandMiniTikzForeach(replaceMiniTikzVariable(body.content, variable, value)))
    .join("\n");
  return { expanded, end: body.end };
}

function readMiniTikzForeachBody(text, start) {
  const cursor = skipTextWhitespace(text, start);
  if (text[cursor] === "{") {
    const body = readBalanced(text, cursor);
    return body ? { content: body.content, end: body.end } : null;
  }
  if (text.startsWith(String.raw`\foreach`, cursor)) {
    const nested = readMiniTikzForeach(text, cursor);
    return nested ? { content: text.slice(cursor, nested.end), end: nested.end } : null;
  }
  const semicolon = text.indexOf(";", cursor);
  if (semicolon === -1) return null;
  return { content: text.slice(cursor, semicolon + 1), end: semicolon + 1 };
}

function miniTikzForeachValues(content) {
  const text = String(content || "").trim();
  const range = text.match(/^(-?\d+)\s*,\s*\\.\\.\\.\s*,\s*(-?\d+)$/) || text.match(/^(-?\d+)\s*,\s*\.\.\.\s*,\s*(-?\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    const step = start <= end ? 1 : -1;
    const values = [];
    for (let value = start; step > 0 ? value <= end : value >= end; value += step) values.push(String(value));
    return values;
  }
  return text.split(",").map((part) => part.trim()).filter(Boolean);
}

function replaceMiniTikzVariable(text, variable, value) {
  return String(text || "").replace(new RegExp(String.raw`\\${escapeRegExp(variable)}(?![A-Za-z])`, "g"), String(value));
}

function extractMiniTikzPolylines(body) {
  const polylines = [];
  const pattern = /\\draw(?:\s*\[([^\]]*)\])?([\s\S]*?);/g;
  let match;
  while ((match = pattern.exec(body))) {
    const path = match[2] || "";
    if (!path.includes("--")) continue;
    if (/\brectangle\b/.test(path)) continue;
    const points = readMiniTikzPathCoordinates(path);
    if (points.length < 2) continue;
    const options = parseGraphicOptions(match[1] || "");
    const closed = /\bcycle\b/.test(path);
    polylines.push({
      points: closed ? [...points, points[0]] : points,
      stroke: miniTikzStrokeColor(options),
      lineWidth: options.thick ? 1.2 : 0.6
    });
  }
  return polylines;
}

function readMiniTikzPathCoordinates(path) {
  const points = [];
  const text = String(path || "");
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "(") continue;
    const coordinate = readBalancedDelimited(text, index, "(", ")");
    if (!coordinate) continue;
    const point = parseMiniTikzCoordinate(coordinate.content);
    if (point) points.push(point);
    index = coordinate.end - 1;
  }
  return points;
}

function extractMiniTikzRectangles(body) {
  const rectangles = [];
  const pattern = /\\draw(?:\s*\[([^\]]*)\])?\s*\(([^()]*)\)\s*rectangle\s*\(([^()]*)\)\s*;/g;
  let match;
  while ((match = pattern.exec(body))) {
    const from = parseMiniTikzCoordinate(match[2]);
    const to = parseMiniTikzCoordinate(match[3]);
    if (!from || !to) continue;
    const options = parseGraphicOptions(match[1] || "");
    rectangles.push({
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      stroke: miniTikzStrokeColor(options),
      lineWidth: options.thick ? 1.2 : 0.6
    });
  }
  return rectangles;
}

function extractMiniTikzNodeCircles(body) {
  const circles = [];
  let cursor = 0;
  const text = String(body || "");
  while (cursor < text.length) {
    const index = text.indexOf(String.raw`\node`, cursor);
    if (index === -1) break;
    const parsed = readMiniTikzNodeCircle(text, index);
    if (parsed?.circle) circles.push(parsed.circle);
    cursor = parsed?.end || index + String.raw`\node`.length;
  }
  return circles;
}

function readMiniTikzNodeCircle(text, start) {
  let cursor = start + String.raw`\node`.length;
  cursor = skipTextWhitespace(text, cursor);
  let options = {};
  if (text[cursor] === "[") {
    const read = readBalancedDelimited(text, cursor, "[", "]");
    if (!read) return null;
    options = parseGraphicOptions(read.content);
    cursor = skipTextWhitespace(text, read.end);
  }
  if (text[cursor] === "(") {
    const name = readBalancedDelimited(text, cursor, "(", ")");
    if (!name) return null;
    cursor = skipTextWhitespace(text, name.end);
  }
  if (!/^at\b/.test(text.slice(cursor))) return null;
  cursor = skipTextWhitespace(text, cursor + 2);
  if (text[cursor] !== "(") return null;
  const coordinate = readBalancedDelimited(text, cursor, "(", ")");
  if (!coordinate) return null;
  const point = parseMiniTikzCoordinate(coordinate.content);
  if (!point) return null;
  const semicolon = text.indexOf(";", coordinate.end);
  return {
    end: semicolon === -1 ? coordinate.end : semicolon + 1,
    circle: miniTikzCircleFromOptions(options, point)
  };
}

function extractMiniTikzDrawNodeCircles(body) {
  const circles = [];
  const pattern = /\\draw\s*\(([^()]*)\)\s*node\s*\[([^\]]*)\]\s*\{\s*\}\s*;/g;
  let match;
  while ((match = pattern.exec(body))) {
    const point = parseMiniTikzCoordinate(match[1]);
    if (!point) continue;
    const circle = miniTikzCircleFromOptions(parseGraphicOptions(match[2] || ""), point);
    if (circle) circles.push(circle);
  }
  return circles;
}

function miniTikzCircleFromOptions(options, point) {
  if (!point) return null;
  if (options.atom !== undefined) {
    return {
      x: point.x,
      y: point.y,
      r: (parseTikzGraphicDimension(options["minimum size"]) ?? parseTikzGraphicDimension("0.4cm")) / 2,
      fill: miniTikzAtomFillColor(options),
      shading: "ball"
    };
  }
  if (!options.circle && options.shape !== "circle") return null;
  const minimumSize = parseTikzGraphicDimension(options["minimum size"]);
  const innerSep = parseTikzGraphicDimension(options["inner sep"]) ?? parseTikzGraphicDimension("2pt");
  return {
    x: point.x,
    y: point.y,
    r: minimumSize ? minimumSize / 2 : Math.max(0.025, innerSep),
    fill: miniTikzFillColor(options),
    shading: options.shading === "ball" ? "ball" : null
  };
}

function parseMiniTikzCoordinate(value) {
  let text = String(value || "").trim();
  if (!text) return null;
  if (text.startsWith("$") && text.endsWith("$")) text = text.slice(1, -1).trim();
  const sum = text.match(/^\(([^()]*)\)\s*\+\s*\(([^()]*)\)$/);
  if (sum) {
    const a = parseMiniTikzCoordinate(sum[1]);
    const b = parseMiniTikzCoordinate(sum[2]);
    return a && b ? { x: a.x + b.x, y: a.y + b.y } : null;
  }
  const direct = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  const direct3d = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!direct && !direct3d) return null;
  if (direct3d) return projectMiniTikz3dCoordinate(Number(direct3d[1]), Number(direct3d[2]), Number(direct3d[3]));
  const x = Number(direct[1]);
  const y = Number(direct[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function projectMiniTikz3dCoordinate(x, y, z) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return {
    x: x + z * 0.42,
    y: y + z * 0.32
  };
}

function miniTikzStrokeColor(options = {}) {
  if (options.black || options.draw === "black") return "black";
  if (options.draw && options.draw !== true) return String(options.draw);
  return "black";
}

function miniTikzAtomFillColor(options = {}) {
  if (options["ball color"]) return String(options["ball color"]);
  if (options.atom !== undefined && options.atom !== true) return String(options.atom);
  if (options.fill && options.fill !== true) return String(options.fill);
  return "black";
}

function miniTikzFillColor(options = {}) {
  if (options.fill === undefined || options.fill === true) return "black";
  return String(options.fill);
}

function skipTextWhitespace(text, start) {
  let cursor = start;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseGraphicOptions(input) {
  const options = {};
  for (const part of String(input).split(",")) {
    const [key, value] = part.split("=").map((item) => item?.trim());
    if (key && value) options[key] = value;
    else if (key) options[key] = true;
  }
  return options;
}

function parseCmDimension(value) {
  const match = String(value || "").match(/^(-?\d+(?:\.\d+)?)\s*cm$/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

function readWholeCommand(text, name, argCount) {
  const start = text.indexOf(`\\${name}`);
  if (start !== 0) return null;
  const read = readCommandAt(text, start, name, argCount);
  if (!read || text.slice(read.end).trim()) return null;
  return read;
}

function replaceCommand(text, name, argCount, mapper) {
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(`\\${name}`, cursor);
    if (index === -1) {
      output += text.slice(cursor);
      break;
    }
    const read = readCommandAt(text, index, name, argCount);
    if (!read) {
      output += text.slice(cursor, index + name.length + 1);
      cursor = index + name.length + 1;
      continue;
    }
    output += text.slice(cursor, index);
    output += mapper(read.args);
    cursor = read.end;
  }
  return output;
}

function readCommandAt(text, index, name, argCount) {
  if (!text.startsWith(`\\${name}`, index)) return null;
  let cursor = index + name.length + 1;
  const args = [];
  for (let count = 0; count < argCount; count += 1) {
    while (/\s/.test(text[cursor] || "")) cursor += 1;
    const arg = readBalanced(text, cursor);
    if (!arg) return null;
    args.push(arg.content);
    cursor = arg.end;
  }
  return { args, end: cursor };
}

function readBalanced(text, start) {
  if (text[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(start + 1, index),
          end: index + 1
        };
      }
    }
  }
  return null;
}

function readBalancedDelimited(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(start + 1, index),
          end: index + 1
        };
      }
    }
  }
  return null;
}

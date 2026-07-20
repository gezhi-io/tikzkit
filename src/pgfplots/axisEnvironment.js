import { parseOptions, styleDefinitionsFromOptions } from "../engine/options.js";
import { renderPgfplotsAxisAsTikz } from "./axisTikzLowering.js";

export const PGFPLOTS_ENVIRONMENTS = [
  { name: "semilogxaxis", defaultOptions: { xmode: "log" } },
  { name: "semilogyaxis", defaultOptions: { ymode: "log" } },
  { name: "loglogaxis", defaultOptions: { xmode: "log", ymode: "log" } },
  {
    name: "ternaryaxis",
    defaultOptions: {
      "pgfplots ternary axis": true,
      grid: "major",
      xmin: 0,
      xmax: 1,
      ymin: 0,
      ymax: 1,
      zmin: 0,
      zmax: 1
    }
  },
  { name: "axis", defaultOptions: {} }
];

export function expandPgfplotsAxes(
  source,
  diagnostics = [],
  options = {},
  axisDependencies = {},
  renderAxis = renderPgfplotsAxisAsTikz
) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const axisEnvironment = findNextPgfplotsEnvironment(source, index);
    if (!axisEnvironment) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, axisEnvironment.beginIndex);
    let cursor = axisEnvironment.beginIndex + axisEnvironment.begin.length;
    const axisOptions = parseOptionalOptions(source, cursor);
    cursor = axisOptions.end;
    const endIndex = source.indexOf(axisEnvironment.end, cursor);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: `Unclosed pgfplots ${axisEnvironment.name} environment` });
      output += source.slice(axisEnvironment.beginIndex);
      break;
    }
    const body = source.slice(cursor, endIndex);
    const parsedAxisOptions = parseOptions(axisOptions.raw);
    const pictureOptions = findContainingTikzPictureOptions(source, axisEnvironment.beginIndex);
    const pictureScale = uniformPictureScale(pictureOptions);
    const renderedAxis = renderAxis(
      {
        ...axisEnvironment.defaultOptions,
        ...parsedAxisOptions,
        "pgfplots explicit x unit": Object.hasOwn(parsedAxisOptions, "x"),
        "pgfplots explicit y unit": Object.hasOwn(parsedAxisOptions, "y"),
        ...(pictureScale === 1 ? {} : { "tikzkit pgfplots picture scale": pictureScale })
      },
      body,
      withLocalPgfplotsStyleDefinitions(source, axisEnvironment.beginIndex, options),
      diagnostics,
      axisDependencies
    );
    output += scaleLoweredPgfplotsPathStyles(renderedAxis, pictureScale);
    index = endIndex + axisEnvironment.end.length;
  }
  return output;
}

function scaleLoweredPgfplotsPathStyles(source, scale) {
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return source;
  return String(source).replace(
    /\\(draw|path|fill|filldraw)(\s*)\[/g,
    (_match, command, spacing) => `\\${command}${spacing}[tikzkit pgfplots style scale=${scale},`
  );
}

function uniformPictureScale(options = {}) {
  const scale = Number(options.scale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function withLocalPgfplotsStyleDefinitions(source, offset, options = {}) {
  const localStyles = collectLocalStyleDefinitions(source, offset);
  if (!Object.keys(localStyles).length) return options;
  return {
    ...options,
    pgfplotsStyleDefinitions: {
      ...(options.pgfplotsStyleDefinitions || {}),
      ...localStyles
    }
  };
}

function collectLocalStyleDefinitions(source, offset) {
  const windowSource = source.slice(localStyleWindowStart(source, offset), offset);
  const styles = {};
  let index = 0;
  while (index < windowSource.length) {
    if (windowSource.startsWith("\\tikzstyle", index)) {
      const parsed = parseTikzstyleDefinition(windowSource, index);
      if (parsed) {
        styles[parsed.name] = parseOptions(parsed.options);
        index = parsed.end;
        continue;
      }
    }
    if (windowSource.startsWith("\\tikzset", index)) {
      const parsed = parseTikzsetStyleDefinitions(windowSource, index);
      if (parsed) {
        Object.assign(styles, parsed.styles);
        index = parsed.end;
        continue;
      }
    }
    index += 1;
  }
  return styles;
}

function localStyleWindowStart(source, offset) {
  const begin = "\\begin{tikzpicture}";
  const beginIndex = source.lastIndexOf(begin, offset);
  if (beginIndex === -1) return 0;
  const endIndex = source.lastIndexOf("\\end{tikzpicture}", offset);
  if (endIndex > beginIndex) return 0;
  let cursor = beginIndex + begin.length;
  const options = parseOptionalOptions(source, cursor);
  return options.end;
}

function parseTikzstyleDefinition(source, start) {
  let index = start + "\\tikzstyle".length;
  index = skipWhitespace(source, index);
  let name = null;
  if (source[index] === "{") {
    const parsedName = extractBalanced(source, index, "{", "}");
    if (!parsedName) return null;
    name = parsedName.content.trim();
    index = parsedName.end;
  } else {
    const match = source.slice(index).match(/^([A-Za-z0-9_./ -]+)/);
    if (!match) return null;
    name = match[1].trim();
    index += match[0].length;
  }
  index = skipWhitespace(source, index);
  if (source[index] !== "=") return null;
  index = skipWhitespace(source, index + 1);
  const options = extractBalanced(source, index, "[", "]");
  if (!name || !options) return null;
  return { name, options: options.content, end: options.end };
}

function parseTikzsetStyleDefinitions(source, start) {
  let index = start + "\\tikzset".length;
  index = skipWhitespace(source, index);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  return {
    styles: styleDefinitionsFromOptions(parseOptions(body.content)),
    end: body.end
  };
}

export function findNextPgfplotsEnvironment(source, start = 0) {
  let best = null;
  for (const environment of PGFPLOTS_ENVIRONMENTS) {
    const begin = `\\begin{${environment.name}}`;
    const beginIndex = source.indexOf(begin, start);
    if (beginIndex === -1) continue;
    if (!best || beginIndex < best.beginIndex) {
      best = {
        ...environment,
        begin,
        end: `\\end{${environment.name}}`,
        beginIndex
      };
    }
  }
  return best;
}

export function findContainingTikzPictureOptions(source, offset) {
  const begin = "\\begin{tikzpicture}";
  const beginIndex = source.lastIndexOf(begin, offset);
  if (beginIndex === -1) return {};
  const endIndex = source.lastIndexOf("\\end{tikzpicture}", offset);
  if (endIndex > beginIndex) return {};
  const options = parseOptionalOptions(source, beginIndex + begin.length);
  return parseOptions(options.raw);
}

function parseOptionalOptions(text, start) {
  let cursor = skipWhitespace(text, start);
  if (text[cursor] !== "[") return { raw: "", end: cursor };
  const balanced = extractBalanced(text, cursor, "[", "]");
  if (!balanced) return { raw: "", end: cursor };
  return { raw: balanced.content, end: balanced.end };
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length) {
      index += 1;
      continue;
    }
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

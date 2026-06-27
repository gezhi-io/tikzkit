import { evaluateMath, parseDimension } from "../math.js";
import { parseOptions } from "../options.js";

export const neuralNetworkExtension = {
  name: "neuralnetwork",
  phase: "preprocess",
  package: "neuralnetwork",
  commands: ["neuralnetwork", "inputlayer", "hiddenlayer", "outputlayer", "linklayers"],
  preprocess(source, context = {}) {
    if (!String(source).includes("\\begin{neuralnetwork}")) return source;
    return expandNeuralNetworkEnvironments(String(source), context);
  }
};

function expandNeuralNetworkEnvironments(source, context) {
  let output = "";
  let index = 0;
  const begin = "\\begin{neuralnetwork}";
  const end = "\\end{neuralnetwork}";
  while (index < source.length) {
    const start = source.indexOf(begin, index);
    if (start === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, start);
    let cursor = start + begin.length;
    const options = parseOptionalOptions(source, cursor);
    cursor = options.end;
    const endIndex = findEnvironmentEnd(source, cursor, begin, end);
    if (endIndex === -1) {
      context.diagnostics?.push({ severity: "warning", message: "Unclosed neuralnetwork environment" });
      output += source.slice(start);
      break;
    }
    output += renderNeuralNetwork(options.raw, source.slice(cursor, endIndex), context);
    index = endIndex + end.length;
  }
  return output;
}

function renderNeuralNetwork(rawOptions, body, context) {
  const options = parseOptions(rawOptions);
  const mainTitle = options.title || "";
  const state = {
    height: scalarOption(options.height, 5),
    nodeSpacing: dimensionOption(options.nodespacing, 1),
    layerSpacing: dimensionOption(options.layerspacing, 2.5),
    mainTitleHeight: mainTitle ? dimensionOption(options.maintitleheight, 2.5 * 0.35) : 0,
    layerTitleHeight: dimensionOption(options.layertitleheight, 2.5 * 0.35),
    nodeSize: options.nodesize || "17pt",
    style: options.style || "",
    topRow: boolOption(options.toprow, false),
    mainTitle,
    titleStyle: options.titlestyle || "",
    layerIndex: 0,
    lastLayer: null,
    thisLayer: null,
    macros: context.macros || new Map()
  };
  const commands = [
    `\\begin{tikzpicture}[${state.style}]`,
    defaultStyles(state)
  ];
  commands.push(transformNetworkBody(body, state));
  if (state.mainTitle) {
    const width = Math.max(0, state.layerSpacing * Math.max(0, state.layerIndex - 1));
    commands.push(`\\node[rectangle,text centered,inner sep=0pt,${state.titleStyle}] (MAIN-TITLE) at (${fmt(width / 2)},0) {${state.mainTitle}};`);
  }
  commands.push("\\end{tikzpicture}");
  return commands.join("\n");
}

function defaultStyles(state) {
  return [
    `\\tikzstyle{neuron}=[circle,fill=black!25,minimum size=${state.nodeSize},inner sep=0pt];`,
    "\\tikzstyle{input neuron}=[neuron, fill=green!50];",
    "\\tikzstyle{output neuron}=[neuron, fill=red!50];",
    "\\tikzstyle{hidden neuron}=[neuron, fill=blue!40];",
    "\\tikzstyle{bias neuron}=[neuron, fill=yellow!50];",
    "\\tikzstyle{link}=[->, shorten <=0pt, shorten >=1pt, thin, draw=black!45];"
  ].join("\n");
}

function transformNetworkBody(body, state) {
  let output = "";
  let index = 0;
  while (index < body.length) {
    const command = nextNetworkCommand(body, index);
    if (!command) {
      output += body.slice(index);
      break;
    }
    output += body.slice(index, command.start);
    let cursor = command.start + command.name.length;
    const options = parseOptionalOptions(body, cursor);
    cursor = options.end;
    if (command.kind === "layer") {
      output += renderLayer(command.layerType, parseOptions(options.raw), state);
    } else {
      output += renderLinks(parseOptions(options.raw), state);
    }
    index = cursor;
  }
  return output;
}

function nextNetworkCommand(source, start) {
  const candidates = [
    { name: "\\inputlayer", kind: "layer", layerType: "input" },
    { name: "\\hiddenlayer", kind: "layer", layerType: "hidden" },
    { name: "\\outputlayer", kind: "layer", layerType: "output" },
    { name: "\\linklayers", kind: "links" }
  ];
  let best = null;
  for (const candidate of candidates) {
    const found = source.indexOf(candidate.name, start);
    if (found !== -1 && (!best || found < best.start)) best = { ...candidate, start: found };
  }
  return best;
}

function renderLayer(type, rawOptions, state) {
  const defaults = {
    title: "",
    titlestyle: "",
    count: 5,
    text: "",
    nodeclass: `${type} neuron`,
    bias: type === "output" ? false : true,
    biaspos: "top",
    top: false,
    widetitle: false
  };
  const options = { ...defaults, ...rawOptions };
  const count = Math.max(0, Math.trunc(scalarOption(options.count, defaults.count)));
  const bias = boolOption(options.bias, defaults.bias);
  const top = boolOption(options.top, defaults.top);
  const startIndex = bias ? 0 : 1;
  let offset = state.mainTitleHeight + state.layerTitleHeight;
  if (!top) {
    offset += (state.nodeSpacing * (state.height - (1 + count - startIndex))) / 2;
  }
  if (state.topRow && !bias) offset += state.nodeSpacing / 2;
  const x = state.layerSpacing * state.layerIndex;
  const layerNumber = state.layerIndex;
  const commands = [];

  if (bias) {
    commands.push(`\\node[bias neuron] (L${layerNumber}-0) at (${fmt(x)},${fmt(-offset)}) {${captionFor(options.text, layerNumber, 0, state)}};`);
  }
  for (let node = 1; node <= count; node += 1) {
    const y = -(state.nodeSpacing * (node - startIndex) + offset);
    commands.push(`\\node[${options.nodeclass}] (L${layerNumber}-${node}) at (${fmt(x)},${fmt(y)}) {${captionFor(options.text, layerNumber, node, state)}};`);
  }
  if (options.title) {
    const textWidth = Math.max(0.1, state.layerSpacing - 0.35);
    commands.push(
      `\\node[align=center,text width=${fmt(textWidth)}cm,${options.titlestyle}] (T${layerNumber}) at (${fmt(x)},${fmt(state.mainTitleHeight)}) {${options.title}};`
    );
  }

  state.lastLayer = state.thisLayer;
  state.thisLayer = { index: layerNumber, start: startIndex, count };
  state.layerIndex += 1;
  return commands.join("\n");
}

function renderLinks(options, state) {
  if (!state.lastLayer || !state.thisLayer) return "";
  const commands = [];
  const style = options.style ? `,${options.style}` : "";
  const notFrom = numberSet(options["not from"]);
  const notTo = numberSet(options["not to"]);
  for (let from = state.lastLayer.start; from <= state.lastLayer.count; from += 1) {
    if (notFrom.has(from)) continue;
    for (let to = 1; to <= state.thisLayer.count; to += 1) {
      if (notTo.has(to)) continue;
      commands.push(`\\draw[link${style}] (L${state.lastLayer.index}-${from}) -- (L${state.thisLayer.index}-${to});`);
    }
  }
  return commands.join("\n");
}

function captionFor(callback, layer, node, state) {
  const text = String(callback || "").trim();
  if (!text) return "";
  const command = text.match(/^\\([A-Za-z@][A-Za-z0-9@]*)$/);
  if (!command) return text;
  const macro = state.macros.get(command[1]);
  if (!macro) return "";
  return applyMacroBody(macro.body, [String(layer), String(node)]);
}

function applyMacroBody(body, args) {
  let output = String(body || "");
  args.forEach((arg, index) => {
    output = output.replaceAll(`#${index + 1}`, arg);
  });
  return output;
}

function numberSet(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item))
  );
}

function boolOption(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === false) return value;
  const text = String(value).trim().toLowerCase();
  if (["false", "0", "no", "off"].includes(text)) return false;
  if (["true", "1", "yes", "on"].includes(text)) return true;
  return fallback;
}

function scalarOption(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = evaluateMath(String(value));
  return Number.isFinite(number) ? number : fallback;
}

function dimensionOption(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = parseDimension(String(value));
  return Number.isFinite(number) ? number : fallback;
}

function parseOptionalOptions(source, start) {
  let index = skipWhitespace(source, start);
  if (source[index] !== "[") return { raw: "", end: index };
  const parsed = extractBalanced(source, index, "[", "]");
  if (!parsed) return { raw: "", end: index };
  return { raw: parsed.content, end: parsed.end };
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return { content: source.slice(start + 1, index), end: index + 1 };
      }
    }
  }
  return null;
}

function findEnvironmentEnd(source, start, begin, end) {
  let depth = 1;
  let cursor = start;
  while (cursor < source.length) {
    const nextBegin = source.indexOf(begin, cursor);
    const nextEnd = source.indexOf(end, cursor);
    if (nextEnd === -1) return -1;
    if (nextBegin !== -1 && nextBegin < nextEnd) {
      depth += 1;
      cursor = nextBegin + begin.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return nextEnd;
    cursor = nextEnd + end.length;
  }
  return -1;
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function fmt(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return String(Math.round(number * 10000) / 10000);
}

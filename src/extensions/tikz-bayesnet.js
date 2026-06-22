import { splitTopLevel, stripOuterBraces } from "../options.js";

const BAYESNET_STYLES = String.raw`
\tikzset{
  latent/.style={circle,fill=white,draw=black,inner sep=1pt,minimum size=20pt,font=\fontsize{10}{10}\selectfont,node distance=1cm},
  obs/.style={latent,fill=gray!25},
  const/.style={rectangle,draw=none,fill=none,inner sep=0pt,node distance=1cm},
  factor/.style={rectangle,draw=black,fill=black,minimum size=5pt,minimum width=5pt,minimum height=5pt,inner sep=0pt,node distance=0.4cm},
  det/.style={diamond,fill=white,draw=black,inner sep=1pt,minimum size=20pt,font=\fontsize{10}{10}\selectfont,node distance=1cm},
  caption/.style={font=\footnotesize,node distance=0},
  factor caption/.style={caption,inner sep=1pt},
  plate caption/.style={caption,inner sep=0pt},
  bayesnet plate/.style={draw,rectangle,rounded corners,inner sep=5pt},
  bayesnet gate/.style={draw,rectangle,dashed,inner sep=5pt}
}
`;

export const tikzBayesnetExtension = {
  name: "tikz-bayesnet",
  phase: "preprocess",
  description: "Expands jluttine/tikz-bayesnet styles and macros into ordinary TikZ nodes and paths.",
  commands: ["edge", "factoredge", "factor", "plate", "gate", "vgate", "hgate"],
  preprocess(source, context = {}) {
    return expandTikzBayesnet(String(source), context.diagnostics || [], context);
  }
};

const BAYESNET_COMMANDS = new Set(tikzBayesnetExtension.commands);

export function expandTikzBayesnet(source, diagnostics = [], context = {}) {
  if (!usesTikzBayesnet(source, context)) return source;
  return `${BAYESNET_STYLES}\n${expandWithMacros(source, diagnostics)}`;
}

function usesTikzBayesnet(source, context = {}) {
  if ((context.libraries || []).some((library) => library?.name === "bayesnet")) return true;
  return /\\usetikzlibrary(?:\[[^\]]*\])?\{[^}]*bayesnet[^}]*\}|\\(?:factoredge|factor|plate|gate|vgate|hgate)\b|\[(?:[^\]]*,\s*)?(?:latent|obs|det|const|factor)(?:\s*,|\])/.test(
    source
  );
}

function expandWithMacros(source, diagnostics) {
  let output = "";
  let index = 0;
  let generated = 0;

  while (index < source.length) {
    if (source[index] !== "\\") {
      output += source[index];
      index += 1;
      continue;
    }
    const command = readCommandName(source, index + 1);
    if (!command || !BAYESNET_COMMANDS.has(command.value)) {
      output += command ? source.slice(index, command.end) : source[index];
      index = command ? command.end : index + 1;
      continue;
    }
    const parsed = parseBayesnetCommand(source, command.value, command.end, diagnostics, () => {
      generated += 1;
      return generated;
    });
    if (!parsed) {
      output += source.slice(index, command.end);
      index = command.end;
      continue;
    }
    output += parsed.text;
    index = parsed.end;
  }
  return output;
}

function parseBayesnetCommand(source, name, afterName, diagnostics, nextId) {
  if (name === "edge") return parseEdgeMacro(source, afterName, diagnostics);
  if (name === "factoredge") return parseFactoredgeMacro(source, afterName, diagnostics);
  if (name === "factor") return parseFactorMacro(source, afterName, diagnostics, nextId);
  if (name === "plate") return parsePlateMacro(source, afterName, diagnostics, nextId);
  if (name === "gate") return parseGateMacro(source, afterName, diagnostics, nextId);
  if (name === "vgate") return parseSplitGateMacro(source, afterName, diagnostics, nextId, "vertical");
  if (name === "hgate") return parseSplitGateMacro(source, afterName, diagnostics, nextId, "horizontal");
  return null;
}

function parseEdgeMacro(source, afterName, diagnostics) {
  const parsed = readOptionalAndRequired(source, afterName, 2, diagnostics, "\\edge");
  if (!parsed) return null;
  const [inputs, outputs] = parsed.args;
  return {
    text: renderDirectedEdges(inputs, outputs, parsed.options),
    end: consumeSemicolon(source, parsed.end)
  };
}

function parseFactoredgeMacro(source, afterName, diagnostics) {
  const parsed = readOptionalAndRequired(source, afterName, 3, diagnostics, "\\factoredge");
  if (!parsed) return null;
  const [inputs, factors, outputs] = parsed.args;
  return {
    text: renderFactoredge(inputs, factors, outputs, parsed.options),
    end: consumeSemicolon(source, parsed.end)
  };
}

function parseFactorMacro(source, afterName, diagnostics, nextId) {
  const parsed = readOptionalAndRequired(source, afterName, 4, diagnostics, "\\factor");
  if (!parsed) return null;
  const [rawName, caption, inputs, outputs] = parsed.args;
  const name = cleanName(rawName) || `bayesnet-factor-${nextId()}`;
  const options = mergeOptions("factor", parsed.options);
  return {
    text: [
      String.raw`\node[${options}] (${name}) {};`,
      renderFactorCaption(name, caption),
      renderFactoredge(inputs, name, outputs, "")
    ].filter(Boolean).join("\n"),
    end: consumeSemicolon(source, parsed.end)
  };
}

function parsePlateMacro(source, afterName, diagnostics, nextId) {
  const parsed = readOptionalAndRequired(source, afterName, 3, diagnostics, "\\plate");
  if (!parsed) return null;
  const [rawName, fitlist, caption] = parsed.args;
  const name = cleanName(rawName) || `bayesnet-plate-${nextId()}`;
  const options = mergeOptions("bayesnet plate", `fit=${normalizeFitList(fitlist)}`, parsed.options);
  return {
    text: [
      String.raw`\node[${options}] (${name}) {};`,
      caption.trim() ? String.raw`\node[plate caption,anchor=north east] at (${name}.south east) {${caption}};` : ""
    ].filter(Boolean).join("\n"),
    end: consumeSemicolon(source, parsed.end)
  };
}

function parseGateMacro(source, afterName, diagnostics, nextId) {
  const parsed = readOptionalAndRequired(source, afterName, 3, diagnostics, "\\gate");
  if (!parsed) return null;
  const [rawName, fitlist, inputs] = parsed.args;
  const name = cleanName(rawName) || `bayesnet-gate-${nextId()}`;
  const options = mergeOptions("bayesnet gate", `fit=${normalizeFitList(fitlist)}`, parsed.options);
  return {
    text: [
      String.raw`\node[${options}] (${name}) {};`,
      renderGateInputs(inputs, name)
    ].filter(Boolean).join("\n"),
    end: consumeSemicolon(source, parsed.end)
  };
}

function parseSplitGateMacro(source, afterName, diagnostics, nextId, orientation) {
  const parsed = readOptionalAndRequired(source, afterName, 6, diagnostics, `\\${orientation === "vertical" ? "vgate" : "hgate"}`);
  if (!parsed) return null;
  const [rawName, fitA, captionA, fitB, captionB, inputs] = parsed.args;
  const name = cleanName(rawName) || `bayesnet-${orientation}-gate-${nextId()}`;
  const fit = `${normalizeFitList(fitA)}${normalizeFitList(fitB)}`;
  const options = mergeOptions("bayesnet gate", `fit=${fit}`, parsed.options);
  return {
    text: [
      String.raw`\node[${options}] (${name}) {};`,
      renderSplitGateCaptions(name, captionA, captionB, orientation),
      renderSplitGateDivider(name, orientation),
      renderGateInputs(inputs, name)
    ].filter(Boolean).join("\n"),
    end: consumeSemicolon(source, parsed.end)
  };
}

function renderDirectedEdges(inputsRaw, outputsRaw, optionsRaw = "") {
  const inputs = listItems(inputsRaw);
  const outputs = listItems(outputsRaw);
  const drawOptions = directedEdgeOptions(optionsRaw);
  const lines = [];
  for (const input of inputs) {
    for (const output of outputs) {
      lines.push(String.raw`\draw[${drawOptions}] (${input}) -- (${output});`);
    }
  }
  return lines.join("\n");
}

function renderFactoredge(inputsRaw, factorsRaw, outputsRaw, optionsRaw = "") {
  const inputs = listItems(inputsRaw);
  const factors = listItems(factorsRaw);
  const outputs = listItems(outputsRaw);
  const incomingOptions = mergeOptions("-", optionsRaw);
  const outgoingOptions = directedEdgeOptions(optionsRaw);
  const lines = [];
  for (const factor of factors) {
    for (const input of inputs) {
      lines.push(String.raw`\draw[${incomingOptions}] (${input}) -- (${factor});`);
    }
    for (const output of outputs) {
      lines.push(String.raw`\draw[${outgoingOptions}] (${factor}) -- (${output});`);
    }
  }
  return lines.join("\n");
}

function renderFactorCaption(name, captionRaw) {
  const caption = captionRaw.trim();
  if (!caption) return "";
  const directed = caption.match(/^(above|below|left|right|above left|above right|below left|below right)\s*:\s*([\s\S]+)$/);
  if (directed) {
    return String.raw`\node[factor caption,${directed[1]}=0.05cm of ${name}] (${name}-caption) {${directed[2].trim()}};`;
  }
  return String.raw`\node[factor caption,above=0.05cm of ${name}] (${name}-caption) {${caption}};`;
}

function renderGateInputs(inputsRaw, gateName) {
  return listItems(inputsRaw)
    .map((input) => String.raw`\draw[-*,thick] (${input}) -- (${gateName});`)
    .join("\n");
}

function renderSplitGateCaptions(name, captionA, captionB, orientation) {
  const a = captionA.trim();
  const b = captionB.trim();
  if (orientation === "vertical") {
    return [
      a ? String.raw`\node[caption,anchor=south east] at (${name}.north) {${a}};` : "",
      b ? String.raw`\node[caption,anchor=south west] at (${name}.north) {${b}};` : ""
    ].filter(Boolean).join("\n");
  }
  return [
    a ? String.raw`\node[caption,anchor=south west] at (${name}.west) {${a}};` : "",
    b ? String.raw`\node[caption,anchor=north west] at (${name}.west) {${b}};` : ""
  ].filter(Boolean).join("\n");
}

function renderSplitGateDivider(name, orientation) {
  if (orientation === "vertical") return String.raw`\draw[-,dashed] (${name}.north) -- (${name}.south);`;
  return String.raw`\draw[-,dashed] (${name}.west) -- (${name}.east);`;
}

function directedEdgeOptions(raw = "") {
  const parts = optionParts(raw);
  const explicitArrow = parts.some(isArrowOptionPart);
  if (explicitArrow) return mergeOptions(raw);
  return mergeOptions("->", ">={triangle 45}", raw);
}

function isArrowOptionPart(part) {
  const text = String(part || "").trim();
  if (["-", "->", "<-", "<->"].includes(text)) return true;
  if (/^-\{[\s\S]+\}$/.test(text) || /^\{[\s\S]+\}-$/.test(text) || /^\{[\s\S]+\}-\{[\s\S]+\}$/.test(text)) return true;
  if (/^-[A-Za-z'][A-Za-z'\s-]*$/.test(text)) return true;
  if (/^[A-Za-z'][A-Za-z'\s-]*-$/.test(text)) return true;
  if (/^[A-Za-z'][A-Za-z'\s-]*-[A-Za-z'][A-Za-z'\s-]*$/.test(text)) return true;
  return false;
}

function optionParts(raw = "") {
  return splitTopLevel(raw || "", ",").map((part) => part.trim()).filter(Boolean);
}

function mergeOptions(...groups) {
  return groups
    .flatMap((group) => optionParts(group))
    .filter(Boolean)
    .join(",");
}

function listItems(raw) {
  const text = stripOuterBraces(String(raw || "").trim());
  return splitTopLevel(text, ",")
    .map((item) => cleanName(item))
    .filter(Boolean);
}

function cleanName(raw) {
  let text = stripOuterBraces(String(raw || "").trim());
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  return text;
}

function normalizeFitList(raw) {
  return String(raw || "").trim();
}

function readOptionalAndRequired(source, start, arity, diagnostics, commandName) {
  let cursor = skipWhitespace(source, start);
  const optional = readOptional(source, cursor, "[", "]");
  cursor = optional ? skipWhitespace(source, optional.end) : cursor;
  const args = [];
  for (let index = 0; index < arity; index += 1) {
    const arg = extractBalanced(source, cursor, "{", "}");
    if (!arg) {
      diagnostics.push({ severity: "warning", message: `Malformed ${commandName} command` });
      return null;
    }
    args.push(arg.content);
    cursor = skipWhitespace(source, arg.end);
  }
  return {
    options: optional?.content || "",
    args,
    end: cursor
  };
}

function readCommandName(source, index) {
  const match = source.slice(index).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: index + match[0].length };
}

function readOptional(source, index, open, close) {
  if (source[index] !== open) return null;
  return extractBalanced(source, index, open, close);
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
        return {
          content: source.slice(start + 1, index),
          end: index + 1
        };
      }
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function consumeSemicolon(source, index) {
  const cursor = skipWhitespace(source, index);
  return source[cursor] === ";" ? cursor + 1 : index;
}

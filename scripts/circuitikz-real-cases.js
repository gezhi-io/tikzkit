import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const CIRCUITIKZ_ROOT = "work/circuitikz";
export const CIRCUITIKZ_EXPECTED_SNIPPET_COUNT = 495;
export const CIRCUITIKZ_REPOSITORY_URL = "https://github.com/circuitikz/circuitikz";
export const CIRCUITIKZ_MANUAL_PATH = "doc/circuitikzmanual.tex";

export const CIRCUITIKZ_STANDALONE_WRAPPER = String.raw`\documentclass[border=4mm]{standalone}
\usepackage{tikz}
\usepackage[siunitx,RPvoltages]{circuitikz}
\begin{document}
<>
\end{document}`;

export function hasCircuitikzCorpus(root = CIRCUITIKZ_ROOT) {
  return existsSync(path.join(root, CIRCUITIKZ_MANUAL_PATH));
}

export async function loadCircuitikzCases(root = CIRCUITIKZ_ROOT) {
  const manualPath = path.join(root, CIRCUITIKZ_MANUAL_PATH);
  const source = await readFile(manualPath, "utf8");
  const snippets = extractCircuitikzSnippets(source);

  return snippets.map((snippet, index) => {
    const number = String(index + 1).padStart(3, "0");
    const line = lineNumberAt(source, snippet.beginIndex);
    return {
      title: `circuitikz manual snippet ${number}`,
      origin: "circuitikz/circuitikz",
      path: `${CIRCUITIKZ_MANUAL_PATH}#circuitikz-${number}`,
      sourceUrl: `${CIRCUITIKZ_REPOSITORY_URL}/blob/master/${CIRCUITIKZ_MANUAL_PATH}#L${line}`,
      source: wrapCircuitikzSnippet(snippet)
    };
  });
}

export function extractCircuitikzSnippets(source) {
  const text = String(source || "");
  const snippets = [];
  const begin = "\\begin{circuitikz}";
  const end = "\\end{circuitikz}";
  let index = 0;

  while (index < text.length) {
    const beginIndex = text.indexOf(begin, index);
    if (beginIndex === -1) break;
    if (isVerbatimBegin(text, beginIndex)) {
      index = beginIndex + begin.length;
      continue;
    }
    let cursor = beginIndex + begin.length;
    const options = parseOptionalBracket(text, skipWhitespace(text, cursor));
    cursor = options ? options.end : cursor;
    const endIndex = text.indexOf(end, cursor);
    if (endIndex === -1) break;
    snippets.push({
      beginIndex,
      optionsRaw: options?.raw || "",
      body: text.slice(cursor, endIndex)
    });
    index = endIndex + end.length;
  }

  return snippets;
}

function isVerbatimBegin(source, beginIndex) {
  return source[beginIndex - 1] === "|" || /\\verb\*?\s*$/.test(source.slice(Math.max(0, beginIndex - 10), beginIndex));
}

export function wrapCircuitikzSnippet(snippet) {
  const body = String(snippet.body || "").trim();
  const picture = `\\begin{tikzpicture}${snippet.optionsRaw || ""}\n${body}\n\\end{tikzpicture}`;
  return CIRCUITIKZ_STANDALONE_WRAPPER.replace("<>", picture);
}

function parseOptionalBracket(source, start) {
  if (source[start] !== "[") return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "[" && source[index - 1] !== "\\") depth += 1;
    if (char === "]" && source[index - 1] !== "\\") {
      depth -= 1;
      if (depth === 0) {
        return {
          raw: source.slice(start, index + 1),
          end: index + 1
        };
      }
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === "\n") line += 1;
  }
  return line;
}

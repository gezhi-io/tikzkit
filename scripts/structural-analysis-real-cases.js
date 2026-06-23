import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const STRUCTURAL_ANALYSIS_ROOT = "work/TikZ-StructuralAnalysis";
export const STRUCTURAL_ANALYSIS_EXPECTED_CASE_COUNT = 227;
export const STRUCTURAL_ANALYSIS_REPOSITORY_URL = "https://github.com/hackl/TikZ-StructuralAnalysis";
export const STRUCTURAL_ANALYSIS_SOURCE_FILES = ["example.tex", "stanli.tex"];

const WRAPPER = String.raw`\documentclass[border=4mm]{standalone}
\usepackage{stanli}
\begin{document}
<>
\end{document}`;

export function hasStructuralAnalysisCorpus(root = STRUCTURAL_ANALYSIS_ROOT) {
  return STRUCTURAL_ANALYSIS_SOURCE_FILES.every((file) => existsSync(path.join(root, file)));
}

export async function loadStructuralAnalysisCases(root = STRUCTURAL_ANALYSIS_ROOT) {
  const groups = await Promise.all(
    STRUCTURAL_ANALYSIS_SOURCE_FILES.map(async (relativePath) => {
      const filePath = path.join(root, relativePath);
      const source = await readFile(filePath, "utf8");
      return extractTikzPictures(source).map((picture, index) => {
        const number = String(index + 1).padStart(3, "0");
        const line = lineNumberAt(source, picture.beginIndex);
        return {
          title: `${path.basename(relativePath, ".tex")} tikzpicture ${number}`,
          origin: "hackl/TikZ-StructuralAnalysis",
          path: `${relativePath}#tikzpicture-${number}`,
          sourceUrl: `${STRUCTURAL_ANALYSIS_REPOSITORY_URL}/blob/master/${relativePath}#L${line}`,
          source: wrapStructuralAnalysisPicture(picture)
        };
      });
    })
  );
  return groups.flat();
}

export function wrapStructuralAnalysisPicture(picture) {
  return WRAPPER.replace("<>", `${picture.setup || ""}\n${sanitizeStructuralAnalysisPicture(picture.raw)}`.trim());
}

export function sanitizeStructuralAnalysisPicture(raw) {
  let source = String(raw || "");
  const begin = "\\begin{tikzpicture}";
  const end = "\\end{tikzpicture}";
  const lastBegin = source.lastIndexOf(begin);
  if (lastBegin > 0) {
    const endAfterLastBegin = source.indexOf(end, lastBegin);
    if (endAfterLastBegin !== -1) {
      source = source.slice(lastBegin, endAfterLastBegin + end.length);
    }
  }
  return source
    .replace(/\\end\{lstlisting\}\\vspace\{[^}]*\}/g, "")
    .replace(/\\(?:begin|end)\{lstlisting\}(?:\[[^\]]*\])?/g, "")
    .replace(/\\begin\{minipage\}(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, "")
    .replace(/\\end\{minipage\}/g, "")
    .replace(/\\(?:hfill|newpage)\b/g, "")
    .replace(/\\(?:section|subsection|label)\{[^}]*\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractTikzPictures(source) {
  const text = String(source || "");
  const begin = "\\begin{tikzpicture}";
  const end = "\\end{tikzpicture}";
  const pictures = [];
  let index = 0;
  let previousEnd = 0;
  while (index < text.length) {
    const beginIndex = text.indexOf(begin, index);
    if (beginIndex === -1) break;
    let cursor = beginIndex + begin.length;
    const options = parseOptionalBracket(text, skipWhitespace(text, cursor));
    cursor = options?.end || cursor;
    const endIndex = text.indexOf(end, cursor);
    if (endIndex === -1) break;
    const raw = text.slice(beginIndex, endIndex + end.length);
    pictures.push({
      beginIndex,
      raw,
      setup: extractSetupCommands(text.slice(previousEnd, beginIndex))
    });
    previousEnd = endIndex + end.length;
    index = previousEnd;
  }
  return pictures;
}

function extractSetupCommands(segment) {
  const commands = [];
  let index = 0;
  while (index < segment.length) {
    if (segment[index] !== "\\") {
      index += 1;
      continue;
    }
    const command = readCommandName(segment, index + 1);
    if (!command || !["setcoords", "setaxis", "scaling", "dscaling"].includes(command.value)) {
      index = command?.end || index + 1;
      continue;
    }
    let cursor = command.end;
    while (cursor < segment.length) {
      cursor = skipWhitespace(segment, cursor);
      if (segment[cursor] === "{" || segment[cursor] === "[") {
        const parsed = extractBalanced(segment, cursor, segment[cursor], segment[cursor] === "{" ? "}" : "]");
        if (!parsed) break;
        cursor = parsed.end;
        continue;
      }
      break;
    }
    if (segment[cursor] === ";") cursor += 1;
    commands.push(segment.slice(index, cursor).trim());
    index = cursor;
  }
  return commands.join("\n");
}

function parseOptionalBracket(source, start) {
  if (source[start] !== "[") return null;
  return extractBalanced(source, start, "[", "]");
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === open && source[index - 1] !== "\\") depth += 1;
    if (char === close && source[index - 1] !== "\\") {
      depth -= 1;
      if (depth === 0) return { content: source.slice(start + 1, index), start, end: index + 1 };
    }
  }
  return null;
}

function readCommandName(source, index) {
  const match = source.slice(index).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: index + match[0].length };
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

import { tokenizeTikzLikeSource } from "./lexer.js";

const pictureEnvs = new Set(["tikzpicture", "circuitikz"]);
const literalEnvs = new Set(["filecontents", "filecontents*", "verbatim", "verbatim*", "lstlisting", "minted"]);

function nextToken(tokens, i) {
  while (tokens[i]?.type === "space" || tokens[i]?.type === "comment") i++;
  return i;
}

function environment(tokens, i) {
  const open = nextToken(tokens, i + 1);
  if (tokens[open]?.value !== "{" || tokens[open + 2]?.value !== "}") return null;
  return tokens[open + 1].value;
}

// A TeX group shields every delimiter inside it, including ] and ;.
// The lexer leaves escaped control symbols (e.g. \; and \}) indivisible.
function delimiter(tokens, start, closing) {
  let braces = 0, squares = 0;
  for (let i = start; i < tokens.length; i++) {
    const v = tokens[i].value;
    if (v === "{") braces++;
    else if (v === "}") {
      if (!braces) return closing === "}" ? i : -1;
      braces--;
    } else if (!braces && closing !== "}") {
      if (v === "[") squares++;
      else if (v === "]") {
        if (!squares && closing === "]") return i;
        squares = Math.max(0, squares - 1);
      } else if (!squares && closing === ";" && v === ";") return i;
      // A damaged single-command picture must not swallow the next figure.
      if (!squares && v === "\\tikz") return -1;
      if (!squares && (v === "\\begin" || v === "\\end")) {
        const env = environment(tokens, i);
        if (pictureEnvs.has(env) || env === "document") return -1;
      }
    }
  }
  return -1;
}

function readPicture(text, tokens, i) {
  let k = nextToken(tokens, i + 1), options = "";
  if (tokens[k]?.value === "[") {
    const end = delimiter(tokens, k + 1, "]");
    if (end < 0) return null;
    options = text.slice(tokens[k].start, tokens[end].end);
    k = nextToken(tokens, end + 1);
  }
  const braced = tokens[k]?.value === "{";
  if (!braced && tokens[k]?.type !== "control") return null;
  const last = delimiter(tokens, k + (braced ? 1 : 0), braced ? "}" : ";");
  if (last < 0) return null;
  const body = text.slice(braced ? tokens[k].end : tokens[k].start, braced ? tokens[last].start : tokens[last].end);
  return { last, beginIndex: tokens[i].start, endIndex: tokens[last].end, options, body, braced };
}

export function findPictureCommands(text, diagnostics = []) {
  if (!/\\tikz(?![A-Za-z@])/.test(text)) return [];
  return scanPictures(text, diagnostics, false);
}

// Reference selection needs both spellings in source order, but must not
// count a sample in a comment, a macro definition, or a picture inside a node.
export function findTopLevelPictures(text) {
  return scanPictures(text, [], true);
}

function scanPictures(text, diagnostics, includeEnvironments) {
  const tokens = tokenizeTikzLikeSource(text, { texTrivia: true });
  const ranges = [];
  let braces = 0, pictures = 0, beginIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const v = tokens[i].value;
    if (v === "{") { braces++; continue; }
    if (v === "}") { braces = Math.max(0, braces - 1); continue; }
    if (braces) continue; // Node content and TeX command arguments are not standalone figures.
    if (v === "\\begin" || v === "\\end") {
      const env = environment(tokens, i);
      if (v === "\\begin" && literalEnvs.has(env)) {
        const stop = "\\end{" + env + "}";
        const end = text.indexOf(stop, tokens[i].end);
        if (end < 0) break;
        while (tokens[i + 1]?.start < end + stop.length) i++;
      } else if (pictureEnvs.has(env)) {
        if (v === "\\begin") {
          if (!pictures && env === "tikzpicture") beginIndex = tokens[i].start;
          pictures++;
        } else if (pictures && --pictures === 0) {
          if (includeEnvironments && beginIndex !== -1) {
            ranges.push({ beginIndex, endIndex: tokens[nextToken(tokens, i + 1) + 2].end });
          }
          beginIndex = -1;
        }
      }
      continue;
    }
    if (pictures || v !== "\\tikz") continue;
    const picture = readPicture(text, tokens, i);
    if (!picture) {
      diagnostics.push({ severity: "warning", message: "Incomplete \\tikz picture: expected a braced body or a path ending in a semicolon" });
      continue;
    }
    const { last, ...range } = picture;
    ranges.push(range);
    i = last;
  }
  return ranges;
}

export function expandPictureCommands(text, diagnostics) {
  const ranges = findPictureCommands(text, diagnostics);
  if (!ranges.length) return text;
  const parts = [];
  let cursor = 0;
  for (const { beginIndex, endIndex, options, body } of ranges) {
    // PGF opens the ordinary tikzpicture before executing the short body.
    // Do this before any library lowers its commands so none can lose the
    // picture's options. The normal parser also accepts the final braced path.
    parts.push(text.slice(cursor, beginIndex), "\\begin{tikzpicture}", options,
      "\n", body, "\n\\end{tikzpicture}");
    cursor = endIndex;
  }
  return parts.join("") + text.slice(cursor);
}

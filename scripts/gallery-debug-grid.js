export const GALLERY_DEBUG_GRID_OPTIONS = "black!45,line width=0.18pt,dash pattern=on 1pt off 1.2pt,step=1cm";

export const GALLERY_DEBUG_GRID_SCOPE = String.raw`
\begin{scope}[on background layer]
  \draw[${GALLERY_DEBUG_GRID_OPTIONS}] ($(current bounding box.south west)+(-1,-1)$) grid ($(current bounding box.north east)+(1,1)$);
\end{scope}`;

const TIKZCD_GRID_STYLE = String.raw`\tikzset{tikzkit compare grid/.style={execute at end picture={${GALLERY_DEBUG_GRID_SCOPE}}}}`;

export function withGalleryDebugGrid(source) {
  const original = String(source || "");
  if (original.includes("tikzkit compare grid")) return original;
  return injectTikzCdGridOption(injectTikzPictureGrid(ensureDebugGridPreamble(original)));
}

function ensureDebugGridPreamble(source) {
  const documentIndex = source.indexOf(String.raw`\begin{document}`);
  if (documentIndex === -1) return source;
  const preamble = `${String.raw`\usetikzlibrary{backgrounds,calc}`}
${TIKZCD_GRID_STYLE}
`;
  return `${source.slice(0, documentIndex)}${preamble}${source.slice(documentIndex)}`;
}

function injectTikzPictureGrid(source) {
  const begin = String.raw`\begin{tikzpicture}`;
  const end = String.raw`\end{tikzpicture}`;
  let output = "";
  let cursor = 0;
  let depth = 0;
  while (cursor < source.length) {
    const nextBegin = source.indexOf(begin, cursor);
    const nextEnd = source.indexOf(end, cursor);
    if (nextBegin === -1 && nextEnd === -1) {
      output += source.slice(cursor);
      break;
    }
    if (nextBegin !== -1 && (nextEnd === -1 || nextBegin < nextEnd)) {
      output += source.slice(cursor, nextBegin + begin.length);
      depth += 1;
      cursor = nextBegin + begin.length;
      continue;
    }
    output += source.slice(cursor, nextEnd);
    if (depth === 1) output += GALLERY_DEBUG_GRID_SCOPE;
    output += end;
    depth = Math.max(0, depth - 1);
    cursor = nextEnd + end.length;
  }
  return output;
}

function injectTikzCdGridOption(source) {
  let output = "";
  let index = 0;
  const begin = String.raw`\begin{tikzcd}`;
  while (index < source.length) {
    const found = source.indexOf(begin, index);
    if (found === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, found + begin.length);
    const afterBegin = found + begin.length;
    let cursor = afterBegin;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    const leadingSpace = source.slice(afterBegin, cursor);
    if (source[cursor] === "[") {
      const end = findBalancedBracket(source, cursor);
      if (end !== -1) {
        const options = source.slice(cursor + 1, end).trim();
        output += `[tikzkit compare grid${options ? `,${options}` : ""}]${leadingSpace}`;
        index = end + 1;
        continue;
      }
    }
    output += `[tikzkit compare grid]${leadingSpace}`;
    index = cursor;
  }
  return output;
}

function findBalancedBracket(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "[" && source[index - 1] !== "\\") depth += 1;
    if (char === "]" && source[index - 1] !== "\\") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

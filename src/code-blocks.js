const TIKZ_FENCE_RE = /(^|\n)(```|''')tikz[^\n]*\n([\s\S]*?)(?:\n\2)(?=\n|$)/g;

export function extractTikzCodeBlocks(markdown) {
  const blocks = [];
  for (const match of String(markdown).matchAll(TIKZ_FENCE_RE)) {
    const prefixLength = match[1].length;
    const start = match.index + prefixLength;
    const end = match.index + match[0].length;
    blocks.push({
      type: "tikz",
      fence: match[2],
      code: match[3],
      start,
      end
    });
  }
  return blocks;
}

export function splitTikzCodeBlocks(markdown) {
  const source = String(markdown);
  const blocks = extractTikzCodeBlocks(source);
  const parts = [];
  let cursor = 0;

  for (const block of blocks) {
    if (block.start > cursor) {
      parts.push({ type: "text", content: source.slice(cursor, block.start) });
    }
    parts.push({ type: "tikz", content: block.code, fence: block.fence });
    cursor = block.end;
  }

  if (cursor < source.length) {
    parts.push({ type: "text", content: source.slice(cursor) });
  }

  return parts.filter((part) => part.content.length > 0);
}

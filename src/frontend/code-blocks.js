export function extractTikzCodeBlocks(markdown) {
  const source = String(markdown);
  const blocks = [];
  let open = null;
  // Track every fenced block so examples inside another language stay literal.
  for (const match of source.matchAll(/[^\r\n]*(?:\r\n|[\r\n]|$)/g)) {
    if (!match[0]) break;
    const line = match[0].replace(/(?:\r\n|[\r\n])$/, "");
    if (open) {
      const close = line.match(/^ {0,3}([`~']+)[ \t]*$/);
      if (!close || close[1].length < open.fence.length || close[1] !== open.fence[0].repeat(close[1].length)) continue;
      if (open.language === "tikz") {
        blocks.push({
          type: "tikz",
          fence: open.fence,
          code: source.slice(open.contentStart, match.index).replace(/(?:\r\n|[\r\n])$/, ""),
          start: open.start,
          end: match.index + line.length
        });
      }
      open = null;
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,}|'{3,})(.*)$/);
    if (!opening || (opening[1][0] === "`" && opening[2].includes("`"))) continue;
    open = {
      fence: opening[1],
      language: opening[2].trim().split(/[ \t]+/, 1)[0],
      start: match.index,
      contentStart: match.index + match[0].length
    };
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

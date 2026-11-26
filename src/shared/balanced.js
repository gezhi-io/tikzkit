export function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\") { i += 1; continue; }
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) {
      return {
        content: text.slice(start + 1, i),
        start,
        end: i + 1
      };
    }
  }
  return null;
}

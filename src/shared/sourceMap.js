export function createSourceSpan(start = 0, end = start, source = "") {
  return { start, end, source };
}

export function sourceSnippet(source, span, context = 40) {
  const text = String(source || "");
  const start = Math.max(0, Number(span?.start) || 0);
  const end = Math.max(start, Number(span?.end) || start);
  return text.slice(Math.max(0, start - context), Math.min(text.length, end + context));
}

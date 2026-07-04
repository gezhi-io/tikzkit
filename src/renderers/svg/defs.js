export function createSvgDefs(parts = []) {
  const body = parts.filter(Boolean).join("");
  return body ? `<defs>${body}</defs>` : "";
}

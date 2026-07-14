export function createPathShape(commands = [], style = {}) {
  return { type: "path", commands, style };
}

export function createTextShape(text, x, y, style = {}, attributes = {}) {
  return { type: "textNode", ...attributes, text, x, y, style };
}

export function createGroupShape(items = [], style = {}) {
  return { type: "group", items, style };
}

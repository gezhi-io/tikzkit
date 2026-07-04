export function createPathShape(commands = [], style = {}) {
  return { type: "path", commands, style };
}

export function createTextShape(text, x, y, style = {}) {
  return { type: "textNode", text, x, y, style };
}

export function createGroupShape(items = [], style = {}) {
  return { type: "group", items, style };
}

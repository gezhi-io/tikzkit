export const tikzCommand = {
  name: "pattern",
  kind: "command",
  status: "core",
  aliases: ["path[pattern]"],
  optionScope: "path",
  implementedBy: ["src/frontend/parser.js:parsePathCommand", "src/engine/options.js:normalizeOptions"],
  options: [
    { name: "pattern", category: "paint", status: "partial",
      notes: "Selects a stock or supported user-defined tile and enables fill; none disables it." },
    { name: "pattern color", category: "paint", status: "implemented",
      notes: "Sets the stencil ink. Inherently colored patterns keep their own palette." }
  ],
  examples: [String.raw`\pattern[pattern=bricks,pattern color=white] (0,0) rectangle (2,1);`]
};

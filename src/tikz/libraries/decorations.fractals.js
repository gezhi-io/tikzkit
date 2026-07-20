export const tikzLibrary = {
  name: "decorations.fractals",
  status: "builtin",
  implementedBy: [
    "src/frontend/parser.js:parseDecoratePathSegment",
    "src/engine/evaluate.js:applyKochSnowflakeDecoration"
  ],
  features: [
    "nested decorate path operation",
    "Koch snowflake recursive segment replacement"
  ],
  implements: [
    "nested decorate path operation",
    "Koch snowflake recursive segment replacement"
  ]
};

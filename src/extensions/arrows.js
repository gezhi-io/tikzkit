import { lowerDeclaredArrowTips, tikzLibrary } from "../tikz/libraries/arrows.js";

export const arrowsExtension = {
  name: "arrows",
  phase: "preprocess",
  description: "Lowers supported PGF user-declared arrow paths into SVG-ready inline arrow tips.",
  commands: [
    "pgfarrowsdeclare",
    "pgfarrowssave",
    "pgfarrowssavethe",
    "pgfpathmoveto",
    "pgfpathlineto",
    "pgfpathcurveto",
    "pgfpatharc"
  ],
  preprocess(source, context = {}) {
    return lowerDeclaredArrowTips(source, context.diagnostics || []);
  }
};

export { tikzLibrary };

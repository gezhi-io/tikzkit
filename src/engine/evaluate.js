import { interpretTikz } from "../interpreter.js";

export { interpretTikz };

export function evaluateTikzAst(ast, options = {}) {
  return interpretTikz(ast, options);
}

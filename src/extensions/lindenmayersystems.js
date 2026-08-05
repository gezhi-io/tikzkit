import { lowerLindenmayerSystems, tikzLibrary } from "../tikz/libraries/lindenmayersystems.js";

export const lindenmayerSystemsExtension = {
  name: "lindenmayersystems",
  phase: "preprocess",
  description: "Lowers deterministic PGF/TikZ Lindenmayer systems into ordinary TikZ path segments.",
  commands: ["pgfdeclarelindenmayersystem", "lindenmayer system", "l-system"],
  preprocess(source, context = {}) {
    return lowerLindenmayerSystems(source, context.diagnostics || []);
  }
};

export { tikzLibrary };

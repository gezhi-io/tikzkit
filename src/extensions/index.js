import { tikzBaguaExtension } from "./tikz-bagua.js";
import { tikzBpmnExtension } from "./tikz-bpmn.js";
import { tikzCdExtension } from "./tikz-cd.js";
import { tikzDecofontsExtension } from "./tikz-decofonts.js";
import { tikzDimlineExtension } from "./tikz-dimline.js";
import { tikzExtExtension } from "./tikz-ext.js";
import { tikzFeynhandExtension } from "./tikz-feynhand.js";
import { tikzFeynmanExtension } from "./tikz-feynman.js";
import { tikzfxgraphExtension } from "./tikzfxgraph.js";
import { tikzNetworkExtension } from "./tikz-network.js";
import { tikzPalatticeExtension } from "./tikz-palattice.js";
import { tikzQtreeExtension } from "./tikz-qtree.js";
import { tikzquadsExtension } from "./tikzquads.js";
import { tikzThreeDPlotExtension } from "./tikz-3dplot.js";

export const BUILTIN_EXTENSIONS = [
  tikzNetworkExtension,
  tikzThreeDPlotExtension,
  tikzBaguaExtension,
  tikzBpmnExtension,
  tikzCdExtension,
  tikzDecofontsExtension,
  tikzDimlineExtension,
  tikzExtExtension,
  tikzFeynhandExtension,
  tikzFeynmanExtension,
  tikzfxgraphExtension,
  tikzPalatticeExtension,
  tikzQtreeExtension,
  tikzquadsExtension
];

export function applyPreprocessExtensions(source, context = {}) {
  const extensions = [...BUILTIN_EXTENSIONS, ...(context.options?.extensions || [])];
  let current = source;
  for (const extension of extensions) {
    if (!extension || typeof extension.preprocess !== "function") continue;
    const result = extension.preprocess(current, {
      ...context,
      extensionName: extension.name || "anonymous-extension"
    });
    if (typeof result === "string") {
      current = result;
    } else if (result && typeof result.source === "string") {
      current = result.source;
    }
  }
  return current;
}

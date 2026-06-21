import { tikzNetworkExtension } from "./tikz-network.js";
import { tikzThreeDPlotExtension } from "./tikz-3dplot.js";

export const BUILTIN_EXTENSIONS = [tikzNetworkExtension, tikzThreeDPlotExtension];

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

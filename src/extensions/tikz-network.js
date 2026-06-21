export const tikzNetworkExtension = {
  name: "tikz-network",
  phase: "preprocess",
  description: "Expands common tikz-network commands into ordinary TikZ nodes and paths.",
  commands: [
    "SetDefaultUnit",
    "SetDistanceScale",
    "SetVertexStyle",
    "SetEdgeStyle",
    "EdgesInBG",
    "EdgesNotInBG",
    "Vertex",
    "Edge",
    "Vertices",
    "Edges"
  ],
  preprocess(source, context = {}) {
    return context.helpers?.expandTikzNetworkMacros
      ? context.helpers.expandTikzNetworkMacros(source, context.diagnostics || [], context.options || {})
      : source;
  }
};

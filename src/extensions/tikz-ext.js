export const tikzExtExtension = {
  name: "tikz-ext",
  phase: "preprocess",
  description: "Enables a practical subset of the tikz-ext library collection.",
  libraries: [
    "ext.paths.ortho",
    "ext.paths.arcto",
    "ext.topaths.arcthrough",
    "ext.transformations.mirror",
    "ext.shapes.superellipse",
    "ext.shapes.circlecrosssplit",
    "ext.shapes.rectangleroundedcorners"
  ],
  preprocess(source) {
    return source;
  }
};

export const texPackage = {
  name: "brunnian",
  status: "partial",
  implementedBy: "src/engine/evaluate.js:nodeShape/nodeShapeData/customNodeLocalAnchor; scripts/render-example-fixtures.js:materializeNativeReferenceResources",
  features: [
    "the knot crossing node shape used by the trefoil fixture",
    "circle-derived compass anchors with the documented 2/3/4/8/16/32 scale prefixes",
    "transform shape and inner sep on those nodes",
    "manifest-backed local .sty materialization for native MacTeX references"
  ],
  requires: ["tikz"],
  localSource: "test/fixtures/examples/latex-examples/resources/knot-trefoil/brunnian.sty",
  localDoc: null,
  localSourceReviewed: "test/fixtures/examples/latex-examples/resources/knot-trefoil/brunnian.sty: knot/thin knot/thick knot/string styles at lines 72-75; knot crossing inherits circle anchors and declares 2/3/4/8/16/32 scaled compass anchors at lines 743-810",
  caseCount: 1,
  caseExamples: ["LaTeX-examples Knot Trefoil"],
  observedOptions: ["knot crossing", "transform shape", "inner sep"],
  notes: "The verified trefoil uses only brunnian's knot crossing node shape and scaled compass anchors. Full brunnian macro families (\\brunnian, \\outbrunnian, link/junction macros, background layers, and knot over/under crossing behavior) remain unsupported. Native QA materializes the fixture-local .sty both under its source path and declared package name."
};

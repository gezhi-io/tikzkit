export const texPackage = {
  "name": "preview",
  "status": "partial",
  "implementedBy": "src/frontend/latex-shell.js:stripTexDocumentShell/collectPreviewBorder + src/renderers/svg/renderSvg.js:sourceMargin + scripts/render-example-fixtures.js:applyTikztosvgDocumentCropBorder",
  "features": [
    "preview environment package declaration compatibility",
    "PreviewBorder physical crop margin",
    "transform-independent native and tikztosvg reference crops"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/preview/preview.sty",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/source/latex/preview/preview.dtx",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/latex/preview/preview.sty; /usr/local/texlive/2025/texmf-dist/tex/latex/preview/prtightpage.def (PreviewBorder is a TeX dimension passed to PreviewBbAdjust after the preview box is measured); /usr/local/texlive/2025/texmf-dist/tex/latex/standalone/standalone.cls (sa@readborder parses one-, two-, or four-sided physical borders); /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex (/tikz/reset cm installs pgftransformreset); /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex (pgftransformreset restores the identity affine matrix)",
  "caseCount": 36,
  "caseExamples": [
    "3d cylinder planes 3d",
    "3d hypersurface 3",
    "3d physics jet cones 3d physics",
    "3d seismic focal mechanism 3d set foreach eng",
    "class diagram diagram",
    "cylinder with two parameters geometry style learn",
    "elem cube elem geometry foreach",
    "elem physics example atom elem physics",
    "elem transparent circles multi pgf set",
    "flow direction of arrival diagram matrrix table",
    "flow easy flowchart diagram",
    "flow labs class diagram style pgf command"
  ],
  "observedOptions": [
    "active,tightpage",
    "active,tightpage,floats",
    "pdftex,active,tightpage"
  ],
  "notes": "The document shell is stripped while PreviewBorder or standalone border is retained as an SVG crop margin in physical page units. The local tikztosvg harness evaluates its synthetic use-as-bounding-box path inside reset cm, so picture scale, non-uniform scale, and rotation do not transform the border. The preview package's font, section, display, delayed material, and arbitrary PreviewEnvironment hooks remain unsupported. Visual evidence is in docs/qa/2026-09-05-document-border-transforms.md."
};

export const tikzLibrary = {
  "name": "shadows",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:pathGeneralShadows + src/renderers/svg/paths.js:renderPathShadow + src/renderers/svg/nodeOverlays.js:renderNodeBoxShadow",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shadows.tex",
  "features": [
    "general shadow",
    "shadow xshift/yshift",
    "shadow scale",
    "path and node shadow rendering"
  ],
  "implements": [
    "general shadow",
    "shadow xshift/yshift",
    "shadow scale",
    "path and node shadow rendering"
  ],
  "notes": "general shadow uses a path/node preaction: the same geometry is painted first with the shadow options, scaled around its own path bounding-box center and shifted in canvas coordinates. The shadow deliberately does not expand the TikZ picture bounding box. Blur/fading variants, copy/double-copy shadows, every shadow hooks, and arbitrary shadow preaction code remain partial."
};

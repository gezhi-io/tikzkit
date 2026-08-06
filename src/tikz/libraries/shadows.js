export const tikzLibrary = {
  "name": "shadows",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:pathGeneralShadows + src/renderers/svg/paths.js:renderPathShadow + src/renderers/svg/nodeOverlays.js:renderNodeBoxShadow",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shadows.tex",
  "features": [
    "general shadow",
    "drop shadow defaults and overrides",
    "copy shadow foreground paint inheritance",
    "double copy shadow preaction order",
    "every shadow style hook for drop shadows",
    "shadow xshift/yshift",
    "shadow scale",
    "path and node shadow rendering"
  ],
  "implements": [
    "general shadow",
    "drop shadow defaults and overrides",
    "copy shadow foreground paint inheritance",
    "double copy shadow preaction order",
    "every shadow style hook for drop shadows",
    "shadow xshift/yshift",
    "shadow scale",
    "path and node shadow rendering"
  ],
  "notes": "general shadow and the documented drop shadow defaults use a path/node preaction: the same geometry is painted first with the shadow options, scaled around its own path bounding-box center and shifted in canvas coordinates. `drop shadow` applies its defaults, then a simple `every shadow/.style`, then caller overrides. `copy shadow` uses the documented foreground fill/draw colors, then its positive .5ex/.5ex source offsets, simple every-shadow styles, and caller overrides. `double copy shadow` paints the double-offset copy first and the single-offset copy second, as in the local source. Closed subpaths in one filled path are painted as one compound shadow. The shadow deliberately does not expand the TikZ picture bounding box. Blur/fading variants, argumented/code every-shadow hooks, special shading propagation, marker tips, and arbitrary shadow preaction code remain partial."
};

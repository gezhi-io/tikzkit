export const tikzLibrary = {
  "name": "fadings",
  "status": "partial",
  "implementedBy": [
    "src/engine/options.js:normalizeOptions",
    "src/renderers/svg/style.js:pathFadingName",
    "src/renderers/svg/defs.js:renderPathFadingDefs"
  ],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryfadings.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryfadings.code.tex",
  "features": [
    "standard axial path fading: west, east, north, south",
    "circle with fuzzy edge 10, 15, and 20 percent",
    "fuzzy ring 15 percent"
  ],
  "implements": [
    "path fading SVG masks for filled paths and nodes",
    "PGF standard axial and radial fading stop geometry"
  ],
  "notes": "PGF defines the radial masks from the origin to 50bp: fuzzy-edge fades remain opaque through 40/42.5/45 percent of the SVG radius and fade to transparent at 50 percent; fuzzy-ring 15 percent is an opaque band from 42.5 to 50 percent of that radius. User-declared fadings, fading transforms, and image/picture-based fading declarations remain unsupported."
};

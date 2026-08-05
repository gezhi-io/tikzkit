export const tikzLibrary = {
  "name": "angles",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:createAnglePic + buildAnglePic",
  "features": [
    "angle pic",
    "right angle pic",
    "counterclockwise reflex-angle sweep",
    "angle radius",
    "angle eccentricity",
    "quote labels",
    "pic fill and draw actions"
  ],
  "implements": [
    "angle pic",
    "right angle pic",
    "counterclockwise reflex-angle sweep",
    "angle radius",
    "angle eccentricity",
    "quote labels",
    "pic fill and draw actions"
  ],
  "notes": "Matches tikzlibraryangles.code.tex for standard counterclockwise angle sweeps and the right-angle square. Named pic definitions and nonstandard custom pics remain outside this slice."
};

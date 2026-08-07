export const tikzLibrary = {
  "name": "plotmarks",
  "status": "partial",
  "implementedBy": "src/pgfplots/marks.js:renderPlotMark + src/engine/evaluate.js:buildPlotMark",
  "features": [
    "mark=x",
    "mark=+",
    "mark=*",
    "mark=o",
    "square/triangle subset",
    "mark size",
    "mark=halfcircle / halfcircle*",
    "mark color / mark options={rotate=...} for halfcircles"
  ],
  "implements": [
    "mark=x",
    "mark=+",
    "mark=*",
    "mark=o",
    "square/triangle subset",
    "mark size",
    "mark=halfcircle / halfcircle*",
    "mark color / mark options={rotate=...} for halfcircles"
  ],
  "notes": "Reviewed locally on 2026-08-08 against pgflibraryplotmarks.code.tex. `mark=halfcircle` paints its lower semicircle white by default or with `mark color`, skips it for `mark color=none`, then strokes a diameter and circle. `mark=halfcircle*` fills its upper half with the plot fill and its lower half with `mark color`, strokes only the outer circle, and accepts `mark options={rotate=...}`. The remaining PGF mark catalog and general mark-option transforms remain partial."
};

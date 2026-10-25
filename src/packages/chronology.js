export const texPackage = {
  "name": "chronology",
  "status": "partial",
  "implementedBy": "src/frontend/latex-shell.js:expandChronologyEnvironments + src/extensions/chronologyLayout.js",
  "features": [
    "chronology environment",
    "\\event point/span subset",
    "\\decimaldate date arithmetic",
    "native major/minor ticks and rotated event labels",
    "fill-only point/span events with native half opacity",
    "whole-picture resizebox scaling with optional unscaled width",
    "single centered 10pt 4:3 Metropolis frame layout subset"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/chronology/chronology.sty",
  "localSourceReviewed": "chronology.sty (chronology@iii and event); graphics.sty (Gscale@div); beamerbaseframe.sty, beamerbaseframesize.sty, beamerbaseframecomponents.sty; beamerfontthememetropolis.sty, beamerouterthememetropolis.sty, beamercolorthememetropolis.sty",
  "localDoc": null,
  "caseCount": 1,
  "caseExamples": [
    "time chronology break arr timeline text advanced"
  ],
  "observedOptions": [],
  "notes": "Native tick start/step rules, physical unit division, event hboxes, rotated bounds and graphics.sty resize ratios replace fitted geometry. CMSS optical fonts and a guarded single centered 10pt 4:3 Metropolis page subset improve the real timeline. Follow-up 2026-10-25: chronevent draw=none is explicit so surrounding strokes cannot thicken point/span events. Authorized browser checks cover all 143 glyphs and seven events across the standalone control and full frame; event paint, dimensions and text placement pass the unchanged 0.09px gate at 3x. Strict native PNG comparisons retain raster differences and are not certified pixel-identical. Other page settings retain a diagnostic and approximate fallback. Custom chronology styles, eventspan/eventpoint and general Beamer layout remain unsupported. The standalone control uses genuine tikztosvg with a disclosed box-capture wrapper; the full Beamer document uses an explicitly labelled MacTeX reference because tikztosvg cannot load the theme. See docs/qa/2026-10-25-polar-timeline.md."
};

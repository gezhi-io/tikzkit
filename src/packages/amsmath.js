export const texPackage = {
  "name": "amsmath",
  "status": "partial",
  "implementedBy": "src/tikz/text.js + src/tikz/textMetrics.js + src/tikz/mathMatrixSyntax.js + src/renderers/svg/mathMatrixFallback.js + src/renderers/svg/mathNode.js + src/renderers/svg/textEngine.js + src/renderers/svg/mathScriptFallback.js + src/renderers/svg/renderSvg.js + src/frontend/latex-shell.js:parseDeclareMathOperator + web/workbench.js",
  "features": [
    "KaTeX delegated environments/macros",
    "SVG-text aligned display fallback with amsmath \\jot row spacing",
    "explicit paired superscript/subscript cursor restoration in SVG-text fallback",
    "SVG-text array fallback: l/c/r columns, @{} zero intercolumn gaps, basic *{n}{...} repeat, and \\left...\\right delimiters",
    "inline matrix formula metrics use local Computer Modern 5/7/8/9/10pt design-size advances",
    "TeX undelimited two-argument parsing for \\frac, \\dfrac, and \\tfrac",
    "SVG-text fraction-sequence metrics for ordinary math atoms and scripts",
    "\\DeclareMathOperator macro expansion"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty",
  "localDoc": null,
  "caseCount": 38,
  "caseExamples": [
    "A3C execution / a3c_execution",
    "A3C neural network / a3c_neural_network",
    "Multilayer network / multilayer_network",
    "muxstep pipeline / muxstep_pipeline",
    "Reinforcement learning greedy policy / reinforcement_learning_greedy_policy",
    "Complex roots - tangent real solution",
    "Complex roots - two real solutions",
    "Complex roots - imaginary solutions",
    "Complex roots - shifted complex solutions",
    "Complex roots - imaginary roots extended graph",
    "Complex roots - shifted extended graph",
    "Complex roots - equation text block"
  ],
  "observedOptions": [],
  "localSourceReviewed": true,
  "notes": "Reviewed TeX Live 2025 amsmath.sty and array.sty: align rows are constructed by align@preamble/start@align and inherit opened-up display spacing; matrix uses array with arraycolsep compensation. On 2026-08-07, local cmr/cmmi/cmsy/cmex TFM design sizes were checked for 5/7/8/9/10pt: inline pmatrix layout now uses fixed arraycolsep and design-size digit, relation, delimiter, italic-correction, and common binary-operator advances rather than an empirical small-font blend. TikZKit uses scoped browser math for interactive previews and calibrated Computer Modern script advances plus explicit paired-script baseline/cursor restoration for the SVG-text fallback. The portable fallback structurally lays out array l/c/r columns, @{} zero gaps, basic *{n}{...} repetition, and \\left...\\right delimiters. On 2026-09-06, LaTeX base `latex.ltx` and `amsmath.sty` were reviewed for the ordinary two-argument definition of `\\frac`: TeX accepts a group or one undelimited token for each argument, so `\\frac12`, `\\frac\\pi2`, and `\\tfrac ab` are normalized before browser rendering and SVG-text measurement. Simple mixed atom/fraction sequences now use local Computer Modern advances and the measured text-style fraction box. Three-way evidence is stored in `outputs/qa/2026-09-06-undelimited-frac-diamond-after`. Tags, intertext, split, gathered, multline, nonempty/custom array preambles, cross-reference expansion, nested general TeX expansion, and full TeX macro expansion remain unsupported or partial."
};

texPackage.implementedBy += " + src/tex/mathBox.js + src/tex/cmMathMetrics.js + src/renderers/svg/nativeMath.js";
texPackage.features.push("shared browser/export native CM 10/7/5pt fractions and scripts");
texPackage.notes += " Reviewed 2026-10-22: local fontmath.ltx, ltmath.dtx, omxcmex.fd, amsmath.sty and CMR/CMMI/CMSY/CMEX TFM parameters now drive an ordinary fraction/script hbox shared by browser SVG and export. This includes nested scripts, fractions, italic correction, native optical sizes, baseline anchors, and AMS small-size rule thickness. 57 native box probes pass; unsupported math versions, other base sizes, roots, accents, large-operator limits and general matrices retain the previous renderer. See docs/qa/2026-10-22-fractions-scripts.md.";

texPackage.implementedBy += " + src/tex/mathDelimiters.js + src/pgfplots/legend.js";
texPackage.features.push("native radicals, ordinary matrix/array boxes, and bold math at 10/7/5pt");
texPackage.notes += " Subsequent 2026-10-22 review: latex.ltx root-index and array struts, amsmath.sty matrix wrappers, fontmath.ltx bold alphabets, and local CMEX extension recipes now drive shared browser/export roots, matrix/pmatrix/bmatrix/Bmatrix/vmatrix/Vmatrix, basic l/c/r arrays, mathbf, boldsymbol and boldmath. 126 native boxes and 193 browser glyph origins match their independent references. Complex alignments, custom preambles, other sizes and full TeX remain partial. See docs/qa/2026-10-22-math-structures.md.";

texPackage.implementedBy += " + src/tex/mathArrays.js + src/tex/mathFonts.js";
texPackage.features.push("native aligned/cases boxes and standard LaTeX math sizes from tiny to Huge");
texPackage.notes += " Alignment/size follow-up on 2026-10-22 supersedes earlier size/alignment limits: local amsmath.sty aligned/cases, fontmath.ltx DeclareMathSizes, NFSS .fd mappings and CM TFM ligatures drive aligned equation pairs, display cells, openup-jot row spacing, t/b/c positioning, explicit row gaps, cases struts/quad separation and roman text conditions. Twelve base sizes from 5 to 24.88pt use original optical math fonts, including CMEX8/9. All 384 native hboxes and 360 browser glyph origins in the new fixtures pass. Native SVG text uses geometricPrecision to avoid browser stem darkening. Custom preambles, tags, alignedat, gathered, smallmatrix, accents, large-operator limits and general TeX remain partial. Evidence: docs/qa/2026-10-22-alignments-sizes.md; outputs/qa/2026-10-22-alignments-final-browser/.";

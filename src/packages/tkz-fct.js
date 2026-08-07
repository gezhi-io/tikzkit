export const texPackage = {
  "name": "tkz-fct",
  "status": "partial",
  "implementedBy": "src/extensions/tkz-fct.js",
  "features": [
    "tkzInit Cartesian bounds",
    "tkzGrid major grid",
    "tkzGrid subgrid, explicit range, and independent x/y steps",
    "tkzAxeXY axes, ticks, labels, and combined trig/fraction/step/orig options",
    "legacy tkzAxeXY[ticks=false] draw-only axes",
    "tkzDrawX independent x axis and ticks",
    "tkzDrawY independent y axis and ticks",
    "tkzLabelX and tkzLabelY numeric, fraction, and pi graduations",
    "tkz-base xlabel and ylabel style hooks",
    "tkzAxeX and tkzAxeY independent axis wrappers",
    "tkzFct sampled scalar functions",
    "tkzFct finite-sample pole branch splitting",
    "tkzFctPar sampled parametric functions",
    "tkzFctPolar sampled polar functions",
    "tkzDrawArea/tkzArea latest-function fills down to source y=0",
    "tkzDrawAreafg/tkzAreafg clipped named-function bands"
  ],
  "requires": ["tikz"],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-area.tex; /usr/local/texlive/2025/texmf-dist/doc/latex/tkz-base/TKZdoc-base-axes.tex",
  "caseCount": 21,
  "caseExamples": [
    "manual linear scalar function plots",
    "sampled tangent branches across poles",
    "manual parametric cycloid",
    "manual polar four-petal rose",
    "documented scalar-function area fill",
    "documented named-function band fill",
    "tkz-base combined trigonometric axes"
  ],
  "observedOptions": ["domain", "samples", "id", "fp", "color", "opacity", "between", "line width", "style", "xstep", "ystep", "sub", "subxstep", "subystep", "ratio", "label", "right space", "left space", "up space", "down space", "noticks", "ticks=false", "tickwd", "tickup", "tickdn", "ticklt", "tickrt", "step", "trig", "frac", "orig", "np off", "node font", "xlabel style", "ylabel style"],
  "localSourceReviewed": true,
  "notes": "Reviewed locally on 2026-08-08: tkz-fct.sty, tkz-base/tkz-obj-axes.tex, tkz-base/tkz-obj-grids.tex, and TKZdoc-base-axes.tex establish that tkzAxeXY forwards one common option set to tkzDrawX, tkzDrawY, tkzLabelX, and tkzLabelY, preserving draw/label order unless swap is present. TikZKit now keeps that shared behavior for label, text, trig, frac, step, orig, ticks=false, tick dimensions, and global xlabel/ylabel styles; bare orig suppresses the zero graduation like the local label key's default. Earlier review on 2026-08-07: tkz-fct.sty and TKZdoc-fct-area.tex define tkzArea (with tkzDrawArea as an alias) as a clipped fill from the most recently declared scalar function to source y=0, after independently converting source x/y units through tkzInit. TikZKit supports that operation with domain, samples, color, opacity, and ordinary TikZ style keys; it preserves nonzero/same-sign origins and splits clipped pole branches. The same source defines tkzAreafg (with tkzDrawAreafg as an alias) as the intersection of the region below named curve a and above named curve b. TikZKit preserves native a/b/c function ordering, samples both curves in source units, splits at crossings, and fills only the a-above-b pieces with between, domain, samples, color, opacity, and ordinary style keys. tkzInit follows tkz-base's same-sign-range local-origin rule; tkzGrid maps explicit source-coordinate ranges plus major/subgrid x/y steps into the local Cartesian frame. tkzDrawX/tkzDrawY and tkzLabelX/tkzLabelY implement source-unit graduations, trig/fraction labels, terminal labels, and normal xlabel/ylabel style hooks. tkzFctPar evaluates x(t)/y(t) in source units with the native domain=-5:5 and samples=200 defaults; tkzFctPolar mirrors its separate native polar mapping. Gnuplot file/cache ids, asymptotes, adaptive sampling, advanced paint keys, and general parametric discontinuity analysis remain deferred."
};

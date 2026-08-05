export const pgfplotsLibrary = {
  name: "dateplot",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/pgfplots/dateCoordinates.js:createPgfplotsDateContext + src/pgfplots/axisTikzLowering.js",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.dateplot.code.tex",
  localDoc: null,
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.dateplot.code.tex",
  features: [
    "date coordinates in=x/y/z",
    "date ZERO",
    "ISO date and hour/minute coordinates",
    "xtick=data date labels with year/month/day/hour/minute templates",
    "per-axis scaled tick suppression"
  ],
  notes: "Reviewed locally: PGFPlots maps ISO dates through pgfcalendar Julian days, subtracts date ZERO, and installs forward/inverse coordinate transforms that expose \\year, \\month, \\day, \\hour, and \\minute to tick labels. TikZKit implements that focused coordinate/tick path. Arbitrary date default inverse templates, calendar-localized formatting, seconds rounding parity, and date math outside axis coordinates remain unsupported."
};

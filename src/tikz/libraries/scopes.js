export const tikzLibrary = {
  "name": "scopes",
  "status": "partial",
  "implementedBy": [
    "src/frontend/parser.js:parseScope",
    "src/engine/evaluate.js:interpretStatement"
  ],
  "features": [
    "documented braced scope shorthand { [options] ... }",
    "whitespace and nested braced scopes",
    "local style, transform, coordinate-basis, and chain state"
  ],
  "implements": [
    "brace scope shorthand",
    "nested scope options"
  ],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryscopes.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-scopes.tex",
  "notes": "The documented shorthand lowers a braced group beginning with optional TikZ options to a local scope. TikZKit accepts whitespace after the opening brace and nested shorthand groups; it reuses the shared scope interpreter so styles, transforms, bases, variables, and chain state remain local. The native after-command-hook positions and arbitrary TeX catcode-sensitive grouping remain partial."
};

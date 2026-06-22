const TIKZQUADS_STYLES = String.raw`
\tikzset{
  QuadKeys/.style={},
  PGKeys/.style={},
  tikzquads base/.style={draw,fill=white,inner sep=1pt,line width=0.4pt},
  Quad compact/.style={Quad,minimum width=3cm},
  Quad/.style={tikzquads base,shape=tikzquads quad,minimum width=6.6cm,minimum height=2.8cm,tikzquads kind=quad},
  Quad Z/.style={Quad,tikzquads kind=quad z},
  Quad Y/.style={Quad,tikzquads kind=quad y},
  Quad G/.style={Quad,tikzquads kind=quad g},
  Quad H/.style={Quad,tikzquads kind=quad h},
  BB/.style={Black Box},
  Black Box/.style={tikzquads base,shape=tikzquads black box,minimum width=3.8cm,minimum height=2.8cm,tikzquads kind=black box},
  Thevenin/.style={Black Box,tikzquads kind=thevenin},
  Norton/.style={Black Box,tikzquads kind=norton},
  PG load line/.style={draw,shape=tikzquads pg load line,minimum width=1.8cm,minimum height=1.8cm,tikzquads kind=pg load line},
  PG linear load line/.style={PG load line},
  tikzquads parallel connect/.style={draw,tikzquads parallel path}
}
`;

export const tikzquadsExtension = {
  name: "tikzquads",
  phase: "preprocess",
  description: "Provides a practical subset of tikzquads CircuiTikZ quadripole and one-port shapes.",
  commands: ["Quad", "Quad Z", "Quad Y", "Quad G", "Quad H", "Black Box", "Thevenin", "Norton", "PG load line", "QuadParConnect"],
  preprocess(source) {
    return `${TIKZQUADS_STYLES}\n${expandQuadParConnect(source)}`;
  }
};

function expandQuadParConnect(source) {
  return String(source).replace(
    /\\QuadParConnect\s*(?:\[([^\]]*)\])?\s*(?:\{([^{}]+)\}|\(([^)]+)\))\s*(?:\{([^{}]+)\}|\(([^)]+)\))/g,
    (_match, rawOptions = "", firstBrace, firstParen, secondBrace, secondParen) => {
      const from = (firstBrace || firstParen || "").trim();
      const to = (secondBrace || secondParen || "").trim();
      if (!from || !to) return _match;
      const options = parseSimpleOptions(rawOptions);
      const side = options.right ? "2" : "1";
      const signA = options.down ? "-" : "+";
      const signB = signA === "+" ? "-" : "+";
      const direction = options.right ? 1 : -1;
      const spacing = optionNumber(options.spacing, 0);
      const run = round(0.36 + Math.max(0, spacing));
      const middleRun = round(run * 0.58);
      return [
        `\\draw[tikzquads parallel connect] (${from}.${side}${signA}) -- ++(${round(direction * middleRun)},0) |- (${to}.${side}${signA});`,
        `\\draw[tikzquads parallel connect] (${from}.${side}${signB}) -- ++(${round(direction * run)},0) |- (${to}.${side}${signB});`
      ].join("\n");
    }
  );
}

function parseSimpleOptions(input = "") {
  const result = {};
  for (const part of String(input).split(",")) {
    const text = part.trim();
    if (!text) continue;
    const equals = text.indexOf("=");
    if (equals === -1) result[text] = true;
    else result[text.slice(0, equals).trim()] = text.slice(equals + 1).trim();
  }
  return result;
}

function optionNumber(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const match = String(value).match(/[-+]?(?:\d+\.?\d*|\.\d+)/);
  return match ? Number(match[0]) : fallback;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

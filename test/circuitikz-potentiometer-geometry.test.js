import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { potentiometerBodyItem, potentiometerGeometry, potentiometerSettings } from "../src/extensions/circuitikz/potentiometers.js";
import { TIKZ_UNIT } from "../src/tikz/metrics.js";

const SP = 65536, PT_PER_CM = 72.27 / 2.54, S = SP * PT_PER_CM;
const flat = { mid: { x: 0, y: 0 }, u: { x: 1, y: 0 }, n: { x: 0, y: 1 }, length: 4 };
const diagonal = { mid: { x: 2, y: 1.5 }, u: { x: .8, y: .6 }, n: { x: -.6, y: .8 }, length: 5 };
const pen = pt => ({ stroke: "navy", fill: "none", lineWidth: pt * TIKZ_UNIT / PT_PER_CM,
  lineCap: "butt", lineJoin: "miter", markerEnd: "irrelevant wire arrow" });
const configs = {
  A: { kind: "american", pos: .2 }, E: { kind: "european", pos: .2 },
  Am: { kind: "american", pos: .2, mirror: true }, Ai: { kind: "american", pos: .2, invert: true },
  Ab: { kind: "american", pos: .2, invert: true, mirror: true },
  Ac: { kind: "american", pos: -.15, invert: true, mirror: true, pen: .6,
    keys: { "bipoles/length": "1.6cm", "resistors/scale": .75, "bipoles/potentiometer/width": .95,
      "bipoles/potentiometer/height": .92, "bipoles/potentiometer/height 2": .38, "resistors/zigs": 5,
      "resistors/zigzag stub": .125, "resistors/thickness": 1.5, "resistors/modifier thickness": .6 } },
  Ec: { kind: "european", pos: 1.25, mirror: true, pen: .6,
    keys: { "bipoles/length": "1.8cm", "resistors/scale": .8, "bipoles/generic potentiometer/width": 1.05,
      "bipoles/generic potentiometer/height": .98, "bipoles/generic potentiometer/height 2": .46,
      "resistors/thickness": "none", "bipoles/thickness": 2.5, "resistors/modifier thickness": .5 } },
  Diag: { kind: "european", pos: .3, invert: true, pen: .8, frame: diagonal },
  ZigDiag: { kind: "american", pos: .83, mirror: true, pen: 1.2, frame: diagonal },
  Scale: { kind: "american", pos: .75, mirror: true, pen: .6, shapeScale: 1.5, keys: { "resistors/scale": .75 } },
  Mid: { kind: "european" },
  Short: { kind: "european", pos: 0, short: true,
    keys: { "bipoles/generic potentiometer/height": .16, "bipoles/generic potentiometer/height 2": .4,
      "bipoles/border margin": 1.6 } }
};

function layout({ kind, keys, pos, frame = flat, invert = false, mirror = false, shapeScale = 1, pen: width = .4 }) {
  const prefix = kind === "european" ? "bipoles/generic potentiometer/" : "bipoles/potentiometer/";
  const settings = potentiometerSettings(kind, { ...keys, [prefix + "wiper pos"]: pos }, {}, shapeScale);
  return { settings, geometry: potentiometerGeometry(frame, settings, invert, mirror),
    item: potentiometerBodyItem(frame, settings, pen(width), undefined, invert, mirror) };
}

// Native dimensions below are integer TeX scaled points (65536 sp per pt).
function compare(cm, sp, label, tolerance = 3) {
  const measured = Math.round(cm * S);
  const error = Math.abs(measured - sp);
  assert.ok(error <= tolerance, `${label}: ${measured} vs ${sp} sp`);
  return error;
}
function comparePoint(p, xy, label, origin = flat.mid) {
  return Math.max(compare(p.x - origin.x, xy[0], label + ".x"), compare(p.y - origin.y, xy[1], label + ".y"));
}

test("native saved wiper, tip, leads and asymmetric envelope reflect in the component's local axes", () => {
  // MacTeX TL2025: \pgfpointdiff{\pgfpointanchor{P}{center}}{\pgfpointanchor{P}{...}}.
  for (const [id, wiper, tip, ne, sw] of [
    ["A", [-626538,1044219], [-626538,391584], [1044219,1044219], [-1044219,-391584]],
    ["E", [-626538,1044219], [-626538,391584], [1044219,1044219], [-1044219,-391584]],
    ["Am", [-626538,-1044219], [-626538,-391584], [1044219,-1044219], [-1044219,391584]],
    ["Ai", [626538,1044219], [626538,391584], [-1044219,1044219], [1044219,-391584]],
    ["Ab", [626538,-1044219], [626538,-391584], [-1044219,-1044219], [1044219,391584]],
    ["Ac", [1381714,-1029304], [1381714,-425154], [-1062867,-1029304], [1062867,425154]],
    ["Ec", [2114563,-1315719], [2114563,-617594], [1409709,-1315719], [-1409709,617594]],
    ["Scale", [587373,-1174746], [587373,-440532], [1174746,-1174746], [-1174746,440532]],
    ["Diag", [-292388,1085950], [99187,563860], [-1461867,208825], [1070292,313265]]
  ]) {
    const { geometry: g } = layout(configs[id]), a = g.anchors, origin = (configs[id].frame ?? flat).mid;
    for (const [p, xy, name] of [[g.wiper,wiper,"wiper"], [g.tip,tip,"tip"], [a.ne,ne,"ne"], [a.sw,sw,"sw"]]) {
      comparePoint(p, xy, id + "." + name, origin);
    }
    assert.deepEqual(a.center, origin);
    for (const [long, names] of [["wiper",["W"]], ["west",["w","left","b"]], ["east",["e","right","a"]],
      ["north",["n","above"]], ["south",["s","below"]], ["north east",["ne"]], ["north west",["nw"]],
      ["south east",["se"]], ["south west",["sw"]]]) {
      for (const short of names) assert.deepEqual(a[short], a[long], id + "." + short);
    }
    assert.deepEqual(a.W, g.wiper); assert.deepEqual(a.tip, g.tip); assert.notDeepEqual(a.W, a.w);
    if (id !== "Diag") {
      comparePoint(a.left, [sw[0], 0], id + ".left");
      comparePoint(a.above, [0, ne[1]], id + ".above");
      compare(g.labelHalfNormal.positive, Math.max(ne[1], sw[1]), id + ".positive");
      compare(g.labelHalfNormal.negative, -Math.min(ne[1], sw[1]), id + ".negative");
    }
  }
});

test("the American zigzag uses the lower half-height, sp-divided steps and only half-pen lead overlap", () => {
  const { item, settings } = layout(configs.Ac);
  assert.equal(item.subtype, "circuitikz-potentiometer-body");
  assert.equal(item.potentiometerKind, "american"); assert.equal(item.zigs, 5);
  assert.equal(item.style.fill, "none"); assert.equal(item.style.lineJoin, "bevel"); assert.equal(item.style.markerEnd, undefined);
  assert.ok(Math.abs(item.style.lineWidth - pen(.9).lineWidth) < .0001);
  assert.ok(Math.abs(settings.wiperThickness - .9) < 1e-9);
  // Actual PGF soft path for Ac. The saved wiper lies OUTSIDE the zigzag (negative wiper pos).
  const xs = [1092358,826642,717436,558006,398576,239146,79716,-79714,-239144,-398574,-558004,-717434,-826640,-1092356];
  assert.deepEqual(item.commands.map(c => c.type), xs.map((_, i) => i ? "lineTo" : "moveTo"));
  item.commands.forEach((p, i) => comparePoint(p, [xs[i], i < 2 || i >= 12 ? 0 : i % 2 ? 425154 : -425154], "zig " + i));
  const scaled = layout(configs.Scale).item.commands;
  comparePoint(scaled[0], [-1214071, 0], "scaled lead overlap");
  comparePoint(scaled.at(-1), [1214065, 0], "scaled final lead overlap");
});

test("the European pot uses its own rectangle keys and fill; its wiper uses the incoming pen", () => {
  const keys = { ...configs.Ec.keys, "bipoles/generic/width": .2, "bipoles/resistor/height": .1, "resistors/fill": "yellow" };
  const { settings, item } = layout({ ...configs.Ec, keys });
  assert.equal(settings.wiperThickness, 1); assert.equal(settings.thickness, 2.5);
  assert.equal(item.potentiometerKind, "european"); assert.equal(item.style.fill, "rgb(255 242 0)");
  const points = [[1409709,617594],[-1409709,617594],[-1409709,-617594],[1409709,-617594]];
  assert.deepEqual(item.commands.map(c => c.type), ["moveTo","lineTo","lineTo","lineTo","closePath"]);
  points.forEach((p,i) => comparePoint(item.commands[i], p, "rectangle " + i));
  assert.equal(potentiometerBodyItem(flat, settings, pen(.6), "red", false, true).style.fill, "red");
});

test("family settings resolve independently and out-of-range wiper positions are not clamped", () => {
  const keys = { "bipoles/potentiometer/width": 1, "bipoles/generic potentiometer/width": .4,
    "bipoles/potentiometer/wiper pos": "3/2", "bipoles/generic potentiometer/wiper pos": "-1/4" };
  const a = potentiometerSettings("american", keys), e = potentiometerSettings("european", keys);
  assert.equal(a.wiperPos, 1.5); assert.equal(e.wiperPos, -.25);
  assert.ok(a.bodyLength > e.bodyLength);
  assert.ok(potentiometerGeometry(flat, a).wiper.x > a.bodyLength / 2);
  assert.ok(potentiometerGeometry(flat, e).wiper.x < -e.bodyLength / 2);
  const cleared = potentiometerSettings("american", {});
  assert.equal(cleared.wiperPos, .5); assert.equal(potentiometerGeometry(flat, cleared).wiper.x, 0);
  const expanded = potentiometerSettings("american", { "bipoles/length": "\\len", "wiper pos": "\\p" }, { len: "1.4cm", p: -.5 });
  assert.equal(expanded.bodyLength, cleared.bodyLength); assert.equal(expanded.wiperPos, -.5);
  const short = layout(configs.Short);
  assert.ok(short.settings.bodyLength > .4 && short.geometry.tip.y > short.geometry.wiper.y);
  // A legitimately shorter wiper reverses the shaft; PGF does not enlarge the named envelope to the body ink.
  assert.equal(short.geometry.labelHalfNormal.positive, short.settings.wiperHalfNormal);
  for (const kind of ["american", "european"]) {
    const style = { ...pen(.4), dashArray: [2,3], strokeOpacity: .65 };
    const body = potentiometerBodyItem(flat, potentiometerSettings(kind), style);
    assert.deepEqual(body.style.dashArray, style.dashArray);
    assert.equal(body.style.strokeOpacity, .65); assert.equal(body.style.markerEnd, undefined);
  }
});

function bodyVertices(tokens) {
  if (tokens[0][0] === "R") {
    assert.deepEqual(tokens.map(t => t[0]), ["R", "S"]);
    const [,x,y] = tokens[0], [,w,h] = tokens[1];
    return [["M",x,y],["L",x+w,y],["L",x+w,y+h],["L",x,y+h],["Z"]];
  }
  // PGF's transformed rectangle ends with a move only after closing the contour.
  return tokens.at(-2)?.[0] === "Z" && tokens.at(-1)[0] === "M" ? tokens.slice(0,-1) : tokens;
}

test("remeasure original CircuitikZ anchors, label envelopes, body vertices, shaft endpoints and pens",
  { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, t => {
    const tmp = mkdtempSync(join(tmpdir(), "potentiometer-native-"));
    try {
      const document = String.raw`\documentclass{article}\usepackage{circuitikz}\makeatletter
\def\pair#1#2#3{\typeout{V|\id|#1|\number\dimexpr#2\relax|\number\dimexpr#3\relax}}
\let\realuse\pgfusepath\def\pgfusepath#1{\ifdefined\ctikzclass\edef\cl{\ctikzclass}\def\rr{resistors}%
\ifx\cl\rr\begingroup\typeout{P|\id|\number\pgflinewidth}\pgfgetpath\savedpath
\def\pgfsyssoftpath@movetotoken{\pair{M}}\def\pgfsyssoftpath@linetotoken{\pair{L}}%
\def\pgfsyssoftpath@rectcornertoken{\pair{R}}\def\pgfsyssoftpath@rectsizetoken{\pair{S}}%
\def\pgfsyssoftpath@closepathtoken{\pair{Z}}\savedpath\endgroup\fi\fi\realuse{#1}}
\def\probe#1{\pgf@process{\pgfpointdiff{\pgfpointanchor{P}{center}}{\pgfpointanchor{P}{#1}}}%
\typeout{A|\id|#1|\number\pgf@x|\number\pgf@y}}
\begin{document}` + Object.entries(configs).map(([id, c]) => {
        const keys = Object.entries(c.keys ?? {}).map(([k,v]) => k + "=" + v).join(",");
        const below = c.kind === "european" || (c.invert && c.mirror);
        const options = [c.kind + " potentiometer", "n=P", c.pos != null && "wiper pos=" + c.pos,
          c.invert && "invert", c.mirror && "mirror", below ? "l_=X" : "l^=X"].filter(Boolean);
        return String.raw`\begingroup\def\id{${id}}\ctikzset{label/align=straight,${keys}}\begin{tikzpicture}
\begin{scope}[line width=${c.pen ?? .4}pt${c.shapeScale ? ",transform shape,scale=" + c.shapeScale : ""}]
\draw (${c.frame ? "0,0" : c.short ? "-.2,0" : "-2,0"}) to[${options}] (${c.frame ? "4,3" : c.short ? ".2,0" : "2,0"});\end{scope}
\pgf@process{\pgfpointanchor{P}{center}}\typeout{O|\id|\number\pgf@x|\number\pgf@y}
\pgf@process{\pgfpointdiff{\pgfpointanchor{P}{center}}{\pgfpointanchor{Plabel}{${below ? "north" : "base"}}}}%
\typeout{B|\id|${below ? -1 : 1}|\number\pgf@y}
\foreach\a in {center,wiper,W,tip,north,south,east,west,n,s,e,w,ne,nw,se,sw,above,below,left,right,a,b,north east,north west,south east,south west}{\probe{\a}}
\end{tikzpicture}\endgroup`;
      }).join("\n") + "\\end{document}";
      const source = join(tmp, "probe.tex");
      writeFileSync(source, document);
      const run = spawnSync("pdflatex", ["-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", source],
        { cwd: tmp, encoding: "utf8" });
      assert.equal(run.status, 0, run.error?.message ?? run.stdout?.slice(-1500));
      const log = readFileSync(join(tmp, "probe.log"), "utf8");
      const rows = {};
      for (const line of log.split(/\r?\n/)) {
        if (!/^[PVABO]\|/.test(line)) continue;
        const [tag,id,...values] = line.split("|");
        const row = rows[id] ??= { anchors: [], paths: [] };
        if (tag === "P") row.paths.push({ pen: +values[0], tokens: [] });
        if (tag === "V") row.paths.at(-1).tokens.push([values[0], ...values.slice(1).map(Number)]);
        if (tag === "A") row.anchors.push([values[0], ...values.slice(1).map(Number)]);
        if (tag === "O") row.center = values.map(Number);
        if (tag === "B") row.label = values.map(Number);
      }
      let max = 0, count = 0;
      for (const [id, config] of Object.entries(configs)) {
        const { geometry, settings, item } = layout(config);
        const { anchors, paths, center, label } = rows[id];
        const check = (p, xy, name) => {
          max = Math.max(max, comparePoint(p, xy, id + "." + name, (config.frame ?? flat).mid)); count += 2;
        };
        assert.equal(anchors.length, 26, id);
        for (const [name, x, y] of anchors) check(geometry.anchors[name], [x,y], name);
        assert.equal(paths.length, 2, id);
        const vertices = bodyVertices(paths[0].tokens);
        const types = { moveTo: "M", lineTo: "L", closePath: "Z" };
        assert.deepEqual(item.commands.map(c => types[c.type]), vertices.map(v => v[0]), id);
        vertices.forEach(([tag,x,y], i) => { if (tag !== "Z") check(item.commands[i], [x-center[0], y-center[1]], "vertex " + i); });
        assert.deepEqual(paths[1].tokens.map(v => v[0]), ["M","L"], id);
        paths[1].tokens.forEach(([,x,y], i) => check(i ? geometry.tip : geometry.wiper, [x-center[0], y-center[1]], "shaft"));
        compare(item.style.lineWidth / TIKZ_UNIT, paths[0].pen, id + ".body pen");
        compare(pen(config.pen ?? .4).lineWidth * settings.wiperThickness / TIKZ_UNIT, paths[1].pen, id + ".wiper pen");
        if (!config.frame && !config.shapeScale) {
          const [side, nativeY] = label, reach = geometry.labelHalfNormal[side > 0 ? "positive" : "negative"];
          const margin = Math.round((config.keys?.["bipoles/border margin"] ?? 1.1) * SP) / SP;
          const y = side * Math.trunc(margin * Math.round(reach * S)) + (side > 0 ? 211626 : 0); // native .75ex
          compare(y / S, nativeY, id + ".label");
        }
      }
      t.diagnostic(`${Object.keys(rows).length} native components, ${count} anchor/path coordinates, max error ${max} sp`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

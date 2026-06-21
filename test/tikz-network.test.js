import assert from "node:assert/strict";
import test from "node:test";
import { tikzNetworkExtension, tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";

function convert(body) {
  return tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{tikz-network}
\begin{document}
\begin{tikzpicture}
${body}
\end{tikzpicture}
\end{document}`);
}

function nodeBox(ir, id) {
  return ir.items.find((item) => item.type === "nodeBox" && item.id === id);
}

test("exposes tikz-network as a built-in extension module", () => {
  assert.equal(tikzNetworkExtension.name, "tikz-network");
  assert.equal(tikzNetworkExtension.phase, "preprocess");
  assert.ok(tikzNetworkExtension.commands.includes("Vertex"));
  assert.equal(typeof tikzNetworkExtension.preprocess, "function");
});

test("expands tikz-network Vertex commands to styled named nodes", () => {
  const { ir, diagnostics } = convert(String.raw`
\Vertex{A}
\Vertex[x=1,y=1,IdAsLabel]{B}
\Vertex[x=2,label=C_1,Math,color=red,opacity=.5,size=.4]{C}
\Vertex[x=3,NoLabel]{D}`);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.A, { x: 0, y: 0 });
  assert.deepEqual(ir.coordinates.B, { x: 1, y: 1 });
  assert.deepEqual(ir.coordinates.C, { x: 2, y: 0 });
  assert.equal(nodeBox(ir, "A").shape, "circle");
  assert.equal(nodeBox(ir, "A").style.fill, "#abd7e6");
  assert.ok(Math.abs(nodeBox(ir, "A").width - parseDimension("0.6cm")) < 1e-6);
  assert.equal(nodeBox(ir, "C").style.fill, "red");
  assert.equal(nodeBox(ir, "C").style.opacity, 0.5);
  assert.ok(Math.abs(nodeBox(ir, "C").width - parseDimension("0.4cm")) < 1e-6);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "B"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "$C_1$"));
  assert.equal(ir.items.some((item) => item.type === "textNode" && item.text === "D"), false);
});

test("supports tikz-network RGB vertex colors and global vertex style", () => {
  const { ir, diagnostics } = convert(String.raw`
\SetVertexStyle[FillColor=green,LineColor=blue,LineWidth=2pt,MinSize=1cm,Shape=rectangle]
\Vertex[RGB,color={127,201,127},opacity=.4]{A}
\Vertex[x=2]{B}`);

  assert.equal(diagnostics.length, 0);
  assert.equal(nodeBox(ir, "A").style.fill, "rgb(127 201 127)");
  assert.equal(nodeBox(ir, "A").style.stroke, "blue");
  assert.equal(nodeBox(ir, "A").style.opacity, 0.4);
  assert.ok(Math.abs(nodeBox(ir, "B").width - parseDimension("1cm")) < 1e-6);
  assert.equal(nodeBox(ir, "B").style.fill, "green");
});

test("expands tikz-network Edge commands with direction, labels, bends, and paths", () => {
  const { ir, diagnostics } = convert(String.raw`
\Vertex{A}
\Vertex[x=2]{B}
\Vertex[x=1,y=-1]{C}
\Edge(A)(B)
\Edge[Direct,bend=35,label=X,distance=.7,color=red,lw=3pt](A)(B)
\Edge[path={A,{0,-1},C,B},style={dashed}](A)(B)`);

  assert.equal(diagnostics.length, 0);
  const paths = ir.items.filter((item) => item.type === "path");
  assert.equal(paths.length, 3);
  assert.equal(paths[0].style.markerEnd, undefined);
  assert.equal(paths[1].style.stroke, "red");
  assert.equal(paths[1].style.markerEnd.kind, "latex");
  assert.ok(paths[1].commands.some((command) => command.type === "curveTo"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "X"));
  assert.ok(paths[2].style.dashArray.length > 0);
  assert.equal(paths[2].commands.filter((command) => command.type === "lineTo").length, 5);
  assert.ok(paths[2].commands.filter((command) => command.type === "moveTo").length > 1);
});

test("supports tikz-network edge style defaults and self loops", () => {
  const { ir, diagnostics } = convert(String.raw`
\SetEdgeStyle[Color=blue,LineWidth=2pt,Arrow=-stealth]
\Vertex{A}
\Vertex[x=2]{B}
\Edge[Direct](A)(B)
\Edge[loopposition=90,loopsize=.5cm,label=L](A)(A)`);

  assert.equal(diagnostics.length, 0);
  const paths = ir.items.filter((item) => item.type === "path");
  assert.equal(paths[0].style.stroke, "blue");
  assert.equal(paths[0].style.markerEnd.kind, "stealth");
  assert.ok(paths[0].style.lineWidth > parseDimension("1pt"));
  assert.ok(paths[1].commands.some((command) => command.type === "curveTo"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "L"));
});

test("loads tikz-network Vertices and Edges through an injected CSV resolver", () => {
  const source = String.raw`
\usepackage{tikz-network}
\begin{tikzpicture}
\Vertices{vertices.csv}
\Edges{edges.csv}
\end{tikzpicture}`;
  const { ir, diagnostics } = tikzToSvg(source, {
    tikzNetworkFileResolver(file) {
      if (file === "vertices.csv") return "id,x,y,label,color\nA,0,0,Alpha,blue\nB,2,0,Beta,red\n";
      if (file === "edges.csv") return "u,v,label,Direct,bend\nA,B,e,1,20\n";
      return "";
    }
  });

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.A, { x: 0, y: 0 });
  assert.deepEqual(ir.coordinates.B, { x: 2, y: 0 });
  assert.equal(nodeBox(ir, "A").style.fill, "blue");
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "Alpha"));
  const path = ir.items.find((item) => item.type === "path");
  assert.equal(path.style.markerEnd.kind, "latex");
  assert.ok(path.commands.some((command) => command.type === "curveTo"));
});

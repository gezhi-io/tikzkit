import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { tkzEuclideExtension } from "../src/internal.js";
import { expandTkzEuclide } from "../src/extensions/tkz-euclide.js";
import { collectTexPackages } from "../src/packages/declarations.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/latex-examples/", import.meta.url);

function renderFixture(number) {
  const source = readFileSync(new URL(`geometry-${number}.tex`, FIXTURE_ROOT), "utf8");
  return tikzToSvg(source, { mathRenderer: "svg-text" });
}

function structuralPaths(result) {
  return result.ir.items.filter((item) => item.type === "path" && item.commands.filter((command) => command.type !== "closePath").length >= 2);
}

test("exposes tkz-euclide as a built-in preprocess extension", () => {
  assert.equal(tkzEuclideExtension.name, "tkz-euclide");
  assert.equal(tkzEuclideExtension.phase, "preprocess");
  for (const command of ["tkzSetUpLabel", "tkzSetUpStyle", "tkzDefPoints", "tkzDefMidPoint", "tkzDefBarycentricPoint", "tkzDefCircle", "tkzInterLL", "tkzInterLC", "tkzInterCC", "tkzGetLength", "tkzGetFirstPoint", "tkzGetSecondPoint", "tkzDrawSegments", "tkzDrawPolygon", "tkzDrawCircle", "tkzClipCircle", "tkzDrawArc", "tkzDrawSector", "tkzMarkSegment", "tkzMarkSegments", "tkzMarkAngle", "tkzMarkAngles", "tkzMarkRightAngle", "tkzMarkRightAngles", "tkzFillAngle", "tkzFillAngles", "tkzLabelAngle", "tkzLabelPoint", "tkzLabelPoints", "tkzLabelSegment", "tkzLabelSegments"]) {
    assert.ok(tkzEuclideExtension.commands.includes(command));
  }
  const pkg = collectTexPackages(String.raw`\usepackage{tkz-euclide}`)[0];
  assert.equal(pkg.status, "extension");
  assert.equal(pkg.implementationStatus, "partial");
  assert.match(pkg.implementedBy, /src\/extensions\/tkz-euclide\.js/);
  assert.match(pkg.implementedBy, /src\/engine\/evaluate\.js:buildArc/);
  assert.match(pkg.localSourceReviewed, /tkz-lib-eu-marks\.tex/);
  assert.match(pkg.localSourceReviewed, /tkz-obj-eu-points-spc\.tex/);
});

test("constructs tkz-euclide circle-circle intersections with native result order and point handoff", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,5/0/B,4/0/Ra,8/0/Rb}
  \tkzInterCC[R](A,4cm)(B,3cm)\tkzGetPoints{C}{D}
  \tkzInterCC(A,Ra)(B,Rb)\tkzGetFirstPoint{Upper}\tkzGetSecondPoint{Lower}
  \tkzDrawPolygon(A,B,C)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.C, { x: 3.2, y: 2.4 });
  assert.deepEqual(result.ir.coordinates.D, { x: 3.2, y: -2.4 });
  assert.deepEqual(result.ir.coordinates.Upper, { x: 3.2, y: 2.4 });
  assert.deepEqual(result.ir.coordinates.Lower, { x: 3.2, y: -2.4 });
  assert.equal(structuralPaths(result).length, 1);
});

test("constructs tkz-euclide circle-circle intersections from documented with-nodes radii", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/P,5/0/B,8/0/Q}
  \tkzInterCC[with nodes](A,A,P)(B,B,Q)\tkzGetPoints{Upper}{Lower}
  \tkzDrawCircle(A,P)
  \tkzDrawCircle(B,Q)
  \tkzDrawSegments(A,Upper B,Upper A,Lower B,Lower)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.Upper, { x: 3.2, y: 2.4 });
  assert.deepEqual(result.ir.coordinates.Lower, { x: 3.2, y: -2.4 });
  assert.equal(result.ir.items.filter((item) => item.type === "path" && item.shape === "circle").length, 2);
  assert.equal(result.ir.items.filter((item) => item.type === "path" && item.commands.length === 2).length, 4);
});

test("keeps a tkzInterCC common point as the native second result", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/B,2/3.464101615/C}
  \tkzInterCC[common=C](A,B)(B,A)\tkzGetPoints{Other}{Common}
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.Other, { x: 2, y: -3.4641016151 });
  assert.deepEqual(result.ir.coordinates.Common, { x: 2, y: 3.4641016151 });
});

test("constructs named tkz-euclide midpoints from the centers of two points", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{-1/2/A,5/-4/B,2/3/C,2/-5/D}
  \tkzDefMidPoint(A,B)\tkzGetPoint{M}
  \tkzDefMidPoint(B,A)\tkzGetPoint{ReverseM}
  \tkzInterLL(A,B)(C,D)\tkzGetPoint{OnMedian}
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.M, { x: 2, y: -1 });
  assert.deepEqual(result.ir.coordinates.ReverseM, { x: 2, y: -1 });
  assert.deepEqual(result.ir.coordinates.OnMedian, { x: 2, y: -1 });
});

test("constructs tkz-euclide barycentric points with positive, negative, and macro weights", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,6/0/B,0/9/C}
  \tkzDefBarycentricPoint(A=1,B=2,C=3)\tkzGetPoint{Interior}
  \tkzDefBarycentricPoint(A=-5,C=1)\tkzGetPoint{Exterior}
  \pgfmathsetmacro{\two}{2}
  \tkzDefBarycentricPoint(A=1,C=\two)\tkzGetPoint{MacroWeight}
  \tkzDrawSegments[red](A,Interior A,Exterior A,MacroWeight)
\end{tikzpicture}`;
  const diagnostics = [];
  const expanded = expandTkzEuclide(source, diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.match(expanded, /\\coordinate \(tkzPointResult\) at \(2,4\.5\);\\coordinate \(Interior\) at \(tkzPointResult\);/);
  assert.match(expanded, /\\coordinate \(tkzPointResult\) at \(0,-2\.25\);\\coordinate \(Exterior\) at \(tkzPointResult\);/);
  assert.match(expanded, /\\coordinate \(tkzPointResult\) at \(0,6\);\\coordinate \(MacroWeight\) at \(tkzPointResult\);/);
});

test("preserves a midpoint between ordinary TikZ node anchors as a calc coordinate", () => {
  const diagnostics = [];
  const expanded = expandTkzEuclide(String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \node (A) at (0,0) {};
  \node (B) at (4,2) {};
  \tkzDefMidPoint(A,B)\tkzGetPoint{M}
\end{tikzpicture}`,
  diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.match(expanded, /\\coordinate \(tkzPointResult\) at \(\$\(A\)!\.5!\(B\)\$\);/);
  assert.match(expanded, /\\coordinate \(M\) at \(tkzPointResult\);/);
});

test("constructs a circumcircle center, circumference point, and radius from three points", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/B,0/3/C}
  \tkzDefCircle[circum](A,B,C)\tkzGetPoint{O}\tkzGetPoints{Center}{Through}\tkzGetLength{radius}
  \tkzDrawCircle[draw=red](Center,Through)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.O, { x: 2, y: 1.5 });
  assert.deepEqual(result.ir.coordinates.Center, { x: 2, y: 1.5 });
  assert.deepEqual(result.ir.coordinates.Through, { x: 0, y: 0 });
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.shape === "circle" && item.style.stroke === "red"));
});

test("constructs an incircle center, tangent point, and radius from three points", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}[very thick]
  \tkzDefPoints{0/0/A,4/0/B,0/3/C}
  \tkzDefCircle[in](A,B,C)\tkzGetPoint{I}\tkzGetPoints{Center}{Tangent}\tkzGetLength{radius}
  \tkzDrawCircle[draw=red,very thick](Center,Tangent)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.I, { x: 1, y: 1 });
  assert.deepEqual(result.ir.coordinates.Center, { x: 1, y: 1 });
  assert.deepEqual(result.ir.coordinates.Tangent, { x: 0, y: 1 });
  const circle = result.ir.items.find((item) => item.type === "path" && item.shape === "circle" && item.style.stroke === "red");
  assert.ok(circle);
  assert.equal(circle.style.lineWidth, lineWidthFromPt(1.2));
});

test("constructs tkz-euclide internal angle bisectors with native K and normed semantics", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/B,0/3/C}
  \tkzDefLine[bisector](B,A,C)\tkzGetPoint{a}
  \tkzInterLL(A,a)(B,C)\tkzGetPoint{a2}
  \tkzDefLine[bisector,K=2](B,A,C)\tkzGetPoint{doubleA}
  \tkzDefLine[bisector,K=2,normed=false](B,A,C)\tkzGetPoint{explicitUnnormedA}
  \tkzDefLine[bisector,K=2,normed](B,A,C)\tkzGetPoint{unitA}
  \tkzDrawLine[add=0 and .2,dashed](A,a2)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.a, { x: 2, y: 2 });
  assert.ok(Math.abs(result.ir.coordinates.a2.x - 12 / 7) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.a2.y - 12 / 7) < 1e-9);
  assert.deepEqual(result.ir.coordinates.doubleA, { x: 4, y: 4 });
  assert.deepEqual(result.ir.coordinates.explicitUnnormedA, { x: 4, y: 4 });
  assert.ok(Math.abs(result.ir.coordinates.unitA.x - Math.SQRT2) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.unitA.y - Math.SQRT2) < 1e-9);
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.style.dashArray?.length === 2));
});

test("constructs tkz-euclide exterior angle bisectors with native orientation and scaling", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/B,0/3/C}
  \tkzDefLine[bisector out](B,A,C)\tkzGetPoint{outsideA}
  \tkzDefLine[bisector out,K=2](B,A,C)\tkzGetPoint{doubleOutsideA}
  \tkzDefLine[bisector out,K=2,normed=false](B,A,C)\tkzGetPoint{explicitUnnormedOutsideA}
  \tkzDefLine[bisector out,K=2,normed](B,A,C)\tkzGetPoint{unitOutsideA}
  \tkzDrawLine[add=1 and 1,dashed,blue](A,outsideA)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.outsideA, { x: -2, y: 2 });
  assert.deepEqual(result.ir.coordinates.doubleOutsideA, { x: -4, y: 4 });
  assert.deepEqual(result.ir.coordinates.explicitUnnormedOutsideA, { x: -4, y: 4 });
  assert.ok(Math.abs(result.ir.coordinates.unitOutsideA.x + Math.SQRT2) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.unitOutsideA.y - Math.SQRT2) < 1e-9);
  const exteriorPath = result.ir.items.find((item) => item.type === "path" && item.style.stroke === "blue");
  assert.ok(exteriorPath);
  assert.ok(exteriorPath.style.dashArray?.length === 2);
});

test("constructs tkz-euclide altitude feet by projecting the middle point onto the outer pair", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,6/0/B,.8/4/C}
  \tkzDefLine[altitude](A,B,C)\tkzGetPoint{b}
  \tkzDefLine[altitude,K=2,normed](B,C,A)\tkzGetPoint{c}
  \tkzDefLine[altitude](B,A,C)\tkzGetPoint{a}
  \tkzDrawSegments[blue](A,a B,b C,c)
  \tkzMarkRightAngles(C,a,B A,b,C B,c,A)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(result.ir.coordinates.b.x - 3 / 13) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.b.y - 15 / 13) < 1e-9);
  assert.deepEqual(result.ir.coordinates.c, { x: 0.8, y: 0 });
  assert.ok(Math.abs(result.ir.coordinates.a.x - 600 / 269) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.a.y - 780 / 269) < 1e-9);
  assert.equal(result.ir.items.filter((item) => item.type === "path" && item.style.stroke === "blue").length, 3);
  const rightAngleMarks = result.ir.items.filter((item) => (
    item.type === "path" &&
    item.style.stroke === "black" &&
    item.style.lineWidth === lineWidthFromPt(0.4) &&
    item.commands.filter((command) => command.type === "lineTo").length === 3
  ));
  assert.equal(rightAngleMarks.length, 3);
});

test("constructs tkz-euclide Euler lines as orthocenter and nine-point center pairs", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,6/0/B,.8/4/C}
  \tkzDefLine[euler](A,B,C)\tkzGetPoints{H}{N}
  \tkzGetPoint{Last}
  \tkzDrawLine[add=1 and 1,red](H,N)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.H, { x: 0.8, y: 1.04 });
  assert.deepEqual(result.ir.coordinates.N, { x: 1.9, y: 1.26 });
  assert.deepEqual(result.ir.coordinates.Last, result.ir.coordinates.N);
  assert.equal(result.ir.items.filter((item) => item.type === "path" && item.style.stroke === "red").length, 1);
});

test("constructs tkz-euclide tangents at a circle point and from an external point", () => {
  const source = `
\\usepackage{tkz-euclide}
\\begin{tikzpicture}
  \\tkzDefPoints{0/0/O,0/3/A,6/-1/E}
  \\tkzDefLine[tangent at=A](O)\\tkzGetPoint{H}
  \\tkzDefLine[tangent from=E](O,A)\\tkzGetPoints{T1}{T2}
  \\tkzDrawLine[add=1 and 1,red](A,H)
  \\tkzDrawSegments[blue](E,T1 E,T2)
\\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  // tkzTgtAt uses tkz@VecKOrthNorm[-1](A,O): a one-centimeter,
  // clockwise normal from the tangent point, not a radius-length vector.
  assert.deepEqual(result.ir.coordinates.H, { x: -1, y: 3 });
  assert.ok(Math.abs(result.ir.coordinates.T1.x - 1.0304187063) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.T1.y + 2.8174877621) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.T2.x - 1.8885002126) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.T2.y - 2.3310012756) < 1e-9);
  assert.equal(structuralPaths(result).filter((item) => item.style.stroke === "blue").length, 2);
});

test("constructs tkz-euclide symmedians by reflecting the median in the internal bisector", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/B,0/3/C}
  \tkzDefLine[symmedian](A,B,C)\tkzGetPoint{S}
  \tkzDefLine[symmedian,K=2](A,B,C)\tkzGetPoint{DoubleS}
  \tkzDefLine[symmedian,K=2,normed](A,B,C)\tkzGetPoint{UnitS}
  \tkzDrawLine[add=1 and 1,red](B,S)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.S, { x: -0.1, y: 1.2 });
  assert.deepEqual(result.ir.coordinates.DoubleS, { x: -4.2, y: 2.4 });
  assert.ok(Math.abs(result.ir.coordinates.UnitS.x - 2.0805251859834586) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.UnitS.y - 0.5617975065414267) < 1e-9);
  assert.equal(structuralPaths(result).filter((item) => item.style.stroke === "red").length, 1);
});

test("constructs tkz-euclide mediators as ordered perpendicular-bisector point pairs", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/B}
  \tkzDefLine(A,B)\tkzGetPoints{C}{D}\tkzGetPoint{Last}
  \tkzDefLine[mediator,K=.5](A,B)\tkzGetPoints{HalfC}{HalfD}
  \tkzDefLine[mediator,K=2,normed](A,B)\tkzGetPoints{UnitC}{UnitD}
  \tkzDrawLine[add=.2 and .2,red](C,D)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.C, { x: 2, y: 3.4641016151 });
  assert.deepEqual(result.ir.coordinates.D, { x: 2, y: -3.4641016151 });
  assert.deepEqual(result.ir.coordinates.Last, result.ir.coordinates.D);
  assert.deepEqual(result.ir.coordinates.HalfC, { x: 2, y: 1.7320508076 });
  assert.deepEqual(result.ir.coordinates.HalfD, { x: 2, y: -1.7320508076 });
  assert.deepEqual(result.ir.coordinates.UnitC, { x: 2, y: 2 });
  assert.deepEqual(result.ir.coordinates.UnitD, { x: 2, y: -2 });
  assert.equal(structuralPaths(result).filter((item) => item.style.stroke === "red").length, 1);
});

test("constructs line-circle intersections with native tkz-euclide ordering controls", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/A,4/0/B,2/0/M,3/2/H,0/2/U,0/1/V}
  \tkzInterLC(M,H)(M,B)\tkzGetPoints{E}{C}
  \tkzInterLC[near](H,M)(M,B)\tkzGetPoints{Near}{Far}
  \tkzInterLC[common=C](C,H)(M,B)\tkzGetPoints{Common}{Other}
  \tkzInterLC[R](A,B)(M,1.5)\tkzGetPoints{RadiusLeft}{RadiusRight}
  \tkzInterLC[with nodes](A,B)(M,U,V)\tkzGetPoints{NodeLeft}{NodeRight}
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(result.ir.coordinates.E.x - 1.105572809) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.E.y + 1.788854382) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.C.x - 2.894427191) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.C.y - 1.788854382) < 1e-9);
  assert.deepEqual(result.ir.coordinates.Near, result.ir.coordinates.C);
  assert.deepEqual(result.ir.coordinates.Common, result.ir.coordinates.C);
  assert.deepEqual(result.ir.coordinates.RadiusLeft, { x: 0.5, y: 0 });
  assert.deepEqual(result.ir.coordinates.RadiusRight, { x: 3.5, y: 0 });
  assert.deepEqual(result.ir.coordinates.NodeLeft, { x: 1, y: 0 });
  assert.deepEqual(result.ir.coordinates.NodeRight, { x: 3, y: 0 });
});

test("keeps tkz-euclide line-circle named results stable under a magnifying picture transform", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}[scale=1.5]
  \tkzDefPoints{0/0/A,4/0/B,2/0/M,3/2/H}
  \tkzInterLC[/tikz/overlay](M,H)(M,B)\tkzGetPoints{E}{C}
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(result.ir.coordinates.E.x - 1.6583592135) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.E.y + 2.683281573) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.C.x - 4.3416407865) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.C.y - 2.683281573) < 1e-9);
});

test("keeps the scaled Thales triangle on the forward circle intersection", () => {
  const source = readFileSync(new URL("./fixtures/examples/tkz-euclide/thales-circle-triangle.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.coordinates.C.y > 0, "C should remain on the upper semicircle");
  assert.ok(result.ir.coordinates.E.y < 0, "E should remain on the opposite line-circle contact");
  assert.ok(result.ir.coordinates.C.y > result.ir.coordinates.E.y);
});

test("constructs external circle tangents in tkz-euclide order and preserves their inversion intersection", () => {
  const source = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \pgfmathsetmacro{\Radius}{1}
  \tkzDefPoints{2/1.5/Z,0/0/O}
  \tkzTangent[from with R=Z,/tikz/overlay](O,\Radius cm)\tkzGetPoints{T1}{T2}
  \tkzInterLL(T1,T2)(O,Z)\tkzGetPoint{dZ}
  \tkzDrawArc[R,line width=1pt,color=orange](O,\Radius cm)(0,180)
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(result.ir.coordinates.T1.x - 0.8699090834) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.T1.y + 0.4932121112) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.T2.x + 0.2299090834) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.T2.y - 0.9732121112) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.dZ.x - 0.32) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.dZ.y - 0.24) < 1e-9);
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.shape === "arc" && item.style.stroke === "rgb(255 128 0)"));
});

test("expands circle-through-point, orthogonal-through circles, multi-angle marks, and multi-point labels", () => {
  const diagnostics = [];
  const expanded = expandTkzEuclide(String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/O,1/0/Z,-.7/-.1/A,.4/-.3/B,.1/.4/C}
  \tkzDrawCircle[fill=white](O,Z)
  \tkzClipCircle(O,Z)
  \tkzMarkAngles[fill=orange,size=.3cm,opacity=.3](B,A,C C,B,A)
  \tkzDrawCircle[orthogonal through=A and B,color=green](O,Z)
  \tkzLabelPoints[below left](A,B,C)
\end{tikzpicture}`,
  diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(expanded, /\\tkz(?:DrawCircle|ClipCircle|MarkAngles|LabelPoints)/);
  assert.match(expanded, /\\draw\[color=black!50,line width=0\.2pt,fill=white\] \(O\) circle \(1cm\);/);
  assert.match(expanded, /\\draw\[opacity=\.3,fill=none\]/);
  assert.match(expanded, /\\draw\[color=black!50,line width=0\.2pt,color=green,tikzkit clip circle=\{0cm,0cm,1cm\}\] \([^)]*\) arc \(/);
  assert.match(expanded, /\\node\[label style,below left\] at \(A\) \{\$A\$\};/);
  assert.match(expanded, /\\node\[label style,below left\] at \(B\) \{\$B\$\};/);
  assert.match(expanded, /\\node\[label style,below left\] at \(C\) \{\$C\$\};/);
});

test("renders hyperbolic triangle circle geometry without tkz-euclide diagnostics", () => {
  for (const name of ["hyperbolic-triangle-exterior-angles.tex", "hyperbolic-triangle-interior-angles.tex"]) {
    const source = readFileSync(new URL(name, FIXTURE_ROOT), "utf8");
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const messages = result.diagnostics.map((diagnostic) => diagnostic.message);

    assert.equal(messages.some((message) => /Unsupported command \\tkz(?:DrawCircle|ClipCircle|MarkAngles|LabelPoints)/.test(message)), false);
    assert.ok(result.ir.items.some((item) => item.type === "path" && item.shape === "circle"));
    assert.ok(result.ir.items.filter((item) => item.type === "path" && item.shape === "arc").length >= 3);
    assert.ok(result.ir.items.filter((item) => item.type === "path" && item.clipCircle).length >= 4);
    assert.ok(result.ir.items.some((item) => item.clipCircle?.radius === 3));
    assert.match(result.svg, /tikzkit-clip-circle-/);
  }
});

test("renders the real interior and exterior triangle-angle case with matching arc multiplicities", () => {
  const source = readFileSync(new URL("interiour-exteriour-angles-triangle.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const arcs = result.ir.items.filter((item) => item.type === "path" && item.shape === "arc");
  const pointMarks = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(arcs.length, 21);
  assert.equal(pointMarks.length, 3);
  assert.ok(paths.filter((item) => item.commands.some((command) => command.type === "lineTo")).length >= 3);
  assert.match(result.svg, /stroke=\"rgb\(0 255 0\)\"/);
  assert.match(result.svg, /stroke=\"blue\"/);
});

test("expands points, intersections, extended lines, polygons, segments, and labels into ordinary TikZ", () => {
  const diagnostics = [];
  const expanded = expandTkzEuclide(String.raw`
\usepackage{tkz-euclide}
\usetkzobj{all}
\begin{tikzpicture}
  \tkzSetUpPoint[shape=circle,size=10,color=black,fill=black]
  \tkzSetUpLine[line width=1]
  \tkzDefPoints{0/0/A,4/0/B,1/2/C,2/-1/D}
  \tkzInterLL(A,B)(C,D) \tkzGetPoint{I}
  \tkzDrawLine[add=0 and .5](A,I)
  \tkzDrawPolygon[blue](A,B,C)
  \tkzDrawSegments(A,C B,C)
  \tkzDrawPoints(A,B,C,I)
  \tkzLabelPoint[above](I){$I$}
\end{tikzpicture}`,
  diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(expanded, /\\(?:usetkzobj|tkz[A-Za-z]+)/);
  assert.match(expanded, /\\coordinate \(tkzPointResult\) at \(1\.6666666667,0\);/);
  assert.match(expanded, /\\coordinate \(I\) at \(tkzPointResult\);/);
  assert.match(expanded, /\\draw\[line width=1pt,[^\]]*\] \(A\) -- \(\$\(I\)!-0\.5!\(A\)\$\);/);
  assert.match(expanded, /\\draw\[line width=1pt,[^\]]*blue[^\]]*,line join=round\] \(A\) -- \(B\) -- \(C\) -- cycle;/);
  assert.match(expanded, /minimum size=10pt/);
  assert.match(expanded, /\\node\[label style,above\] at \(I\) \{\$I\$\};/);
});

test("keeps tkzLabelLine positions outside the segment and renders coordinate-system polygons", () => {
  const source = readFileSync(new URL("coordinate-system-3.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = new Map(
    result.ir.items
      .filter((item) => item.type === "textNode" && item.text)
      .map((item) => [item.text, item])
  );
  const closedPolygons = result.ir.items.filter(
    (item) => item.type === "path" && item.commands.some((command) => command.type === "closePath")
  );

  assert.deepEqual(result.diagnostics, []);
  assert.equal(closedPolygons.length, 2);
  assert.ok(Math.abs(labels.get("$g_1$").x - 3) < 1e-9);
  assert.ok(Math.abs(labels.get("$g_2$").y - 3) < 1e-9);
  assert.deepEqual(result.ir.coordinates.R, { x: 2, y: 3 });
});

test("renders coordinate-system-1 axes, angle mark, and the default point label", () => {
  const source = readFileSync(new URL("coordinate-system-1.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = new Map(
    result.ir.items
      .filter((item) => item.type === "textNode" && item.text)
      .map((item) => [item.text, item])
  );
  const point = result.ir.items.find((item) => item.type === "nodeBox" && item.shape === "circle");
  const axes = structuralPaths(result).filter((item) => item.shape !== "arc");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.P, { x: 2, y: 1 });
  assert.equal(result.ir.items.filter((item) => item.type === "path" && item.shape === "arc").length, 1);
  assert.deepEqual(axes.map((item) => item.commands), [
    [{ type: "moveTo", x: -3, y: 0 }, { type: "lineTo", x: 3, y: 0 }],
    [{ type: "moveTo", x: 0, y: -3 }, { type: "lineTo", x: 0, y: 3 }]
  ]);
  assert.equal(labels.get("$g_1$").x, 3);
  assert.equal(labels.get("$g_2$").y, 3);
  assert.ok(labels.get("$P$").y < point.y);
});

test("renders coordinate-system-2 angle arcs and labels on the normalized bisector", () => {
  const source = readFileSync(new URL("coordinate-system-2.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const angleArc = result.ir.items.find((item) => item.type === "path" && item.shape === "arc");
  const angleLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$\\cdot$");
  const closedPolygon = result.ir.items.find(
    (item) => item.type === "path" && item.commands.some((command) => command.type === "closePath")
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(angleArc);
  assert.equal(angleArc.style.fill, "none");
  assert.equal(angleArc.style.opacity, 0.5);
  assert.deepEqual(angleArc.commands[0], { type: "moveTo", x: 0.3, y: 0 });
  assert.ok(Math.abs(angleArc.commands.at(-1).x) < 1e-9);
  assert.ok(Math.abs(angleArc.commands.at(-1).y - 0.3) < 1e-9);
  assert.ok(angleLabel);
  assert.ok(Math.abs(angleLabel.x - 0.15 / Math.sqrt(2)) < 1e-9);
  assert.ok(Math.abs(angleLabel.y - 0.15 / Math.sqrt(2)) < 1e-9);
  assert.deepEqual(closedPolygon.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 2, y: 0 },
    { type: "lineTo", x: 2, y: 1 },
    { type: "lineTo", x: 0, y: 1 },
    { type: "closePath" }
  ]);
});

test("expands perpendicular lines through ordinary TikZ nodes and explicit-radius arcs", () => {
  const diagnostics = [];
  const expanded = expandTkzEuclide(String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{1/1/Z1,2/2/Z2,3/0/A}
  \node (m) at ($(Z1)!0.5!(Z2)$) {};
  \tkzDefLine[perpendicular=through m](Z1,Z2)\tkzGetPoint{c}
  \tkzDrawLine[add=2 and 1,dashed,thick](m,c)
  \tkzDrawArc[R,line width=1pt,color=orange](A,2.24 cm)(0,180)
\end{tikzpicture}`,
  diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.match(expanded, /\\coordinate \(tkzPointResult\) at \(\$\(m\)\+\(-1,1\)\$\);/);
  assert.match(expanded, /\\coordinate \(c\) at \(tkzPointResult\);/);
  assert.match(expanded, /\(\$\(m\)!-2!\(c\)\$\) -- \(\$\(c\)!-1!\(m\)\$\)/);
  assert.match(expanded, /\\draw\[line width=1pt,draw=orange\] \(\$\(A\)\+\(0:2\.24cm\)\$\) arc \(0:180:2\.24cm\);/);
});

test("expands tkz-euclide sectors through their four documented draw modes", () => {
  const diagnostics = [];
  const expanded = expandTkzEuclide(String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{0/0/O,2/0/A,0/2/B,-1/1/C}
  \tkzDrawSector[thick,fill=green!20](O,A)(B)
  \tkzDrawSector[rotate,draw=orange](O,A)(-90)
  \tkzDrawSector[R,draw=teal](O,1)(90,0)
  \tkzDrawSector[R with nodes,fill=blue!20](O,1.5)(B,C)
\end{tikzpicture}`,
  diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.match(expanded, /\\draw\[thick,fill=green!20\] \(O\) -- \(\$\(O\)\+\(0:2cm\)\$\) arc \(0:90:2cm\) -- cycle;/);
  assert.match(expanded, /\\draw\[draw=orange\] \(O\) -- \(\$\(O\)\+\(-90:2cm\)\$\) arc \(-90:0:2cm\) -- cycle;/);
  assert.match(expanded, /\\draw\[draw=teal\] \(O\) -- \(\$\(O\)\+\(-270:1cm\)\$\) arc \(-270:0:1cm\) -- cycle;/);
  assert.match(expanded, /\\draw\[fill=blue!20\] \(O\) -- \(\$\(O\)\+\(90:1\.5cm\)\$\) arc \(90:135:1\.5cm\) -- cycle;/);
});

test("renders the full thales circle triangle including tkzDrawSector", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/tkz-euclide/thales-circle-triangle.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const sector = result.ir.items.find((item) => (
    item.type === "path" &&
    item.shape === "arc" &&
    item.commands.some((command) => command.type === "closePath")
  ));

  assert.deepEqual(result.diagnostics, []);
  assert.ok(sector);
  // The example has picture scale=1.5, so the native M->B radius of 2cm
  // becomes a three-unit radial edge in the shared scene graph.
  assert.deepEqual(sector.commands[0], { type: "moveTo", x: 3, y: 0 });
  assert.deepEqual(sector.commands[1], { type: "lineTo", x: 6, y: 0 });
  assert.ok(sector.commands.some((command) => command.type === "closePath"));
});

test("renders the hyperbolic axiom fixture with points, a perpendicular, and its orange semicircle", () => {
  const source = readFileSync(new URL("hyperbolische-geometrie-axiom-1-2.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const orangePaths = result.ir.items.filter(
    (item) => item.type === "path" && item.shape === "arc" && item.style?.stroke === "rgb(255 128 0)"
  );

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.c, { x: 0.5, y: 2.5 });
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle").length, 2);
  assert.equal(orangePaths.length, 1);
  assert.equal(orangePaths[0].shape, "arc");
  assert.equal(orangePaths[0].commands.filter((command) => command.type === "curveTo").length, 2);
});

test("renders geometry-3 with its complete point-line-intersection-label structure", () => {
  const result = renderFixture(3);
  const paths = structuralPaths(result);
  const labels = result.ir.items.filter((item) => item.type === "textNode" && item.text).map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.C, { x: 2.2857142857, y: 1.1428571429 });
  assert.equal(paths.length, 5);
  assert.deepEqual(paths[0].commands, [
    { type: "moveTo", x: -0.2, y: -0.4 },
    { type: "lineTo", x: 1.2, y: 2.4 }
  ]);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox").length, 5);
  for (const label of ["$P$", "$Q$", "$B$", "$C$", "$A$"]) assert.ok(labels.includes(label));
});

test("renders geometry-8 segments, intersections, and multi-arc angles", () => {
  const result = renderFixture(8);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message);
  const angleArcs = result.ir.items.filter((item) => item.type === "path" && item.shape === "arc");
  const nonAnglePaths = structuralPaths(result).filter((item) => item.shape !== "arc");
  const labels = new Map(
    result.ir.items
      .filter((item) => item.type === "textNode" && item.text)
      .map((item) => [item.text, item])
  );

  assert.deepEqual(result.ir.coordinates.M, { x: 3, y: 1 });
  assert.equal(nonAnglePaths.length, 7);
  assert.equal(angleArcs.length, 7);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox").length, 5);
  for (const label of ["$\\alpha_1$", "$\\alpha_2$", "$\\beta$", "$\\gamma$", "$M$"]) {
    assert.ok(labels.has(label), `geometry-8 should render ${label}`);
  }
  assert.ok(labels.get("$\\alpha_1$").x > 0 && labels.get("$\\alpha_1$").y > 0);
  assert.ok(labels.get("$\\alpha_2$").x > 0 && labels.get("$\\alpha_2$").y > 0);
  assert.ok(labels.get("$\\beta$").x < result.ir.coordinates.B.x && labels.get("$\\beta$").y > 0);
  assert.ok(labels.get("$\\gamma$").y < result.ir.coordinates.C.y);
  assert.deepEqual(messages, []);
  assert.equal(messages.some((message) => /Unsupported command|Unknown coordinate/.test(message)), false);
});

test("renders geometry-9's single and triple tkz angle arcs without diagnostics", () => {
  const result = renderFixture(9);
  const arcs = result.ir.items.filter((item) => item.type === "path" && item.shape === "arc");
  const redArcs = arcs.filter((item) => item.style.stroke === "red");
  const greenArcs = arcs.filter((item) => item.style.stroke === "rgb(0 255 0)");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(redArcs.length, 1);
  assert.equal(greenArcs.length, 3);
  assert.ok(greenArcs[1].commands[0].x > greenArcs[0].commands[0].x);
  assert.ok(greenArcs[2].commands[0].x < greenArcs[0].commands[0].x);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle").length, 5);
});

test("keeps tkz-euclide exterior triple-angle arcs visibly separated at the PGF default linewidth", () => {
  const source = readFileSync(
    new URL("interiour-exteriour-angles-triangle.tex", FIXTURE_ROOT),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const arcs = result.ir.items.filter((item) => item.type === "path" && item.shape === "arc");
  const blueArcs = arcs.filter((item) => item.style.stroke === "blue");
  const greenArcs = arcs.filter((item) => item.style.stroke === "rgb(0 255 0)");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(greenArcs.length, 3);
  assert.equal(blueArcs.length, 18);
  assert.equal(blueArcs.every((arc) => arc.style.fill === "none"), true);

  // The first exterior mark is centered at Q. tkz-euclide uses size cm,
  // then size cm minus/plus 2.5\pgflinewidth; PGF defaults to 0.4pt.
  const firstTriple = blueArcs.slice(0, 3);
  const radii = firstTriple.map((arc) => Math.hypot(
    arc.commands[0].x - result.ir.coordinates.Q.x,
    arc.commands[0].y - result.ir.coordinates.Q.y
  ));
  assert.ok(Math.abs(radii[0] - 0.6) < 1e-8);
  assert.ok(Math.abs(radii[1] - (0.6 - 0.4 * 2.5 / 28.45274)) < 1e-8);
  assert.ok(Math.abs(radii[2] - (0.6 + 0.4 * 2.5 / 28.45274)) < 1e-8);
});

test("renders official tkz-euclide angle equality marks in the decorated arc tangent frame", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/tkz-euclide/angle-equality-marks.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const marks = result.ir.items.filter((item) => item.type === "path" && item.shape === "plot-mark");
  const cross = marks.find((item) => item.mark === "x");
  const doubleBar = marks.find((item) => item.mark === "||");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(cross, "expected the official mark=x angle marker");
  assert.ok(doubleBar, "expected the official mark=|| angle marker");
  assert.equal(doubleBar.commands.length, 4);

  const [crossStart, crossEnd] = cross.commands;
  assert.ok(Math.abs(crossEnd.x - crossStart.x) > 0.05);
  assert.ok(Math.abs(crossEnd.y - crossStart.y) > 0.05);

  const [firstStart, firstEnd, secondStart, secondEnd] = doubleBar.commands;
  const firstBar = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const secondBar = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  assert.ok(Math.abs(firstBar.x * secondBar.y - firstBar.y * secondBar.x) < 1e-9);
});

test("renders tkz-euclide custom angle marks from the local PGF declarations", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/tkz-euclide/custom-angle-marks.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const marks = result.ir.items.filter((item) => item.type === "path" && item.shape === "plot-mark");
  const byKind = new Map(marks.map((item) => [item.mark, item]));

  assert.deepEqual(result.diagnostics, []);
  for (const kind of ["z", "s", "oo", "s|", "s||", "s|||"]) {
    assert.ok(byKind.has(kind), `expected custom tkz-euclide mark ${kind}`);
  }
  assert.equal(byKind.get("z").commands.length, 4);
  assert.equal(byKind.get("s").commands.filter((command) => command.type === "curveTo").length, 2);
  assert.equal(byKind.get("oo").commands.filter((command) => command.type === "curveTo").length, 4);
  assert.equal(byKind.get("s||").commands.length, 4);
  assert.equal(byKind.get("s|||").commands.length, 6);
});

test("renders tkz-euclide custom segment marks in the decorated path frame", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/tkz-euclide/custom-segment-marks.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const marks = result.ir.items.filter((item) => item.type === "path" && item.shape === "plot-mark");
  const byKind = new Map(marks.map((item) => [item.mark, item]));

  assert.deepEqual(result.diagnostics, []);
  for (const kind of ["z", "s", "oo", "s|", "s||", "s|||"]) {
    assert.ok(byKind.has(kind), `expected custom tkz-euclide segment mark ${kind}`);
  }

  const [from, to] = result.ir.items.find((item) => item.type === "path" && item.commands?.length === 2 && item.style?.stroke === "black").commands;
  const segment = { x: to.x - from.x, y: to.y - from.y };
  const slash = byKind.get("s|").commands;
  const slashDirection = { x: slash[1].x - slash[0].x, y: slash[1].y - slash[0].y };
  assert.ok(Math.abs(segment.x * slashDirection.y - segment.y * slashDirection.x) > 0.01);
});

test("renders tkz-euclide normal, German, and multiple right angle marks", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/tkz-euclide/right-angle-marks.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const closedMarks = result.ir.items.filter((item) => (
    item.type === "path" && item.shape !== "circle" && item.commands?.some((command) => command.type === "closePath")
  ));
  const arcs = result.ir.items.filter((item) => item.type === "path" && item.shape === "arc");
  const filledDots = result.ir.items.filter((item) => item.type === "path" && item.shape === "circle" && item.style?.fill === "red");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(closedMarks.length, 3);
  assert.equal(closedMarks.some((item) => item.style?.fill === "rgb(204 204 255)"), true);
  assert.equal(closedMarks.filter((item) => item.style?.fill === "rgb(204 255 204)").length, 2);
  assert.equal(arcs.some((item) => item.style?.stroke === "red"), true);
  assert.equal(filledDots.length, 1);
});

test("renders single and multiple tkz-euclide angle sectors with native size and fill semantics", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/tkz-euclide/fill-angles.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const sectors = result.ir.items.filter((item) => (
    item.type === "path" && item.commands?.some((command) => command.type === "closePath")
  ));
  const blueSector = sectors.find((item) => item.style?.fill === "rgb(204 204 255)");
  const redSectors = sectors.filter((item) => item.style?.fill === "rgb(255 204 204)");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(blueSector);
  assert.equal(blueSector.style.opacity, 0.5);
  assert.ok(Math.abs(blueSector.commands[1].x - 1.5) < 1e-9);
  assert.equal(redSectors.length, 2);
  assert.equal(redSectors.every((item) => item.style?.opacity === 0.25), true);
});

test("places single and plural tkz-euclide segment labels through native path nodes", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/tkz-euclide/segment-labels.tex", import.meta.url),
    "utf8"
  );
  const diagnostics = [];
  const expanded = expandTkzEuclide(source, diagnostics);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => item.type === "textNode" && ["$a$", "$b$", "$c$"].includes(item.text));

  assert.deepEqual(diagnostics, []);
  assert.match(expanded, /\\path \(B\) to node\[label style,right\] \{\$a\$\} \(C\);/);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(labels.length, 3);
  const byText = new Map(labels.map((item) => [item.text, item]));
  assert.ok(byText.get("$a$").x > 1.4);
  assert.ok(byText.get("$b$").x < 0.5);
  assert.ok(byText.get("$c$").y < 0.1);

  const pluralDiagnostics = [];
  const plural = expandTkzEuclide(String.raw`
    \usepackage{tkz-euclide}
    \begin{tikzpicture}
      \tkzDefPoints{0/0/A,1/0/B,1/1/C}
      \tkzLabelSegments[above,pos=.25](A,B B,C){$s$}
    \end{tikzpicture}
  `, pluralDiagnostics);
  assert.deepEqual(pluralDiagnostics, []);
  assert.equal((plural.match(/node\[label style,above,pos=.25\] \{\$s\$\}/g) || []).length, 2);
});

test("shares tkz-euclide label styles between point and segment labels", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/tkz-euclide/label-styles.tex", import.meta.url),
    "utf8"
  );
  const diagnostics = [];
  const expanded = expandTkzEuclide(source, diagnostics);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = new Map(result.ir.items
    .filter((item) => item.type === "textNode")
    .map((item) => [item.text, item]));

  assert.deepEqual(diagnostics, []);
  assert.match(expanded, /\\tikzset\{label style\/\.style=\{font=\\scriptsize,red\}\}/);
  assert.match(expanded, /\\tikzset\{label style\/\.style=\{blue,font=\\footnotesize\}\}/);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(labels.get("$A$").style.fill, "red");
  assert.equal(labels.get("$r$").style.fill, "red");
  assert.equal(labels.get("$A$").style.fontScale, 0.7);
  assert.equal(labels.get("$D$").style.fill, "blue");
  assert.equal(labels.get("$s$").style.fill, "blue");
  assert.equal(labels.get("$D$").style.fontScale, 0.8);

  const appended = tikzToSvg(String.raw`
    \usepackage{tkz-euclide}
    \tikzset{label style/.append style={green,font=\tiny}}
    \begin{tikzpicture}
      \tkzDefPoint(0,0){G}
      \tkzLabelPoint(G){$G$}
    \end{tikzpicture}
  `, { mathRenderer: "svg-text" });
  const appendedLabel = appended.ir.items.find((item) => item.type === "textNode" && item.text === "$G$");
  assert.deepEqual(appended.diagnostics, []);
  assert.equal(appendedLabel.style.fill, "rgb(0 255 0)");
  assert.equal(appendedLabel.style.fontScale, 0.5);
});

test("renders tkzMarkSegments bar marks at native tangent offsets", () => {
  const source = readFileSync(new URL("geometry-6.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const shortBlackPaths = result.ir.items.filter((item) => {
    if (item.type !== "path" || item.style?.stroke !== "black" || item.commands?.length !== 2) return false;
    const [from, to] = item.commands;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return length > 0.27 && length < 0.29;
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(shortBlackPaths.length, 4);
  for (const path of shortBlackPaths) {
    const [from, to] = path.commands;
    assert.ok(Math.hypot(to.x - from.x, to.y - from.y) > 0.27);
  }
});

test("keeps geometry-3 through geometry-9 structurally drawable through the shared subset", () => {
  for (let number = 3; number <= 9; number += 1) {
    const result = renderFixture(number);
    const messages = result.diagnostics.map((diagnostic) => diagnostic.message);

    assert.ok(Object.keys(result.ir.coordinates).length >= 3, `geometry-${number} should define its points`);
    assert.ok(structuralPaths(result).length >= 1, `geometry-${number} should contain structural paths`);
    assert.ok(result.ir.items.some((item) => item.type === "nodeBox"), `geometry-${number} should draw points`);
    assert.equal(
      messages.some((message) => /Unsupported command \\tkz(?:SetUp|DefPoint|InterLL|GetPoint|Draw|LabelPoint|LabelLine|FillPolygon)/.test(message)),
      false,
      `geometry-${number} should not fall back to unsupported diagnostics for the shared subset`
    );
    assert.equal(messages.some((message) => /Unknown coordinate/.test(message)), false, `geometry-${number} should resolve shared points`);
  }
});

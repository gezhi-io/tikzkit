import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";

const options = "hide axis,scale only axis,width=6cm,height=4cm,enlargelimits=false";
const dir = "error bars/.cd,y dir=both,y explicit";
const stems = result => result.ir.items.filter(item => item.subtype === "axis-error-bar");
const caps = result => result.ir.items.filter(item => item.subtype === "axis-error-cap");
const vertices = path => path.commands.map(({ x, y }) => [x, y]);
const near = (got, expected) => assert.ok(Math.abs(got - expected) < 0.00001, `${got} != ${expected}`);

function plot(env, axis, body) {
  return tikzToSvg(String.raw`\begin{tikzpicture}\begin{${env}}[${options},${axis}]
    ${body}\end{${env}}\end{tikzpicture}`);
}

test("semilogy projects the two raw endpoints, not symmetric offsets in screen space", () => {
  const result = plot("semilogyaxis", "xmin=-1,xmax=5,ymin=1,ymax=16,log basis y=2",
    String.raw`\addplot[only marks,mark=*,blue,${dir}] coordinates {(2,4) +- (0,2)};`);
  assert.deepEqual(result.diagnostics, []);
  const arms = stems(result).map(vertices);
  assert.equal(arms.length, 2);
  for (const [[x,y],[endX]] of arms) { near(x,3); near(y,2); near(endX,3); }
  near(arms[0][1][1], Math.log2(6)); near(arms[1][1][1],1);
  for (const [i, cap] of caps(result).entries()) {
    const [[x1,y1],[x2,y2]] = vertices(cap);
    near(y1, arms[i][1][1]); near(y2,y1); near(Math.abs(x1-x2),4*2.54/72.27);
  }
});

test("only the invalid log arm is omitted; the linear dimension keeps negative values", () => {
  const axis = { ymode:"log", enlargelimits:false };
  const series = {type:"coordinates", options:{"error bars/.cd":true,"x dir":"both","x fixed":2,"y dir":"both","y explicit":true},
    points:[{x:-3,y:2,errors:{y:{plus:4,minus:2}}}, {x:1,y:4,errors:{y:{plus:1,minus:5}}}]};
  const ranges = computeAxisRanges(axis, [series]);
  assert.deepEqual([ranges.xMin,ranges.xMax,ranges.yMin,ranges.yMax], [-5,3,2,6]);
  const result = plot("semilogyaxis","xmin=-5,xmax=3,ymin=1,ymax=8",String.raw`\addplot[only marks,mark=*,blue,
    error bars/.cd,x dir=both,x fixed=2,y dir=both,y explicit] coordinates {(-3,2) += (0,4) -= (0,2) (1,4) += (0,1) -= (0,5)};`);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(stems(result).length,6);
  assert.equal(caps(result).length,6);
  assert.doesNotMatch(result.svg,/NaN|Infinity/);
});

test("base-two relative table errors skip missing sides and keep the log of one", () => {
  const result = plot("loglogaxis","xmin=1,xmax=8,ymin=1,ymax=16,log basis x=2,log basis y=2",
    String.raw`\addplot[only marks,mark=*,blue,error bars/.cd,x dir=minus,x fixed relative=.5,y dir=both,y explicit relative]
      table[x=X,y=Y,y error plus=up,y error minus=dn] {
        X Y up dn
        2 4 .5 .75
        4 8 0  1.5
      };`);
  assert.deepEqual(result.diagnostics, []);
  const arms = stems(result).map(vertices);
  assert.equal(arms.length,5);
  for (const [i,[x,y]] of [[0,2], [2,Math.log2(6)], [2,0], [2,3], [4,3]].entries()) {
    near(arms[i][1][0],x); near(arms[i][1][1],y);
  }
});

test("an invalid log center neither widens the other axis nor joins a requested gap", () => {
  for (const policy of ["discard", "jump"]) {
    const result = plot("semilogyaxis", `unbounded coords=${policy},ymin=1,ymax=10`,
      String.raw`\addplot[mark=none,error bars/.cd,y dir=plus,y fixed=1]
        coordinates {(1,2) (2,4) (100,0) (2000,-1) (3,3) (4,6)};`);
    assert.deepEqual(result.diagnostics, []);
    const line = result.ir.items.filter(item => item.subtype === "axis-plot").flatMap(item => item.commands);
    assert.deepEqual(line.map(({type}) => type), ["moveTo", "lineTo", policy === "jump" ? "moveTo" : "lineTo", "lineTo"]);
    [0, 2, 4, 6].forEach((x, i) => near(line[i].x, x));
    assert.equal(stems(result).length, 4);
  }
});

test("an invalid fixed relative log factor is a plot error, even if its side is unused", () => {
  const opts = "xmin=1,xmax=16,ymin=1,ymax=16";
  for (const [dimension,e] of [["x",1],["y",-1.2]]) {
    const result = plot("loglogaxis",opts,String.raw`\addplot[blue,error bars/.cd,${dimension} dir=plus,${dimension} fixed relative=${e}]
      coordinates {(2,3) (4,5)};`);
    const issues = result.diagnostics.filter(d => d.code === "PGFPLOTS_LOG_ERROR_FACTOR");
    assert.equal(issues.length,1);
    assert.equal(issues[0].severity,"error"); assert.ok(issues[0].message.includes(dimension + " fixed relative"));
  }
});

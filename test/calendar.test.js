import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function renderCalendar(body) {
  return tikzToSvg(String.raw`
\documentclass[tikz,border=2pt]{standalone}
\usepackage{tikz}
\usetikzlibrary{calendar}
\begin{document}
${body}
\end{document}`, { mathRenderer: "svg-text" });
}

function textNode(result, text) {
  return result.ir.items.find((item) => item.type === "textNode" && item.text === text);
}

test("lays out a multi-month week list Monday through Sunday with native month gaps", () => {
  const result = renderCalendar(String.raw`
\begin{tikzpicture}
  \calendar (cal) at (0,0)
    [dates=2000-01-01 to 2000-02-last,
     week list,
     month label above centered,
     month text=\textcolor{blue}{\%mt} \%y-,
     day xshift=1cm,
     day yshift=1cm,
     month yshift=3cm,
     every day/.style={draw, minimum size=8mm}]
    if (Sunday) [red];
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  const january = textNode(result, "\\textcolor{blue}{January} 2000");
  const february = textNode(result, "\\textcolor{blue}{February} 2000");
  assert.ok(january);
  assert.ok(february);
  assert.equal(january.x, february.x);

  const jan1 = textNode(result, "1");
  const jan2 = textNode(result, "2");
  const jan3 = textNode(result, "3");
  const jan31 = result.ir.items.find((item) => item.type === "textNode" && item.text === "31");
  const feb1 = result.ir.items.filter((item) => item.type === "textNode" && item.text === "1")[1];

  assert.equal(jan1.x, 5);
  assert.equal(jan2.x, 6);
  assert.equal(jan2.y, 0);
  assert.equal(jan3.x, 0);
  assert.equal(jan3.y, -1);
  assert.equal(jan2.style.fill, "red");
  assert.equal(feb1.x, 1);
  assert.equal(feb1.y, jan31.y - 3);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox").length, 60);
});

test("matches documented calendar weekday groups and text shorthands", () => {
  const result = renderCalendar(String.raw`
\begin{tikzpicture}
  \calendar [dates=2024-03-01 to 2024-03-03,
    week list,
    day text=\%w. \%d0,
    month label above centered,
    month text=\%m. \%y=]
    if (weekend) [blue];
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(textNode(result, "Mar 2024"));
  assert.equal(textNode(result, "Fri 01").style.fill, "black");
  assert.equal(textNode(result, "Sat 02").style.fill, "blue");
  assert.equal(textNode(result, "Sun 03").style.fill, "blue");
});

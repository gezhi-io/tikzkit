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

test("lays out documented day-list directions and month-list weekday offsets", () => {
  const renderSingleCalendar = (calendar) => renderCalendar(String.raw`
\begin{tikzpicture}
  ${calendar}
\end{tikzpicture}`);
  const dateNodes = (result) => result.ir.items.filter((item) => item.type === "textNode");

  const down = renderSingleCalendar(String.raw`\calendar [dates=2000-01-30 to 2000-02-02, day list downward,
    day yshift=1cm, month yshift=3cm, day text=\%m0/\%d0];
  `);
  const up = renderSingleCalendar(String.raw`\calendar [dates=2000-01-30 to 2000-02-02, day list upward,
    day yshift=1cm, month yshift=3cm];
  `);
  const right = renderSingleCalendar(String.raw`\calendar [dates=2000-01-30 to 2000-02-02, day list right,
    day xshift=1cm, month xshift=3cm];
  `);
  const left = renderSingleCalendar(String.raw`\calendar [dates=2000-01-30 to 2000-02-02, day list left,
    day xshift=1cm, month xshift=3cm];
  `);
  const months = renderSingleCalendar(String.raw`\calendar [dates=2000-01-01 to 2000-02-02, month list,
    month label left, day xshift=1cm, month yshift=3cm];
  `);
  for (const result of [down, up, right, left, months]) assert.deepEqual(result.diagnostics, []);

  const [downJan30, downJan31, downFeb1] = dateNodes(down);
  const [, upJan31, upFeb1] = dateNodes(up);
  const [, rightJan31, rightFeb1] = dateNodes(right);
  const [, leftJan31, leftFeb1] = dateNodes(left);
  const january = textNode(months, "January");
  const february = textNode(months, "February");
  const monthDates = dateNodes(months).filter((item) => /^\d+$/.test(item.text));
  const monthJan1 = monthDates[0];
  const monthFeb1 = monthDates.find((item) => item.text === "1" && item.y < monthJan1.y);

  assert.equal(downFeb1.x, downJan30.x);
  assert.equal(downJan30.text, "01/30");
  assert.equal(downFeb1.y, downJan31.y - 4);
  assert.equal(upFeb1.y, upJan31.y + 4);
  assert.equal(rightFeb1.x, rightJan31.x + 4);
  assert.equal(leftFeb1.x, leftJan31.x - 4);
  assert.ok(january && february);
  assert.ok(january.x < monthJan1.x, "month label left stays to the left of its month row");
  assert.equal(monthJan1.x, 5, "January 1, 2000 was a Saturday in Monday-first columns");
  assert.equal(monthFeb1.x, 1, "February 1, 2000 was a Tuesday in Monday-first columns");
  assert.equal(monthFeb1.y, monthJan1.y - 3);
});

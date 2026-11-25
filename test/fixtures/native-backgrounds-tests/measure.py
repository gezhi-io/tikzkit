"""Measure original TikZ pictures from JSON on stdin; print their native paint trace."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import fitz  # PyMuPDF: actual PDF paint, after PGF assembles its layer boxes.


PREAMBLE = r"""\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{backgrounds}
\pagestyle{empty}
\makeatletter
\newwrite\bgout
\immediate\openout\bgout=picture.trace
\def\bgbounds{\immediate\write\bgout{B \bgid\space
  \number\pgf@picminx\space\number\pgf@picminy\space
  \number\pgf@picmaxx\space\number\pgf@picmaxy}}
\tikzset{every picture/.append style={execute at end picture=\bgbounds}}
% Freeze values now; defer the write until shipout to observe physical layer order.
\def\bglater#1{\begingroup\edef\bgdo{\endgroup\noexpand\write\bgout{#1}}\bgdo}
\def\bgxy#1#2#3{\bglater{#1 \number\dimexpr#2\relax\space\number\dimexpr#3\relax}}
\def\bgbackground{background}
\def\bgpaint{%
  \bglater{P \bgid\space\pgfonlayer@name\space\number\pgflinewidth\space
    \number\pgf@pathminx\space\number\pgf@pathminy\space
    \number\pgf@pathmaxx\space\number\pgf@pathmaxy}%
  \ifx\pgfonlayer@name\bgbackground
    \pgfgetpath\bgpath
    \def\pgfsyssoftpath@movetotoken{\bgxy{M}}%
    \def\pgfsyssoftpath@linetotoken{\bgxy{L}}%
    \def\pgfsyssoftpath@curvetosupportatoken{\bgxy{C1}}%
    \def\pgfsyssoftpath@curvetosupportbtoken{\bgxy{C2}}%
    \def\pgfsyssoftpath@curvetotoken{\bgxy{C}}%
    \def\pgfsyssoftpath@rectcornertoken{\bgxy{R}}%
    \def\pgfsyssoftpath@rectsizetoken{\bgxy{S}}%
    \def\pgfsyssoftpath@closepathtoken##1##2{\bglater{Z}}%
    \bgpath
  \fi}
\let\bgoriginalinvoke\pgfsyssoftpath@invokecurrentpath
\def\pgfsyssoftpath@invokecurrentpath{%
  \begingroup
    \ifx\pgf@up@stroke\pgfutil@empty
      \ifx\pgf@up@fill\pgfutil@empty\else\bgpaint\fi
    \else\bgpaint\fi
  \endgroup
  \bgoriginalinvoke}
\makeatother
\begin{document}
"""


def rgb(value):
    if value is None:
        return None
    # DeviceGray may come back from MuPDF's color conversion as (.49996, .50004, .49993).
    return "#" + "".join(f"{round(255 * round(v, 3)):02x}" for v in value)


def measure(pictures, adjacent, work):
    pages = [[name] for name in pictures if name not in adjacent] + [adjacent]
    source = PREAMBLE + "\n\\newpage\n".join(
        "\n".join(rf"\def\bgid{{{name}}}" + "\n" + pictures[name] for name in page)
        for page in pages
    ) + "\n\\end{document}"
    (work / "picture.tex").write_text(source, encoding="utf8")
    run = subprocess.run(
        [os.environ.get("QA_LATEX_ENGINE", "pdflatex"), "-no-shell-escape",
         "-halt-on-error", "-interaction=nonstopmode", "picture.tex"],
        cwd=work, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30,
    )
    if run.returncode:
        raise RuntimeError(run.stdout[-2500:])
    records = {name: {"paint": []} for name in pictures}
    shipped = []
    for line in (work / "picture.trace").read_text().splitlines():
        op, *args = line.split()
        if op == "B":
            records[args[0]]["bodyPt"] = [int(n) / 65536 for n in args[1:]]
        elif op == "P":
            name, layer, pen_sp, *bounds = args
            path = {"layer": layer, "penPt": int(pen_sp) / 65536}
            if layer == "background":
                path["pathPt"] = []
            else:
                path["boundsPt"] = [int(n) / 65536 for n in bounds]
            records[name]["paint"].append(path)
            shipped.append((name, path))
        else:
            path["pathPt"].append([op, *(int(n) / 65536 for n in args)])
    with fitz.open(work / "picture.pdf") as pdf:
        assert len(pdf) == len(pages)
        for page, names in zip(pdf, pages):
            draws = page.get_drawings()
            rows = [(name, path) for name, path in shipped if name in names]
            assert len(draws) == len(rows), (names, len(draws), rows)
            for i, ((name, native), draw) in enumerate(zip(rows, draws)):
                if name in adjacent:
                    records[name].setdefault("firstOnPage", i)
                native["stroke"] = rgb(draw["color"])
                native["fill"] = rgb(draw["fill"])
                if native["stroke"] is not None:
                    assert abs(draw["width"] * 72.27 / 72 - native["penPt"]) < .002, (name, draw, native)
    return records


if __name__ == "__main__":
    request = json.load(sys.stdin)
    with tempfile.TemporaryDirectory(prefix="tikz-backgrounds-") as directory:
        print(json.dumps(measure(request["pictures"], request["adjacent"], Path(directory)), separators=(",", ":")))

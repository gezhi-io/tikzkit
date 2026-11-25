"""Optional live oracle: pdflatex + PyMuPDF. Default Node tests use the JSON only."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

import fitz


HERE = Path(__file__).resolve().parent
PT_PER_BP = 72.27 / 72
# Interior pixels, deliberately clear of antialiasing. Read their RGB from the
# rasterized page, not from a graphics-state register or a guessed stacking order.
SAMPLE_PT = {
    "paint-order": [(1.5, 1.5), (5, 5), (11.5, 11.5)],
    "bounds-pens": [(42, -10), (42, -13), (42, -15)],
    "color-stack": [(11, 1), (41, 1), (81, 1), (101, 1)],
    "shorthand-color": [(21, 1), (61, 1)],
    "transforms-clips": [(11, 4), (16, 3), (20, 8), (23, 3), (26, 3), (29, 3), (29, -1.5)],
}
PREAMBLE = r"""\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{backgrounds}
\pagestyle{empty}
\makeatletter
\newwrite\bgout
\immediate\openout\bgout=layers.trace
\immediate\write\bgout{V \pgfversion}
% Freeze the TeX register and layer now; ship the write in the same box as the paint.
% No PDF save/restore here: that would change the behavior under investigation.
\def\bgpaint{\begingroup\edef\bgdo{\endgroup\noexpand\write\bgout{%
  P \bgid\space\pgfonlayer@name\space\number\pgflinewidth}}\bgdo}
\let\bgoriginalinvoke\pgfsyssoftpath@invokecurrentpath
\def\pgfsyssoftpath@invokecurrentpath{%
  \ifx\pgf@up@stroke\pgfutil@empty
    \ifx\pgf@up@fill\pgfutil@empty\else\bgpaint\fi
  \else\bgpaint\fi
  \bgoriginalinvoke}
\def\bgfinish{%
  \immediate\write\bgout{B \bgid\space
    \number\pgf@picminx\space\number\pgf@picminy\space
    \number\pgf@picmaxx\space\number\pgf@picmaxy}%
  % Last mark on main, below the coordinate-transform and bounds machinery.
  % Its first vertex gives the actual PDF page position of the picture origin.
  \pgfsys@beginscope
  \pgfsys@color@rgb@stroke{1}{0}{1}\pgfsys@moveto{0pt}{0pt}%
  \pgfsys@lineto{2pt}{0pt}\pgfsys@stroke\pgfsys@endscope}
\makeatother
\begin{document}
"""


def short(x):
    return round(x, 3) or 0


def rgb(color):
    return "#" + "".join(f"{round(255 * c):02x}" for c in color)


def path_pt(draw, origin):
    def pt(p):
        return [short((p.x - origin.x) * PT_PER_BP), short((origin.y - p.y) * PT_PER_BP)]

    points = []
    for op, *args in draw["items"]:
        if op == "l":
            a, b = map(pt, args)
            assert not points or points[-1] == a, ("disjoint subpaths", draw)
            if not points:
                points.append(a)
            points.append(b)
        elif op in ("re", "qu"):
            assert not points, ("compound path", draw)
            shape = args[0]
            points = list(map(pt, [shape.tl, shape.tr, shape.br, shape.bl] if op == "re"
                              else [shape.ul, shape.ur, shape.lr, shape.ll]))
            points.append(points[0])
        else:
            raise ValueError(f"unexpected PDF path item {op!r}")
    if draw.get("closePath") and points[-1] != points[0]:
        points.append(points[0])
    return points


def pdf_paint(page, trace):
    draws = page.get_drawings(extended=True)
    mark = draws.pop()
    assert mark["type"] == "s" and rgb(mark["color"]) == "#ff00ff" and mark["level"] == 0
    seg, = mark["items"]
    op, origin, end = seg
    assert op == "l" and abs((end.x - origin.x) * PT_PER_BP - 2) < .001 and end.y == origin.y
    paint, stack = [], []
    for draw in draws:
        level = draw["level"]
        stack = stack[:level]
        assert len(stack) == level, ("unbalanced PDF clip/group", draw)
        if draw["type"] == "group":
            # MuPDF exposes a knockout group for a single translucent PDF B operation.
            assert draw["knockout"] and draw["opacity"] == 1 and draw["blendmode"] == "Normal", draw
            stack.append(None)
            continue
        path = path_pt(draw, origin)
        if draw["type"] == "clip":
            stack.append(path)
            continue
        assert draw["type"] in ("s", "f", "fs"), draw
        layer, tex_pen = trace[len(paint)]
        row = {"layer": layer, "pathPt": path}
        if draw["fill"] is not None:
            row.update(fill=rgb(draw["fill"]), fillAlpha=short(draw["fill_opacity"]))
        if draw["color"] is not None:
            nums = list(map(float, re.findall(r"[-+]?(?:\d*\.)?\d+", draw["dashes"])))
            row.update(stroke=rgb(draw["color"]), strokeAlpha=short(draw["stroke_opacity"]),
                       penPt=short(draw["width"] * PT_PER_BP), texPenPt=short(tex_pen),
                       dashPt=[short(n * PT_PER_BP) for n in nums[:-1]],
                       phasePt=short(nums[-1] * PT_PER_BP),
                       cap=("butt", "round", "square")[draw["lineCap"][0]],
                       join=("miter", "round", "bevel")[int(draw["lineJoin"])])
        clips = [clip for clip in stack if clip is not None]
        if clips:
            row["clipsPt"] = clips
        paint.append(row)
    assert len(paint) == len(trace), (len(paint), trace)
    return paint, origin


def raster_samples(page, origin, points):
    scale = 4
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
    samples = []
    for x, y in points:
        pixel = pix.pixel(int((origin.x + x / PT_PER_BP) * scale),
                          int((origin.y - y / PT_PER_BP) * scale))
        samples.append([x, y, "#" + bytes(pixel).hex()])
    return samples


def measure(work):
    files = sorted(HERE.glob("*.tex"))
    end = r"\end{tikzpicture}"
    pages, records, traces = [], {}, {}
    for file in files:
        source = file.read_text(encoding="utf8")
        assert source.count(end) == 1, file
        pages.append(r"\begingroup\def\bgid{" + file.stem + "}\n" +
                     source.replace(end, "\\bgfinish\n" + end) + r"\endgroup")
        records[file.stem] = {"sha256": hashlib.sha256(file.read_bytes()).hexdigest()}
        traces[file.stem] = []
    (work / "layers.tex").write_text(PREAMBLE + "\n\\newpage\n".join(pages) +
                                     "\n\\end{document}\n", encoding="utf8")
    run = subprocess.run([os.environ.get("QA_LATEX_ENGINE", "pdflatex"), "-no-shell-escape",
                          "-interaction=nonstopmode", "-halt-on-error", "layers.tex"],
                         cwd=work, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=45)
    if run.returncode:
        raise RuntimeError(run.stdout[-3500:])
    pgf_version = None
    for line in (work / "layers.trace").read_text().splitlines():
        tag, key, *values = line.split()
        if tag == "V":
            pgf_version = key
        elif tag == "B":
            records[key]["boxPt"] = [short(int(v) / 65536) for v in values]
        elif tag == "P":
            traces[key].append((values[0], int(values[1]) / 65536))
        else:
            raise ValueError(line)
    with fitz.open(work / "layers.pdf") as doc:
        assert len(doc) == len(files)
        for page, file in zip(doc, files):
            record = records[file.stem]
            record["paint"], origin = pdf_paint(page, traces[file.stem])
            if file.stem in SAMPLE_PT:
                record["pixelsPtRGB"] = raster_samples(page, origin, SAMPLE_PT[file.stem])
    return {"engine": run.stdout.splitlines()[0].split(" (preloaded")[0], "pgf": pgf_version,
            "cases": records}


def format_fixture(result):
    # One paint per line makes changes to ink, register width, or geometry easy to review.
    lines = ["{", '  "engine": ' + json.dumps(result["engine"]) + ",",
             '  "pgf": ' + json.dumps(result["pgf"]) + ",", '  "cases": {']
    cases = []
    for name, data in result["cases"].items():
        rows = ",\n".join("        " + json.dumps(p, separators=(",", ":")) for p in data["paint"])
        samples = (',\n      "pixelsPtRGB": ' + json.dumps(data["pixelsPtRGB"])) if "pixelsPtRGB" in data else ""
        cases.append(f'    "{name}": {{\n      "sha256": "{data["sha256"]}",\n' +
                     '      "boxPt": ' + json.dumps(data["boxPt"]) + samples +
                     ',\n      "paint": [\n' + rows + "\n      ]\n    }")
    return "\n".join([*lines, ",\n".join(cases), "  }", "}", ""])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="replace the checked-in reference")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="tikz-background-scope-") as tmp:
        result = measure(Path(tmp))
    if args.record:
        (HERE / "texlive-2025.json").write_text(format_fixture(result), encoding="utf8")
    else:
        print(json.dumps(result))

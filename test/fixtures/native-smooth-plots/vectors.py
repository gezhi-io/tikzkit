"""Read painted plot operators, in mm from top left, without fitting to the ink."""
import re
from xml.etree import ElementTree as ET

from fontTools.misc.transform import Transform
from fontTools.pens.recordingPen import RecordingPen
from fontTools.svgLib.path import parse_path
from pypdf import PdfReader

MM = 25.4 / 72  # PDF bp and CSS pt, not TeX pt.


def point(matrix, x, y):
    return [round(v, 6) for v in matrix.transformPoint((float(x), float(y)))]


def pdf_vectors(file):
    reader = PdfReader(file)
    assert len(reader.pages) == 1
    page = reader.pages[0]
    assert page.cropbox == page.mediabox and list(page.cropbox[:2]) == [0, 0] and not page.rotation
    w, h = (float(v) * MM for v in page.cropbox[2:])
    matrix, stroke = Transform(MM, 0, 0, -MM, 0, h), "black"
    stack, paths, ops = [], [], []
    for args, op in page.get_contents().operations:
        if op == b"q":
            stack.append((matrix, stroke))
        elif op == b"Q":
            matrix, stroke = stack.pop()
        elif op == b"cm":
            matrix = matrix.transform(tuple(map(float, args)))
        elif op in (b"G", b"RG"):
            rgb = tuple(map(float, args if op == b"RG" else args * 3))
            stroke = {(0, 0, 0): "black", (0, 0, 1): "blue", (1, 0, 0): "red"}.get(rgb)
        elif op in (b"m", b"l", b"c"):
            ops.append([op.decode().upper(), *(point(matrix, *args[i:i+2]) for i in range(0, len(args), 2))])
        elif op == b"h":
            ops.append(["Z"])
        elif op in (b"S", b"B", b"n", b"f", b"f*"):
            if stroke and op in (b"S", b"B") and any(v[0] in ("C", "L") for v in ops):
                paths.append((stroke, op == b"B", ops))
            ops = []
        elif op in (b"v", b"y", b"re", b"s", b"b", b"b*", b"B*", b"Do"):
            raise ValueError(f"Unexpected path/paint operator in {file}: {op}")
    assert not stack and not ops
    return [w, h], paths


def svg_commands(d, matrix):
    pen = RecordingPen()
    parse_path(d, pen)
    sub, ops = [], []
    for op, pts in pen.value:
        if op in ("moveTo", "endPath") and sub:
            if len(sub) > 1:  # Cairo writes an unpainted move following a close.
                ops.extend(sub)
            sub = []
        if op == "endPath":
            continue
        if op == "closePath" and sub[-1] == ["L", sub[0][1]]:
            sub.pop()  # fontTools emits this redundant straight return before Z.
        code = {"moveTo":"M", "lineTo":"L", "curveTo":"C", "closePath":"Z"}[op]
        sub.append([code, *(point(matrix, *p) for p in pts)])
    if len(sub) > 1:
        ops.extend(sub)
    return ops


def svg_vectors(file):
    root = ET.parse(file).getroot()
    assert root.get("preserveAspectRatio", "xMidYMid meet") == "xMidYMid meet"
    w, h = (float(re.fullmatch(r"([\d.]+)pt", root.attrib[k])[1]) * MM for k in ("width", "height"))
    x, y, vw, vh = map(float, root.attrib["viewBox"].split())
    s = min(w/vw, h/vh)
    viewport = Transform(s, 0, 0, s, (w-s*vw)/2-s*x, (h-s*vh)/2-s*y)
    parents = {el: p for p in root.iter() for el in p}
    paths = []
    colors = {"rgb(0%, 0%, 0%)":"black", "rgb(0%, 0%, 100%)":"blue", "rgb(100%, 0%, 0%)":"red"}
    for el in root.findall(".//{*}path"):
        stroke = colors.get(el.get("stroke"), el.get("stroke"))
        if stroke not in ("black", "red", "blue"):
            continue
        chain, node = [], el
        while node in parents:
            chain.append(node)
            node = parents[node]
        if any(p.tag.rsplit("}",1)[-1] in ("defs","clipPath","symbol","marker","mask") for p in chain):
            continue
        matrix = viewport
        for node in reversed(chain):
            t = node.get("transform")
            if t:
                args = re.fullmatch(r"matrix\(([^()]+)\)", t)
                assert args, (file, t)  # Only the painted plot ancestry is read.
                matrix = matrix.transform(tuple(map(float, re.split(r"[\s,]+", args[1].strip()))))
        paths.append((stroke, el.get("fill") != "none", svg_commands(el.attrib["d"], matrix)))
    return [w, h], paths


def geometry(file, case):
    page, paths = (pdf_vectors if file.suffix == ".pdf" else svg_vectors)(file)
    axis = case.startswith("smooth-pgfplots-")
    pens = ["blue"] if axis else ["black", "blue", "red"]
    plotted = [dict(pen=c, ops=ops) for c, fill, ops in paths if c in pens and not fill]
    assert plotted, (case, file)
    return {"pageMm":[round(v, 6) for v in page], "paths":plotted,
            "blueMarks":sum(c == "blue" and fill for c, fill, _ in paths) if axis else None}


def compare(ref, obs):
    code = lambda g: [(p["pen"], "".join(v[0] for v in p["ops"])) for p in g["paths"]]
    same = code(ref) == code(obs)
    result = {"sameOperatorsAndPens":same, "observedOperators":[s for _,s in code(obs)],
              "maxPageDeltaMm":round(max(abs(x-y) for x,y in zip(ref["pageMm"], obs["pageMm"])), 6)}
    for label in ("knots", "handles"):
        deltas = []
        if same:
            for a, b in zip(ref["paths"], obs["paths"]):
                for p, q in zip(a["ops"], b["ops"]):
                    if p[0] == "Z":
                        continue
                    l, r = (p[1:-1], q[1:-1]) if label == "handles" else (p[-1:], q[-1:])
                    deltas.extend(abs(x-y) for u,v in zip(l,r) for x,y in zip(u,v))
        result[label+"MaxAbsMm"] = round(max(deltas), 6) if deltas else None
    return result

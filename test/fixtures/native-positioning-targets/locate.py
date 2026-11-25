"""Locate painted nodes without using TikZKit's scene, SVG IDs or predicted output."""

from math import sqrt
import re

import cv2
import numpy as np
import pymupdf
from scipy.optimize import linear_sum_assignment


DPI = 384
PPM = DPI / 25.4
MM_PER_BP = 25.4 / 72
CENTER_TOL = 0.20  # Three samples at 384 dpi, less than one 96-dpi CSS pixel.
SIZE_TOL = 0.27
REFERENCE_TOL = 0.02  # Original PDF vector vs independently specified coordinates.
CAL_TOL = 0.14
RGB = dict(red=(255, 0, 0), green=(0, 255, 0), blue=(0, 0, 255), cyan=(0, 173, 239),
           magenta=(236, 0, 140), orange=(255, 128, 0), violet=(128, 0, 128))
q = 1 / sqrt(2)
# (description, physical source center in mm, expected source-to-probe vector).
# These are controls on the native PDF, never lookup coordinates for colored ink.
PROBES = {
    "standalone-precedence": {
        "red": ("no of: above=.5", (12, 8), (0, 12)),
        "green": ("no of: above right=.5 and 3mm", (40, 8), (7, 12)),
        "blue": ("at clause after direction", (39, 31), (10, 0)),
        "magenta": ("direction after at clause", (12, 34), (15, 0)),
        "orange": ("at key before direction", (12, 34), (0, 11)),
        "cyan": ("at key after direction", (39, 49), (0, 8)),
    },
    "targets": {
        "red": ("bare / on grid", (10, 8), (12, 0)),
        "green": ("explicit center", (10, 18), (16, 0)),
        "blue": ("explicit north east", (10, 28), (21, 3)),
        "cyan": ("named coordinate", (10, 38), (16, 0)),
        "magenta": ("literal coordinate", (10, 48), (16, 0)),
        "orange": ("bare / off grid", (10, 58), (21, 0)),
        "violet": ("on grid after placement", (10, 68), (21, 0)),
    },
    "diagonals": {
        "red": ("library default pair", (24, 32), (19, 15)),
        "green": ("explicit scalar", (24, 32), (-9 - 10*q, 5 + 10*q)),
        "blue": ("explicit equal pair", (24, 32), (19, -15)),
        "magenta": ("explicit unequal pair", (24, 32), (-22, -11)),
    },
    "option-order": {
        "red": ("picture pair", (10, 8), (9, 5)),
        "green": ("scope pair", (40, 8), (13, 8)),
        "blue": ("local key before placement", (10, 26), (6, 3)),
        "magenta": ("local key after placement", (40, 26), (13, 8)),
        "orange": ("nested scalar", (10, 44), (10*q, 10*q)),
        "cyan": ("picture pair restored", (40, 44), (9, 5)),
    },
    "skew": {
        "red": ("Y basis + physical X", (12, 8), (4, 9)),
        "green": ("physical Y + X basis, left", (51, 8), (-13, 10)),
        "blue": ("both basis vectors, down", (12, 38), (10, -13)),
        "magenta": ("unitless scalar diagonal", (51, 38), (-10*q, -13*q)),
        "orange": ("mixed pair, horizontal only", (12, 55), (4, 0)),
        "cyan": ("mixed pair, vertical only", (51, 52), (0, 10)),
    },
}


def point(box):
    return ((box[:2] + box[2:]) / 2)


def wh(box):
    return box[2:] - box[:2]


def relative(p, origin):
    return (p - origin) * [1, -1]


def extent(v):
    return float(np.max(np.abs(v)))


def rounded(values):
    return np.round(values, 5).tolist()


def components(image, color, minimum, tolerance=18):
    color = np.array(color, dtype=int)
    mask = cv2.inRange(image, tuple(map(int, np.maximum(0, color - tolerance))),
                       tuple(map(int, np.minimum(255, color + tolerance))))
    stats = cv2.connectedComponentsWithStats(mask, 8)[2][1:]
    return [np.array([x, y, x+w, y+h]) / PPM for x, y, w, h, area in stats
            if area >= minimum * PPM**2 and area / (w * h) > 0.55]


def synthetic(case, colored, marks, grays):
    spec = PROBES[case]
    assert len(marks) == 3, (case, "expected exactly three calibration squares", marks)
    xmark = max(marks, key=lambda b: point(b)[0])
    ymark = min(marks, key=lambda b: point(b)[1])
    others = [b for b in marks if b is not xmark and b is not ymark]
    assert len(others) == 1, (case, "unidentifiable scale marks")
    origin = point(others[0])
    axes = [relative(point(b), origin) for b in (xmark, ymark)]
    sources = list(dict.fromkeys(v[1] for v in spec.values()))
    assert len(sources) == len(grays), (case, "gray target count", len(grays), len(sources))
    gray_centers = [relative(point(b), origin) for b in grays]
    # Only the unlabelled gray sources need correspondence. Record (and gate)
    # their independent displacement; color identities never use nearest-node matching.
    cost = np.linalg.norm(np.array(sources)[:, None] - gray_centers, axis=2)
    ii, jj = linear_sum_assignment(cost)
    mapping = {sources[i]: point(grays[j]) for i, j in zip(ii, jj)}
    assert set(colored) <= set(spec), (case, "unrecognized probe", colored.keys())
    targets = {key: mapping[v[1]] for key, v in spec.items()}
    cal = {"xVectorMm": rounded(axes[0]), "yVectorMm": rounded(axes[1]),
           "maxAxisErrorMm": extent(np.array(axes) - [[20, 0], [0, 10]]),
           "maxSourceErrorMm": max(extent(relative(p, origin) - xy) for xy, p in mapping.items())}
    return colored, origin, targets, cal


def identify_driver(case, rects, diamonds):
    if case == "diagonal-decision-flow":
        assert len(rects) == 3 and len(diamonds) == 1, (case, "shape counts", len(rects), len(diamonds))
        request, *right = sorted(rects, key=lambda b: point(b)[0])
        approve, revise = sorted(right, key=lambda b: point(b)[1])
        boxes = dict(request=request, complete=diamonds[0], approve=approve, revise=revise)
        parents = {"request": "request", "complete": "request", "approve": "complete", "revise": "complete"}
        first = "request"
    else:
        assert case == "on-grid-center-placement" and len(rects) == 6 and not diamonds, (case, len(rects), diamonds)
        by_x = sorted(rects, key=lambda b: point(b)[0])
        boxes = {}
        for col, group in [(1, by_x[:3]), (2, by_x[3:])]:
            boxes.update(zip([letter + str(col) for letter in "abc"],
                             sorted(group, key=lambda b: -point(b)[1])))
        parents = dict(a1="a1", b1="a1", c1="b1", a2="a1", b2="a2", c2="b2")
        first = "a1"
    return boxes, point(boxes[first]), {k: point(boxes[p]) for k, p in parents.items()}, None


def raster(case, rgb):
    if case in PROBES:
        colored = {}
        for key in PROBES[case]:
            found = components(rgb, RGB[key], 0.4)
            assert len(found) <= 1, (case, key, "ambiguous colored component count", len(found))
            if found:
                colored[key] = found[0]
        result = synthetic(case, colored, components(rgb, (0, 0, 0), .22),
                           components(rgb, (128, 128, 128), .25, tolerance=7))
    else:
        mask = (cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY) < 80).astype("uint8")
        contours, tree = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        rects, diamonds = [], []
        for i, contour in enumerate(contours):
            x, y, w, h = cv2.boundingRect(contour)
            if w < 3*PPM or h < 1.9*PPM:
                continue
            depth = 0
            while (i := tree[0, i, 3]) != -1:
                depth += 1
            if not depth % 2:  # Only the enclosed white side of the stroked node outline.
                continue
            ratio = cv2.contourArea(contour) / (w*h)
            box = np.array([x, y, x+w, y+h]) / PPM
            if ratio > .90:
                rects.append(box)
            elif .44 < ratio < .55 and len(cv2.approxPolyDP(contour, .26*PPM, True)) == 4:
                diamonds.append(box)
        result = identify_driver(case, rects, diamonds)
    return describe(*result)


def original_pdf(case, file):
    with pymupdf.open(file) as doc:
        assert len(doc) == 1
        page = doc[0]
        paths = page.get_drawings()
        page_size = np.array([page.rect.width, page.rect.height]) * MM_PER_BP
    rects, diamonds, marks, grays, colored = [], [], [], [], {}
    for p in paths:
        box = np.array(p["rect"]) * MM_PER_BP
        if case in PROBES and p["type"] == "f":
            color = np.rint(255*np.array(p["fill"])).astype(int)
            if max(color) == 0:
                marks.append(box)
            elif max(abs(color - 128)) <= 2:
                grays.append(box)
            else:
                matches = [k for k, rgb in RGB.items() if extent(color - rgb) <= 3]
                assert len(matches) == 1 and matches[0] not in colored, (case, color, matches)
                colored[matches[0]] = box
        elif case not in PROBES and p["type"] == "s":
            ops = [item[0] for item in p["items"]]
            if ops == ["re"] or ("c" in ops and min(wh(box)) > 4):
                rects.append(box)
            elif ops == ["l"]*4 and min(wh(box)) > 4:
                diamonds.append(box)
    if case in PROBES:
        assert set(colored) == set(PROBES[case]), (case, "incomplete native PDF", colored.keys())
    result = synthetic(case, colored, marks, grays) if case in PROBES else identify_driver(case, rects, diamonds)
    return describe(*result), rounded(page_size)


def svg_vectors(case, shapes):
    rects, diamonds, marks, grays, colored = [], [], [], [], {}
    for shape in shapes:
        box = np.array(shape["boxMm"])
        if case not in PROBES:
            (rects if shape["flatTop"] else diamonds).append(box)
            continue
        color = np.array([int(n) for n in re.findall(r"\d+", shape["fill"])])
        if max(color) == 0:
            marks.append(box)
        elif extent(color - 128) <= 2:
            grays.append(box)
        else:
            matches = [key for key, rgb in RGB.items() if extent(color - rgb) <= 3]
            assert len(matches) == 1 and matches[0] not in colored, (case, color, matches)
            colored[matches[0]] = box
    result = synthetic(case, colored, marks, grays) if case in PROBES else identify_driver(case, rects, diamonds)
    return describe(*result)


def pdf_connector_paths(file):
    with pymupdf.open(file) as doc:
        paths = doc[0].get_drawings()
    out = []
    for p in paths:
        items = p["items"]
        if p["type"] == "s" and len(items) == 1 and items[0][0] == "l":
            out.append({"kind": "shaft", "firstMm": np.array(items[0][1])*MM_PER_BP,
                        "lastMm": np.array(items[0][2])*MM_PER_BP})
        elif p["type"] == "fs" and all(v[0] == "l" for v in items):
            out.append({"kind": "head", "firstMm": np.array(items[0][1])*MM_PER_BP})
    return out


def connector_landmarks(paths, geom):
    shafts = [p for p in paths if p["kind"] == "shaft"]
    tips = np.array([p["firstMm"] for p in paths if p["kind"] == "head"])
    assert len(shafts) == len(tips) == 3
    ends = np.array([p["lastMm"] for p in shafts])
    ii, jj = linear_sum_assignment(np.linalg.norm(ends[:,None]-tips, axis=2))
    centers = {k: np.array(n["pageCenterMm"]) for k,n in geom["nodes"].items()}
    result = {}
    for i, j in zip(ii,jj):
        start = np.array(shafts[i]["firstMm"])
        near = lambda p: min(centers, key=lambda k: np.linalg.norm(centers[k]-p))
        key = near(start) + "-" + near(ends[i])
        result[key] = {k: rounded(relative(np.array(p),geom["originPageMm"]))
                       for k,p in [("shaftStart", start), ("shaftEnd", ends[i]), ("tip", tips[j])]}
    assert set(result) == {"request-complete", "complete-approve", "complete-revise"}
    return result


def describe(boxes, origin, targets, cal):
    return {"originPageMm": rounded(origin), "calibration": cal, "nodes": {
        key: {"pageCenterMm": rounded(point(b)), "relativeMm": rounded(relative(point(b), origin)),
              "sizeMm": rounded(wh(b)), "sourceVectorMm": rounded(relative(point(b), targets[key]))}
        for key, b in boxes.items()}}

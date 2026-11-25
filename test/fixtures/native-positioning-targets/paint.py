"""Raster appearance controls. Ink coverage is not a positioning pass/fail test."""

import cv2
import numpy as np

from locate import PPM, PROBES, rounded


def dark(rgb):
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY) < 100


def text_masks(case, rgb, geometry, pdf):
    if case in PROBES:
        return {}
    mask = dark(rgb)
    nodes = geometry["nodes"]
    result = {}
    for key, node in nodes.items():
        center = np.array(node["pageCenterMm"]) * PPM
        width, height = np.array(pdf["nodes"][key]["sizeMm"]) * PPM
        # Compare a fixed interior of the *native* node. Exclude outline and
        # the light gray help grid; do not stretch either side to fit its box.
        l, t = np.maximum(0, np.floor(center - [width/2, height/2]).astype(int))
        r, b = np.minimum(mask.shape[::-1], np.ceil(center + [width/2, height/2]).astype(int))
        y, x = np.mgrid[t:b, l:r]
        dx, dy = np.abs(x+.5-center[0])/(width/2), np.abs(y+.5-center[1])/(height/2)
        inside = (dx+dy < .86) if key == "complete" else ((dx < .90) & (dy < .86))
        yy, xx = np.nonzero(mask[t:b, l:r] & inside)
        assert len(xx) > 8, (case, key, "missing text ink")
        result[key] = (np.stack([xx+l, yy+t], axis=1), center, np.array([1., 0.]))
    if case == "diagonal-decision-flow":
        _, ids, stats, centers = cv2.connectedComponentsWithStats(mask.astype("uint8"), 8)
        for label, dest in [("yes", "approve"), ("no", "revise")]:
            a, b = [np.array(nodes[k]["pageCenterMm"])*PPM for k in ("complete", dest)]
            tangent = (b-a)/np.linalg.norm(b-a)
            normal = np.array([tangent[1], -tangent[0]])
            center = (a+b)/2
            selected = []
            for i, ((_, _, w, h, area), c) in enumerate(zip(stats[1:], centers[1:]), 1):
                rel = (c+.5-center)/PPM
                if (abs(rel@tangent) < 9 and abs(rel@normal) < 6 and max(w, h) < 5*PPM and area > 3):
                    selected.append(i)
            # Glyphs can join or split between rasterizers. Count ink, rather
            # than assuming there must be one component per character.
            yy, xx = np.nonzero(np.isin(ids, selected))
            assert 1 < len(selected) < 9 and len(xx) > 40, (case, label, "unisolated sloped ink")
            result[label] = (np.stack([xx, yy], axis=1), center, tangent)
    return result


def ink_coordinates(text):
    points, origin, tangent = text
    normal = np.array([tangent[1], -tangent[0]])
    return ((points+.5-origin)/PPM) @ np.stack([tangent, normal], axis=1)


def text_comparison(actual, ref):
    a, b = ink_coordinates(actual), ink_coordinates(ref)
    # Translation only, by the node center / connector midpoint. Do not line
    # up glyphs, rotate to match, or optimize the overlap.
    def pixels(text):
        return {tuple(x) for x in (text[0] - np.rint(text[1]).astype(int)).tolist()}
    aa, bb = pixels(actual), pixels(ref)
    return {"inkCentroidTNmm": rounded(a.mean(axis=0)), "referenceCentroidTNmm": rounded(b.mean(axis=0)),
            "deltaTNmm": rounded(a.mean(axis=0)-b.mean(axis=0)),
            "inkSpanDeltaTNmm": rounded(np.ptp(a,axis=0)-np.ptp(b,axis=0)),
            "inkAreaMm2": round(len(a)/PPM**2, 4), "referenceAreaMm2": round(len(b)/PPM**2, 4),
            "inkIoU": round(len(aa & bb)/len(aa | bb), 5)}


def registered(a, b, origin_a, origin_b):
    # Register one landmark, rounded to one capture sample. Retain the entire
    # union of both pages, with white outside the pages and no content fitting.
    shift = np.rint(PPM*(np.array(origin_b)-origin_a)).astype(int)
    lo, hi = np.minimum(shift, 0), np.maximum(shift + a.shape[1::-1], b.shape[1::-1])
    w, h = hi-lo
    out = []
    for im, (x, y) in [(a, shift-lo), (b, -lo)]:
        canvas = np.full((h, w, 3), 255, dtype="uint8")
        canvas[y:y+im.shape[0], x:x+im.shape[1]] = im
        out.append(canvas)
    return out


def photometry(a, b, origin_a, origin_b):
    aa, bb = registered(a, b, origin_a, origin_b)
    diff = cv2.absdiff(aa, bb)
    union = (np.min(aa,axis=2) < 242) | (np.min(bb,axis=2) < 242)
    return {"inkUnionPixels": int(union.sum()), "inkUnionMeanAbsRgb255": round(float(diff[union].mean()), 4),
            "fractionOfInkUnionWithMaxChannelDiffOver24": round(float((diff.max(axis=2)[union]>24).mean()), 5)}

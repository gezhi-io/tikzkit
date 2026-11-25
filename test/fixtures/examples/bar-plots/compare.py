"""python3 compare.py STAGE  (requires Pillow, pdftocairo and rsvg-convert)."""
import re
import sys
from itertools import groupby
from math import ceil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "helpers"))
from physical_plot_comparison import DPI, run


CM, PT = DPI / 2.54, DPI / 72.27
EDGE_SLOP = 3  # One gray baseline measurement plus two antialiased edges.
SAMPLED = "axis-sampled-log-ybar"


def fixed(values, spacing, width, shift):
    return [(i * spacing * CM + (shift - width / 2) * PT,
             i * spacing * CM + (shift + width / 2) * PT, v * CM) for i, v in enumerate(values)]


def halves(edges, values, unit, value_unit, upper):
    spans = []
    for (a, b), v in zip(zip(edges, edges[1:]), values, strict=True):
        mid = (a + b) / 2
        left, right = (mid, b) if upper else (a, mid)
        spans.append((left * unit, right * unit, v * value_unit))
    return spans


# For each painted bin: two category edges, then the signed distance from zero.
BARS = {
    "manual-signed-ybar": {
        "blue": ("y", fixed([1, 1.2, -.6, .7, -.9], .5, 6, 0)),
        "red": ("y", fixed([-1.2, -1.3, .5, -.2, .5], .5, 4, 3)),
    },
    "manual-grouped-xbar": {
        "blue": ("x", fixed([1, -.4, 1.7, -1.6], 1, 5, -4)),
        "teal": ("x", fixed([.8, .65, -1.25, -.9], 1, 5, 4)),
    },
    "manual-nonuniform-bar-intervals": {
        "red": ("y", halves([0, 2, 3, 5, 8, 9], [2, 1.2, .3, 1.7, .9], 10 * PT, CM, False)),
        "teal": ("x", halves([0, 1, 1.5, 4, 6, 7], [-3, -2, -4, -1, -2], .5 * CM, .5 * CM, True)),
    },
}


def boxes(mask, direction):
    # Bars of a series occupy disjoint categories, even when their signs differ.
    vertical = direction == "y"
    projection = mask.getprojection()[0 if vertical else 1]
    found = []
    for painted, entries in groupby(enumerate(projection), key=lambda item: bool(item[1])):
        if not painted:
            continue
        indices = [i for i, _ in entries]
        a, b = indices[0], indices[-1] + 1
        if vertical:
            _, t, _, bottom = mask.crop((a, 0, b, mask.height)).getbbox()
            found.append((a, t, b, bottom))
        else:
            l, _, r, _ = mask.crop((0, a, mask.width, b)).getbbox()
            found.append((l, a, r, b))
    return found if vertical else found[::-1]


def components(mask):
    # Join runs on adjacent scanlines, including a one-pixel diagonal contact
    # at antialiased corners. No pixels are removed or added to the measurements.
    runs, parent, previous = [], [], []
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    data, pattern = mask.tobytes(), re.compile(b"\xff+")
    for y in range(mask.height):
        offset, current = y * mask.width, []
        for match in pattern.finditer(data, offset, offset + mask.width):
            l, r = match.start() - offset, match.end() - offset
            i = len(runs)
            parent.append(i)
            runs.append((l, y, r))
            for a, b, j in previous:
                if a > r:
                    break
                if b >= l:
                    parent[root(j)] = i
            current.append((l, r, i))
        previous = current
    groups = {}
    for i, (l, y, r) in enumerate(runs):
        group = groups.setdefault(root(i), [l, y, r, y + 1, 0])
        group[0], group[2] = min(group[0], l), max(group[2], r)
        group[3], group[4] = y + 1, group[4] + r - l
    return [{"bounds_px": (l, t, r, b), "width_px": r - l, "height_px": b - t, "ink_px": n}
            for l, t, r, b, n in sorted(groups.values())]


def measure_boxes(result, planes, color, direction, targets, *, connected=False):
    entries = result["series"][color] = {"expected_boxes_px": targets, "panels": {}}
    for panel, (masks, _, _) in planes.items():
        parts = components(masks[color]) if connected else None
        actual = [p["bounds_px"] for p in parts] if connected else boxes(masks[color], direction)
        error = (max(abs(x - y) for box, target in zip(actual, targets) for x, y in zip(box, target))
                 if len(actual) == len(targets) else None)
        passed = error is not None and error <= EDGE_SLOP
        stats = entries["panels"][panel] = {"count": len(actual), "max_edge_error_px": error}
        if connected:
            length_error = (max(max(abs(p["width_px"] - (r - l)), abs(p["height_px"] - (b - t)))
                                for p, (l, t, r, b) in zip(parts, targets)) if error is not None else None)
            stats.update(components=parts, max_length_error_px=length_error)
            passed = passed and length_error <= EDGE_SLOP
        stats["passed"] = passed
        if panel != "before" and not passed:
            result["passed"] = False


def sampled_probe(planes):
    # Fixed 8.8 x 5.8 cm paper with a 2 TeX pt border. Nothing is fitted to paint.
    ox, oy = .4 * CM + 2 * PT, 5.4 * CM + 2 * PT
    result = {"passed": True, "paper_zero_px": [ox, oy], "edge_tolerance_px": EDGE_SLOP,
              "expected_paper_px": [ceil(8.8 * CM + 4 * PT), ceil(5.8 * CM + 4 * PT)], "series": {}}
    rects = [(ox + a * CM, oy - h * CM, ox + b * CM, oy) for a, b, h in [(1, 2, 4), (4, 6, 2), (7, 8, 1)]]
    for color in ("teal", "blue"):
        measure_boxes(result, planes, color, "y", rects, connected=True)
    radius = 2.2 * PT  # 2pt circle plus half of its 0.4pt outline.
    marks = [(ox + x * CM, oy - y * CM) for x, y in [(0, 5), (2, 4), (6, 2), (8, 1)]]
    measure_boxes(result, planes, "red", "y", [(x - radius, y - radius, x + radius, y + radius)
                                               for x, y in marks], connected=True)

    # Only the gray rule is below plot zero. Its position and the other checks
    # are measured against the paper origin, not separately for each raster.
    cut = round(oy + .08 * CM)
    ry = oy + .18 * CM
    target_rule = (ox, ry - .2 * PT, ox + 8 * CM, ry + .2 * PT)
    result["reference_rule_px"] = target_rule
    result["failed_probes"] = {}
    for panel, (core, _, _) in planes.items():
        ink = core["all-ink"]
        box = ink.crop((0, cut, ink.width, ink.height)).getbbox() if ink.height > cut else None
        rule = (box[0], cut + box[1], box[2], cut + box[3]) if box else None
        failures = []
        if not rule or max(abs(x-y) for x, y in zip(rule, target_rule)) > EDGE_SLOP:
            failures.append("reference rule missing or displaced")
        for x, y, filled in [(1.5, 2, True), (5, 1, True), (7.5, .5, True),
                             (.5, 2.5, False), (3, 1, False), (6.5, .5, False)]:
            u, v = round(ox + x * CM), round(oy - y * CM)
            mask = core["teal" if filled else "colored-ink"]
            if not (0 <= u < mask.width and 0 <= v < mask.height) or bool(mask.getpixel((u, v))) != filled:
                failures.append(f"expected {'teal fill' if filled else 'clear paper'} at ({x},{y}) cm")
        result["failed_probes"][panel] = failures
        if panel != "before" and failures:
            result["passed"] = False
    return result


def probe(case, planes):
    name = case["id"]
    if name == SAMPLED:
        return sampled_probe(planes)
    if name not in BARS:
        return None  # Additional manifest cases still get every physical image comparison.
    baseline = planes["pdf"][2]
    if not baseline:
        raise ValueError(f"{name}: original PDF has no gray zero line")
    l, t, r, b = baseline
    if name == "manual-signed-ybar":
        ox, oy = l + .25 * CM, (t + b) / 2
    elif name == "manual-grouped-xbar":
        ox, oy = (l + r) / 2, b - .35 * CM
    else:
        ox, oy = l + .5, b - .5
    result = {"passed": True, "native_zero_px": [ox, oy], "edge_tolerance_px": EDGE_SLOP, "series": {}}
    for color, (direction, spans) in BARS[name].items():
        targets = [(ox + a, oy - max(0, v), ox + z, oy - min(0, v)) if direction == "y" else
                   (ox + min(0, v), oy - z, ox + max(0, v), oy - a) for a, z, v in spans]
        measure_boxes(result, planes, color, direction, targets)
    return result


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(run(Path(sys.argv[1]), Path(__file__).with_name("manifest.json"), "Bar plots", (*BARS, SAMPLED), probe))

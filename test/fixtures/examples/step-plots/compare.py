"""python3 compare.py STAGE  (Pillow, pdftocairo and rsvg-convert required)."""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops as C, ImageDraw, ImageFilter, ImageFont


DPI, INK, RADIUS, SIZE_SLOP = 288, 48, 2, 3
MANUAL = ("manual-const-handlers", "manual-jump-handlers")
# Probes use data coordinates in the original PDF's black frame, never the candidate's.
AXES = {
    "axis-clipped-plateaus": ((6, 4), [
        ("blue", 0, 2, True), ("blue", 6, 2.5, True), ("blue", 3, 4, True),
        ("blue", 4, 4, True), ("red", 0, .5, True), ("red", 6, .75, True),
        ("blue", 3.5, 4, False), ("red", 4, 0, False),
    ]),
    "axis-sampled-step-corner": ((4, 6), [
        ("blue", 0, 1, True), ("blue", 1, 6, True), ("red", 0, .5, True),
        ("red", 2, 3.5, True), ("red", .5, 2, False), ("red", 3.75, 6, False),
    ]),
}
PAIRS = [
    ("before", "pdf"), ("before", "strict"), ("strict", "pdf"), ("strict-browser", "strict"),
    ("live", "pdf"), ("live", "strict"), ("download", "pdf"),
    ("download", "strict"), ("download", "live"),
]


def load_png(path):
    with Image.open(path) as src:
        rgba = src.convert("RGBA")
    return Image.alpha_composite(Image.new("RGBA", rgba.size, "white"), rgba).convert("RGB")


def inputs(stage, row):
    if (row["referenceKind"] != "tikztosvg" or row["tikztosvgStatus"] != "rendered" or
            row["mactexPngStatus"] != "rendered" or not row["referenceProvenance"]["independentNumerics"]):
        raise ValueError(f"{row['id']}: strict independent references required")
    name = row["id"]
    native = stage / "reference-288dpi"
    native.mkdir(exist_ok=True)
    pdf = stage / ".mactex-work" / name / "reference.pdf"
    strict = native / (name + "-svg.png")
    subprocess.run(["pdftocairo", "-png", "-singlefile", "-r", str(DPI), pdf, native / name], check=True)
    subprocess.run(["rsvg-convert", "--dpi-x", str(DPI), "--dpi-y", str(DPI),
                    "-o", strict, stage / row["tikztosvgSvg"]], check=True)
    return {k: load_png(p) for k, p in {
        "before": stage / "before" / (name + ".png"), "live": stage / "after" / (name + ".png"),
        "download": stage / "after" / (name + "-download.png"),
        "strict-browser": stage / "after" / (name + "-tikztosvg.png"),
        "pdf": native / (name + ".png"), "strict": strict,
    }.items()}


def masks(im, size):
    # Pad only to the right and bottom. Do not trim, register, center or resample ink.
    page = Image.new("RGB", size, "white")
    page.paste(im, (0, 0))
    r, g, b = page.split()
    low, high = C.darker(r, C.darker(g, b)), C.lighter(r, C.lighter(g, b))
    chroma = C.subtract(high, low)
    raw = {"blue": C.subtract(b, C.lighter(r, g)), "red": C.subtract(r, C.lighter(g, b)),
           "teal": C.subtract(C.darker(g, b), r), "colored-ink": chroma, "all-ink": C.invert(low)}
    core = {k: v.point(lambda n: 255 if n >= INK else 0) for k, v in raw.items()}
    near = {k: v.filter(ImageFilter.MaxFilter(2 * RADIUS + 1)) for k, v in core.items()}
    neutral = chroma.point(lambda n: 255 if n < 24 else 0)
    frame = C.multiply(neutral, high.point(lambda n: 255 if n < 160 else 0)).getbbox()
    return core, near, frame


def compare(actual, ref, actual_size, ref_size):
    a, an, _ = actual
    b, bn, _ = ref
    ok = all(abs(x - y) <= SIZE_SLOP for x, y in zip(actual_size, ref_size))
    result = {"viewport_ok": ok, "ink": {}}
    missing, extra = (Image.new("L", b["all-ink"].size) for _ in range(2))
    for color in a:
        lost, added = C.subtract(b[color], an[color]), C.subtract(a[color], bn[color])
        nlost, nadded = lost.histogram()[255], added.histogram()[255]
        result["ink"][color] = {"reference_px": b[color].histogram()[255], "actual_px": a[color].histogram()[255],
                                "missing_px": nlost, "extra_px": nadded}
        ok = ok and not (nlost or nadded)
        missing, extra = C.lighter(missing, lost), C.lighter(extra, added)
    result["passed"] = bool(ok)
    return result, missing, extra


def axis_checks(name, planes):
    (w, h), probes = AXES[name]
    frame = planes["pdf"][2]
    if not frame:
        raise ValueError(f"{name}: native PDF has no axis frame")
    l, t, r, b = frame
    checks = {}
    for panel, (_, near, _) in planes.items():
        missed = []
        for color, x, y, present in probes:
            xy = (round(l + x / w * (r - 1 - l)), round(b - 1 - y / h * (b - 1 - t)))
            if bool(near[color].getpixel(xy)) != present:
                missed.append(f"{color} at ({x},{y}): expected {'ink' if present else 'clear'}")
        checks[panel] = missed
    frame_ok = all(abs(n - cm * DPI / 2.54) <= SIZE_SLOP for n, cm in [(r - 1 - l, w), (b - 1 - t, h)])
    return {"native_frame_px": frame, "physical_frame_ok": frame_ok, "failed_probes": checks}


def evaluate(name, images):
    sizes = {k: im.size for k, im in images.items()}
    size = tuple(map(max, zip(*sizes.values())))
    planes = {k: masks(im, size) for k, im in images.items()}
    colors = ("red", "blue") if name in AXES else ("blue", "teal", "red")
    absent = [k for k in colors if not planes["pdf"][0][k].getbbox()]
    result = {"sizes_px": sizes, "missing_native_colors": absent, "comparisons": {}}
    ok = not absent
    for actual, ref in PAIRS:
        stats, missing, extra = compare(planes[actual], planes[ref], sizes[actual], sizes[ref])
        result["comparisons"][actual + "_vs_" + ref] = stats
        if actual != "before":
            ok = ok and stats["passed"]
        if (actual, ref) == ("live", "pdf"):
            overlay = Image.new("RGB", size, "white")
            overlay.paste("#89939c", mask=planes["pdf"][0]["all-ink"])
            overlay.paste("#b7430c", mask=missing)
            overlay.paste("#146cc0", mask=extra)
    if name in AXES:
        edges = result["axis"] = axis_checks(name, planes)
        ok = ok and edges["physical_frame_ok"] and not any(v for k, v in edges["failed_probes"].items() if k != "before")
    result["passed"] = ok
    return result, overlay


def font(size):
    for name in ("Arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def sheet(rows, path):
    labels = [("Before: browser", "before"), ("After: browser", "live"), ("Download reopened", "download"),
              ("MacTeX PDF", "pdf"), ("Strict tikztosvg: reopened", "strict-browser"), ("After vs. PDF", "overlay")]
    # Integer reduction has one fixed physical scale and top-left origin for every panel.
    cell = max(max((im.width + 1) // 2 for im in images.values()) for _, _, images in rows) + 36
    heights = [max((im.height + 1) // 2 for im in images.values()) for _, _, images in rows]
    paper = Image.new("RGB", (3 * cell, 84 + sum(42 + 2 * (h + 37) for h in heights)), "#f5f7f8")
    draw = ImageDraw.Draw(paper)
    title, label, heading = font(25), font(16), font(18)
    draw.text((16, 9), "Step and jump plots", font=title, fill="#202c36")
    draw.text((16, 47), "288 dpi, shown at 1:2 from the page origin. Overlay: gray = reference, rust = missing, blue = extra.",
              font=label, fill="#354451")
    y = 78
    for (case, passed, images), h in zip(rows, heights):
        draw.rectangle((0, y, paper.width, y + 30), fill="#dae4e6")
        draw.text((16, y + 4), ("PASS  |  " if passed else "FAIL  |  ") + case["title"],
                  font=heading, fill="#205448" if passed else "#9b2c1e")
        y += 42
        for band in (labels[:3], labels[3:]):
            for i, (caption, key) in enumerate(band):
                x = 16 + i * cell
                draw.text((x, y), caption, font=label, fill="#273541")
                im = images[key].reduce(2)
                paper.paste(im, (x, y + 23))
            y += h + 37
    paper.save(path, optimize=True)


def main(stage):
    report = {"passed": False, "dpi": DPI, "thresholds": {"ink_8bit": INK, "position_px": RADIUS,
              "unmatched_px_allowed": 0, "viewport_px": SIZE_SLOP}, "baseline_gates": False, "cases": {}}
    rows = []
    try:
        catalog = json.loads(Path(__file__).with_name("manifest.json").read_text())["cases"]
        if {r["id"] for r in catalog} != {*MANUAL, *AXES}:
            raise ValueError("expected two manual and two axis fixtures")
        refs = {r["id"]: r for r in json.loads((stage / "summary.json").read_text())["cases"]}
        for case in catalog:
            name = case["id"]
            images = inputs(stage, refs[name])
            result, overlay = evaluate(name, images)
            report["cases"][name] = result
            rows.append((case, result["passed"], {**images, "overlay": overlay}))
            print(f"{'PASS' if result['passed'] else 'FAIL'}  {name}")
        sheet(rows, stage / "sheet.png")
        report["passed"] = all(c["passed"] for c in report["cases"].values())
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as exc:
        report["input_error"] = str(exc)
        print(f"Comparison incomplete: {exc}", file=sys.stderr)
    (stage / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))

"""Compare manifest fixtures at their physical page origins; capture is a separate step."""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops as C, ImageDraw, ImageFilter, ImageFont


DPI, INK, RADIUS, SIZE_SLOP = 288, 48, 2, 3
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


def measure_images(images):
    sizes = {k: im.size for k, im in images.items()}
    size = tuple(map(max, zip(*sizes.values())))
    planes = {k: masks(im, size) for k, im in images.items()}
    comparisons = {}
    passed = True
    for actual, ref in PAIRS:
        stats, missing, extra = compare(planes[actual], planes[ref], sizes[actual], sizes[ref])
        comparisons[actual + "_vs_" + ref] = stats
        if actual != "before":
            passed = passed and stats["passed"]
        if (actual, ref) == ("live", "pdf"):
            overlay = Image.new("RGB", size, "white")
            overlay.paste("#89939c", mask=planes["pdf"][0]["all-ink"])
            overlay.paste("#b7430c", mask=missing)
            overlay.paste("#146cc0", mask=extra)
    return sizes, planes, comparisons, overlay, passed


def evaluate(case, images, probe=None):
    sizes, planes, comparisons, overlay, passed = measure_images(images)
    native_ink = bool(planes["pdf"][0]["colored-ink"].getbbox())
    result = {"sizes_px": sizes, "native_colored_ink": native_ink, "comparisons": comparisons}
    passed = passed and native_ink
    details = probe(case, planes) if probe else None
    if details is not None:
        if "expected_paper_px" in details:
            target = details["expected_paper_px"]
            bad = {k: sz for k, sz in sizes.items() if any(abs(x - y) > SIZE_SLOP for x, y in zip(sz, target))}
            details["wrong_paper_sizes_px"] = bad
            details["passed"] = details["passed"] and not any(k != "before" for k in bad)
        result["geometry"] = details
        passed = passed and details["passed"]
    result["passed"] = passed
    return result, overlay


def font(size):
    for name in ("Arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def contact_sheet(title_text, rows, path):
    labels = [("Before: browser", "before"), ("After: browser", "live"), ("Download reopened", "download"),
              ("MacTeX PDF", "pdf"), ("Strict tikztosvg: reopened", "strict-browser"), ("After vs. PDF", "overlay")]
    # Integer reduction has one fixed physical scale and top-left origin for every panel.
    cell = max(max((im.width + 1) // 2 for im in images.values()) for _, _, images in rows) + 36
    heights = [max((im.height + 1) // 2 for im in images.values()) for _, _, images in rows]
    paper = Image.new("RGB", (3 * cell, 84 + sum(42 + 2 * (h + 37) for h in heights)), "#f5f7f8")
    draw = ImageDraw.Draw(paper)
    title, label, heading = font(25), font(16), font(18)
    draw.text((16, 9), title_text, font=title, fill="#202c36")
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


def run(stage, manifest, title, required_ids=(), probe=None):
    report = {"passed": False, "dpi": DPI, "thresholds": {"ink_8bit": INK, "position_px": RADIUS,
              "unmatched_px_allowed": 0, "viewport_px": SIZE_SLOP}, "baseline_gates": False, "cases": {}}
    try:
        catalog = json.loads(manifest.read_text())["cases"]
        ids = [row["id"] for row in catalog]
        missing = set(required_ids).difference(ids)
        if not ids or len(set(ids)) != len(ids) or missing:
            raise ValueError(f"empty or duplicate catalog, or missing required fixtures: {sorted(missing)}")
        refs = {row["id"]: row for row in json.loads((stage / "summary.json").read_text())["cases"]}
        rows = []
        for case in catalog:
            name = case["id"]
            images = inputs(stage, refs[name])
            result, overlay = evaluate(case, images, probe)
            report["cases"][name] = result
            rows.append((case, result["passed"], {**images, "overlay": overlay}))
            print(f"{'PASS' if result['passed'] else 'FAIL'}  {name}")
        contact_sheet(title, rows, stage / "sheet.png")
        report["passed"] = all(row["passed"] for row in report["cases"].values())
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as exc:
        report["input_error"] = str(exc)
        print(f"Comparison incomplete: {exc}", file=sys.stderr)
    (stage / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    return 0 if report["passed"] else 1

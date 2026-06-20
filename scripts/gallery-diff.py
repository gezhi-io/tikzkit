import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

Image.MAX_IMAGE_PIXELS = None

ROOT = Path("outputs/real-gallery")
NATIVE_REPORT = ROOT / "native" / "report.json"
JS_REPORT = ROOT / "js" / "report.json"
OUT_DIR = ROOT / "diff"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_COMPARE_SIDE = 1400
PIXEL_THRESHOLD = 0.02
MEAN_THRESHOLD = 5 / 255

native_rows = {row["id"]: row for row in json.loads(NATIVE_REPORT.read_text())}
js_rows = {row["id"]: row for row in json.loads(JS_REPORT.read_text())}


def composite_white(image):
    rgba = image.convert("RGBA")
    canvas = Image.new("RGBA", rgba.size, "white")
    canvas.alpha_composite(rgba)
    return canvas


def content_bbox(image, threshold=10):
    white = Image.new("RGBA", image.size, "white")
    delta = ImageChops.difference(image, white).convert("L")
    mask = delta.point(lambda value: 255 if value > threshold else 0)
    return mask.getbbox()


def expand_bbox(bbox, image_size, pad=4):
    left, top, right, bottom = bbox
    width, height = image_size
    return (
        max(0, left - pad),
        max(0, top - pad),
        min(width, right + pad),
        min(height, bottom + pad),
    )


def crop_to_content(image):
    composited = composite_white(image)
    bbox = content_bbox(composited)
    if not bbox:
        return Image.new("RGBA", (1, 1), "white"), None
    return composited.crop(expand_bbox(bbox, composited.size)), bbox


def resize_keep_aspect(image, scale):
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def center_on_canvas(image, size):
    canvas = Image.new("RGBA", size, "white")
    x = (size[0] - image.width) // 2
    y = (size[1] - image.height) // 2
    canvas.alpha_composite(image, (x, y))
    return canvas


def normalize_pair(native_img, js_img):
    native_crop, native_bbox = crop_to_content(native_img)
    js_crop, js_bbox = crop_to_content(js_img)
    native_side = max(native_crop.width, native_crop.height)
    native_scale = min(1.0, MAX_COMPARE_SIDE / native_side) if native_side else 1.0
    native_norm = resize_keep_aspect(native_crop, native_scale)

    js_side_scale = min(
        native_norm.width / js_crop.width if js_crop.width else 1,
        native_norm.height / js_crop.height if js_crop.height else 1,
    )
    js_norm = resize_keep_aspect(js_crop, js_side_scale)

    width = max(native_norm.width, js_norm.width)
    height = max(native_norm.height, js_norm.height)
    return (
        center_on_canvas(native_norm, (width, height)),
        center_on_canvas(js_norm, (width, height)),
        {
            "nativeSize": list(native_img.size),
            "jsSize": list(js_img.size),
            "nativeContentBox": list(native_bbox) if native_bbox else None,
            "jsContentBox": list(js_bbox) if js_bbox else None,
            "compareSize": [width, height],
        },
    )


rows = []
for case_id, native in native_rows.items():
    js = js_rows.get(case_id)
    row = {
        "id": case_id,
        "path": native["path"],
        "ok": False,
        "changedPixelsRatio": None,
        "meanAbsDiff": None,
        "reason": "",
    }
    if not js or not native.get("ok") or not js.get("ok"):
        row["reason"] = "missing native or js png"
        rows.append(row)
        continue

    native_img = Image.open(native["pngPath"])
    js_img = Image.open(js["pngPath"])
    native_canvas, js_canvas, metadata = normalize_pair(native_img, js_img)

    diff = ImageChops.difference(native_canvas, js_canvas)
    changed_mask = diff.convert("L").point(lambda value: 255 if value > 8 else 0)
    changed_bbox = changed_mask.getbbox()
    changed = 0 if not changed_bbox else sum(1 for value in changed_mask.getdata() if value)
    stat = ImageStat.Stat(diff)
    mean = sum(stat.mean) / (4 * 255)
    width, height = native_canvas.size
    diff_path = OUT_DIR / f"{case_id}.png"
    diff.save(diff_path)

    row.update(
        {
            "ok": changed / (width * height) <= PIXEL_THRESHOLD and mean <= MEAN_THRESHOLD,
            "changedPixelsRatio": changed / (width * height),
            "meanAbsDiff": mean,
            "diffPath": str(diff_path),
            **metadata,
        }
    )
    rows.append(row)

(OUT_DIR / "report.json").write_text(json.dumps(rows, indent=2) + "\n")
failed = [row for row in rows if not row["ok"]]
print(f"gallery:diff {len(rows) - len(failed)}/{len(rows)} within threshold")
if failed:
    raise SystemExit(1)

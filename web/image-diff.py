#!/usr/bin/env python3
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except Exception as exc:  # pragma: no cover - environment failure path
    print(json.dumps({"error": f"Pillow unavailable: {exc}"}), file=sys.stderr)
    sys.exit(2)

WHITE = (255, 255, 255, 255)


def main() -> int:
    parsed = parse_args(sys.argv)
    if parsed is None:
        return 2
    actual_path, expected_path, diff_path, threshold, align_window, align_step = parsed

    actual = load_on_white(actual_path)
    expected = load_on_white(expected_path)
    width = max(actual.width, expected.width)
    height = max(actual.height, expected.height)
    actual = pad_to(actual, width, height)
    expected = pad_to(expected, width, height)

    dx = 0
    dy = 0
    if align_window > 0:
        dx, dy = find_best_translation(actual, expected, threshold, align_window, align_step)

    metrics, diff = compare_images(actual, expected, threshold, dx=dx, dy=dy, make_diff=True)
    metrics["alignment"] = {
        "dx": dx,
        "dy": dy,
        "window": align_window,
        "mode": "translation",
    }

    diff_path.parent.mkdir(parents=True, exist_ok=True)
    diff.save(diff_path)

    print(json.dumps(metrics, separators=(",", ":")))
    return 0


def parse_args(argv):
    if len(argv) < 4:
        print("usage: image-diff.py actual.png expected.png diff.png [threshold] [--align-window N] [--align-step N]", file=sys.stderr)
        return None

    actual_path = Path(argv[1])
    expected_path = Path(argv[2])
    diff_path = Path(argv[3])
    threshold = 12
    align_window = 0
    align_step = 1

    index = 4
    while index < len(argv):
        arg = argv[index]
        if arg == "--align-window":
            if index + 1 >= len(argv):
                print("--align-window requires a numeric value", file=sys.stderr)
                return None
            align_window = max(0, int(float(argv[index + 1])))
            index += 2
        elif arg == "--align-step":
            if index + 1 >= len(argv):
                print("--align-step requires a numeric value", file=sys.stderr)
                return None
            align_step = max(1, int(float(argv[index + 1])))
            index += 2
        elif arg == "--threshold":
            if index + 1 >= len(argv):
                print("--threshold requires a numeric value", file=sys.stderr)
                return None
            threshold = int(float(argv[index + 1]))
            index += 2
        elif arg.startswith("--"):
            print(f"unknown option: {arg}", file=sys.stderr)
            return None
        else:
            threshold = int(float(arg))
            index += 1

    return actual_path, expected_path, diff_path, threshold, align_window, align_step


def find_best_translation(actual: Image.Image, expected: Image.Image, threshold: int, window: int, sample_step: int):
    best_key = None
    best_shift = (0, 0)
    for dx, dy in alignment_candidates(actual, expected, window):
        metrics, _ = compare_images(
            actual,
            expected,
            threshold,
            dx=dx,
            dy=dy,
            sample_step=sample_step,
            make_diff=False,
        )
        key = (metrics["changedPixels"], metrics["_absoluteSum"], abs(dx) + abs(dy))
        if best_key is None or key < best_key:
            best_key = key
            best_shift = (dx, dy)
    return best_shift


def alignment_candidates(actual: Image.Image, expected: Image.Image, window: int):
    candidates = set()

    def add(dx: int, dy: int):
        if abs(dx) <= window and abs(dy) <= window:
            candidates.add((dx, dy))

    def add_neighborhood(dx: int, dy: int, radius: int):
        for offset_y in range(-radius, radius + 1):
            for offset_x in range(-radius, radius + 1):
                add(dx + offset_x, dy + offset_y)

    add(0, 0)
    actual_bbox = nonwhite_bbox(actual)
    expected_bbox = nonwhite_bbox(expected)
    if actual_bbox and expected_bbox:
        ax0, ay0, ax1, ay1 = actual_bbox
        ex0, ey0, ex1, ey1 = expected_bbox
        axc = round((ax0 + ax1) / 2)
        ayc = round((ay0 + ay1) / 2)
        exc = round((ex0 + ex1) / 2)
        eyc = round((ey0 + ey1) / 2)
        dxs = [ex0 - ax0, ex1 - ax1, exc - axc]
        dys = [ey0 - ay0, ey1 - ay1, eyc - ayc]
        radius = min(3, max(1, window // 20))
        for dx in dxs:
            for dy in dys:
                add_neighborhood(dx, dy, radius)

    coarse = max(1, window // 8)
    values = list(range(-window, window + 1, coarse))
    if values[-1] != window:
        values.append(window)
    for dy in values:
        for dx in values:
            add(dx, dy)

    return sorted(candidates, key=lambda item: (abs(item[0]) + abs(item[1]), item[1], item[0]))


def nonwhite_bbox(image: Image.Image):
    pixels = image.load()
    left = image.width
    top = image.height
    right = -1
    bottom = -1
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a > 0 and min(r, g, b) < 250:
                left = min(left, x)
                top = min(top, y)
                right = max(right, x)
                bottom = max(bottom, y)
    if right < left or bottom < top:
        return None
    return left, top, right, bottom


def compare_images(actual: Image.Image, expected: Image.Image, threshold: int, *, dx=0, dy=0, sample_step=1, make_diff=False):
    width = expected.width
    height = expected.height
    diff = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    actual_pixels = actual.load()
    expected_pixels = expected.load()
    diff_pixels = diff.load()

    changed = 0
    absolute_sum = 0
    total = 0
    for y in range(0, height, sample_step):
        for x in range(0, width, sample_step):
            a = shifted_pixel(actual_pixels, width, height, x, y, dx, dy)
            b = expected_pixels[x, y]
            delta = tuple(abs(a[i] - b[i]) for i in range(4))
            pixel_sum = sum(delta)
            absolute_sum += pixel_sum
            total += 1
            max_delta = max(delta[:3])
            if make_diff:
                if max_delta > threshold:
                    diff_pixels[x, y] = (255, 0, 0, 255)
                else:
                    gray = 245 - min(40, pixel_sum // 8)
                    diff_pixels[x, y] = (gray, gray, gray, 255)
            if max_delta > threshold:
                changed += 1

    if make_diff and sample_step != 1:
        raise ValueError("diff image generation requires sample_step=1")

    metrics = {
        "width": width,
        "height": height,
        "totalPixels": total,
        "changedPixels": changed,
        "changedRatio": changed / total if total else 0,
        "meanAbsoluteRgbaDiff": absolute_sum / (total * 4 * 255) if total else 0,
        "threshold": threshold,
        "_absoluteSum": absolute_sum,
    }
    if make_diff:
        del metrics["_absoluteSum"]
    return metrics, diff


def shifted_pixel(pixels, width: int, height: int, x: int, y: int, dx: int, dy: int):
    source_x = x - dx
    source_y = y - dy
    if source_x < 0 or source_x >= width or source_y < 0 or source_y >= height:
        return WHITE
    return pixels[source_x, source_y]


def load_on_white(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    background = Image.new("RGBA", image.size, WHITE)
    background.alpha_composite(image)
    return background


def pad_to(image: Image.Image, width: int, height: int) -> Image.Image:
    if image.width == width and image.height == height:
        return image
    padded = Image.new("RGBA", (width, height), WHITE)
    padded.alpha_composite(image, (0, 0))
    return padded


if __name__ == "__main__":
    raise SystemExit(main())

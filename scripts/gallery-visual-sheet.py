#!/usr/bin/env python3
"""Create native/JS/diff contact sheets for real-gallery visual QA."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path("outputs/real-gallery")
REPORT_PATH = ROOT / "diff" / "report.json"
DEFAULT_OUT_DIR = ROOT / "visual-sheets"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("case_ids", nargs="+", help="Case ids such as 101 122 160")
    parser.add_argument("-o", "--output", help="Output PNG path")
    parser.add_argument("--thumb-width", type=int, default=320)
    parser.add_argument("--thumb-height", type=int, default=230)
    return parser.parse_args()


def load_report() -> dict[str, dict]:
    if not REPORT_PATH.exists():
      return {}
    rows = json.loads(REPORT_PATH.read_text())
    return {str(row.get("id", "")).zfill(3): row for row in rows}


def image_path(case_id: str, kind: str) -> Path:
    if kind == "native":
        return ROOT / "native" / case_id / "native.png"
    if kind == "js":
        return ROOT / "js" / f"{case_id}.png"
    if kind == "diff":
        return ROOT / "diff" / f"{case_id}.png"
    raise ValueError(kind)


def open_thumb(path: Path, size: tuple[int, int]) -> Image.Image:
    if not path.exists():
        img = Image.new("RGB", size, "white")
        draw = ImageDraw.Draw(img)
        draw.rectangle((0, 0, size[0] - 1, size[1] - 1), outline=(220, 0, 0))
        draw.text((10, 10), f"missing\n{path}", fill=(160, 0, 0))
        return img
    img = Image.open(path).convert("RGB")
    img.thumbnail(size, Image.Resampling.LANCZOS)
    framed = Image.new("RGB", size, "white")
    x = (size[0] - img.width) // 2
    y = (size[1] - img.height) // 2
    framed.paste(img, (x, y))
    return framed


def metrics_label(row: dict | None) -> str:
    if not row:
        return "no diff row"
    changed = row.get("changedPixelsRatio")
    mean = row.get("meanAbsDiff")
    ok = row.get("ok")
    if changed is None or mean is None:
        return f"ok={ok}"
    return f"changed={changed * 100:.2f}% mean={mean:.4f} ok={ok}"


def main() -> None:
    args = parse_args()
    case_ids = [str(case).zfill(3) for case in args.case_ids]
    report = load_report()
    thumb = (args.thumb_width, args.thumb_height)
    columns = ["native", "js", "diff"]
    pad = 16
    title_h = 40
    col_label_h = 18
    row_h = title_h + col_label_h + thumb[1] + pad
    width = pad + len(columns) * (thumb[0] + pad)
    height = pad + len(case_ids) * row_h
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for row_index, case_id in enumerate(case_ids):
        top = pad + row_index * row_h
        draw.text((pad, top), f"Case {case_id}  {metrics_label(report.get(case_id))}", fill="black", font=font)
        image_top = top + title_h + col_label_h
        for col_index, kind in enumerate(columns):
            left = pad + col_index * (thumb[0] + pad)
            draw.text((left, top + title_h), kind, fill="black", font=font)
            draw.rectangle((left, image_top, left + thumb[0], image_top + thumb[1]), outline=(220, 220, 220))
            sheet.paste(open_thumb(image_path(case_id, kind), thumb), (left, image_top))

    DEFAULT_OUT_DIR.mkdir(parents=True, exist_ok=True)
    output = Path(args.output) if args.output else DEFAULT_OUT_DIR / f"cases-{'-'.join(case_ids)}.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    print(output)


if __name__ == "__main__":
    main()

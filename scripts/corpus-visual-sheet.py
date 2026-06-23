#!/usr/bin/env python3
"""Create JS render contact sheets for external corpus visual QA."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path("outputs/corpora")
SUMMARY_PATH = ROOT / "render-summary.json"
DEFAULT_OUT_DIR = ROOT / "visual-sheets"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "cases",
        nargs="+",
        help="Corpus case refs such as janosh:062, f0nzie:163, walmes:041",
    )
    parser.add_argument("-o", "--output", help="Output PNG path")
    parser.add_argument("--thumb-width", type=int, default=420)
    parser.add_argument("--thumb-height", type=int, default=280)
    return parser.parse_args()


def load_summary() -> dict[str, dict[str, dict]]:
    index: dict[str, dict[str, dict]] = {}
    if not SUMMARY_PATH.exists():
        corpora = []
    else:
        corpora = json.loads(SUMMARY_PATH.read_text())
    for corpus in corpora:
        merge_corpus_rows(index, corpus)
    for report_path in sorted(ROOT.glob("*/js/report.json")):
        try:
            merge_corpus_rows(index, json.loads(report_path.read_text()))
        except (OSError, json.JSONDecodeError):
            continue
    return index


def merge_corpus_rows(index: dict[str, dict[str, dict]], corpus: dict) -> None:
    corpus_id = str(corpus.get("id", ""))
    if not corpus_id:
        return
    rows = index.setdefault(corpus_id, {})
    for row in corpus.get("rows", []):
        rows[str(row.get("id", "")).zfill(3)] = row


def parse_case_ref(ref: str) -> tuple[str, str]:
    if ":" not in ref:
        raise SystemExit(f"Case ref must be corpus:id, got {ref!r}")
    corpus, case_id = ref.split(":", 1)
    return corpus, case_id.zfill(3)


def image_path(corpus: str, case_id: str) -> Path:
    return ROOT / corpus / "js" / f"{case_id}.png"


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


def diagnostics_text(row: dict | None) -> list[str]:
    if not row:
        return ["no report row"]
    diagnostics = row.get("diagnostics", [])
    if not diagnostics:
        return ["0 diagnostics"]
    lines = [f"{len(diagnostics)} diagnostics"]
    seen: set[str] = set()
    for diagnostic in diagnostics:
        message = str(diagnostic.get("message", ""))
        if message in seen:
            continue
        seen.add(message)
        lines.append(f"- {message}")
        if len(lines) >= 6:
            break
    return lines


def main() -> None:
    args = parse_args()
    refs = [parse_case_ref(ref) for ref in args.cases]
    summary = load_summary()
    thumb = (args.thumb_width, args.thumb_height)
    pad = 16
    meta_w = 430
    row_h = max(thumb[1] + pad * 2, 250)
    width = pad * 3 + meta_w + thumb[0]
    height = pad + row_h * len(refs)
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for row_index, (corpus, case_id) in enumerate(refs):
        top = pad + row_index * row_h
        report_row = summary.get(corpus, {}).get(case_id)
        title = report_row.get("title", "") if report_row else ""
        path = report_row.get("path", "") if report_row else ""
        header = f"{corpus}:{case_id}  {title}"
        draw.text((pad, top), header, fill="black", font=font)
        y = top + 22
        for line in wrap(path, width=70):
            draw.text((pad, y), line, fill=(60, 60, 60), font=font)
            y += 15
        y += 6
        for line in diagnostics_text(report_row):
            for wrapped in wrap(line, width=72):
                draw.text((pad, y), wrapped, fill=(130, 0, 0) if line.startswith("-") else "black", font=font)
                y += 15
        img_left = pad * 2 + meta_w
        img_top = top
        draw.rectangle((img_left, img_top, img_left + thumb[0], img_top + thumb[1]), outline=(220, 220, 220))
        sheet.paste(open_thumb(image_path(corpus, case_id), thumb), (img_left, img_top))

    DEFAULT_OUT_DIR.mkdir(parents=True, exist_ok=True)
    if args.output:
        output = Path(args.output)
    else:
        safe_name = "-".join(f"{corpus}-{case_id}" for corpus, case_id in refs)
        output = DEFAULT_OUT_DIR / f"{safe_name}.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    print(output)


if __name__ == "__main__":
    main()

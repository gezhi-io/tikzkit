"""Reconcile independent paint/vector locators with original-source pdfLaTeX."""

import argparse
import csv
import hashlib
import json
from pathlib import Path
from xml.etree import ElementTree

import numpy as np
import pymupdf
from PIL import Image

from locate import (CAL_TOL, CENTER_TOL, DPI, PROBES, REFERENCE_TOL, SIZE_TOL, connector_landmarks,
                    extent, original_pdf, pdf_connector_paths, raster, rounded, svg_vectors)
from paint import photometry, text_comparison, text_masks
from sheets import make_sheets


JS = ["live", "download", "export"]
PAIRS = [(a, b) for a in JS for b in ["pdf", "tikztosvg"]] + [
    ("tikztosvg", "pdf"), ("live", "download"), ("export", "live")]
GROUPS = [("relativeMm", "dx", "dy"), ("sourceVectorMm", "sourceDx", "sourceDy"),
          ("sizeMm", "dw", "dh"), ("pageCenterMm", "pageDx", "pageDy")]


def read(file):
    return json.loads(file.read_text())


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def stroke_sha(file):
    root = ElementTree.parse(file).getroot()
    parts = [[root.get(k) for k in ["width", "height", "viewBox"]]]
    def visit(el, transforms):
        name = el.tag.split("}")[-1]
        if name in {"defs", "symbol", "clipPath", "mask"}:
            return
        transforms = [*transforms, el.get("transform")] if el.get("transform") else transforms
        if name in {"rect", "path", "polygon", "line"} and el.get("stroke") not in {None, "none"}:
            parts.append([name, transforms, sorted(el.attrib.items())])
        for child in el:
            visit(child, transforms)
    visit(root, [])
    return hashlib.sha256(json.dumps(parts).encode()).hexdigest()


def csv_out(file, rows):
    with file.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, list(dict.fromkeys(k for r in rows for k in r)))
        writer.writeheader()
        writer.writerows(rows)


def subtract(a, b):
    return rounded(np.array(a) - b)


def check_case(root, entry, report, summary_case, previous):
    case = entry["id"]
    assert entry["renderFingerprint"] == summary_case["renderFingerprint"]
    assert sha(Path(report["fixtureRoot"])/entry["source"]) == entry["sourceSha256"]
    assert entry["originalPdfInputMatchesSource"]
    images, panels, masks, rows, text_rows, photo = {}, {}, {}, [], [], {}
    ref = entry["panels"]["pdf"]
    assert sha(root/ref["pdfFile"]) == ref["pdfSha256"]
    pdf, pdf_size = original_pdf(case, root/ref["pdfFile"])
    with pymupdf.open(root/ref["pdfFile"]) as doc:
        pdf_fonts = sorted({font[3].split("+")[-1] for font in doc[0].get_fonts()})
    for mode, panel in entry["panels"].items():
        assert sha(root/panel["file"]) == panel["sha256"]
        images[mode] = np.asarray(Image.open(root/panel["file"]).convert("RGB"))
        if mode == "pdf":
            vector, size = pdf, pdf_size
        else:
            assert sha(root/panel["svgFile"]) == panel["svgSha256"]
            vector = svg_vectors(case, panel["vectors"])
            size = rounded(np.array(panel["intrinsicCssPx"]) * 25.4 / 96)
        pixels = raster(case, images[mode])
        panels[mode] = {"vector": vector, "raster": pixels, "pageMm": size,
                        "pngSha256": panel["sha256"], "svgSha256": panel.get("svgSha256"),
                        "fonts": panel.get("fonts", {})}
        if case not in PROBES and mode != "pdf":
            panels[mode]["strokeSha256"] = stroke_sha(root/panel["svgFile"])
        if case == "diagonal-decision-flow" and (mode == "pdf" or "connectors" in panel):
            paths = pdf_connector_paths(root/ref["pdfFile"]) if mode == "pdf" else panel["connectors"]
            panels[mode]["connectors"] = connector_landmarks(paths, vector)
        masks[mode] = text_masks(case, images[mode], pixels, pdf)

    issues = []
    for key, (_, _, expected) in PROBES.get(case, {}).items():
        assert extent(np.array(pdf["nodes"][key]["sourceVectorMm"])-expected) < REFERENCE_TOL, (case, key, "PDF vs hand calculation")
    assert set(panels["tikztosvg"]["vector"]["nodes"]) == set(pdf["nodes"])
    for mode, panel in panels.items():
        for kind in ["vector", "raster"]:
            g = panel[kind]
            if (cal := g["calibration"]) and (cal["maxAxisErrorMm"] > (CAL_TOL if kind=="raster" else REFERENCE_TOL)
                    or cal["maxSourceErrorMm"] > (CENTER_TOL if kind=="raster" else REFERENCE_TOL)):
                issues.append(f"{mode}/{kind}: calibration or fixed source moved")
        for key in pdf["nodes"]:
            a, b = panel["raster"]["nodes"].get(key), panel["vector"]["nodes"].get(key)
            if a and b and extent(subtract(a["relativeMm"], b["relativeMm"])) > CENTER_TOL:
                issues.append(f"{mode}/{key}: vector and painted centers disagree")

    for a, b in PAIRS:
        for kind in ["vector", "raster"]:
            for key in pdf["nodes"]:
                aa, bb = [panels[m][kind]["nodes"].get(key) for m in [a, b]]
                row = {"case": case, "kind": kind, "actual": a, "reference": b, "node": key,
                       "meaning": PROBES.get(case, {}).get(key, (key,))[0]}
                if aa is None or bb is None:
                    row["status"] = "MISSING " + "/".join(m for m, n in [(a,aa),(b,bb)] if n is None)
                else:
                    for field, x, y in GROUPS:
                        row[x], row[y] = subtract(aa[field], bb[field])
                    row["pageDy"] *= -1  # All signed differences use right/up, including absolute page centers.
                    center = max(abs(row[k]) for k in ["dx","dy","sourceDx","sourceDy"])
                    size = max(abs(row[k]) for k in ["dw","dh"])
                    ct = REFERENCE_TOL if kind == "vector" else CENTER_TOL
                    st = (REFERENCE_TOL if case in PROBES else CENTER_TOL) if kind == "vector" else SIZE_TOL
                    row["status"] = "PASS" if center <= ct and size <= st else "DIFF"
                rows.append(row)
        for key in masks[b]:
            v = text_comparison(masks[a][key], masks[b][key])
            text_rows.append({"case": case, "actual": a, "reference": b, "text": key,
                              "dTmm": v["deltaTNmm"][0], "dNmm": v["deltaTNmm"][1],
                              "spanDTmm": v["inkSpanDeltaTNmm"][0], "spanDNmm": v["inkSpanDeltaTNmm"][1],
                              "inkAreaMm2": v["inkAreaMm2"], "referenceAreaMm2": v["referenceAreaMm2"],
                              "inkIoU": v["inkIoU"]})
        photo[a+"/"+b] = photometry(images[a], images[b], panels[a]["raster"]["originPageMm"],
                                     panels[b]["raster"]["originPageMm"])
    native = [r for r in rows if r["actual"] == "tikztosvg" and r["reference"] == "pdf"]
    assert all(r["status"] == "PASS" for r in native), (case, "native reference disagreement", native)
    stage_diff = {}
    if previous:
        assert entry["sourceSha256"] == previous["sourceSha256"], (case, "baseline source changed")
        for mode, panel in panels.items():
            old = previous["panels"][mode]
            common = old["vector"]["nodes"].keys() & panel["vector"]["nodes"].keys()
            stage_diff[mode] = {
                "identicalPng": panel["pngSha256"] == old["pngSha256"],
                "identicalSvg": None if mode == "pdf" else panel["svgSha256"] == old["svgSha256"],
                "identicalDriverStrokes": panel["strokeSha256"] == old["strokeSha256"] if "strokeSha256" in old else None,
                "centerChangesMm": {k: subtract(panel["vector"]["nodes"][k]["relativeMm"], old["vector"]["nodes"][k]["relativeMm"]) for k in common},
                "sizeChangesMm": {k: subtract(panel["vector"]["nodes"][k]["sizeMm"], old["vector"]["nodes"][k]["sizeMm"]) for k in common},
                "newlyPresent": sorted(panel["vector"]["nodes"].keys() - common)}
        assert all(stage_diff[m]["identicalPng"] for m in ["pdf", "tikztosvg"]), (case, "native images changed")
    if entry["diagnostics"] or entry["exportDiagnostics"]:
        issues.append("Renderer diagnostics: " + str(entry["diagnostics"] or entry["exportDiagnostics"]))
    return ({"sourceSha256": entry["sourceSha256"], "panels": panels, "pdfFonts": pdf_fonts,
             "issues": issues, "fromBaseline": stage_diff, "photometry": photo}, rows, text_rows)


def worst(rows, fields=("dx", "dy")):
    return max((max(abs(r[f]) for f in fields) for r in rows if fields[0] in r), default=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", type=Path)
    parser.add_argument("--baseline", type=Path, action="append", default=[])
    parser.add_argument("--require-match", action="store_true")
    args = parser.parse_args()
    root = args.stage.resolve()
    capture, summary = read(root/"capture.json"), read(root/"summary.json")
    assert capture["dpi"] == DPI and not capture["errors"] and not capture["badRequests"]
    assert sha(root/"summary.json") == capture["summarySha256"] and summary["gate"]["accepted"]
    old, base_paths = {}, {}
    for stage in args.baseline:
        for k, v in read(stage/"geometry.json")["cases"].items():
            assert k not in old
            old[k], base_paths[k] = v, stage
    records, all_rows, all_text = {}, [], []
    for entry in capture["rows"]:
        case = entry["id"]
        assert not args.baseline or case in old
        src = next(r for r in summary["cases"] if r["id"] == case)
        records[case], rows, text_rows = check_case(root, entry, capture, src, old.get(case))
        all_rows.extend(rows)
        all_text.extend(text_rows)
    compare = [r for r in all_rows if r["actual"] in JS and r["reference"] in ("pdf","tikztosvg")]
    passed = all(r["status"] == "PASS" for r in compare) and not any(v["issues"] for v in records.values())
    result = {"revision": capture["revision"], "rendererSha256": capture["environment"]["rendererSha256"],
              "chrome": capture["browser"], "dpi": DPI, "matches": passed, "cases": records}
    (root/"geometry.json").write_text(json.dumps(result, indent=2) + "\n")
    csv_out(root/"node-residuals.csv", all_rows)
    if all_text:
        csv_out(root/"text-residuals.csv", all_text)
    arrow_rows = []
    if "diagonal-decision-flow" in records:
        panels = records["diagonal-decision-flow"]["panels"]
        for a,b in PAIRS:
            aa,bb = panels[a].get("connectors"),panels[b].get("connectors")
            if aa and bb:
                for edge in aa:
                    for point,xy in aa[edge].items():
                        dx,dy = subtract(xy,bb[edge][point])
                        arrow_rows.append(dict(actual=a,reference=b,edge=edge,point=point,dx=dx,dy=dy))
    if arrow_rows:
        csv_out(root/"connector-residuals.csv", arrow_rows)
    make_sheets(root, capture, records, base_paths, all_text)
    lines = ["# Native positioning: " + capture["revision"], "",
             f"Chrome {capture['browser']}; {DPI} dpi. Renderer: `{result['rendererSha256']}`.",
             "pdfLaTeX compiled byte-identical original source; tikztosvg used the repository's wrapper. No source grid or per-panel fit.",
             "Center deltas: max absolute x/y in mm, translation only. Full signed measurements: node-residuals.csv.",
             "Vector tolerances: 0.02 mm centers and focused node sizes; 0.20 mm real-driver sizes.",
             "Raster tolerances: 0.20 mm centers, 0.27 mm sizes. Text and page paint are separate controls.", "",
             "| Case | Nodes | Vector center vs PDF | Vector center vs tikztosvg | Painted center vs either | Outline size vs PDF |",
             "|---|---:|---:|---:|---:|---:|"]
    for case, rec in records.items():
        subset = [r for r in compare if r["case"] == case]
        v = [r for r in subset if r["kind"]=="vector"]
        p = [r for r in v if r["reference"]=="pdf"]
        t = [r for r in v if r["reference"]=="tikztosvg"]
        lines.append(f"| {case} | {len(rec['panels']['pdf']['vector']['nodes'])} | {worst(p):.5f} | {worst(t):.5f} | "
                     f"{worst([r for r in subset if r['kind']=='raster']):.5f} | {worst(p, ('dw','dh')):.5f} |")
    lines += ["", "Missing landmarks are never measured as zero. Mismatches (live vs PDF):"]
    failures = [r for r in compare if r["actual"]=="live" and r["reference"]=="pdf" and r["status"]!="PASS"]
    lines.extend(f"- {r['case']} / {r['kind']} / {r['node']}: {r['status']}, dx={r.get('dx')}, dy={r.get('dy')} mm." for r in failures)
    if not failures:
        lines.append("- None.")
    for case, rec in records.items():
        lines.extend(f"- {case}: {issue}" for issue in rec["issues"])
    if all_text:
        lines += ["", "## Text / photometry", "",
                  "Positive T is along the connector; positive N is above it. For horizontal node text, T/N are right/up.",
                  "Ink IoU compares the dark-pixel masks after integer-sample registration on the node or link, never on the glyphs.",
                  "This is a painting control, not a font-identity test. Full text: text-residuals.csv; frame metrics and fonts: geometry.json.", "",
                  "| Word | Actual | Reference | T (mm) | N (mm) | Ink IoU |", "|---|---|---|---:|---:|---:|"]
        lines.extend(f"| {r['text']} | {r['actual']} | {r['reference']} | {r['dTmm']:+.4f} | {r['dNmm']:+.4f} | {r['inkIoU']:.3f} |"
                     for r in all_text if r["text"] in ("yes","no") and r["actual"] in ("live","export","tikztosvg") and r["reference"]=="pdf")
        for case in ["diagonal-decision-flow", "on-grid-center-placement"]:
            if case not in records:
                continue
            r = records[case]
            changed = r["fromBaseline"].get("live", {}).get("identicalPng")
            p = r["photometry"]["live/pdf"]
            actual, native = r["panels"]["live"], r["panels"]["pdf"]
            page_delta = subtract(actual["pageMm"], native["pageMm"])
            outlines = [row for row in compare if row["case"] == case and row["kind"] == "vector"
                        and row["actual"] == "live" and row["reference"] == "pdf"]
            words = [row for row in all_text if row["case"] == case and row["actual"] == "live"
                     and row["reference"] == "pdf" and row["text"] not in ("yes", "no")]
            observed_fonts = actual["fonts"].get("loaded")
            lines.append(f"\n{case}: PDF fonts {r['pdfFonts']}; loaded workbench faces {observed_fonts}. "
                         f"Live minus PDF page width/height: {page_delta[0]:+.5f}, {page_delta[1]:+.5f} mm; "
                         f"max absolute (unregistered) node-center delta: {worst(outlines, ('pageDx','pageDy')):.5f} mm. "
                         f"Outline width deltas: {min(v['dw'] for v in outlines):+.5f} to {max(v['dw'] for v in outlines):+.5f} mm. "
                         f"Max node-word ink centroid error: {worst(words, ('dTmm','dNmm')):.4f} mm. "
                         f"Live vs PDF ink-union RGB MAE: {p['inkUnionMeanAbsRgb255']:.2f}/255; "
                         f"equal live PNG to baseline: {changed if changed is not None else 'not compared'}.")
    if arrow_rows:
        live = [r for r in arrow_rows if r["actual"]=="live" and r["reference"]=="pdf"]
        shape_match = records["diagonal-decision-flow"]["fromBaseline"].get("live", {}).get("identicalDriverStrokes")
        lines += ["", "## Decision-flow connectors", "",
                  "Shaft centerline endpoints and the leading arrowhead vertex, relative to the Request node. Full signed vectors: connector-residuals.csv.",
                  f"Live vs original PDF: maximum shaft endpoint delta {worst([r for r in live if r['point']!='tip']):.5f} mm; "
                  f"maximum tip delta {worst([r for r in live if r['point']=='tip']):.5f} mm. "
                  f"Live stroked geometry and viewport identical to baseline: {shape_match}."]
    (root/"report.md").write_text("\n".join(lines)+"\n")
    print(("MATCH" if passed else "DIFFERENCES"), root, "vector vs PDF", worst([r for r in compare if r["kind"]=="vector" and r["reference"]=="pdf"]))
    if args.require_match and not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

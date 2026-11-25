"""Measure physical paint in the shared Chrome capture; never fit one page to another."""
import argparse
import hashlib
import re
import subprocess
import sys
import tarfile
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pymupdf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "native-pgfplots-error-bars"))
import physical as shared
from physical import DIR, DPI, JS, LIMIT, MM, REFS, color, csv_out, load_panel, read, rounded, sha

MANUAL, SEMI, MIXED, EDGE = "manual-log-relative", "semilogy-asymmetric", "loglog-mixed-bases", "nonpositive-lower"
JUMP = "semilogy-invalid-centers"
X = ("x+", "x-")
VALID = {MANUAL: [X, X] + [DIR] * 5, SEMI: [DIR, ("x+", "y+"), ("x-", "y-")],
         MIXED: [DIR] * 2, EDGE: [("x+",), ("x+",), X] * 2, JUMP: [("x+", "x-", "y+")] * 4}
for case, arms in VALID.items():
    shared.ACTIVE[case] = [X if case == EDGE else DIR] * len(arms)
    shared.OLD[case] = (-1, [])


def measure(case, paths, size, rgb, raster_samples):
    rows = shared.physical(case, paths, size, rgb)
    if case == JUMP:
        points = np.array([[v["pageX"], v["pageY"]] for n, v in rows.items() if re.fullmatch(r"p\d+", n)])
        links, remaining = [], []
        for op in paths:
            items = []
            for item in op["items"]:
                if len(points) and item[0] == "l" and color(op["color"]) == "0000ff":
                    distances = np.linalg.norm(np.array(item[1:])[:, None]*MM - points, axis=2)
                    a, b = distances.argmin(1)
                    if a != b and distances.min(1).max() < shared.NEAR:
                        links.append(f"{a+1}-{b+1}")
                        continue
                items.append(item)
            if items:
                remaining.append(dict(op, items=items))
        # Squashed connecting lines can look vertical: classify by BOTH data
        # marker endpoints before asking the shared extractor to match stems.
        rows = shared.physical(case, remaining, size, rgb)
        rows["inventory"]["dataLinks"] = len(links)
        rows["data-line"] = dict(markerLinks=" ".join(links), pointSpanX=np.ptp(points[:, 0]) if len(points) else 0.)
        for d in X:
            r = rows["p1:"+d]
            if r["cap"]:
                center = np.array([r["capPageX"], r["capPageY"]])
                dy = np.array([0, .3*r["capLength"]])
                r["insideInk"] = shared.screen_ink(rgb, center-dy, r["capColor"])
                r["outsideInk"] = shared.screen_ink(rgb, center+dy, r["capColor"])
        r = rows["p4:x+"]
        if r["cap"]:
            # This cap is bisected by the right frame. Read a fixed 7x3 pixel
            # window at each tip: standalone Chrome can paint it two columns
            # farther left than the editor. Retain, do not register, that shift.
            near = []
            for side in (-1, 1):
                point = [r["capPageX"], r["capPageY"] + side*.3*r["capLength"]]
                x, y = np.floor(np.array(point)*shared.PPM).astype(int)
                patch = rgb[y-1:y+2, x-3:x+4].astype(int)
                blue = (patch[:, :, 2] - patch[:, :, :2].max(2)).max(0)
                near.append(blue.max() > .3*255 and r["capColor"] == "0000ff")
                raster_samples.append(dict(cap="p4:x+", side=side, sampleX=x, sampleY=y, peakX=x-3+blue.argmax(),
                                           maxBlue=int(blue.max()), bothTipsIn3x3=r["capInk"]))
            r["capInk"] = all(near)
        return rows, len(links)
    inv = rows["inventory"]
    raw_links = inv.pop("dataLinks")
    if case != MANUAL:
        inv["dataLinks"] = raw_links
        return rows, raw_links
    points = np.array([[rows[f"p{i+1}"][k] for k in ("pageX", "pageY")]
                       for i in range(min(inv["markers"], len(VALID[case])))])
    center_caps = [[], []]
    line = []
    for op in paths:
        if color(op["color"]) != "0000ff":
            continue
        for item in op["items"]:
            if item[0] != "l":
                continue
            v = np.array(item[1:]) * MM
            step = np.ptp(v, axis=0)
            if min(step) > .02:
                line.append(v)
            elif max(step) > .012 and len(points) >= 2:
                center = v.mean(0)
                i = np.linalg.norm(points[:2] - center, axis=1).argmin()
                if np.linalg.norm(center - points[i]) < shared.NEAR:
                    center_caps[i].append(dict(capAxis="vertical" if step.argmax() else "horizontal",
                        capLength=np.linalg.norm(step), capPen=op["width"] * MM,
                        capPageX=center[0], capPageY=center[1]))
    # The two zero-y caps at each center are indistinguishable as signed arms.
    for i, caps in enumerate(center_caps):
        for j, cap in enumerate(caps):
            rows[f"p{i+1}:center-cap-{j+1}"] = cap
    inv["centerCaps"] = sum(map(len, center_caps))
    inv["caps"] += inv["centerCaps"]
    inv["unassigned"] -= inv["centerCaps"]
    # Cairo can collapse collinear vertices. Check the painted line through each
    # marker in order, not equality of the internal number of straight segments.
    if line and len(points):
        a, b = np.array(line).transpose(1, 0, 2)
        segment = b - a
        lengths = np.linalg.norm(segment, axis=1)
        positions, gaps = [], []
        for point in points:
            t = np.clip(((point - a) * segment).sum(1) / lengths**2, 0, 1)
            dist = np.linalg.norm(a + t[:, None] * segment - point, axis=1)
            j = dist.argmin()
            positions.append(lengths[:j].sum() + t[j] * lengths[j])
            gaps.append(dist[j])
        rows["data-line"] = dict(visits=sum(g < LIMIT for g in gaps), ordered=bool(np.all(np.diff(positions) > 0)),
                                 maxGap=max(gaps), lineLength=sum(lengths))
    return rows, raw_links


def tick_groups(rows):
    groups = {}
    for side in ("bottom", "top", "left", "right"):
        for kind in ("major", "minor"):
            group = [v for n, v in rows.items() if n.startswith(f"tick-{side}-")
                     and (v["tickLength"] > 1.25) == (kind == "major")]
            groups[f"{side}-{kind}"] = sorted(group, key=lambda v: v["plotAt"])
    return groups


def labels(stage, entry, route, frame):
    panel = entry["panels"][route]
    parts = []
    if route == "pdf":
        with pymupdf.open(stage / panel["pdfFile"]) as doc:
            spans = [v for b in doc[0].get_text("dict")["blocks"] for l in b.get("lines", []) for v in l["spans"]]
            for v in spans:
                parts.append((v["text"], v["font"], *(np.array(v["origin"]) * MM), v["size"] * MM))
    else:
        root = ET.parse(stage / panel["svgFile"]).getroot()
        left, top, w, h = map(float, root.attrib["viewBox"].split())
        page = np.array(panel["intrinsicCssPx"]) * 25.4 / 96
        unit = min(page / [w, h])
        offset = (page - unit * np.array([w, h])) / 2 - unit * np.array([left, top])
        for group in root.findall("{*}g"):
            glyphs = group.findall("{*}text")
            if not glyphs:
                continue
            # These native math runs consist solely of translate + uniform scale.
            m = re.fullmatch(r"translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\)", group.get("transform", ""))
            assert m and all("transform" not in g.attrib for g in glyphs)
            tx, ty, scale = map(float, m.groups())
            for g in glyphs:
                point = offset + unit * ([tx, ty] + scale * np.array([float(g.get("x")), float(g.get("y"))]))
                face = g.get("font-family")
                assert face in panel["fonts"]["loaded"]
                parts.append((g.text, face.removeprefix("TikZKit"), *point, float(g.get("font-size")) * scale * unit))
        assert len(parts) == len(root.findall(".//{*}text"))
        assert "".join(p[0] for p in parts[::3]) == "1" * (len(parts) // 3)
        assert all(p[0] == "0" for p in parts[1::3])
        parts = [p for i, p in enumerate(parts) if i % 3 != 1]
    result = {}
    assert len(parts) % 2 == 0
    for base, exp in zip(parts[::2], parts[1::2]):
        assert base[0] in ("10", "1") and exp[0].isdigit()
        axis = "x" if base[3] > frame["bottom"] else "y"
        name = f"label-{axis}-10^{exp[0]}"
        assert name not in result
        result[name] = dict(baseFace=base[1], expFace=exp[1], baseEm=base[4], expEm=exp[4],
                            pageX=base[2], pageY=base[3], expAdvance=exp[2]-base[2], expRaise=base[3]-exp[3])
    return result


def delta(a, b):
    result, bad = {}, []
    for k in sorted(set(a) | set(b)):
        if k not in a or k not in b:
            result[k] = "missing" if k not in a else "extra"
            bad.append(k)
        elif isinstance(b[k], (bool, str, np.bool_)):
            result[k] = "same" if a[k] == b[k] else f"{a[k]} vs {b[k]}"
            if a[k] != b[k]:
                bad.append(k)
        else:
            result[k] = a[k] - b[k]
            if abs(result[k]) > LIMIT:
                bad.append(k)
    return dict(fail=" ".join(bad), **rounded(result))


def source_check(stage, cap, e, manual):
    src = Path(cap["fixtureRoot"]) / e["source"]
    assert e["editorRenderClicked"] and e["previousSvgDetached"] and e["originalPdfInputMatchesSource"]
    assert sha(src) == e["sourceSha256"] and (stage/".mactex-work"/e["id"]/"reference.tex").read_bytes() == src.read_bytes()
    tex = src.read_bytes()
    picture = tex[tex.index(b"\\begin{tikzpicture}"):tex.index(b"\\end{document}")]
    if e["id"] == MANUAL:
        assert picture == manual and b"\\pgfplotsset{width=7cm,compat=1.18}" in tex
    adapter = (stage/"tikztosvg-input"/(e["id"]+".tex")).read_bytes().lstrip(b"\n")
    assert adapter.startswith(picture.split(b"\\end{tikzpicture}")[0]+b"\\tikzset{execute at end picture=")
    def elements(k, ignore_css=False):
        return [(n.tag, sorted(n.attrib.items()), (n.text or "").strip())
                for n in ET.parse(stage/e["panels"][k]["svgFile"]).iter()
                if not ignore_css or not n.tag.endswith("}style")]
    assert elements("live") == elements("download")
    assert elements("download", True) == elements("export", True)
    cli = stage/"capture/cli"/(e["id"]+".svg")
    cli.parent.mkdir(exist_ok=True)
    result = subprocess.run(["node", Path(cap["tree"])/"bin/tikz2svg.js", src, "--strict",
                             "--math-renderer", "svg-text", "-o", cli], capture_output=True, check=True)
    assert not result.stderr and sha(cli) == e["panels"]["download"]["svgSha256"]
    return dict(case=e["id"], publicCLI=sha(cli), download=e["panels"]["download"]["svgSha256"],
                harnessExport=e["panels"]["export"]["svgSha256"])


def check_native(case, rows):
    inv = rows["inventory"]
    assert inv["markers"] == len(VALID[case]) and inv["unassigned"] == 0, (case, inv)
    assert inv["stems"] == sum(map(len, VALID[case]))
    assert inv["caps"] == inv["stems"] + (4 if case == MANUAL else 0)
    for i, arms in enumerate(VALID[case]):
        for d in shared.ACTIVE[case][i]:
            rec = rows[f"p{i+1}:{d}"]
            assert rec["stem"] == rec["cap"] == (d in arms)
            if d in arms:
                assert rec["capAxis"] == ("horizontal" if d[0] == "y" else "vertical")
                assert rec["stemInk"]
                if case == JUMP and i == 0 and d in X:
                    assert rec["insideInk"] and not rec["outsideInk"] and not rec["capInk"]
                else:
                    assert rec["capInk"]
    if case == JUMP:
        assert rows["data-line"]["markerLinks"] == "1-2 3-4"
    if case == MANUAL:
        assert all(rows[f"p{i}:center-cap-{j}"]["capAxis"] == "horizontal" for i in (1, 2) for j in (1, 2))
        assert rows["data-line"]["visits"] == 7 and rows["data-line"]["ordered"]


def audit(stage, before=None, strict=False):
    cap = read(stage/"capture.json")
    assert cap["dpi"] == DPI and not cap["errors"] and not cap["badRequests"]
    assert sha(stage/"summary.json") == cap["summarySha256"] and read(stage/"summary.json")["gate"]["accepted"]
    cases = {e["id"] for e in cap["rows"]}
    assert cases == set(VALID) or (not strict and cases == set(VALID)-{JUMP})
    archive = subprocess.check_output(["kpsewhich", "-format=TeX system documentation", "pgfplots.doc.src.tar.bz2"], text=True).strip()
    with tarfile.open(archive) as tar:
        manual = b"".join(tar.extractfile("pgfplots.reference.errorbars.tex").readlines()[197:215])
    old = {e["id"]: e for e in read(before/"capture.json")["rows"]} if before else {}
    features, pages, residuals, inventory, locks, pairs, cli, samples = [], [], [], [], [], [], [], []
    for e in cap["rows"]:
        case = e["id"]
        cli.append(source_check(stage, cap, e, manual))
        panels = {}
        for k in (*JS, *REFS):
            paths, size, rgb, h, _ = load_panel(stage, e, k)
            sampled = []
            rows, raw_links = measure(case, paths, size, rgb, sampled)
            samples.extend(dict(case=case, panel=k, **v) for v in sampled)
            pg = rows["frame"]
            pages.append(dict(case=case, panel=k, rasterSha=h, **rounded(pg)))
            if k in (*JS, "pdf"):
                rows.update(labels(stage, e, k, pg))
            if k in REFS:
                check_native(case, rows)
            counts = {key: len(group) for key, group in tick_groups(rows).items()}
            inventory.append(dict(case=case, panel=k, **rows["inventory"], rawDataSegments=raw_links, **counts,
                labels=" ".join(n[6:] for n in rows if n.startswith("label-")),
                fonts=" ".join(e["panels"][k]["fonts"]["loaded"]) if k in JS else "CMR10 CMR7" if k == "pdf" and case == MANUAL else ""))
            features.extend(dict(case=case, panel=k, feature=n, **rounded(v)) for n, v in rows.items())
            for i in range(len(VALID[case])):
                for axis in ("x", "y"):
                    a, b = (rows.get(f"p{i+1}:{axis}{d}", {}).get("span") for d in ("+", "-"))
                    pairs.append(dict(case=case, panel=k, marker=i+1, axis=axis, **rounded(dict(
                        plus=a, minus=b, absRatio=a/-b if a is not None and b else None))))
            panels[k] = rows
        for k in (*JS, "tikztosvg", "rsvg"):
            for ref in ("pdf", "tikztosvg"):
                if k == ref:
                    continue
                a, b = panels[k], panels[ref]
                def record(name, group, actual, native):
                    residuals.append(dict(case=case, panel=k, reference=ref, group=group, feature=name, **delta(actual, native)))
                for n in sorted(set(a) | set(b)):
                    if n.startswith("tick-"):
                        continue
                    label = n.startswith("label-")
                    if label and (k not in JS or ref != "pdf"):
                        continue  # converter glyphs are outlines
                    record(n, "labels" if label else "geometry", a.get(n, {}), b.get(n, {}))
                for name, target in tick_groups(b).items():
                    actual = tick_groups(a)[name]
                    record("ticks-"+name, "ticks", {"count":len(actual)}, {"count":len(target)})
                    if len(actual) == len(target):
                        for j, (v, w) in enumerate(zip(actual, target)):
                            record(f"tick-{name}-{j+1}", "ticks", v, w)
                    elif actual and target:
                        # Different sets have no ordinal correspondence. Report the
                        # worst distance to the nearest same-edge, same-kind tick.
                        m = abs(np.subtract.outer([v["plotAt"] for v in actual], [w["plotAt"] for w in target]))
                        record("nearest-"+name, "ticks", {"nearest":max(m.min(0).max(), m.min(1).max())}, {"nearest":0.})
        if before:
            assert old[case]["sourceSha256"] == e["sourceSha256"]
            def native_hashes(root, entry):
                p = entry["panels"]
                with pymupdf.open(root/p["pdf"]["pdfFile"]) as doc:
                    stream = hashlib.sha256(doc[0].read_contents()).hexdigest()
                return dict(pdfStream=stream, pdfPNG=p["pdf"]["sha256"], converterSVG=p["tikztosvg"]["svgSha256"],
                            converterChrome=p["tikztosvg"]["sha256"], converterRsvg=sha(root/"capture/rsvg"/(case+".png")))
            prior, current = native_hashes(before, old[case]), native_hashes(stage, e)
            locks.extend(dict(case=case, item=n, baseline=v, current=current[n], match=current[n]==v) for n, v in prior.items())
    summaries = []
    for case, panel, ref in dict.fromkeys((r["case"], r["panel"], r["reference"]) for r in residuals):
        group = [r for r in residuals if (r["case"], r["panel"], r["reference"]) == (case, panel, ref)]
        arms = [r for r in group if ":" in r["feature"] and "center-cap" not in r["feature"]]
        def maximum(rows, *fields):
            values = [abs(r[f]) for r in rows for f in fields if isinstance(r.get(f), (int, float, np.number))]
            return max(values, default="")
        summaries.append(dict(case=case, panel=panel, reference=ref, checked=len(group),
            failed=sum(bool(r["fail"]) for r in group), plotEnd=maximum(arms, "plotX", "plotY"),
            pageEnd=maximum(arms, "pageX", "pageY"), signedSpan=maximum(arms, "span"),
            capLength=maximum(arms, "capLength"), pageSize=maximum(group, "pageW", "pageH"),
            origin=maximum(group, "left", "bottom"), labelPlacement=maximum(
                [r for r in group if r["group"] == "labels"], "pageX", "pageY")))
    for name, items in (("pages", pages), ("features", features), ("inventory", inventory), ("signed-arms", pairs),
                        ("case-summary", summaries), ("residuals", residuals), ("reference-locks", locks),
                        ("cli", cli), ("raster-samples", samples)):
        if items:
            csv_out(stage/(name+".csv"), items)
    failures = [r for r in residuals if r["fail"]]
    unlocked = [(r["case"], r["item"]) for r in locks if not r["match"]]
    diag = [(e["id"], e["diagnostics"], e["exportDiagnostics"]) for e in cap["rows"] if e["diagnostics"] or e["exportDiagnostics"]]
    print(f"{cap['revision']} / {cap['environment']['rendererSha256'][:12]}: {len(failures)} failed feature comparisons; diagnostics {diag}; native changes {unlocked}")
    if strict and (failures or unlocked or diag or not before):
        raise SystemExit(1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("stage", type=Path)
    ap.add_argument("--before", type=Path)
    ap.add_argument("--require-all", action="store_true")
    a = ap.parse_args()
    audit(a.stage, a.before, a.require_all)

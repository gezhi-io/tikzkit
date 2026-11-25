"""Show whole captured pages at 192 dpi. No trimming, fitting or registration."""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent.with_name("native-pgfplots-boxplots")))
from gallery import font


SMALL = {
    "petri-manual-places": "Two labeled places",
    "petri-manual-styled-tokens": "Seven plain dots and three numbered dots",
    "petri-manual-transition": "Transition: pre, post and edge weight",
    "petri-manual-structured-atlas": "The original 3 x 3 structured atlas",
    "petri-manual-colored": "Four colored tokens",
    "petri-manual-children": "Four explicit token children",
}
NETWORK = "mutual-exclusion"


def tile(folder, panel):
    path = folder/panel["png"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == panel["pngSha256"], path
    with Image.open(path) as im:
        # Only pad an odd final row/column; keep the same 2:1 sampling grid in every panel.
        w, h = im.size
        page = Image.new("RGB", (w+w%2, h+h%2), "white")
        rgba = im.convert("RGBA")
        page.paste(rgba, mask=rgba.getchannel("A"))
        return page.resize((page.width//2,page.height//2), Image.Resampling.LANCZOS)


def sheet(before, stage, output):
    read = lambda folder: json.loads((folder/"proof.json").read_text())
    old, new = read(before), read(stage)
    cases = set(new["results"])
    assert cases == set(old["results"]) and cases in (set(SMALL), set(SMALL) | {NETWORK}), "Incomplete sheet pair"
    for folder, proof in ((before,old), (stage,new)):
        data = (folder/"capture.json").read_bytes()
        captured = json.loads(data)
        assert captured["dpi"] == 384 and captured["environment"]["rendererSha256"] == proof["renderer"]
        assert {row["id"] for row in captured["rows"]} == cases
        if "captureSha256" in proof:
            assert hashlib.sha256(data).hexdigest() == proof["captureSha256"], folder
    for case in cases:
        assert new["results"][case]["sourceSha256"] == old["results"][case]["sourceSha256"]
    frozen = before.resolve() == stage.resolve()
    cols = [("pdf", "Original PDF", "MacTeX / Poppler"), ("rsvg", "Native converter", "tikztosvg / librsvg"),
            ("before", "Frozen workbench", "Chrome / Render")]
    if not frozen:
        cols.append(("live", "Current workbench", "Chrome / Render"))
    cols += [("download", "Download SVG", "Reopened in Chrome"), ("cli", "Command line", "Strict SVG / librsvg")]
    def panel(case, key):
        if key == "before":
            return before, old["results"][case]["panels"]["live"]
        return stage, new["results"][case]["panels"][key]

    tiles = []
    for case, label in SMALL.items():
        row = new["results"][case]
        imgs = [tile(*panel(case,key)) for key, *_ in cols]
        counts = [len(r["dots"]) for r in (row["panels"]["pdf"], old["results"][case]["panels"]["live"], row["panels"]["live"])]
        note = f"PDF: {counts[0]} dots   |   frozen: {counts[1]}" + ("" if frozen else f"   |   current: {counts[2]}")
        tiles.append((label, note, imgs))
    widths = [max(183, max(imgs[j].width for _, _, imgs in tiles)) + 18 for j in range(len(cols))]
    pad = 20
    width = 2*pad + sum(widths)
    height = 181 + sum(max(im.height for im in imgs)+53 for _, _, imgs in tiles)
    image = Image.new("RGB", (width,height), "#f3f6f6")
    d = ImageDraw.Draw(image)
    def text(x, y, s, size=15, bold=False, color="#234146"):
        d.text((x,y), s, font=font(size,bold), fill=color)
    text(pad, 10, "TikZ manual  /  Petri nets", 28, True)
    text(pad, 51, "Frozen renderer "+old["renderer"][:12]+("" if frozen else "  /  current "+new["renderer"][:12])+
         "     |     Whole 384 dpi captures, shown at 192 dpi. Same scale and page origin in every column.")
    x = pad
    for j, (key, name, sub) in enumerate(cols):
        text(x, 82, name, 18, True, "#99462c" if key == "before" else "#17665f")
        text(x, 107, sub, 14)
        x += widths[j]
    y = 137
    for i, (label, note, imgs) in enumerate(tiles, 1):
        d.line((pad,y-3,width-pad,y-3), fill="#b7cacc")
        text(pad,y+3,f"{i:02}    {label}",18,True)
        text(width-pad-d.textlength(note,font=font(15)),y+5,note)
        y += 34
        x = pad
        for j, img in enumerate(imgs):
            image.paste(img,(x,y))
            d.rectangle((x-1,y-1,x+img.width,y+img.height),outline="#aebfc0")
            x += widths[j]
        y += max(im.height for im in imgs) + 19
    matches = sum(new["results"][case]["cliEqualsDownload"] for case in SMALL)
    text(pad,y+4,f"Till Tantau, PGF/TikZ manual (2019).  |  Download and strict CLI bytes match: {matches}/{len(SMALL)} files on this sheet.",14)
    image.save(output,optimize=True,dpi=(192,192))
    if NETWORK in cases:
        network_sheet(cols, panel, old, new, output.with_name(output.stem+"-"+NETWORK+output.suffix))


def network_sheet(cols, panel, old, new, output):
    tiles = []
    for key, name, sub in cols:
        folder, p = panel(NETWORK, key)
        paths = [v["path"] for v in p["arcs"]]
        counts = (f"{len(p['places'])} places, {len(p['rects'])} transitions, {len(p['dots'])} tokens"
                  f"   |   {paths.count('l')} shafts, {paths.count('cc')} arrowheads")
        tiles.append((key, name, sub+"   |   "+counts, tile(folder, p)))
    pairs = [tiles[i:i+2] for i in range(0,len(tiles),2)]
    pad, gap = 24, 32
    col = max(im.width for *_,im in tiles)
    heights = [max(im.height for *_,im in pair)+98 for pair in pairs]
    width, height = 2*pad+2*col+gap, 112+sum(heights)+78
    image = Image.new("RGB", (width,height), "#f3f6f6")
    d = ImageDraw.Draw(image)
    def text(x, y, s, size, bold=False, color="#234146"):
        d.text((x,y), s, font=font(size,bold), fill=color)

    text(pad,12,"TikZ manual  /  Mutual-exclusion network",34,True)
    a,b = new["results"][NETWORK]["manualLines"]
    text(pad,62,f"Manual lines {a}-{b}   |   Renderer {old['renderer'][:12]} to {new['renderer'][:12]}"
         "   |   Whole 384 dpi pages at 192 dpi, aligned at the page origin.",20)
    y = 112
    for pair, h in zip(pairs, heights):
        d.line((pad,y-5,width-pad,y-5),fill="#b7cacc")
        for i,(key,name,note,im) in enumerate(pair):
            x = pad+i*(col+gap)
            text(x,y+2,name,25,True,"#99462c" if key == "before" else "#17665f")
            text(x,y+39,note,18)
            image.paste(im,(x,y+68))
            d.rectangle((x-1,y+67,x+im.width,y+68+im.height),outline="#aebfc0")
        y += h
    row = new["results"][NETWORK]
    before_px, after_px = [s["results"][NETWORK]["pixelDiff"]["live"]["changedOver16"] for s in (old,new)]
    text(pad,y,f"PDF versus Chrome: {before_px:,} pixels before, {after_px:,} after"
         f"   |   Live versus reopened download: {row['liveVsDownloadPx']['changedOver16']:,} pixels"
         "   |   Threshold: >16 in any RGB channel at 384 dpi.",19)
    match = "match" if row["cliEqualsDownload"] else "differ"
    text(pad,y+34,f"Till Tantau, PGF/TikZ manual (2019).   |   Current download and strict CLI SVG bytes {match}."
         " The CLI panel uses librsvg's text rendering.",18)
    image.save(output,optimize=True,dpi=(192,192))


if __name__ == "__main__":
    sheet(*(Path(a) for a in sys.argv[1:]))

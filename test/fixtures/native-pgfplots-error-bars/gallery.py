"""Fixed-scale photographic proof, with the actual converter/editor raster difference."""
import argparse
import csv
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from physical import ASY, AUTO, FIX, PPM, SYM, TABLE, csv_out
from proof import difference
from sheet import rasters
from sheets import ACCENT, INK, MUTED, RULE, line

ROWS={
    SYM:("01  Manual / symmetric input, upper y only","Five data markers; each has an upper y error. No horizontal or lower errors.",None),
    ASY:("02  Manual / asymmetric and missing errors","The second marker covers its zero-error cap; orientation is read from the vector paths.",None),
    FIX:("03  Fixed scatter / independent directions and cap pens","Blue: four directions. Red: fixed x and relative y; thick stems, thin caps. Green: no cap.",(25.7,5.4,38.2,14.6)),
    AUTO:("04  Autoscale / error extrema set the limits","The outer endpoints define x = 1 to 8 and y = 1 to 6. Frames and margins are not aligned in post.",None),
    TABLE:("05  Grouped ybar / two inline tables","Four shifted bar tops and eight signed table endpoints measured independently. Native caps are black.",(15.3,11.7,21.7,18.1)),
}
def read_rows(f):
    with f.open() as fp: return list(csv.DictReader(fp))

def gallery(stage,before,routes):
    cap,images=rasters(stage); parent=rasters(before)[1] if before else None
    summary={(r["case"],r["reference"]):r for r in read_rows(stage/"case-summary.csv")}
    features={(r["case"],r["panel"],r["feature"]):r for r in read_rows(stage/"features.csv")}
    cols=([("pdf","Original pdfLaTeX"),("rsvg","tikztosvg / librsvg"),("live","Loaded editor"),("download","Downloaded SVG"),("export","CLI export")] if routes else
          [("pdf","Original pdfLaTeX"),("rsvg","tikztosvg / librsvg")]+([("parent","Parent / editor")] if parent else [])+
          [("live","Candidate / editor" if parent else "Parent / editor"),("diff","Editor vs converter")])
    cw=256; w=28+cw*len(cols); out=Image.new("RGB",(w,2400),"#f5f8f8"); d=ImageDraw.Draw(out)
    line(d,(14,9),"PGFPlots  /  Measurement error bars",25,INK,True)
    line(d,(14,44),f"Renderer {cap['environment']['rendererSha256'][:12]}   |   Actual 384 dpi samples. Same physical scale across columns; common page origin, no fitting.",14,MUTED)
    note=("Each row shows the original page and the same physical crop from each output." if routes else
          "Difference: dark = shared ink; magenta = converter only; green = editor only; amber = different hues in shared ink.")
    line(d,(14,65),note,14,MUTED)
    for j,(_,title) in enumerate(cols): line(d,(14+cw*j,94),title,16,ACCENT,True)
    dest=stage/"overlays"; dest.mkdir(exist_ok=True); y=124; metrics=[]
    for case,(title,caption,box) in ROWS.items():
        if case not in images: continue
        ims=images[case]
        if parent: ims["parent"]=parent[case]["live"]
        if not routes:
            for k in ("live","download","export","tikztosvg"):
                diff,row=difference(ims["rsvg"],ims[k]); diff.save(dest/f"{case}-{k}.png")
                metrics.append(dict(case=case,panel=k,**row))
                if k=="live": ims["diff"]=diff
        s,c=summary[case,"pdf"],summary[case,"tikztosvg"]
        detail=(f"Max endpoint error (mm), plot / page: PDF {s['plotEnd']} / {s['pageEnd']}; converter {c['plotEnd']} / {c['pageEnd']}."
                if s["plotEnd"] else "No nonzero error stems measured in this editor.")
        if case==ASY:
            key=(case,"live","p2:y-"); detail+="  Covered cap: PDF horizontal; editor "+(features[key].get("capAxis") or "absent")+"."
        d.line((14,y,w-14,y),fill=RULE); line(d,(14,y+4),title,17,INK,True); line(d,(14,y+28),caption,13,MUTED)
        line(d,(14,y+47),detail,13,MUTED); y+=71
        for rect,scale in [(None,.245)]+([(box,1.17 if case==FIX else 2.1)] if box else []):
            if rect:
                line(d,(14,y),("Red data point: two different stroke widths" if case==FIX else "Upper error cap on the first red bar")+"  /  fixed native page window",13,INK,True); y+=21
            largest=0
            for j,(k,_) in enumerate(cols):
                im=ims[k]
                if rect:
                    x0,y0,x1,y1=np.rint(np.array(rect)*PPM).astype(int)
                    tile=Image.new("RGB",(x1-x0,y1-y0),"white"); tile.paste(im,(-x0,-y0)); im=tile
                tile=im.resize(tuple(round(v*scale) for v in im.size),Image.Resampling.NEAREST if scale>=1 else Image.Resampling.LANCZOS)
                assert tile.width<cw-9; x=14+j*cw; out.paste(tile,(x,y)); d.rectangle((x-1,y-1,x+tile.width,y+tile.height),outline=RULE)
                largest=max(largest,tile.height)
            y+=largest+11
        y+=4
    assert y<out.height
    out.crop((0,0,w,y)).save(stage/("all-routes.png" if routes else "gallery.png"))
    if metrics: csv_out(stage/"overlay-pixels.csv",metrics)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path); ap.add_argument("--before",type=Path)
    a=ap.parse_args(); gallery(a.stage,a.before,False); gallery(a.stage,a.before,True)

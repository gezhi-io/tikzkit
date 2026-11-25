"""One sheet of the actual physical pages. Every panel has the same 4:1 reduction."""
import argparse
import json
from pathlib import Path
import sys
from PIL import Image, ImageDraw

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent.with_name("native-pgfplots-boxplots")))
from gallery import font

ROWS = [
    ("hist-manual-intervals","Three labeled intervals","Three filled bins: 3, 2, 7. Native x ticks point out; grid lines pass through bin edges."),
    ("hist-manual-const","Constant-step handler","Five step segments and four dots. The final height, 7, repeats at x = 10."),
    ("hist-manual-cumulative-x","Cumulative / 8,000 original observations","Ten bars. The first three heights are 11, 154 and 811; the last is 8,000. Four half-open tick labels."),
    ("hist-manual-sharp","Sharp handler / intervals off","Two diagonals and three dots at x = 1, 4, 7. No phantom mark at x = 10."),
    ("hist-four-bin-modes","Four-bin control","Counts: 2, 0, 1, 3. Teal: density. Red: cumulative count. Blue dots: cumulative density."),
]
COLS = [("pdf","Original PDF","MacTeX / Poppler"),("rsvg","Native converter","tikztosvg / librsvg"),
        ("live","Workbench","Chrome / Render"),("download","Download SVG","Reopened in Chrome"),
        ("cli","Packaged CLI","Strict SVG / librsvg"),("before","Frozen workbench","Chrome / Render at ca5b3ae")]

def sheet(before, stage, dst):
    def read(s): return json.loads((s/"geometry.json").read_text())
    old,new=read(before),read(stage); tiles={}; widths=[225]*len(COLS); heights=[]
    for case,_,_ in ROWS:
        a,b=old["results"][case],new["results"][case]; assert a["sourceSha256"]==b["sourceSha256"]
        assert old["archiveDataSha256"]==new["archiveDataSha256"]
        row=[]
        for j,(key,_,_) in enumerate(COLS):
            source,rec,k=(before,a,"live") if key=="before" else (stage,b,key)
            with Image.open(source/rec["panels"][k]["png"]) as im:
                tile=im.convert("RGB").resize(tuple(round(s/4) for s in im.size),Image.Resampling.LANCZOS)
            widths[j]=max(widths[j],tile.width);row.append(tile)
        tiles[case]=row;heights.append(max(i.height for i in row))
    pad,gap=20,18;xx=[pad]
    for w in widths: xx.append(xx[-1]+w+gap)
    width=xx[-1]+pad-gap; height=132+sum(h+78 for h in heights)+53
    canvas=Image.new("RGB",(width,height),"#f3f6f6"); d=ImageDraw.Draw(canvas)
    def text(x,y,s,n=14,b=False,color="#244047"): d.text((x,y),s,font=font(n,b),fill=color)
    text(pad,10,"PGFPlots  /  Numeric histograms",28,True)
    text(pad,50,f"Frozen ca5b3ae ({old['renderer'][:12]})   /   Verified renderer {new['renderer'][:12]}     |     384 dpi shown at 96 dpi. Same page origin and scale in every column; no fitting or cropping.",15)
    for x,(k,title,sub) in zip(xx,COLS):
        text(x,83,title,18,True,"#925031" if k=="before" else "#116961")
        text(x,106,sub,13)
    y=132
    for idx,((case,title,caption),h) in enumerate(zip(ROWS,heights),1):
        d.line((pad,y-3,width-pad,y-3),fill="#b8c9cb")
        text(pad,y+2,f"{idx:02}    {title}",18,True)
        text(pad,y+29,caption)
        diff=new["results"][case]["vsPdf"]["live"]["pageMm"]
        oldw=old["results"][case]["panels"]["live"]["pageMm"][0]
        s=f"Frozen width {oldw:.3f} mm   |   Workbench minus PDF: width {diff[0]:+.3f}, height {diff[1]:+.3f} mm"
        text(xx[-2],y+29,s,14,False,"#436363")
        y+=53
        for x,im in zip(xx,tiles[case]):
            canvas.paste(im,(x,y));d.rectangle((x-1,y-1,x+im.width,y+im.height),outline="#aec0c1")
        y+=h+25
    d.line((pad,y-3,width-pad,y-3),fill="#b8c9cb")
    same=sum(v["cliMatchesDownload"] for v in new["results"].values())
    text(pad,y+4,f"Download = packaged CLI, byte for byte: {same}/5. Only the rasterizer changes between those columns. The 226.661 mm frozen control is shown in full.",14,True)
    cumul=new["results"]["hist-manual-cumulative-x"]
    ref,live=(cumul["panels"][k]["pageMm"][0] for k in ("pdf","live"))
    dy=cumul["vsPdf"]["live"]["paint"]["bar/0000ff"]["maxXYmm"][1]
    text(pad,y+26,f"Cumulative page: PDF {ref:.4f} mm, workbench {live:.4f} mm. Largest vertical difference at a bar edge: {dy:.4f} mm.",14)
    canvas.save(dst,optimize=True,dpi=(96,96))

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    for k in ("before","stage","output"): ap.add_argument(k,type=Path)
    a=ap.parse_args();sheet(a.before,a.stage,a.output)

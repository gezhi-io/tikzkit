"""Compose complete 384 dpi captures at one 4:1 scale; no crops or alignment."""
import argparse
import json
from pathlib import Path
import sys
from PIL import Image,ImageDraw

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent.with_name("native-pgfplots-boxplots")))
from gallery import font

ROWS=[
    ("explicit-hole","Explicit colors","Empty center vs painted white corner. All nine marks and labels remain, including 4."),
    ("nan-colorbar","Numeric meta / NaN and colorbar","No center fill. The native 0-8 colorbar runs from blue at the bottom to red at the top."),
    ("table","Table / automatic limits","Nine original table rows, meta column C, mesh/cols=3. Cell edges span -0.5 to 2.5 on both axes."),
    ("starred","Starred orientation","Native lower-left cell = 0 (blue), upper-left = 6 (orange). The manual explicitly sets axis on top."),
    ("skewed","Skewed scanlines","Nine connected quadrilaterals, not rectangles. The last corner reaches y=3.125 beyond the y=3.04 axis."),
]

def run(before,stage,output):
    def read(path):return json.loads((path/"geometry.json").read_text())
    old,new=read(before),read(stage);frozen=before.resolve()==stage.resolve()
    columns=[("pdf","Original PDF","MacTeX / Poppler"),("rsvg","Native converter","tikztosvg / librsvg"),
             ("old","Frozen workbench","Chrome / Render at 041f86f")]
    if not frozen:columns.append(("live","Workbench","Chrome / Render"))
    columns.extend([("download","Download SVG","Reopened in Chrome"),("cli","Packaged CLI","Strict SVG / librsvg")])
    tiles=[];maxw=230
    for suffix,title,note in ROWS:
        case="matrix-manual-"+suffix; ref=old["results"][case];rec=new["results"][case];row=[]
        assert ref["sourceSha256"]==rec["sourceSha256"]
        for k,*_ in columns:
            root,r,key=(before,ref,"live") if k=="old" else (stage,rec,k)
            if key not in r["panels"]:row.append(None);continue
            with Image.open(root/r["panels"][key]["png"]) as image:
                tile=image.convert("RGB").resize(tuple(round(s/4) for s in image.size),Image.Resampling.LANCZOS)
            row.append(tile);maxw=max(maxw,tile.width)
        tiles.append((row,rec))
    col=maxw+17;pad=19;width=2*pad+len(columns)*col
    height=171+sum(max(i.height for i in row if i)+76 for row,_ in tiles)
    canvas=Image.new("RGB",(width,height),"#f3f6f6");draw=ImageDraw.Draw(canvas)
    def label(x,y,s,n=14,b=False,color="#233e44"):draw.text((x,y),s,font=font(n,b),fill=color)
    label(pad,9,"PGFPlots  /  2D matrix heatmaps",27,True)
    label(pad,49,f"Frozen {old['renderer'][:12]}"+("" if frozen else f"   /   Verified {new['renderer'][:12]}")+
          "     |     Same page origin and physical scale. Native 384 dpi shown at 96 dpi. No fitting.",15)
    for j,(k,title,sub) in enumerate(columns):
        x=pad+j*col;label(x,78,title,17,True,"#9a5033" if k=="old" else "#176964");label(x,100,sub,13)
    y=125
    for i,((_,title,note),(row,rec)) in enumerate(zip(ROWS,tiles),1):
        draw.line((pad,y-3,width-pad,y-3),fill="#b9c9ca")
        label(pad,y+1,f"{i:02}    {title}",18,True);label(pad,y+28,note)
        p=rec["panels"]["pdf"];v=rec["vsPdf"]["live"];s=f"PDF: {len(p['cells'])} cells, {len(p['marks'])} marks   |   Workbench: {v['cellCounts'][1]} cells"
        label(width-pad-draw.textlength(s,font=font(14)),y+28,s,color="#365e60")
        y+=51
        for j,tile in enumerate(row):
            x=pad+j*col
            if tile:
                canvas.paste(tile,(x,y));draw.rectangle((x-1,y-1,x+tile.width,y+tile.height),outline="#aebfc0")
            else:label(x,y+10,"Strict CLI: no output",14,True,"#9a5033")
        y+=max(i.height for i in row if i)+25
    same=sum(r["cliMatchesDownload"] for r in new["results"].values())
    draw.line((pad,y-3,width-pad,y-3),fill="#b9c9ca")
    label(pad,y+4,f"Download = CLI, byte for byte: {same}/5. Label appearance can differ between Chrome, Poppler and librsvg.",14,True)
    if not frozen:
        skew=new["results"]["matrix-manual-skewed"]["panels"];p,v=skew["pdf"],skew["live"]
        def gap(panel):return panel["colorbarMm"][0]-panel["frameMm"][2]
        if p["colorbarMm"] and v["colorbarMm"]:
            tx,ty=(len(v["ticksMm"][side]) for side in ("bottom","left"))
            label(pad,y+24,f"Skewed table: {tx} x ticks, {ty} y ticks. Frame-to-colorbar gap: PDF {gap(p):.5f} mm; workbench {gap(v):.5f} mm.",14)
    canvas.save(output,optimize=True,dpi=(96,96))

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    for k in ("before","stage","output"):ap.add_argument(k,type=Path)
    a=ap.parse_args();run(a.before,a.stage,a.output)

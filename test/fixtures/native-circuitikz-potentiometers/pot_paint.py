"""Color of five independently identifiable features in the three paint rows."""
import numpy as np

PAINT="paint-probe"
FEATURES=("leftLead","rightLead","body","shaft","head")
EXPECTED={"bare":("none","none","black","black","black"),
          "red":("red",)*5,"draw=red":("red","red","red","red","black")}
# Absolute page windows (mm), offsets from x=21 and y=9/25/41. No registration.
WINDOWS=((-15,-.35,-11,.35),(11,-.35,15,.35),(-5.8,.6,5.8,2.19),
         (-.4,-5.35,.4,-4.48),(-.65,-3.48,.65,-2.65))

def color(v):
    rgb=tuple(np.rint(np.array(v)*255).astype(int))
    return {(255,0,0):"red",(0,0,0):"black"}.get(rgb,"#%02x%02x%02x"%rgb)

def rows(paths,rgb,panel,vertices,ppm):
    geometry=[(op,vertices(op)) for op in paths]; result=[]
    for label,y in zip(EXPECTED,(9,25,41)):
        mid=np.array([21,y]); inks={f:set() for f in FEATURES}
        for op,pts in geometry:
            p=pts-mid; x,z=p.T; w,h=np.ptp(p,axis=0)
            if op["color"] is not None:
                c=color(op["color"])
                for segment in op["items"]:
                    if segment[0]!="l": continue
                    endpoints=vertices({"items":[segment]})-mid
                    if len(endpoints)!=2: continue
                    a,b=endpoints
                    if max(abs(a[1]),abs(b[1]))<.08:
                        for at,key in ((-13,"leftLead"),(13,"rightLead")):
                            if min(a[0],b[0])<at<max(a[0],b[0]): inks[key].add(c)
                if abs((x.min()+x.max())/2)<.1 and abs((z.min()+z.max())/2)<.1 and 9<w<13 and 3<h<5: inks["body"].add(c)
                if max(abs(x))<.1 and -6<z.min()<-5 and -3.8<z.max()<-2.6: inks["shaft"].add(c)
            if op["fill"] is not None and max(abs(x))<1 and -4.3<z.min()<-3.3 and -2.6<z.max()<-1.8:
                inks["head"].add(color(op["fill"]))
        r=dict(case=PAINT,panel=panel,component=label)
        for key,box in zip(FEATURES,WINDOWS):
            r[key]="+".join(sorted(inks[key])) or "none"
            x0,y0,x1,y1=np.rint((np.array(box)+np.tile(mid,2))*ppm).astype(int)
            tile=rgb[y0:y1,x0:x1].astype(int); assert tile.size
            hi=tile.max(2); spread=hi-tile.min(2)
            masks={"black":(hi<150)&(spread<18),"red":(tile[:,:,0]-tile[:,:,1:].max(2)>85)}
            coverage={c:int(m.sum()) for c,m in masks.items()}
            other=(hi<220)&(spread>=18)&~masks["red"]; coverage["other"]=int(other.sum())
            r[key+"Pixels"]="+".join(sorted(c for c,n in coverage.items() if n>=3)) or "none"
            r[key+"Counts"]=" ".join(f"{c}:{n}" for c,n in coverage.items())
        result.append(r)
    return result

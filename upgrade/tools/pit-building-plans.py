"""Fit garage volumes to mapped plans and the actual racing/pit corridors at build time."""
from pathlib import Path
import sys,json,math
sys.path.insert(0,str(Path(__file__).parent/'deps'))
from shapely import Polygon,LineString,box,union_all,get_parts
from shapely.affinity import rotate,translate
R=Path(__file__).resolve().parents[2]; S=R/'upgrade/src'
read=lambda name:json.loads((S/name).read_text(encoding='utf-8'))
tracks=read('world-tour-data.json');pits=read('pit-lanes.json');contexts=read('venue-context-data.json');mapped=read('venue-map-data.json')
ids={'monza':[34404652],'austria':[118364939],'silverstone':[227332429],'spa':[77352246],'suzuka':[184422099],'interlagos':[33779114],'zandvoort':[52473177]}
result={};audit=[]
for key,d in tracks.items():
    n=len(d['x']); left=[];right=[]
    for i in range(n):
        nx,nz=-d['tz'][i],d['tx'][i];x,z=d['x'][i],d['z'][i]
        left.append((x-nx*(d['widthLeft'][i]+1.1),z-nz*(d['widthLeft'][i]+1.1)))
        right.append((x+nx*(d['widthRight'][i]+1.1),z+nz*(d['widthRight'][i]+1.1)))
    road=union_all([Polygon([left[i],right[i],right[(i+1)%n],left[(i+1)%n]]).buffer(0) for i in range(n)])
    pit=pits[key]; corridor=union_all([road,LineString(zip(pit['x'],pit['z'])).buffer(pit['width']/2+1.1)])
    features={f['id']:f for f in mapped.get(key,[]) if f.get('id') in ids.get(key,[])}
    features.update({f['id']:f for f in contexts.get(key,{}).get('structures',[]) if f.get('type','').endswith('-pit')})
    output={}
    for ident,f in features.items():
        pts=f['footprint']; edge=max(zip(pts,pts[1:]+pts[:1]),key=lambda ab:math.dist(*ab));angle=math.atan2(edge[1][1]-edge[0][1],edge[1][0]-edge[0][0]);origin=pts[0]
        raw=Polygon(pts).buffer(0);safe=raw.difference(corridor).buffer(-.65)
        local=rotate(translate(safe,-origin[0],-origin[1]),-math.degrees(angle),origin=(0,0));plans=[]
        if local.is_empty: continue
        x0,z0,x1,z1=local.bounds;count=max(1,math.ceil((x1-x0)/14));span=(x1-x0)/count
        for i in range(count):
            lo=x0+i*span+.02;hi=x0+(i+1)*span-.02; intervals=None
            # Intersection of vertical sections yields a rectangle wholly inside
            # the usable plan, rather than filling a bent building's bounding box.
            for u in [0,.25,.5,.75,1]:
                cut=local.intersection(LineString([(lo+(hi-lo)*u,z0-1),(lo+(hi-lo)*u,z1+1)]))
                parts=[box(lo,g.bounds[1],hi,g.bounds[3]) for g in get_parts(cut) if g.geom_type=='LineString' and g.length>1]
                section=union_all(parts);intervals=section if intervals is None else intervals.intersection(section)
            if intervals is None or intervals.is_empty: continue
            for part in get_parts(intervals):
                if part.geom_type!='Polygon': continue
                a,b,c,e=part.bounds
                if e-b<4 or c-a<5:continue
                rectangle=box(a,b,c,e)
                if not local.buffer(.002).covers(rectangle):continue
                world=translate(rotate(rectangle,math.degrees(angle),origin=(0,0)),*origin)
                assert not world.intersects(corridor)
                plans.append([[round(x,5),round(z,5)] for x,z in list(world.exterior.coords)[:-1]])
        output[str(ident)]=plans;audit.append({'circuit':key,'id':ident,'name':f.get('name'),'sections':len(plans),'originalOverlapM2':round(raw.intersection(corridor).area,3),'newOverlapM2':0})
    result[key]=output
(S/'pit-building-plans.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
(R/'upgrade/qa/pit-building-plans.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
print('Garage plans:',len(audit),'buildings,',sum(a['sections'] for a in audit),'footprint-bounded sections')

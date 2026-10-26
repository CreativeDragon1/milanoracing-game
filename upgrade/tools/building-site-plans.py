"""Reconcile ground-level building parcels with the game's driving corridors.

Keep source footprints unchanged. Only conflicting ground-level parcels get a
derived frontage, with room for their facade trim. Elevated hotel/tunnel spans
retain their original plans and are checked separately in three dimensions.
"""
from pathlib import Path
import json,sys
sys.path.insert(0,str(Path(__file__).parent/'deps'))
from shapely import Polygon,LineString,union_all
R=Path(__file__).resolve().parents[2];S=R/'upgrade/src'
read=lambda p:json.loads((S/p).read_text(encoding='utf-8'))
tour=read('world-tour-data.json');mapped=read('venue-map-data.json');contexts=read('venue-context-data.json');pits=read('pit-lanes.json');garage_plans=read('pit-building-plans.json')
plans={};audit=[]
for ident,t in tour.items():
    n=t['N'];left=[];right=[]
    for i in range(n):
        nx,nz=-t['tz'][i],t['tx'][i];x,z=t['x'][i],t['z'][i]
        left.append((x-nx*t['widthLeft'][i],z-nz*t['widthLeft'][i]));right.append((x+nx*t['widthRight'][i],z+nz*t['widthRight'][i]))
    road=union_all([Polygon([left[i],right[i],right[(i+1)%n],left[(i+1)%n]]).buffer(0) for i in range(n)])
    pit=pits[ident];driving=union_all([road,LineString(zip(pit['x'],pit['z'])).buffer(pit['width']/2)])
    features={f['id']:f for f in mapped.get(ident,[]) if f.get('kind')=='building'}
    features.update({f['id']:f for f in contexts.get(ident,{}).get('structures',[])})
    fixed={};rows=[]
    for f in features.values():
        if 'footprint' not in f or f.get('minHeight',0)>0 or f.get('type') in ['fairmont','yas-hotel','podium']:continue
        # Garages have their own section-by-section plan and elevation solver.
        if str(f['id']) in garage_plans.get(ident,{}):continue
        raw=Polygon(f['footprint'],f.get('holes',[])).buffer(0);overlap=raw.intersection(driving).area
        margin=2.95 if f.get('type') in ['paris','yachtclub','cafe'] else .8
        kerb_overlap=f.get('type') in ['paris','yachtclub'] and raw.intersection(driving.buffer(margin)).area>.1
        if overlap<.1 and not kerb_overlap:continue
        fitted=raw.difference(driving.buffer(margin)).buffer(0)
        if fitted.geom_type!='Polygon' or fitted.area<=raw.area*.65:
            rows.append({'id':f['id'],'name':f.get('name',''),'oldOverlapM2':round(overlap,3),'review':True,'geometry':fitted.geom_type,'remaining':round(fitted.area/raw.area,4)});continue
        fixed[str(f['id'])]={'footprint':[list(p) for p in list(fitted.exterior.coords)[:-1]],'holes':[[list(p) for p in list(h.coords)[:-1]] for h in fitted.interiors]}
        rows.append({'id':f['id'],'name':f.get('name',''),'oldOverlapM2':round(overlap,3),'newOverlapM2':round(fitted.intersection(driving).area,3),'retainedAreaFraction':round(fitted.area/raw.area,4),'facadeClearanceMetres':margin})
    plans[ident]=fixed;audit.append({'circuit':ident,'checkedBuildings':len(features),'adjusted':rows})
    print(ident,len(features),'building parcels;',len(rows),'frontage corrections',flush=True)
(S/'building-site-plans.json').write_text(json.dumps(plans,separators=(',',':')),encoding='utf-8')
(R/'upgrade/qa/building-site-plans.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')

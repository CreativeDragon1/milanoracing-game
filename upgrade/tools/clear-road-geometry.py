from pathlib import Path
import sys,json,numpy as np
from shapely import Polygon,LineString,union_all,get_parts
U=Path('upgrade');source=U/'research/osm/venue-buildings-before-road-clearance.json';target=U/'src/venue-map-data.json'
if not source.exists():source.write_bytes(target.read_bytes())
data=json.loads(source.read_text());tour=json.loads((U/'src/world-tour-data.json').read_text());pits=json.loads((U/'src/pit-lanes.json').read_text());report=[]
for id,features in data.items():
 d=tour[id];q=np.column_stack([d['x'],d['z']]);n=len(q);normal=np.column_stack([-np.array(d['tz']),d['tx']]);left=q-normal*(np.array(d['widthLeft'])+.8)[:,None];right=q+normal*(np.array(d['widthRight'])+.8)[:,None];corridor=union_all([Polygon([left[i],right[i],right[(i+1)%n],left[(i+1)%n]]).buffer(0) for i in range(n)]);pit=pits[id];corridor=union_all([corridor,LineString(np.column_stack([pit['x'],pit['z']])).buffer(pit['width']/2+1)])
 out=[];clipped=0
 for f in features:
  if f['kind']!='building':out.append(f);continue
  p=Polygon(f['footprint']).buffer(0)
  if not p.intersects(corridor):out.append(f);continue
  clipped+=1
  for part in get_parts(p.difference(corridor)):
   if part.geom_type=='Polygon' and part.area>8:out.append({**f,'footprint':np.array(part.exterior.coords)[:-1].round(4).tolist(),'circuitClearanceAdapted':True})
 data[id]=out;report.append({'circuit':id,'overlappingFootprintsAdapted':clipped});print(report[-1])
target.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8');(U/'qa/building-clearance.json').write_text(json.dumps(report,indent=2))

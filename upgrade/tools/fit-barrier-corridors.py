"""Fit runoffs inside the available corridor without crossing another road arm."""
from pathlib import Path
import sys,json,math
import numpy as np
sys.path.insert(0,str(Path(__file__).parent/'deps'))
from shapely import Polygon,LineString,Point,union_all
from shapely.ops import nearest_points

U=Path(__file__).resolve().parents[1];path=U/'src/world-tour-data.json';data=json.loads(path.read_text());reports=[]
for ident in sys.argv[1:] or ['spa']:
 t=data[ident];n=t['N'];p=np.column_stack((t['x'],t['z']));normal=np.column_stack((-np.array(t['tz']),t['tx']))
 backup=U/f'research/terrain/{ident}-runoff-source.json'
 if not backup.exists():backup.write_text(json.dumps({'left':t['runoffLeft'],'right':t['runoffRight']}))
 original=json.loads(backup.read_text());left=p-normal*(np.array(t['widthLeft'])+1.5)[:,None];right=p+normal*(np.array(t['widthRight'])+1.5)[:,None]
 road=union_all([Polygon([left[i],left[(i+1)%n],right[(i+1)%n],right[i]]).buffer(0) for i in range(n)]).buffer(.12)
 ds=np.linalg.norm(np.roll(p,-1,axis=0)-p,axis=1)
 for side,key in [(-1,'Left'),(1,'Right')]:
  half=np.array(t['width'+key]);start=half+1.9;old=half+np.array(original[key.lower()]);limit=old.copy()
  for i in range(n):
   a=p[i]+normal[i]*side*start[i];b=p[i]+normal[i]*side*old[i]
   if old[i]<=start[i]:continue
   intersection=LineString([a,b]).intersection(road)
   if not intersection.is_empty:
    nearest=nearest_points(Point(a),intersection)[1];distance=math.hypot(nearest.x-a[0],nearest.y-a[1]);limit[i]=max(start[i],min(old[i],start[i]+distance-.65))
  # A bounded spatial slope prevents a safe endpoint forming a diagonal kink.
  # Only reductions propagate, so smoothing cannot push a wall back into asphalt.
  for repeat in range(6):
   for i in range(n):limit[i]=min(limit[i],limit[(i-1)%n]+ds[(i-1)%n]*.28)
   for i in range(n-1,-1,-1):limit[i]=min(limit[i],limit[(i+1)%n]+ds[i]*.28)
  limit=np.maximum(limit,start);t['runoff'+key]=np.round(limit-half,5).tolist()
  changed=np.where(old-limit>.01)[0];reports.append({'circuit':ident,'side':key,'changedStations':changed.tolist(),'maximumReduction':float(max(old-limit)),'minimumKerbGap':float(min(limit-half-1.5))})
path.write_text(json.dumps(data,separators=(',',':')))
(U/'qa/barrier-corridor-fit.json').write_text(json.dumps(reports,indent=2))
for r in reports:print(r['circuit'],r['side'],len(r['changedStations']),'stations fitted; maximum correction',round(r['maximumReduction'],2),'m')

"""Offline, low-poly terrain. Road heights are measured; surrounding land is inferred.
Clip every grid cell against the runoff corridor, keeping the road unobstructed.
"""
from pathlib import Path
import sys,json,base64
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent/"deps"))
from shapely import Polygon,box,union_all,constrained_delaunay_triangles
from scipy.spatial import cKDTree
path=ROOT/'upgrade/src/world-tour-data.json';tour=json.loads(path.read_text());reports=[r for r in json.loads((ROOT/'upgrade/qa/terrain-validation.json').read_text()) if r['id'] not in sys.argv[1:]] if len(sys.argv)>1 else []
for ident,d in tour.items():
 if len(sys.argv)>1 and ident not in sys.argv[1:]:continue
 if ident not in ['milano','spa','suzuka','interlagos','zandvoort'] and not d.get('original',False):continue
 q=np.array([d['x'],d['z']]).T;norm=np.array([-np.array(d['tz']),d['tx']]).T;y=np.array(d['elevation']['height']);n=len(q)
 left=q-norm*(np.array(d.get('widthLeft',[d['width']/2]*n))+np.array(d['runoffLeft']))[:,None];right=q+norm*(np.array(d.get('widthRight',[d['width']/2]*n))+np.array(d['runoffRight']))[:,None]
 corridor=union_all([Polygon([left[i],right[i],right[(i+1)%n],left[(i+1)%n]]).buffer(0) for i in range(n)])
 sea=box(q[:,0].max()+35,(q[:,1].min()+q[:,1].max())/2-550,q[:,0].max()+385,(q[:,1].min()+q[:,1].max())/2+550) if d['theme'] in ('harbour','marina') else Polygon()
 excluded=union_all([corridor,sea]);boundary=np.vstack([left,right]);boundaryNext=np.vstack([np.roll(left,-1,axis=0),np.roll(right,-1,axis=0)]);bank=np.array(d.get('bank',[0]*n));boundaryY=np.r_[y+(np.array(d.get('widthLeft',[d['width']/2]*n))+np.array(d['runoffLeft']))*np.tan(bank),y-(np.array(d.get('widthRight',[d['width']/2]*n))+np.array(d['runoffRight']))*np.tan(bank)];boundaryNextY=np.r_[np.roll(boundaryY[:n],-1),np.roll(boundaryY[n:],-1)];tree=cKDTree(boundary);vertices=[]
 # The far ground remains a simple plane; this mesh covers the entire dressed area.
 lo=np.floor((q.min(axis=0)-360)/60).astype(int);hi=np.ceil((q.max(axis=0)+360)/60).astype(int)
 def height(points):
  distance,idx=tree.query(points,k=12);candidates=np.concatenate([idx,idx//n*n+(idx%n-1)%n],axis=1);v=boundaryNext[candidates]-boundary[candidates]
  f=np.clip(np.sum((points[:,None]-boundary[candidates])*v,axis=2)/np.maximum(np.sum(v*v,axis=2),1e-12),0,1);proj=boundary[candidates]+v*f[:,:,None];dist=np.sum((points[:,None]-proj)**2,axis=2);best=dist.argmin(axis=1);ix=candidates[np.arange(len(points)),best];u=f[np.arange(len(points)),best]
  exact=boundaryY[ix]*(1-u)+boundaryNextY[ix]*u;weights=1/(distance*distance+100);smooth=(boundaryY[idx]*weights).sum(axis=1)/weights.sum(axis=1)
  blend=np.clip((np.sqrt(dist.min(axis=1))-3)/35,0,1);out=exact*(1-blend)+smooth*blend
  # Taper the far mesh into the inexpensive background plane, beyond the scenery.
  border=np.minimum(points-lo*60,hi*60-points).min(axis=1);out*=np.clip(border/150,0,1)
  if not sea.is_empty:
   # Inferred shoreline slopes down to the existing marina water level.
   sx=np.maximum(np.maximum(sea.bounds[0]-points[:,0],points[:,0]-sea.bounds[2]),0);sz=np.maximum(np.maximum(sea.bounds[1]-points[:,1],points[:,1]-sea.bounds[3]),0);out*=1-blend+blend*np.clip(np.hypot(sx,sz)/30,0,1)
  return out-.015
 for gx in range(lo[0],hi[0]):
  for gz in range(lo[1],hi[1]):
   cell=box(gx*60,gz*60,(gx+1)*60,(gz+1)*60).difference(excluded)
   for tri in constrained_delaunay_triangles(cell).geoms:
    p=np.array(tri.exterior.coords)[:3];h=height(p);v=np.column_stack((p[:,0],h,p[:,1]))
    if np.cross(v[1]-v[0],v[2]-v[0])[1]<0:v=v[[0,2,1]]
    vertices.extend(v.ravel())
 arr=np.array(vertices,dtype='<f4');assert np.isfinite(arr).all()
 d['elevation']['terrain']=base64.b64encode(arr.tobytes()).decode();reports.append({'id':ident,'terrainTriangles':len(arr)//9,'bytes':arr.nbytes,'roadCorridorArea':corridor.area});print(reports[-1],flush=True)
path.write_text(json.dumps(tour,separators=(',',':')))
(ROOT/'upgrade/qa/terrain-validation.json').write_text(json.dumps(reports,indent=2))

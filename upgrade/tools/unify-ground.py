"""Bake one continuous ground surface around kerbs, including overlapping runoffs.

The road's X/Z, surveyed-source elevation samples and widths remain unchanged.
Material boundaries partition the same triangulation, so adjacent strips cannot
cross at different heights. The Suzuka bridge remains a separate upper deck.
"""
from pathlib import Path
import sys,json,base64
import numpy as np
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
sys.path.insert(0,str(Path(__file__).parent/'deps'))
from shapely import Polygon,LineString,box,union_all,constrained_delaunay_triangles,points
from shapely.strtree import STRtree
U=Path(__file__).resolve().parents[1]
tour=json.loads((U/'src/world-tour-data.json').read_text());geo=json.loads((U/'src/geographic-data.json').read_text());pits=json.loads((U/'src/pit-lanes.json').read_text())
ids=sys.argv[1:] or list(tour);reports=[]
for ident in ids:
 d=tour[ident];e=d['elevation'];n=d['N'];q=np.column_stack((d['x'],d['z']));normal=np.column_stack((-np.array(d['tz']),d['tx']));y=np.array(e['height']);bank=np.tan(d.get('bank',np.zeros(n)));half=[np.array(d.get('widthLeft',[d['width']/2]*n)),np.array(d.get('widthRight',[d['width']/2]*n))]
 # Rebuilds always sample the same source, never accumulate mesh deformation.
 source=U/f'research/terrain/{ident}-ground-source.bin';source.parent.mkdir(exist_ok=True,parents=True)
 if not source.exists():source.write_bytes(base64.b64decode(e['terrain']))
 old=np.frombuffer(source.read_bytes(),dtype='<f4').reshape(-1,3,3).astype(float);oldpolys=[Polygon(t[:,[0,2]]) for t in old];oldtree=STRtree(oldpolys)
 bridge=set()
 if d.get('features',{}).get('overpass'):
  upper=max(d['features']['overpass']['stations'],key=lambda i:y[i]);bridge={(upper+j)%n for j in range(-7,8)}
 roads=[];runoffs=[];edges=[];edge_y=[];edge_end=[];edge_end_y=[];edge_run=[]
 for side,h,r in [(-1,half[0],np.array(d['runoffLeft'])),(1,half[1],np.array(d['runoffRight']))]:
  a=q+normal*(side*(h+1.5))[:,None];b=q+normal*(side*(h+r))[:,None];ay=y-side*(h+1.5)*bank
  for i in range(n):
   j=(i+1)%n
   if i in bridge:continue
   runoffs.append(Polygon([a[i],b[i],b[j],a[j]]).buffer(0));edges.append(a[i]);edge_end.append(a[j]);edge_y.append(ay[i]);edge_end_y.append(ay[j]);edge_run.append(max(r[i]-1.5,1))
 left=q-normal*(half[0]+1.5)[:,None];right=q+normal*(half[1]+1.5)[:,None]
 for i in range(n):
  if i not in bridge:roads.append(Polygon([left[i],right[i],right[(i+1)%n],left[(i+1)%n]]).buffer(0))
 road=union_all(roads);pit=pits[ident];pitpoly=LineString(np.column_stack((pit['x'],pit['z']))).buffer(pit['width']/2-.03)
 water=union_all([Polygon(f['points']).buffer(0) for f in geo.get(ident,{}).get('features',[]) if f['kind']=='water'])
 if ident not in geo and d['theme'] in ('harbour','marina'):water=box(q[:,0].max()+35,(q[:,1].min()+q[:,1].max())/2-550,q[:,0].max()+385,(q[:,1].min()+q[:,1].max())/2+550)
 exclusion=union_all([road,pitpoly,water]);zone=union_all(runoffs).difference(exclusion)
 bounds=geo.get(ident,{}).get('nearBounds',[[old[:,:,0].min(),old[:,:,2].min()],[old[:,:,0].max(),old[:,:,2].max()]])
 A=np.array(edges);B=np.array(edge_end);Y=np.array(edge_y);Z=np.array(edge_end_y);R=np.array(edge_run);edge_tree=cKDTree(A)
 def height(p):
  # Original landscape supplies the far terrain; match actual triangle heights.
  base=np.full(len(p),np.nan);pairs=oldtree.query(points(p),predicate='intersects')
  if pairs.shape[1]:
   ix,ti=pairs;tri=old[ti];a,b,c=tri[:,0],tri[:,1],tri[:,2];den=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);safe=np.abs(den)>1e-8;ix=ix[safe];a,b,c,den=a[safe],b[safe],c[safe],den[safe];pt=p[ix];u=((b[:,2]-c[:,2])*(pt[:,0]-c[:,0])+(c[:,0]-b[:,0])*(pt[:,1]-c[:,2]))/den;v=((c[:,2]-a[:,2])*(pt[:,0]-c[:,0])+(a[:,0]-c[:,0])*(pt[:,1]-c[:,2]))/den;base[ix]=u*a[:,1]+v*b[:,1]+(1-u-v)*c[:,1]
  dist,ix=edge_tree.query(p,k=32);v=B[ix]-A[ix];f=np.clip(((p[:,None]-A[ix])*v).sum(2)/np.maximum((v*v).sum(2),1e-9),0,1);distance=np.linalg.norm(p[:,None]-A[ix]-v*f[:,:,None],axis=2);h=Y[ix]*(1-f)+Z[ix]*f;weights=1/(distance+.1)**3;joined=(h*weights).sum(1)/weights.sum(1);nearest=distance.argmin(1);row=np.arange(len(p));near=distance[row,nearest];exact=h[row,nearest]
  joined=np.where(near<.015,exact,joined)
  base=np.where(np.isfinite(base),base,joined)
  influence=np.clip(1-near/(R[ix[row,nearest]]+35),0,1);influence=influence*influence*(3-2*influence)
  return np.where(near<.015,exact,base*(1-influence)+joined*influence)-.015
 polys=[[],[]]
 # 30 m cells maintain or increase local geometric detail; no runtime tessellation.
 for x in np.arange(bounds[0][0],bounds[1][0],30):
  for z in np.arange(bounds[0][1],bounds[1][1],30):
   cell=box(x,z,min(x+30,bounds[1][0]),min(z+30,bounds[1][1])).difference(exclusion)
   for kind,shape in [(0,cell.difference(zone)),(1,cell.intersection(zone))]:
    if shape.is_empty:continue
    for tri in constrained_delaunay_triangles(shape).geoms:
     if tri.area>1e-7:polys[kind].append(np.array(tri.exterior.coords)[:3])
 combined=np.concatenate([np.array(p).reshape(-1,2) for p in polys]);unique,inverse=np.unique(combined.round(7),axis=0,return_inverse=True);heights=np.empty(len(unique))
 for start in range(0,len(unique),2048):heights[start:start+2048]=height(unique[start:start+2048])
 # Relax only reconstructed near-ground heights. Road/kerb boundary vertices
 # and the original distant landscape stay pinned. This removes steep sliver
 # slopes where the nearest road branch changes at tight uphill hairpins.
 dist,ix=edge_tree.query(unique,k=16);vec=B[ix]-A[ix];f=np.clip(((unique[:,None]-A[ix])*vec).sum(2)/np.maximum((vec*vec).sum(2),1e-9),0,1);near=np.linalg.norm(unique[:,None]-A[ix]-vec*f[:,:,None],axis=2).min(1)
 tri_ix=inverse.reshape(-1,3);edges_ix=np.concatenate([tri_ix[:,[0,1]],tri_ix[:,[1,2]],tri_ix[:,[2,0]]]);edges_ix=np.unique(np.sort(edges_ix,axis=1),axis=0);weights=1/np.maximum(np.linalg.norm(unique[edges_ix[:,0]]-unique[edges_ix[:,1]],axis=1),.05)
 adj=coo_matrix((np.tile(weights,2),(edges_ix.ravel(order='F'),edges_ix[:,::-1].ravel(order='F'))),shape=(len(unique),len(unique))).tocsr();sums=np.maximum(np.asarray(adj.sum(1)).ravel(),1e-9);free=(near>.03)&(near<90)
 for _ in range(90):heights[free]=heights[free]*.2+(adj@heights/sums)[free]*.8
 values=np.column_stack((combined[:,0],heights[inverse],combined[:,1])).reshape(-1,3,3)
 flip=np.cross(values[:,1]-values[:,0],values[:,2]-values[:,0])[:,1]<0;values[flip]=values[flip][:,[0,2,1]]
 outside=len(polys[0]);encode=lambda a:base64.b64encode(np.asarray(a,dtype='<f4').tobytes()).decode()
 e['terrain']=encode(values);e['groundOutsideTriangles']=outside;e.pop('groundOutside',None);e.pop('groundRunoff',None);e['unifiedGround']=True;e['bridgeSegments']=sorted(bridge)
 reports.append({'id':ident,'triangles':len(values),'outside':outside,'runoff':len(values)-outside,'uniqueVertices':len(unique),'bridgeSegments':len(bridge),'source':'Preserved road and original mapped landscape; continuous reconstructed ground joins'})
 print(reports[-1],flush=True)
(U/'src/world-tour-data.json').write_text(json.dumps(tour,separators=(',',':')))
(U/'qa/unified-ground.json').write_text(json.dumps(reports,indent=2))

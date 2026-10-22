"""Mapzen/AWS DEM + OSM land cover, transformed into each circuit's metre coordinates.
Source DEM is terrain, not a survey of the racing surface. Preserve the existing road.
"""
from pathlib import Path
import sys,json,base64,urllib.request,concurrent.futures,xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from scipy.ndimage import map_coordinates,grey_opening,gaussian_filter
ROOT=Path(__file__).resolve().parents[2]
from shapely import Polygon,LineString,Point,box,union_all,constrained_delaunay_triangles,get_parts
from shapely.ops import linemerge,polygonize
U=ROOT/'upgrade';cache=U/'research/terrain/tiles';cache.mkdir(exist_ok=True)
trans=json.loads((U/'src/geographic-transforms.json').read_text());tour=json.loads((U/'src/world-tour-data.json').read_text());result={};reports=[]
def tilexy(ll,z=12):
 lon,lat=ll.T;return np.column_stack(((lon+180)/360*2**z,(1-np.arcsinh(np.tan(np.radians(lat)))/np.pi)/2*2**z))
def download(t):
 x,y=t;p=cache/f'12-{x}-{y}.png'
 if not p.exists():
  url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/{x}/{y}.png'
  for k in range(3):
   try:p.write_bytes(urllib.request.urlopen(url,timeout=35).read());break
   except Exception:
    if k==2:raise
 return t,np.array(Image.open(p),dtype=np.float32)
for ident,tr in trans.items():
 if len(sys.argv)>1 and ident not in sys.argv[1:]:continue
 d=tour[ident];q=np.column_stack([d['x'],d['z']]);n=len(q);normal=np.column_stack([-np.array(d['tz']),d['tx']]);roadY=np.array(d['elevation']['height']);R=np.array(tr['rotation']);unit=np.array(tr['unit']);T=np.array(tr['translation']);origin=np.array(tr['origin']);scale=tr['scale']
 def togeo(xz):return (xz-T)@R.T/scale/unit+origin
 def togame(ll):return ((ll-origin)*unit)@R*scale+T
 centre=(q.min(0)+q.max(0))/2;extent=6500 if ident in ['austria','monaco','spa'] else 4500
 bounds=np.array([centre-extent,centre+extent]);corners=np.array([[x,z] for x in bounds[:,0] for z in bounds[:,1]])
 tiles=tilexy(togeo(corners));tl=np.floor(tiles.min(0)).astype(int);br=np.floor(tiles.max(0)).astype(int)
 requests=[(x,y) for x in range(tl[0],br[0]+1) for y in range(tl[1],br[1]+1)]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:images=dict(pool.map(download,requests))
 mosaic=np.zeros(((br[1]-tl[1]+1)*256,(br[0]-tl[0]+1)*256),dtype=np.float32)
 for (x,y),im in images.items():mosaic[(y-tl[1])*256:(y-tl[1]+1)*256,(x-tl[0])*256:(x-tl[0]+1)*256]=im[:,:,0]*256+im[:,:,1]+im[:,:,2]/256-32768
 if ident in ['singapore','abu-dhabi']:
  # Urban SRTM carries roof returns; a morphological ground estimate removes tower spikes.
  mosaic=gaussian_filter(grey_opening(mosaic,size=(9,9)),1.0)
 def dem(xz):
  px=(tilexy(togeo(np.asarray(xz)))-tl)*256-.5
  return map_coordinates(mosaic,[px[:,1],px[:,0]],order=1,mode='nearest')
 offset=float(np.median(dem(q)-roadY));tree=cKDTree(q)
 # Preserve exact runoff-edge elevation, blend gently into measured land over 160 m.
 left=q-normal*(np.array(d.get('widthLeft',[d['width']/2]*n))+np.array(d['runoffLeft']))[:,None];right=q+normal*(np.array(d.get('widthRight',[d['width']/2]*n))+np.array(d['runoffRight']))[:,None]
 boundary=np.vstack([left,right]);nextB=np.vstack([np.roll(left,-1,axis=0),np.roll(right,-1,axis=0)]);bank=np.array(d.get('bank',[0]*n));by=np.r_[roadY+(np.array(d.get('widthLeft',[d['width']/2]*n))+np.array(d['runoffLeft']))*np.tan(bank),roadY-(np.array(d.get('widthRight',[d['width']/2]*n))+np.array(d['runoffRight']))*np.tan(bank)];nextY=np.r_[np.roll(by[:n],-1),np.roll(by[n:],-1)];btree=cKDTree(boundary)
 def height(points):
  points=np.asarray(points);dist,idx=btree.query(points,k=4);ix=np.concatenate([idx,idx//n*n+(idx%n-1)%n],axis=1);v=nextB[ix]-boundary[ix];u=np.clip(((points[:,None]-boundary[ix])*v).sum(2)/np.maximum((v*v).sum(2),1e-9),0,1);dst=((points[:,None]-boundary[ix]-v*u[:,:,None])**2).sum(2);j=dst.argmin(1);ix=ix[np.arange(len(points)),j];u=u[np.arange(len(points)),j];edge=by[ix]*(1-u)+nextY[ix]*u;distance=np.sqrt(dst.min(1));blend=np.clip((distance-2)/160,0,1);blend=blend*blend*(3-2*blend);return edge*(1-blend)+(dem(points)-offset)*blend-.025
 # Land use, public roads, water and coastlines from the complete cached OSM extract.
 root=ET.parse(U/f'research/osm/{ident}-map.osm').getroot()
 if ident=='singapore':
  known={a.tag+str(a.attrib.get('id')) for a in root}
  for file in (U/'research/osm').glob('water-*.osm'):
   for el in ET.parse(file).getroot():
    key=el.tag+str(el.attrib.get('id'))
    if key not in known:root.append(el);known.add(key)
 nodes={x.attrib['id']:[float(x.attrib['lon']),float(x.attrib['lat'])] for x in root.findall('node')};ways={};features=[];coasts=[]
 for w in root.findall('way'):
  refs=[x.attrib['ref'] for x in w.findall('nd')];tags={x.attrib['k']:x.attrib['v'] for x in w.findall('tag')}
  if len(refs)<2 or not all(r in nodes for r in refs):continue
  xz=togame(np.array([nodes[r] for r in refs]));ways[w.attrib['id']]=(xz,tags)
  if tags.get('natural')=='coastline':coasts.append(LineString(xz))
  kind='water' if tags.get('natural')=='water' or tags.get('waterway')=='riverbank' else 'forest' if tags.get('natural') in ['wood','scrub'] or tags.get('landuse')=='forest' else 'sand' if tags.get('natural') in ['sand','beach','bare_rock'] else 'grass' if tags.get('landuse') in ['grass','meadow','recreation_ground','village_green'] or tags.get('leisure') in ['park','golf_course','garden'] else 'field' if tags.get('landuse') in ['farmland','orchard','vineyard'] else 'paved' if tags.get('amenity')=='parking' or tags.get('aeroway') in ['apron','runway','taxiway'] else 'road' if tags.get('highway') in ['motorway','trunk','primary','secondary','tertiary','residential','service','unclassified','pedestrian','footway','path'] else None
  if not kind:continue
  if kind=='road':
   # Racing lanes remain authoritative; external roads never cover the game road.
   line=LineString(xz).simplify(1);typ=tags['highway'];width=3 if typ in ['path','footway'] else 4 if typ=='service' else 7 if typ in ['residential','unclassified','pedestrian'] else 10 if typ in ['secondary','tertiary'] else 14
   if line.length>8:features.append({'kind':kind,'name':tags.get('name',''),'points':np.array(line.coords).round(2).tolist(),'width':width,'id':int(w.attrib['id'])})
  elif refs[0]==refs[-1] and len(xz)>3:
   poly=Polygon(xz).buffer(0).simplify(1)
   for poly in get_parts(poly):
    if poly.geom_type=='Polygon' and poly.area>30:features.append({'kind':kind,'name':tags.get('name',''),'points':np.array(poly.exterior.coords)[:-1].round(2).tolist(),'id':int(w.attrib['id'])})
 # Multipolygon outer rings are needed for large reservoirs/forests, often absent as closed ways.
 for rel in root.findall('relation'):
  tags={x.attrib['k']:x.attrib['v'] for x in rel.findall('tag')};kind='water' if tags.get('natural')=='water' else 'forest' if tags.get('natural')=='wood' or tags.get('landuse')=='forest' else None
  if not kind:continue
  segments=[LineString(ways[m.attrib['ref']][0]) for m in rel.findall('member') if m.attrib.get('type')=='way' and m.attrib.get('role')=='outer' and m.attrib['ref'] in ways]
  if not segments:continue
  for poly in polygonize(union_all(segments)):
   poly=poly.simplify(1)
   if poly.area>100:features.append({'kind':kind,'name':tags.get('name',''),'points':np.array(poly.exterior.coords)[:-1].round(2).tolist(),'id':int(rel.attrib['id'])})
 # Reconstruct the water side of mapped coastlines. OSM has land on its left in lon/lat;
 # the north-to-negative-z transform mirrors that, so the water is on the left here.
 if coasts:
  bb=root.find('bounds').attrib
  region=Polygon(togame(np.array([[float(bb[x]),float(bb[y])] for x,y in [('minlon','minlat'),('maxlon','minlat'),('maxlon','maxlat'),('minlon','maxlat')]])))
  clipped=union_all(coasts).intersection(region)
  polygons=list(polygonize(union_all([region.boundary,clipped])))
  samples=[];landSamples=[]
  for line in coasts:
   pts=np.array(line.coords)
   for a,b in zip(pts[:-1],pts[1:]):
    v=b-a;ln=np.linalg.norm(v)
    if ln>2:
     normalWater=np.array([-v[1],v[0]])/ln
     samples.append((a+b)/2+normalWater*2);landSamples.append((a+b)/2-normalWater*2)
  for poly in polygons:
   wet=sum(poly.contains(Point(p)) for p in samples);dry=sum(poly.contains(Point(p)) for p in landSamples)
   if poly.area>100 and wet>dry and sum(poly.contains(Point(p)) for p in q)<5:
    features.append({'kind':'water','name':'Mapped coastline','points':np.array(poly.simplify(.2).exterior.coords)[:-1].round(2).tolist(),'id':-1})
 for f in features:
  if f['kind']=='water':f['waterHeight']=float(-offset+.12 if f['id']==-1 else np.median(dem(np.array(f['points'])))-offset+.08)
 corridor=union_all([Polygon([left[i],right[i],right[(i+1)%n],left[(i+1)%n]]).buffer(0) for i in range(n)])
 pit=json.loads((U/'src/pit-lanes.json').read_text())[ident];pitpath=LineString(np.column_stack([pit['x'],pit['z']]));corridor=union_all([corridor,pitpath.buffer(pit['width']/2+.04)])
 water=union_all([Polygon(f['points']).buffer(0) for f in features if f['kind']=='water']);excluded=union_all([corridor,water])
 step=60;lo=np.floor((q.min(0)-700)/step).astype(int);hi=np.ceil((q.max(0)+700)/step).astype(int);vertices=[]
 for gx in range(lo[0],hi[0]):
  for gz in range(lo[1],hi[1]):
   cell=box(gx*step,gz*step,(gx+1)*step,(gz+1)*step).difference(excluded)
   for tri in constrained_delaunay_triangles(cell).geoms:
    p=np.array(tri.exterior.coords)[:3];v=np.column_stack([p[:,0],height(p),p[:,1]])
    if np.cross(v[1]-v[0],v[2]-v[0])[1]<0:v=v[[0,2,1]]
    vertices.extend(v.ravel())
 arr=np.array(vertices,dtype='<f4');d['elevation']['terrain']=base64.b64encode(arr.tobytes()).decode()
 # Far landscape uses a compact height grid; near terrain replaces its central rectangle.
 count=161;xx=np.linspace(*bounds[:,0],count);zz=np.linspace(*bounds[:,1],count);X,Z=np.meshgrid(xx,zz);points=np.column_stack([X.ravel(),Z.ravel()]);heights=height(points).astype('<f4');assert np.isfinite(heights).all()
 old=json.loads((U/'src/geographic-data.json').read_text()).get(ident,{}) if (U/'src/geographic-data.json').exists() else {}
 result[ident]={**old,'count':count,'bounds':bounds.tolist(),'nearBounds':[(lo*step).tolist(),(hi*step).tolist()],'height':base64.b64encode(heights.tobytes()).decode(),'datumOffset':offset,'transform':tr,'features':features,'source':'Mapzen Terrain Tiles / OpenStreetMap','sourceZoom':12}
 reports.append({'circuit':ident,'demTiles':len(requests),'heightRangeMetres':[float(heights.min()),float(heights.max())],'nearTerrainTriangles':len(arr)//9,'farGrid':count,'features':{k:sum(f['kind']==k for f in features) for k in ['water','forest','sand','grass','field','paved','road']},'verticalDatumOffset':offset});print(reports[-1],flush=True)
 (U/'src/world-tour-data.json').write_text(json.dumps(tour,separators=(',',':')),encoding='utf-8')
 existing=json.loads((U/'src/geographic-data.json').read_text()) if (U/'src/geographic-data.json').exists() else {};existing.update(result);(U/'src/geographic-data.json').write_text(json.dumps(existing,separators=(',',':')),encoding='utf-8')
 (U/'qa/geographic-terrain.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')

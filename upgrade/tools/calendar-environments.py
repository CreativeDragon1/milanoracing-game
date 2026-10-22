"""Bake mapped surface boundaries and planting across the complete real calendar.

OSM supplies horizontal alignments, not a survey. Every overlay is intersected
with the existing terrain/runoff triangles so it cannot float or bridge a valley.
The racing surface, pits, buildings and water are excluded before triangulation.
"""
from pathlib import Path
import sys,json,base64,xml.etree.ElementTree as ET
import numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0,str(Path(__file__).parent/'deps'))
from shapely import Polygon,LineString,Point,union_all,constrained_delaunay_triangles,get_parts
from shapely.strtree import STRtree
U=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((U/p).read_text(encoding='utf-8'))
tour=load('src/world-tour-data.json');trans=load('src/geographic-transforms.json');geo=load('src/geographic-data.json');mapped=load('src/venue-map-data.json');pits=load('src/pit-lanes.json')
out={};reports=[]
for ident,tr in trans.items():
 d=tour[ident];n=d['N'];q=np.column_stack([d['x'],d['z']]);normal=np.column_stack([-np.array(d['tz']),d['tx']]);tree=cKDTree(q)
 half=[np.array(d.get('widthLeft',[d['width']/2]*n)),np.array(d.get('widthRight',[d['width']/2]*n))];y=np.array(d['elevation']['height']);bank=np.array(d['bank'])
 road=union_all([Polygon([q[i]-normal[i]*(half[0][i]+1.7),q[i]+normal[i]*(half[1][i]+1.7),q[(i+1)%n]+normal[(i+1)%n]*(half[1][(i+1)%n]+1.7),q[(i+1)%n]-normal[(i+1)%n]*(half[0][(i+1)%n]+1.7)]).buffer(0) for i in range(n)])
 pit=pits[ident];pitPoly=LineString(np.column_stack([pit['x'],pit['z']])).buffer(pit['width']/2+1)
 buildings=union_all([Polygon(f['footprint']).buffer(.6) for f in mapped[ident] if f['kind']=='building' and len(f['footprint'])>=3])
 water=union_all([Polygon(f['points']).buffer(.5) for f in geo[ident]['features'] if f['kind']=='water' and len(f['points'])>=3])
 excluded=union_all([road,pitPoly,buildings,water]);region=LineString(np.vstack([q,q[0]])).buffer(650)
 terrain=np.frombuffer(base64.b64decode(d['elevation']['terrain']),dtype='<f4').reshape(-1,3,3).astype(float)
 extra=[]
 for side,h,run in [(-1,half[0],d['runoffLeft']),(1,half[1],d['runoffRight'])]:
  for i in range(n):
   j=(i+1)%n;v=[]
   for k,a in [(i,h[i]+1.5),(i,h[i]+run[i]),(j,h[j]+run[j]),(j,h[j]+1.5)]:
    o=side*a;v.append([q[k,0]+normal[k,0]*o,y[k]-o*np.tan(bank[k]),q[k,1]+normal[k,1]*o])
   extra.extend([[v[0],v[1],v[2]],[v[0],v[2],v[3]]])
 terrain=np.concatenate([terrain,np.array(extra)]);triPolys=[Polygon(v[:,[0,2]]) for v in terrain];spatial=STRtree(triPolys)
 root=ET.parse(U/f'research/osm/{ident}-map.osm').getroot()
 def point(e):
  a=(np.array([float(e.get('lon')),float(e.get('lat'))])-tr['origin'])*tr['unit'];return (a@np.array(tr['rotation'])*tr['scale']+tr['translation']).tolist()
 nodes={e.get('id'):point(e) for e in root.findall('node')};records=[];rows=[];hedges=[];bleachers=[];trees=[]
 for w in root.findall('way'):
  tags={e.get('k'):e.get('v') for e in w.findall('tag')};refs=[e.get('ref') for e in w.findall('nd')]
  if len(refs)<2 or any(r not in nodes for r in refs):continue
  p=[nodes[r] for r in refs];closed=refs[0]==refs[-1];wid=int(w.get('id'));name=tags.get('name:en',tags.get('name',''))
  line=LineString(p)
  if not line.intersects(region):continue
  if tags.get('natural')=='tree_row':rows.append({'id':wid,'points':p,'species':tags.get('genus',tags.get('leaf_type',''))})
  if tags.get('barrier') in ['hedge','retaining_wall','guard_rail'] and ident!='monaco':hedges.append({'id':wid,'points':p,'type':tags['barrier']})
  if tags.get('leisure')=='bleachers' and closed and not tags.get('building'):bleachers.append({'id':wid,'name':name,'footprint':p[:-1]})
  if tags.get('highway')=='raceway' and not any(k.startswith('disused') or k.startswith('abandoned') for k in tags):
   poly=line.buffer(float(tags.get('width','6').split()[0])*.5 if tags.get('width','6').split()[0].replace('.','',1).isdigit() else 3,cap_style=2,join_style=2).intersection(region).difference(excluded)
   if poly.area>20:records.append((wid,name or 'Supporting motorsport route','asphalt',poly))
  if not closed or tags.get('building') or tags.get('building:part'):continue
  kind='gravel' if tags.get('natural')=='shingle' or tags.get('surface') in ['gravel','fine_gravel'] else 'sand' if tags.get('natural') in ['sand','beach'] else 'asphalt' if tags.get('amenity')=='parking' or tags.get('aeroway') in ['apron','runway','taxiway'] or (tags.get('area')=='yes' and tags.get('surface') in ['asphalt','paved','concrete']) else 'lawn' if tags.get('landuse')=='grass' or tags.get('leisure') in ['garden','pitch'] else 'meadow' if tags.get('landuse') in ['meadow','recreation_ground'] or tags.get('natural')=='grassland' else 'scrub' if tags.get('natural')=='scrub' else None
  if kind=='sand' and ident in ['monza','silverstone','suzuka'] and line.distance(LineString(np.vstack([q,q[0]])))<160:kind='gravel'
  if not kind:continue
  poly=Polygon(p).buffer(0).intersection(region).difference(excluded)
  if poly.area<12:continue
  records.append((wid,name,kind,poly))
 for e in root.findall('node'):
  tags={t.get('k'):t.get('v') for t in e.findall('tag')}
  if tags.get('natural')=='tree':trees.append([*nodes[e.get('id')],8+int(e.get('id'))%7])
 chunks={};source=[];occupied=Polygon();priority={'gravel':0,'asphalt':1,'sand':2,'lawn':3,'meadow':4,'scrub':5}
 for wid,name,kind,poly in sorted(records,key=lambda r:priority[r[2]]):
  poly=poly.difference(occupied)
  if poly.area<12:continue
  occupied=union_all([occupied,poly]);count=0
  for ti in spatial.query(poly,predicate='intersects'):
   tri=terrain[ti];clip=triPolys[ti].intersection(poly)
   if clip.area<.02:continue
   a,b,c=tri;den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
   if abs(den)<1e-8:continue
   for part in constrained_delaunay_triangles(clip).geoms:
    v=[]
    for x,z in list(part.exterior.coords)[:3]:
     u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;w=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
     v.append([x,u*a[1]+w*b[1]+(1-u-w)*c[1]+.045,z])
    v=np.array(v)
    if np.cross(v[1]-v[0],v[2]-v[0])[1]<0:v=v[[0,2,1]]
    key=(kind,int(v[:,0].mean()//240),int(v[:,2].mean()//240));chunks.setdefault(key,[]).extend(v.ravel());count+=1
  source.append({'id':wid,'name':name,'kind':kind,'area':round(poly.area),'triangles':count})
 # Mapped forest edges get real planting instead of random sparse trees in open fields.
 rng=np.random.default_rng(2917);forest=[]
 for f in geo[ident]['features']:
  if f['kind']=='forest' and len(f['points'])>=3:forest.append(Polygon(f['points']).buffer(0))
 forest=union_all(forest).intersection(LineString(np.vstack([q,q[0]])).buffer(420)).difference(excluded.buffer(8))
 if not forest.is_empty:
  lo,zo,hi,zi=forest.bounds;spacing=11 if ident in ['monza','spa','suzuka','austria'] else 16
  for x in np.arange(lo,hi,spacing):
   for z in np.arange(zo,zi,spacing):
    p=np.array([x,z])+rng.uniform(-3,3,2)
    if forest.contains(Point(p)) and tree.query(p)[0]>max(d['width']/2+15,25):trees.append([*p,10+rng.random()*8])
 # Spacing along source tree rows, with no invented avenue locations.
 for row in rows:
  line=LineString(row['points'])
  for s in np.arange(0,line.length,9):
   p=line.interpolate(s);trees.append([p.x,p.y,7.5+(row['id']%4)])
 clean=[];used=set();safe=excluded.buffer(5)
 for x,z,h in trees:
  key=(round(x/6),round(z/6))
  if key in used or not region.contains(Point(x,z)) or safe.contains(Point(x,z)):continue
  used.add(key);clean.append([round(x,2),round(z,2),round(h,2)])
 out[ident]={'tiles':[{'kind':k[0],'tile':list(k[1:]),'positions':base64.b64encode(np.array(v,dtype='<f4').tobytes()).decode()} for k,v in chunks.items()], 'sources':source,'planting':clean,'treeRows':rows,'boundaries':hedges,'bleachers':bleachers,'note':'OSM alignments; existing terrain-conforming surfaces. Plant species and furniture dimensions reconstructed. No surveyed-replica claim.'}
 reports.append({'id':ident,'mappedSurfaceAreas':len(source),'surfaceTriangles':sum(len(v)//9 for v in chunks.values()),'tiles':len(chunks),'mappedPlanting':len(clean),'boundaries':len(hedges),'bleachers':len(bleachers),'roadOverlapArea':round(occupied.intersection(road).area,8)})
 print(reports[-1],flush=True)
(U/'src/calendar-environments-data.json').write_text(json.dumps(out,separators=(',',':')),encoding='utf-8')
(U/'qa/calendar-environments.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')

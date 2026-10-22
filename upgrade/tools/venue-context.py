"""Select major venue structures and connecting infrastructure from cached OSM.
Positions use the circuit's existing least-squares geographic registration.
No network access; source attribution and way/node IDs travel with each feature.
"""
from pathlib import Path
import json,math,re,sys,xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0,str(Path(__file__).parent/'deps'))
from shapely.geometry import Polygon
from shapely import constrained_delaunay_triangles
U=Path('upgrade');transforms=json.loads((U/'src/geographic-transforms.json').read_text());mapped=json.loads((U/'src/venue-map-data.json').read_text(encoding='utf-8'))
SELECT={
 'monaco':[(r'^Monte-Carlo Casino and Opera House$','casino'),(r'^Fairmont$','fairmont'),(r'^Hôtel de Paris$','paris'),(r'^Hermitage$','hermitage'),(r'^Café de Paris$','cafe'),(r'^La Rascasse$','rascasse'),(r'^Chapelle Sainte-Dévote$','chapel'),(r'^Yacht Club de Monaco$','yachtclub'),(r'^Prince.s Palace of Monaco$','palace'),(r'Musée océanographique|^Oceanographic Museum','oceanographic')],
 'singapore':[(r'^Old City Hall$','cityhall'),(r'^Old Supreme Court$','supreme-court'),(r'^Singapore Cricket Club$','cricket'),(r'^Singapore Recreation Club$','recreation'),(r"^Saint Andrew.s Cathedral$",'cathedral'),(r'^Swissôtel The Stamford$','swissotel'),(r'^Pan Pacific( Singapore)?$','panpacific'),(r'^The Ritz-Carlton, Millenia Singapore$','ritz'),(r'^Mandarin Oriental','mandarin'),(r'^ArtScience Museum$','lotus'),(r'^F1 Pit Building$','singapore-pit'),(r'^Civilian War Memorial$','memorial'),(r'^Merlion Fountain$','merlion')],
 'silverstone':[(r'^Hilton Garden Inn','hilton'),(r'^BRDC Clubhouse$','brdc'),(r'^Silverstone Museum$','museum')],
 'bahrain':[(r'^(Main|First Turn|University|Victory) Grandstand','bahrain-stand')],
 'austria':[(r'^Start/Ziel Tribüne$','austria-wing')],
 'spa':[(r'^Tribune Endurance$','endurance'),(r'^Stand Endurance$','endurance-pit'),(r"^Hôtel de la Source$",'source-hotel'),(r"^Hotel de l.Eau Rouge$",'eau-rouge-hotel')],
 'abu-dhabi':[(r'^W Hotel Abu Dhabi$','yas-hotel'),(r'^Main Grandstand$','yas-stand'),(r'^Marina Grandstand$','yas-stand'),(r'^South Grandstand$','yas-stand'),(r'^Ferrari World','ferrariworld')],
 'suzuka':[(r'^Circuit Wheel$|大観覧車|サーキットホイール','wheel'),(r'^Suzuka Circuit Hotel$','suzuka-hotel')],
 'interlagos':[], 'zandvoort':[(r'^Hoofdtribune$','zandvoort-stand')], 'monza':[(r'^Podio$','podium'),(r'^Hospitality Building$','monza-hospitality')]
}
def inside(p,poly):
 x,y=p;ok=False
 for a,b in zip(poly,poly[1:]+poly[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:ok=not ok
 return ok
def centre(poly):return [sum(p[j] for p in poly)/len(poly) for j in [0,1]]
def area(poly):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1]))/2)
def distance(p,poly):
 if inside(p,poly):return 0
 ds=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  dx=b[0]-a[0];dz=b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/max(1e-9,dx*dx+dz*dz)))
  ds.append(math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t))
 return min(ds)
out={}
for ident,tr in transforms.items():
 root=ET.parse(U/f'research/osm/{ident}-map.osm').getroot()
 def point(lon,lat):
  x=(float(lon)-tr['origin'][0])*tr['unit'][0];z=(float(lat)-tr['origin'][1])*tr['unit'][1];r=tr['rotation']
  return [round((x*r[0][j]+z*r[1][j])*tr['scale']+tr['translation'][j],2) for j in [0,1]]
 nodes={int(e.get('id')):point(e.get('lon'),e.get('lat')) for e in root.findall('node')};ways={};tagged=[]
 for e in root:
  if e.tag not in ['node','way','relation']:continue
  tags={t.get('k'):t.get('v') for t in e.findall('tag')};name=tags.get('name:en',tags.get('name',''));eid=int(e.get('id'))
  if e.tag=='way':
   pts=[nodes[int(nd.get('ref'))] for nd in e.findall('nd') if int(nd.get('ref')) in nodes]
   if len(pts)>2 and pts[0]==pts[-1]:pts.pop()
   refs=e.findall('nd');closed=len(refs)>2 and refs[0].get('ref')==refs[-1].get('ref')
   ways[eid]={'id':eid,'name':name,'tags':tags,'points':pts,'closed':closed}
  if tags:tagged.append((e,tags,name))
 # Multipolygon building outlines often have no tags on the outer way itself.
 for e,tags,name in tagged:
  if e.tag!='relation' or not tags.get('building'):continue
  holes=[ways[int(m.get('ref'))]['points'] for m in e.findall('member') if m.get('type')=='way' and m.get('role')=='inner' and int(m.get('ref')) in ways]
  for m in e.findall('member'):
   if m.get('type')=='way' and m.get('role') in ['outer','outline'] and int(m.get('ref')) in ways:
    w=ways[int(m.get('ref'))];w['tags']={**tags,**w['tags']};w['name']=w['name'] or name;w['holes']=holes
 buildings=[w for w in ways.values() if (w['tags'].get('building') or w['tags'].get('building:part')) and w['tags'].get('building')!='roof' and len(w['points'])>=3]
 features=[];seen=set()
 for pattern,kind in SELECT.get(ident,[]):
  for e,tags,name in tagged:
   if not re.search(pattern,name,re.I) or tags.get('highway') or tags.get('public_transport') or tags.get('monitoring:weather') or tags.get('type') in ['boundary','route','route_master','public_transport'] or tags.get('amenity') in ['bicycle_rental','parking','parking_entrance']:continue
   f=None;eid=int(e.get('id'))
   if e.tag=='way':
    f=ways[eid]
    if not (f['tags'].get('building') or f['tags'].get('building:part')) and kind not in ['memorial','merlion','wheel']:continue
   elif e.tag=='node':
    p=nodes[eid]
    if kind in ['memorial','merlion','wheel']:f={'id':eid,'points':[p]}
    else:
     candidates=sorted(buildings,key=lambda w:(0 if tags.get('wikidata') and w['tags'].get('wikidata')==tags['wikidata'] else 1,distance(p,w['points']),-area(w['points'])))
     if candidates and distance(p,candidates[0]['points'])<35:f=candidates[0]
   elif e.tag=='relation':
    if not tags.get('building') and tags.get('type')!='building':continue
    members=[ways[int(m.get('ref'))] for m in e.findall('member') if m.get('type')=='way' and m.get('role') in ['outline','outer'] and int(m.get('ref')) in ways]
    if not members:members=[ways[int(m.get('ref'))] for m in e.findall('member') if m.get('type')=='way' and m.get('role')=='part' and int(m.get('ref')) in ways]
    if members:f=max(members,key=lambda w:area(w['points']))
   if not f or len(f['points'])<1 or f['id'] in seen:continue
   seen.add(f['id']);existing=next((v for v in mapped[ident] if v['id']==f['id']),None)
   record={'id':f['id'],'sourceId':eid,'name':name,'type':kind,'footprint':(existing or {}).get('footprint',f['points']),'tags':f.get('tags',tags),'source':'https://www.openstreetmap.org/'+('node' if len(f['points'])==1 else 'way')+'/'+str(f['id'])}
   if existing:record['mappedHeight']=existing['height']
   record['holes']=f.get('holes',[])
   if len(record['footprint'])>=3:
    plan=Polygon(record['footprint'],record['holes']).buffer(0)
    roofInner=plan.buffer(-3,join_style=2)
    roof=[]
    for part,high in [(plan.difference(roofInner),False),(roofInner,True)]:
     for tri in constrained_delaunay_triangles(part).geoms:
      for x,z in list(tri.exterior.coords)[:3]:
       roof.append([round(x,3),round(z,3),1.8 if high else (0 if plan.boundary.distance(__import__('shapely').Point(x,z))<.05 else 1.8)])
    record['roofMesh']=roof
   features.append(record)
 infrastructure=[]
 for w in ways.values():
  t=w['tags'];kind=None
  if t.get('man_made')=='pier':kind='pier'
  if t.get('waterway')=='dock':kind='dock'
  if t.get('man_made') in ['quay','breakwater'] or t.get('barrier')=='sea_wall' or ident=='monaco' and t.get('natural')=='coastline':kind='quay'
  if t.get('leisure')=='swimming_pool' and area(w['points'])>600:kind='pool'
  if t.get('highway') and t.get('bridge')=='yes' and not t.get('tunnel') and t['highway'] not in ['steps']:kind='bridge'
  if ident=='monza' and (t.get('historic')=='raceway' or t.get('disused:highway')=='raceway' or 'sopraelevat' in w['name'].lower()):kind='banking'
  if ident=='suzuka' and t.get('attraction') in ['roller_coaster','ferris_wheel']:kind=t['attraction']
  if kind and len(w['points'])>1:infrastructure.append({'id':w['id'],'type':kind,'name':w['name'],'points':w['points'],'closed':w['closed'],'tags':t})
 # An authored outer envelope replaces its interior mapped building parts too.
 # Keeping both produces flickering facades and roof slabs inside courtyards.
 replacements=[]
 for f in features:
  if len(f['footprint'])<3:continue
  for b in mapped[ident]:
   if b['id']==f['id']:continue
   if all(inside(p,f['footprint']) for p in b['footprint']) and not any(inside(centre(b['footprint']),h) for h in f.get('holes',[])):replacements.append(b['id'])
 out[ident]={'structures':features,'infrastructure':infrastructure,'replacedParts':sorted(set(replacements))}
 print(ident,[(f['id'],f['name'],f['type']) for f in features],len(infrastructure),'infrastructure features')
(U/'src/venue-context-data.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False),encoding='utf-8')

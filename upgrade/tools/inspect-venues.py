from pathlib import Path
import json,sys,xml.etree.ElementTree as ET,re
sys.stdout.reconfigure(encoding='utf-8')
U=Path('upgrade');mapped=json.loads((U/'src/venue-map-data.json').read_text(encoding='utf-8'))
pattern=re.compile(r'fairmont|h.tel|hotel|tribun|grandstand|wing|pit|boxes|stand |anderson|national gallery|merlion|swiss|pacific|marina|caf.|rass|church|casino|pool|pisc|palais|control|tower|welcome|bull|endurance|conrad|ritz|hermit|ferrari|arts|cricket|stamford|padang|esplanade|bridge|pavilion|wheel|circuit|opera|louis|sainte|rascasse|yacht',re.I)
report={}
for ident in sys.argv[1:] or mapped:
 xml=ET.parse(U/f'research/osm/{ident}-map.osm').getroot();records=[]
 for e in xml:
  tags={t.get('k'):t.get('v') for t in e.findall('tag')};name=tags.get('name:en',tags.get('name',''))
  if tags.get('type') in ['route','route_master'] or tags.get('public_transport') or tags.get('bus')=='yes':continue
  if pattern.search(name) or tags.get('leisure') in ['swimming_pool','marina'] or tags.get('building')=='grandstand' or tags.get('bridge') or tags.get('attraction')=='ferris_wheel':
   records.append({'id':int(e.get('id')),'element':e.tag,'name':name,'tags':tags,'inBuild':any(f['id']==int(e.get('id')) for f in mapped[ident])})
 report[ident]=records
 print(ident, len(mapped[ident]),'mapped objects')
 for r in records:
  if r['element']=='way' and r['tags'].get('building') or r['tags'].get('attraction')=='ferris_wheel':print(r['id'],r['element'],r['name'], 'BUILT' if r['inBuild'] else 'missing')
(U/'qa/venue-source-inventory.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')

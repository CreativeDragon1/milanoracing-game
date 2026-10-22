from pathlib import Path
import json,sys,xml.etree.ElementTree as ET
sys.path.insert(0,str(Path('upgrade/tools/deps').resolve()))
from shapely.geometry import Polygon
sys.stdout.reconfigure(encoding='utf-8')
data=json.loads(Path('upgrade/src/venue-context-data.json').read_text(encoding='utf-8'))
for ident in sys.argv[1:] or ['monaco','singapore','austria','interlagos']:
 print('\n',ident)
 for f in data[ident]['structures']:
  if len(f['footprint'])<3:continue
  p=Polygon(f['footprint']);print(f['id'],f['name'],round(p.area),p.bounds)
 root=ET.parse(f'upgrade/research/osm/{ident}-map.osm').getroot()
 if ident in ['austria','interlagos']:
  for e in root:
   t={v.get('k'):v.get('v') for v in e.findall('tag')}
   if t.get('building') or t.get('building:part'):
    if t.get('name') or ident=='austria' and e.tag=='way':print(e.tag,e.get('id'),t)

"""Copy reusable, licensed source assets into the independent native project."""
from pathlib import Path
import json,shutil,wave,hashlib,base64
ROOT=Path(__file__).resolve().parents[2];U=ROOT/'upgrade';G=ROOT/'native-desktop/game';A=G/'assets'
for directory in ['vegetation','audio','surfaces','fonts']: (A/directory).mkdir(parents=True,exist_ok=True)
for p in (U/'assets/tree-small-02/textures').glob('*1k.jpg'):shutil.copy2(p,A/'vegetation'/p.name)
for p in (U/'assets/tree-small-02').glob('canopy-*.png'):shutil.copy2(p,A/'vegetation'/p.name)
shutil.copy2(U/'src/tree-model.json',A/'vegetation/model.json')
for p in (U/'assets').glob('*.jpg'):
 if not p.name.startswith(('lawn-','turf-','sand-fine-','asphalt-fine-','rock-ground-','palm-bark-')):shutil.copy2(p,A/'surfaces'/p.name)
for prefix,kinds in [('asphalt-fine',['color','normal','rough']),('lawn',['color','normal']),('sand-fine',['color','normal']),('palm-bark',['color','normal','rough'])]:
 for kind in kinds:
  p=U/'assets'/f'{prefix}-{kind}.webp';shutil.copy2(p,A/'surfaces'/p.name)
shutil.copy2(U/'assets/zandvoort-dune-cover.png',A/'surfaces/zandvoort-dune-cover.png')
for name in ['Barlow-Bold.ttf','Barlow-ExtraBoldItalic.ttf','Michroma.ttf','DM-Sans.ttf']:
 shutil.copy2(U/'assets/fonts'/name,A/'fonts'/name)
shutil.copy2(U/'vendor/team-logo.png',A/'team-logo.png')
shutil.copy2(U/'assets/livery/manifest.json',A/'livery-manifest.json')
data=json.loads((U/'src/world-tour-data.json').read_text(encoding='utf-8'))
for d in data.values():d['elevation'].pop('terrain',None)
(G/'circuits/physics.json').write_text(json.dumps(data,separators=(',',':')))
shutil.copy2(U/'src/pit-lanes.json',G/'circuits/pits.json')
bank=json.loads((U/'vendor/work/audio-assets/v10-bank.json').read_text())
with wave.open(str(U/'vendor/work/audio-assets/v10-bank.wav')) as stream:
 params=stream.getparams();raw=stream.readframes(params.nframes)
 for part in bank['layers']:
  with wave.open(str(A/'audio'/(part['name']+'.wav')),'wb') as out:
   out.setparams(params);out.writeframes(raw[part['start']*2:(part['start']+part['frames'])*2])
(A/'audio/bank.json').write_text(json.dumps(bank,indent=2))
shutil.copytree(U/'licenses',ROOT/'native-desktop/licenses',dirs_exist_ok=True)
print('Prepared native materials, geometry, telemetry, font, branding and V10 audio assets.')
geography=json.loads((U/'src/geographic-data.json').read_text())
for ident,g in geography.items():
 for key in ['satellite','cover']:
  mime,encoded=g[key].split(',',1);suffix='.jpg' if 'jpeg' in mime else '.png'
  filename=ident+'-'+key+suffix;(A/'surfaces'/filename).write_bytes(base64.b64decode(encoded));g[key]='res://assets/surfaces/'+filename
 g.pop('height',None);g.pop('features',None)
(G/'circuits/geography.json').write_text(json.dumps(geography,indent=2))

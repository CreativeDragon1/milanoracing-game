"""Feather mapped natural land-cover boundaries into a material weight map."""
from pathlib import Path
import json,base64
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
U=Path(__file__).resolve().parents[1]
g=json.loads((U/'src/geographic-data.json').read_text())['zandvoort']
tiles=json.loads((U/'src/calendar-environments-data.json').read_text())['zandvoort']['tiles']
b=np.array(g['nearBounds']);size=1024
mask=Image.new('L',(size,size),35);draw=ImageDraw.Draw(mask)
values={'sand':0,'scrub':115,'meadow':175,'lawn':235}
for tile in tiles:
 if tile['kind'] not in values:continue
 p=np.frombuffer(base64.b64decode(tile['positions']),dtype='<f4').reshape(-1,3,3)[:,:,[0,2]]
 p=(p-b[0])/(b[1]-b[0])*(size-1)
 for tri in p:draw.polygon([tuple(v) for v in tri],fill=values[tile['kind']])
# Natural grass and sand mingle over metres; paved boundaries remain separate meshes.
mask=mask.filter(ImageFilter.GaussianBlur(2.4))
mask.save(U/'assets/zandvoort-dune-cover.png')
print('Baked mapped coastal material mask:',size,size)

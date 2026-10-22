from pathlib import Path
import json,base64,urllib.request,time,io
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import map_coordinates
U=Path('upgrade');path=U/'src/geographic-data.json';data=json.loads(path.read_text());cache=U/'research/terrain/imagery';cache.mkdir(exist_ok=True)
for ident,g in data.items():
 tr=g['transform'];R=np.array(tr['rotation']);T=np.array(tr['translation']);unit=np.array(tr['unit']);origin=np.array(tr['origin']);size=2048;lo,hi=np.array(g['bounds']);x=np.linspace(lo[0],hi[0],size);z=np.linspace(lo[1],hi[1],size);X,Z=np.meshgrid(x,z);xz=np.column_stack([X.ravel(),Z.ravel()]);ll=(xz-T)@R.T/tr['scale']/unit+origin;lon,lat=ll.T;tiles=np.column_stack([(lon+180)/360*4096,(1-np.arcsinh(np.tan(np.radians(lat)))/np.pi)/2*4096]);tl=np.floor(tiles.min(0)).astype(int);br=np.floor(tiles.max(0)).astype(int);mosaic=np.zeros(((br[1]-tl[1]+1)*256,(br[0]-tl[0]+1)*256,3),dtype=np.uint8)
 for tx in range(tl[0],br[0]+1):
  for ty in range(tl[1],br[1]+1):
   p=cache/f'2016-12-{tx}-{ty}.jpg'
   if not p.exists():
    p.write_bytes(urllib.request.urlopen(f'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/12/{ty}/{tx}.jpg',timeout=30).read());time.sleep(.16)
   im=np.array(Image.open(p).convert('RGB'));mosaic[(ty-tl[1])*256:(ty-tl[1]+1)*256,(tx-tl[0])*256:(tx-tl[0]+1)*256]=im
 pix=(tiles-tl)*256-.5;col=np.stack([map_coordinates(mosaic[:,:,c],[pix[:,1],pix[:,0]],order=1,mode='nearest') for c in range(3)],axis=1).reshape(size,size,3)
 # Colour only: retain physical normals and macro terrain. No baked map labels.
 image=Image.fromarray(col);out=io.BytesIO();image.save(out,format='JPEG',quality=88);g['satellite']='data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
 image.save(U/f'qa/{ident}-geographic-colour.jpg',quality=85)
 lo,hi=np.array(g['nearBounds']);image=Image.new('RGBA',(2048,2048),(0,0,0,0));draw=ImageDraw.Draw(image)
 palette={'forest':(56,78,43,230),'grass':(116,130,79,210),'field':(151,140,89,230),'sand':(187,169,132,225),'paved':(99,102,104,245),'road':(95,98,100,255),'water':(46,91,110,250)}
 for kind in ['grass','field','forest','sand','paved','road','water']:
  for f in g['features']:
   if f['kind']!=kind:continue
   pts=[tuple(v) for v in ((np.array(f['points'])-lo)/(hi-lo)*2048)]
   if kind=='road':draw.line(pts,fill=palette[kind],width=max(1,round(f['width']/(hi[0]-lo[0])*2048)),joint='curve')
   else:draw.polygon(pts,fill=palette[kind])
 out=io.BytesIO();image.save(out,format='PNG',optimize=True);g['cover']='data:image/png;base64,'+base64.b64encode(out.getvalue()).decode();g['imageryVintage']='2016 / 2017';path.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8');print(ident,'satellite and mapped land use baked',flush=True)

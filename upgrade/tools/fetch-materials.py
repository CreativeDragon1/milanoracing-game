from pathlib import Path
import json,subprocess,concurrent.futures
R=Path(__file__).resolve().parents[2];D=R/'upgrade/assets';D.mkdir(exist_ok=True)
files=json.loads((R/'upgrade/vendor/work/graphics-assets/asphalt-track-files.json').read_text())
jobs=[(files[k]['2k']['jpg']['url'],D/name) for k,name in [('Diffuse','asphalt-color.jpg'),('nor_gl','asphalt-normal.jpg'),('Rough','asphalt-rough.jpg')]] if 'nor_gl' in files else []
if not jobs:
 for k in files:
  if k.lower() in ('diffuse','nor_gl','rough'):
   jobs.append((files[k]['2k']['jpg']['url'],D/({'diffuse':'asphalt-color.jpg','nor_gl':'asphalt-normal.jpg','rough':'asphalt-rough.jpg'}[k.lower()])))
for a in ['aerial_grass_rock','sandy_gravel']:
 meta=D/(a+'.json');subprocess.run(['curl.exe','-fsSL','--max-time','30','https://api.polyhaven.com/files/'+a,'-o',str(meta)],capture_output=True)
 if meta.exists():
  f=json.loads(meta.read_text())
  for k,name in [('Diffuse','color'),('nor_gl','normal'),('Rough','rough')]:
   if k in f and '1k' in f[k] and 'jpg' in f[k]['1k']:jobs.append((f[k]['1k']['jpg']['url'],D/(a+'-'+name+'.jpg')))
def get(j):
 url,path=j
 if path.exists():return
 subprocess.run(['curl.exe','-fsSL','--max-time','90',url,'-o',str(path)],check=True,capture_output=True);print(path.name,path.stat().st_size,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(get,jobs))
(D/'sources.json').write_text(json.dumps([{'url':url,'file':p.name,'license':'CC0 / Poly Haven'} for url,p in jobs],indent=2))

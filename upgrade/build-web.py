"""Modular hosted build with immutable cache assets and installable application shell."""
from pathlib import Path
import re,base64,hashlib,gzip,json,shutil
from PIL import Image
U=Path(__file__).resolve().parent;R=U.parent;P=U/'server/public';A=P/'assets';A.mkdir(parents=True,exist_ok=True)
extensions={'image/png':'png','image/jpeg':'jpg','application/octet-stream':'hdr','font/ttf':'ttf','audio/wav':'wav'};used=[]
def save(data,ext):
 name=hashlib.sha256(data).hexdigest()[:20]+'.'+ext;(A/name).write_bytes(data);used.append(name)
 if ext in ['js','css','ttf','hdr','wav']:(A/(name+'.gz')).write_bytes(gzip.compress(data,compresslevel=7,mtime=0));used.append(name+'.gz')
 return '/assets/'+name
html=(U/'qa/standalone.html').read_text(encoding='utf-8')
html=re.sub(r'data:('+ '|'.join(re.escape(k) for k in extensions)+r');base64,([A-Za-z0-9+/=]+)',lambda m:save(base64.b64decode(m[2]),extensions[m[1]]),html)
html=re.sub(r'<script>([\s\S]*?)</script>',lambda m:'<script src="'+save(m[1].encode(),'js')+'"></script>',html)
html=re.sub(r'<style>([\s\S]*?)</style>',lambda m:'<link rel="stylesheet" href="'+save(m[1].encode(),'css')+'">',html)
html=html.replace('</head>','<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#080c16"><meta name="robots" content="noindex,nofollow"></head>')
(P/'index.html').write_text(html,encoding='utf-8')
(P/'manifest.webmanifest').write_text(json.dumps({'id':'/','name':'Milano Racing Grand Prix','short_name':'Milano Racing','description':'Twelve circuits. One grid.','start_url':'/?installed=1','scope':'/','display':'standalone','orientation':'landscape','background_color':'#080c16','theme_color':'#080c16','icons':[{'src':'/icon-'+str(n)+'.png','sizes':f'{n}x{n}','type':'image/png','purpose':'any'} for n in [192,512]]}))
logo=Image.open(U/'vendor/team-logo.png').convert('RGBA')
for n in [192,512]:
 im=Image.new('RGBA',(n,n),'#ff7a00');art=logo.copy();art.thumbnail((int(n*.84),int(n*.68)),Image.Resampling.LANCZOS);im.alpha_composite(art,((n-art.width)//2,(n-art.height)//2));im.convert('RGB').save(P/f'icon-{n}.png')
(P/'sw.js').write_text("""const CACHE='milano-grand-prix-1';self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('milano-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/login')||u.pathname.startsWith('/downloads/'))return;e.respondWith((async()=>{try{const r=await fetch(e.request);const control=r.headers.get('Cache-Control')||'';if(r.ok&&!/private|no-store/.test(control)&&(u.pathname==='/'||u.pathname.startsWith('/assets/'))){const c=await caches.open(CACHE);await c.put(e.request,r.clone())}return r}catch(error){const hit=await caches.match(e.request);if(hit)return hit;return new Response('Reconnect to open the private test build.',{status:503,headers:{'Content-Type':'text/plain'}})}})())});""",encoding='utf-8')
tour=json.loads((U/'src/world-tour-data.json').read_text());(U/'server/Multiplayer Circuits.json').write_text(json.dumps({key:{k:d[k] for k in ['x','z','tx','tz','length','width','widthLeft','widthRight','name']} for key,d in tour.items()},separators=(',',':')))
shutil.copy2(U/'src/track-limits.json',U/'server/track-limits.json')
# Remove only obsolete generated hash assets inside this build's assets directory.
for f in A.iterdir():
 if f.is_file() and re.fullmatch(r'[a-f0-9]{20}\.[a-z]+(?:\.gz)?',f.name) and f.name not in used:f.unlink()
(U/'qa/web-build.json').write_text(json.dumps({'htmlBytes':len(html.encode()),'assets':len(used),'bytes':sum((A/f).stat().st_size for f in used),'circuits':list(tour)},indent=2))
print('Web application built:',len(html.encode()),'byte shell,',len(used),'assets')

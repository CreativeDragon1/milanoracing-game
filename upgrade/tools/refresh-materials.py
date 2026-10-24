"""Fetch unmodified CC0 photographic PBR maps, with hashes and physical scale."""
from pathlib import Path
import urllib.request,json,hashlib,concurrent.futures
U=Path(__file__).resolve().parents[1];R=U/'research/materials';A=U/'assets'
# Forest/grass verges, compacted sand, fine asphalt and exposed mineral slopes.
choices={'leafy_grass':('turf', '2k'),'dense_sand':('sand-fine','2k'),'asphalt_01':('asphalt-fine','2k'),'rocky_terrain_02':('rock-ground','1k')}
jobs=[]
for name,(prefix,res) in choices.items():
    meta=json.loads((R/(name+'-files.json')).read_text());info=json.loads((R/(name+'-info.json')).read_text())
    for source,suffix in [('Diffuse','color'),('nor_gl','normal'),('Rough','rough')]:
        item=meta[source][res]['jpg'];jobs.append((name,prefix+'-'+suffix+'.jpg',item,info))
def fetch(job):
    name,file,item,info=job;path=A/file
    if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest()!=item['md5']:
        req=urllib.request.Request(item['url'],headers={'User-Agent':'MilanoRacingAssetPreparation/1.0'})
        data=urllib.request.urlopen(req,timeout=120).read();assert hashlib.md5(data).hexdigest()==item['md5'],file
        path.write_bytes(data)
    return {'file':file,'asset':name,'url':item['url'],'license':'CC0 / Poly Haven','authors':info['authors'],'dimensionsMetres':[v/1000 for v in info['dimensions']],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:report=list(pool.map(fetch,jobs))
(A/'surface-refresh-sources.json').write_text(json.dumps(report,indent=2))
print('Verified',len(report),'PBR maps;',sum(r['bytes'] for r in report),'bytes')

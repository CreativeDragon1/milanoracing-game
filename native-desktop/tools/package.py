"""Package the tested native desktop build and prepared Godot source snapshot."""
from pathlib import Path
import hashlib,json,zipfile,shutil,datetime

N=Path(__file__).resolve().parents[1];D=Path.home()/'Downloads';OUT=N/'packages';OUT.mkdir(exist_ok=True)
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda:f.read(4*1024*1024),b''):h.update(block)
    return h.hexdigest()
report=json.loads((N/'qa/packaged-rendering.json').read_text())
assert len(report['reports'])==12
assert report['exeSHA256']==sha(N/'build/Milano Racing Native.exe')
assert report['packSHA256']==sha(N/'build/Milano Racing Native.pck')
assert all(r['instanceErrors']==0 for r in report['reports'])
assert all(r['race']['drivers']==22 and r['race']['finiteDrivers'] for r in report['reports'])
modes=json.loads((N/'qa/packaged-modes.json').read_text())
assert modes['exeSHA256']==report['exeSHA256'] and modes['packSHA256']==report['packSHA256']
assert {r['mode'] for r in modes['reports']}=={'full-monaco','full-spa','rain','home'}
drive=json.loads((N/'qa/packaged-input.json').read_text())
assert drive['exeSHA256']==report['exeSHA256'] and drive['packSHA256']==report['packSHA256']
assert drive['inputSmoke']['peakKmh']>50 and drive['inputSmoke']['finitePosition']
for name in ['race','vehicle','online','ui']:
    checks=json.loads((N/f'qa/{name}.json').read_text())
    assert checks['passed'] and not checks['failures'],name
reel=json.loads((N/'qa/home-reel.json').read_text())
assert reel['decodePassed'] and reel['sha256']==sha(N/'game/assets/home-reel.ogv')
def source_files():
    evidence={'tree-grounding.json','race.json','vehicle.json','online.json','ui.json','home-reel.json','packaged-rendering.json','packaged-modes.json','packaged-input.json'}
    for root in ['game','tools','docs','licenses','qa']:
        for p in (N/root).rglob('*'):
            if not p.is_file():continue
            rel=p.relative_to(N)
            if root=='qa' and (p.parent!=N/'qa' or p.name not in evidence):continue
            if any(s in rel.parts for s in ['.godot','editor_data','templates','__pycache__','packaged']):continue
            if p.suffix in ['.exe','.zip','.tpz','.bin','.log','.png'] and root in ['tools','qa']:continue
            if root=='game' and (p.suffix=='.bin' or p.name=='release.json'):continue
            if root=='tools' and p.name in ['_sc_','inspect-engine.gd']:continue
            if root=='qa' and p.name=='release.json':continue
            if p.name=='inspect_car.gd':continue
            yield p,Path('Milano-Racing-Native-Source')/rel
    for name in ['README.md','.gitignore']:yield N/name,Path('Milano-Racing-Native-Source')/name
def archive(name,entries):
    path=OUT/name
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p,arc in entries:z.write(p,str(arc))
    with zipfile.ZipFile(path) as z:assert z.testzip() is None
    print(name,round(path.stat().st_size/1024**2,1),'MiB; CRC passed',flush=True)
    return path
base=Path('Milano Racing Native')
entries=[(p,base/p.name) for p in (N/'build').glob('*') if p.suffix in ['.exe','.pck']]
entries.append((N/'README.md',base/'README.md'))
for folder in ['docs','licenses']:
    entries.extend((p,base/folder/p.relative_to(N/folder)) for p in (N/folder).rglob('*') if p.is_file())
binary=archive('Milano-Racing-Native-Windows.zip',entries)
source=archive('Milano-Racing-Native-Source.zip',source_files())
files=[]
for p in [binary,source]:
    destination=D/p.name
    if destination.exists() and sha(destination)!=sha(p):
        shutil.copy2(destination,D/(p.stem+' - previous '+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+p.suffix))
    shutil.copy2(p,destination);digest=sha(p);assert sha(destination)==digest
    files.append({'name':p.name,'bytes':p.stat().st_size,'sha256':digest,'downloadsPath':str(destination)})
manifest={'version':'0.2.0','scope':'Native practice, 22-car AI races, qualifying, private-server online client and recorded cinematic home screen. Reconstructed venues; commercial-reference visual parity is not claimed.','publicWebsiteDeployed':False,'exeSHA256':report['exeSHA256'],'packSHA256':report['packSHA256'],'files':files}
(N/'qa/release.json').write_text(json.dumps(manifest,indent=2))
(D/'Milano-Racing-Native-SHA256SUMS.txt').write_text(''.join(f['sha256']+'  '+f['name']+'\n' for f in files))
print(json.dumps(manifest,indent=2),flush=True)

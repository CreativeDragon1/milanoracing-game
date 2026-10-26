"""Package the tested native desktop build and prepared Godot source snapshot."""
from pathlib import Path
import hashlib,json,zipfile,shutil,datetime,sys

N=Path(__file__).resolve().parents[1];D=Path.home()/'Downloads';OUT=N/'packages';OUT.mkdir(exist_ok=True)
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda:f.read(4*1024*1024),b''):h.update(block)
    return h.hexdigest()
report=json.loads((N/'qa/packaged-rendering.json').read_text())
assert {r['circuit'] for r in report['reports']}==set(json.loads((N/'game/circuits/physics.json').read_text()))
assert report['exeSHA256']==sha(N/'build/Milano Apex.exe')
assert report['packSHA256']==sha(N/'build/Milano Apex.pck')
assert all(r['instanceErrors']==0 for r in report['reports'])
assert all(r['race']['drivers']==22 and r['race']['finiteDrivers'] for r in report['reports'])
modes=json.loads((N/'qa/packaged-modes.json').read_text())
assert modes['exeSHA256']==report['exeSHA256'] and modes['packSHA256']==report['packSHA256']
assert {r['mode'] for r in modes['reports']}=={'full-monaco','full-spa','rain','home'}
drive=json.loads((N/'qa/packaged-input.json').read_text())
assert drive['exeSHA256']==report['exeSHA256'] and drive['packSHA256']==report['packSHA256']
assert drive['inputSmoke']['peakKmh']>50 and drive['inputSmoke']['finitePosition']
comparison=json.loads((N/'qa/performance-comparison.json').read_text())
assert comparison['packSHA256']==report['packSHA256'],'Performance comparison must use this resource pack'
for name in ['race','vehicle','online','ui','learning','traffic','pit-skip','screen-fit','updater']:
    checks=json.loads((N/f'qa/{name}.json').read_text())
    assert checks['passed'] and not checks.get('failures',[]),name
assert json.loads((N/'qa/car-livery.json').read_text())['passed']
active_livery=json.loads((N/'game/assets/livery-manifest.json').read_text())
assert json.loads((N/'qa/car-livery.json').read_text())['artworkSHA256']==active_livery['artworkSHA256']
assert json.loads((N/'qa/circuit-map.json').read_text())['passed']
reel=json.loads((N/'qa/home-reel.json').read_text())
assert reel['decodePassed'] and reel['sha256']==sha(N/'game/assets/home-reel.ogv')
assert reel['livery']==active_livery['artworkSHA256'],'Menu footage must show the active livery'
def source_files():
    evidence={'pit-skip.json','traffic.json','icon.json','tree-grounding.json','race.json','vehicle.json','online.json','ui.json','home-reel.json','packaged-rendering.json','packaged-modes.json','packaged-input.json','learning.json','performance-comparison.json','car-livery.json','circuit-map.json','mixed-trailer-routes.json','mixed-trailer-reel.json','mixed-trailer-landscape.json','spa-static-clearance.json','structure-grounding.json','structure-clearance-calendar.json','monaco-static-clearance.json','singapore-static-clearance.json','esplanade.json','trailer-motion.json'}
    evidence.update({'screen-fit.json','updater.json','screen-performance.json'})
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
            yield p,Path('Milano-Apex-Source')/rel
    for name in ['README.md','.gitignore']:yield N/name,Path('Milano-Apex-Source')/name
def archive(name,entries):
    path=OUT/name
    pending=path.with_suffix(path.suffix+'.partial')
    with zipfile.ZipFile(pending,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p,arc in entries:z.write(p,str(arc))
    with zipfile.ZipFile(pending) as z:assert z.testzip() is None
    pending.replace(path)
    print(name,round(path.stat().st_size/1024**2,1),'MiB; CRC passed',flush=True)
    return path
base=Path('Milano Apex')
entries=[(p,base/p.name) for p in [N/'build/Milano Apex.exe',N/'build/Milano Apex.pck']]
entries.append((N/'README.md',base/'README.md'))
for folder in ['docs','licenses']:
    entries.extend((p,base/folder/p.relative_to(N/folder)) for p in (N/folder).rglob('*') if p.is_file())
if '--source-only' in sys.argv:
    binary=OUT/'Milano-Apex-Windows.zip'
    previous=json.loads((N/'qa/release.json').read_text())
    assert previous['exeSHA256']==report['exeSHA256'] and previous['packSHA256']==report['packSHA256']
    assert sha(binary)==next(f['sha256'] for f in previous['files'] if f['name']==binary.name)
else:
    binary=archive('Milano-Apex-Windows.zip',entries)
source=archive('Milano-Apex-Source.zip',source_files())
files=[]
for p in [binary,source]:
    destination=D/p.name
    if destination.exists() and sha(destination)!=sha(p):
        shutil.copy2(destination,D/(p.stem+' - previous '+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+p.suffix))
    shutil.copy2(p,destination);digest=sha(p);assert sha(destination)==digest
    files.append({'name':p.name,'bytes':p.stat().st_size,'sha256':digest,'downloadsPath':str(destination)})
manifest={'version':json.loads((N/'game/assets/update-config.json').read_text())['version'],'scope':'Native practice, 22-car AI races, qualifying, private-server online client and recorded cinematic home screen. Reconstructed venues; commercial-reference visual parity is not claimed.','publicWebsiteDeployed':False,'exeSHA256':report['exeSHA256'],'packSHA256':report['packSHA256'],'files':files}
manifest['liveryRevision']=active_livery['revision']
manifest['artworkSHA256']=active_livery['artworkSHA256']
# Keep a ready-to-launch copy alongside the archives. The older Native folder
# remains available for rollback and the measured baseline.
installed=D/'Milano Apex';installed.mkdir(exist_ok=True)
for name in ['Milano Apex.exe','Milano Apex.pck']:
    target=installed/name
    if target.exists() and sha(target)!=sha(N/'build'/name):
        shutil.copy2(target,installed/(target.stem+' - previous '+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+target.suffix))
    shutil.copy2(N/'build'/name,target)
    assert sha(target)==sha(N/'build'/name)
for folder in ['docs','licenses']:shutil.copytree(N/folder,installed/folder,dirs_exist_ok=True)
shutil.copy2(N/'README.md',installed/'README.md')
manifest['readyToLaunch']=str(installed/'Milano Apex.exe')
(N/'qa/release.json').write_text(json.dumps(manifest,indent=2))
(D/'Milano-Apex-SHA256SUMS.txt').write_text(''.join(f['sha256']+'  '+f['name']+'\n' for f in files))
print(json.dumps(manifest,indent=2),flush=True)

"""Exercise the exported executable, not the editor project, on the actual GPU."""
from pathlib import Path
import subprocess,json,time,sys,hashlib
N=Path(__file__).resolve().parents[1];E=N/'build/Milano Racing Native.exe';out=N/'qa/packaged';out.mkdir(exist_ok=True)
ids=sys.argv[1:] or list(json.loads((N/'game/circuits/physics.json').read_text()))
reports=[]
for ident in ids:
    log=out/f'{ident}.log';begin=time.perf_counter()
    r=subprocess.run([str(E),'--log-file',str(log),'--rendering-method','forward_plus','--quit-after','36000','--','--qa','--qa-race','--qa-seconds=45','--circuit='+ident,'--qa-output='+out.as_posix()],timeout=240)
    text=log.read_text(encoding='utf-8')
    assert r.returncode==0 and 'SCRIPT ERROR' not in text and '\nERROR:' not in text,(ident,r.returncode,text[-2000:])
    assert 'NATIVE_QA ' in text,(ident,text[-1000:])
    report=json.loads((out/f'native-{ident}.json').read_text())
    assert report['restoredInstances']>0 and report['instanceErrors']==0,report
    assert report['inputSmoke']['finitePosition'] and report['frames']>100,report
    assert report['race']['drivers']==22 and report['race']['finiteDrivers'],report
    report['startupAndRunSeconds']=round(time.perf_counter()-begin,2)
    reports.append(report);print(ident,report['medianMs'],report['p95Ms'],'ms; packaged Vulkan passed',flush=True)
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
    return h.hexdigest()
(N/'qa/packaged-rendering.json').write_text(json.dumps({'scope':'Exported Windows executable, 22-car moving grid with deterministic Elite QA driver. First 45 seconds per circuit, 3 second warmup, High preset, 1440x810 window, 144 FPS cap. Partial-lap samples, not minimum-FPS or other-hardware guarantees.','exeSHA256':sha(E),'packSHA256':sha(E.with_suffix('.pck')),'reports':reports},indent=2))

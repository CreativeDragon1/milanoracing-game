"""Exercise the exported executable, not the editor project, on the actual GPU."""
from pathlib import Path
import subprocess,json,time,sys,hashlib,os
N=Path(__file__).resolve().parents[1];E=Path(os.environ.get('MILANO_PACKAGED_EXE',str(N/'build/Milano Apex.exe'))).resolve();out=Path(os.environ.get('MILANO_PACKAGED_OUTPUT',str(N/'qa/packaged'))).resolve();out.mkdir(parents=True,exist_ok=True)
ids=sys.argv[1:] or list(json.loads((N/'game/circuits/physics.json').read_text()))
seconds=max(15,int(os.environ.get('MILANO_PACKAGED_SECONDS','45')))
reports=[]
for ident in ids:
    log=out/f'{ident}.log';begin=time.perf_counter()
    r=subprocess.run([str(E),'--position','-4000,-4000','--log-file',str(log),'--rendering-method','forward_plus','--quit-after','36000','--','--qa','--qa-race','--qa-seconds='+str(seconds),'--circuit='+ident,'--qa-output='+out.as_posix()],timeout=240,capture_output=True)
    text=log.read_text(encoding='utf-8')
    assert r.returncode==0 and 'SCRIPT ERROR' not in text and '\nERROR:' not in text,(ident,r.returncode,text[-2000:])
    assert 'NATIVE_QA ' in text,(ident,text[-1000:])
    report=json.loads((out/f'native-{ident}.json').read_text())
    assert report['restoredInstances']>0 and report['instanceErrors']==0,report
    assert report['inputSmoke']['finitePosition'] and report['frames']>100,report
    assert report.get('minimizedFrames',0)==0,'Minimized window invalidates GPU timing'
    assert report['race']['drivers']==22 and report['race']['finiteDrivers'],report
    report['startupAndRunSeconds']=round(time.perf_counter()-begin,2)
    reports.append(report);print(ident,report['medianMs'],report['p95Ms'],'ms; packaged Vulkan passed',flush=True)
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
    return h.hexdigest()
Path(os.environ.get('MILANO_PACKAGED_REPORT',str(N/'qa/packaged-rendering.json'))).write_text(json.dumps({'scope':f'Exported Windows executable, 22-car moving grid with deterministic Elite QA driver. First {seconds} seconds per circuit, 3 second warmup, High preset, 1440x810 window, 144 FPS cap. Partial-lap smoke samples, not minimum-FPS or other-hardware guarantees.','sampleSeconds':seconds,'exeSHA256':sha(E),'packSHA256':sha(E.with_suffix('.pck')),'reports':reports},indent=2))

"""Longer packaged laps, rain rendering, and cinematic home playback."""
from pathlib import Path
import subprocess,json,hashlib
N=Path(__file__).resolve().parents[1];E=N/'build/Milano Racing Native.exe';out=N/'qa/modes';out.mkdir(exist_ok=True)
reports=[]
for name,ident,flags in [('full-monaco','monaco',['--qa-complete-race']),('full-spa','spa',['--qa-complete-race']),('rain','singapore',['--qa-race','--qa-rain','--qa-seconds=35']),('home','milano',['--qa-home','--qa-seconds=24'])]:
    log=out/(name+'.log')
    r=subprocess.run([str(E),'--log-file',str(log),'--quit-after','36000','--','--qa','--circuit='+ident,'--qa-output='+out.as_posix(),*flags],timeout=250)
    text=log.read_text(encoding='utf-8')
    assert r.returncode==0 and 'NATIVE_QA ' in text and 'SCRIPT ERROR' not in text and '\nERROR:' not in text,(name,text[-3000:])
    report=json.loads((out/('native-'+ident+'.json')).read_text())
    if name.startswith('full-'):assert report['race']['phase']=='race_result' and report['race']['finiteDrivers'],report
    if name=='rain':assert report['visuals']['wet']==1,report
    if name=='home':assert report['home']['playing'] and report['home']['position']>0 and report['home']['render3DDisabled'],report
    report['mode']=name;reports.append(report);print(name,'passed',report['medianMs'],report['p95Ms'],'ms',flush=True)
(N/'qa/packaged-modes.json').write_text(json.dumps({'exeSHA256':hashlib.sha256(E.read_bytes()).hexdigest(),'packSHA256':hashlib.sha256(E.with_suffix('.pck').read_bytes()).hexdigest(),'reports':reports},indent=2))

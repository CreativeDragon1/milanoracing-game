from pathlib import Path
import subprocess,json
N=Path(__file__).resolve().parents[1];E=N/'build/Milano Racing Native.exe';out=N/'qa/input-smoke';out.mkdir(exist_ok=True);log=out/'runtime.log'
r=subprocess.run([str(E),'--log-file',str(log),'--quit-after','36000','--','--qa','--qa-drive','--circuit=milano','--qa-output='+out.as_posix()],timeout=240)
text=log.read_text(encoding='utf-8');assert r.returncode==0 and 'SCRIPT ERROR' not in text and '\nERROR:' not in text,text[-2000:]
d=json.loads((out/'native-milano.json').read_text());assert d['inputSmoke']['enabled'] and d['inputSmoke']['peakKmh']>50 and d['inputSmoke']['finitePosition'] and d['instanceErrors']==0,d
(N/'qa/packaged-input.json').write_text(json.dumps(d,indent=2));print('Packaged keyboard-input smoke passed:',d['inputSmoke'],flush=True)

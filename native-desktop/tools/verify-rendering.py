from pathlib import Path
import subprocess,json,time,sys
N=Path(__file__).resolve().parents[1];G=N/'game';E=N/'tools/Godot_v4.7.2-stable_win64_console.exe';reports=[]
ids=sys.argv[1:] or list(json.loads((G/'circuits/physics.json').read_text()))
for ident in ids:
 log=N/'qa'/f'render-{ident}.log';begin=time.perf_counter()
 with log.open('w',encoding='utf-8') as out:
  r=subprocess.run([str(E),'--path',str(G),'--rendering-method','forward_plus','--quit-after','36000','--','--qa','--circuit='+ident],stdout=out,stderr=subprocess.STDOUT,timeout=240)
 text=log.read_text(encoding='utf-8');assert r.returncode==0,(ident,r.returncode,text[-2000:]);assert 'SCRIPT ERROR' not in text and '\nERROR:' not in text,(ident,text[-2000:]);assert 'NATIVE_QA ' in text,(ident,text[-2000:])
 report=json.loads((N/'qa'/f'native-{ident}.json').read_text());assert report['restoredInstances']>0 and report['instanceErrors']==0,report;report['startupAndRunSeconds']=round(time.perf_counter()-begin,2);reports.append(report);print(ident,report['medianMs'],report['p95Ms'],'ms; Vulkan render passed',flush=True)
(N/'qa/rendering.json').write_text(json.dumps({'scope':'Stationary driving view, 3 second warmup and 9 second sample; not a full-race benchmark','reports':reports},indent=2))

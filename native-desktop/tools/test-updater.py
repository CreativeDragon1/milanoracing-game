"""Exercise the real Windows updater in disposable game folders, never Downloads."""
from pathlib import Path
import base64,hashlib,http.server,io,json,subprocess,threading,time,zipfile
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
N=Path(__file__).resolve().parents[1];root=N/'qa'/('updater-'+str(time.time_ns()));root.mkdir()
key=serialization.load_pem_private_key((N/'signing/private.pem').read_bytes(),None)
names=['Milano Apex.exe','Milano Apex.pck'];new={n:('new '+n).encode()*100 for n in names};state={};checks=[]
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if state.get('private'):self.send_error(401);return
  value=state['feed'] if self.path.endswith('.json') else state['zip'];self.send_response(200);self.send_header('Content-Length',str(len(value)));self.end_headers();self.wfile.write(value[:len(value)//2] if state.get('interrupted') and self.path.endswith('.zip') else value)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
def prepare(case,seq=11,unsafe=False):
 folder=root/case;folder.mkdir();cache=folder/'.milano-update';cache.mkdir()
 for name in names:(folder/name).write_bytes(('old '+name).encode())
 (folder/'my-save.dat').write_text('KEEP ME');(folder/'preferences.cfg').write_text('KEEP SETTINGS')
 buf=io.BytesIO()
 with zipfile.ZipFile(buf,'w') as z:
  for name,data in new.items():z.writestr('../escape.exe' if unsafe and name==names[0] else name,data)
 archive=buf.getvalue();payload=json.dumps({'platform':'windows-x64','version':'test','sequence':seq,'archive':f'/updates/windows-{seq}.zip','bytes':len(archive),'sha256':hashlib.sha256(archive).hexdigest(),'files':{n:{'bytes':len(v),'sha256':hashlib.sha256(v).hexdigest()} for n,v in new.items()}},separators=(',',':')).encode()
 envelope={'payload':base64.b64encode(payload).decode(),'signature':base64.b64encode(key.sign(payload,padding.PKCS1v15(),hashes.SHA256())).decode()}
 state.clear();state.update(feed=json.dumps(envelope).encode(),zip=archive)
 job={'install':str(folder),'feed':origin+'/updates/windows.json','sequence':10,'parent':0,'cookie':'test-cookie'}
 return folder,cache,job,envelope
def launch(cache,job):
 (cache/'job.json').write_text(json.dumps(job));return subprocess.Popen(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(N/'game/assets/update-worker.ps1'),'-JobPath',str(cache/'job.json'),'-TestMode'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
def done(proc,folder,cache,expected):
 output=proc.communicate(timeout=45)[0].decode(errors='replace');status=json.loads((cache/'status.json').read_text(encoding='utf-8-sig')) if (cache/'status.json').exists() else {}
 assert status.get('state')==expected,(expected,status,output)
 for n in names:assert (folder/n).read_bytes()==(new[n] if expected=='updated' else ('old '+n).encode())
 assert (folder/'my-save.dat').read_text()=='KEEP ME' and (folder/'preferences.cfg').read_text()=='KEEP SETTINGS'
 assert not json.loads((cache/'job.json').read_text(encoding='utf-8-sig'))['cookie']
 checks.append(folder.name);print(folder.name,expected,flush=True)
try:
 for case in ['success','stale','bad-signature','corrupt-download','unsafe-path','private','interrupted']:
  folder,cache,job,envelope=prepare(case,seq=10 if case=='stale' else 11,unsafe=case=='unsafe-path')
  if case=='bad-signature':envelope['signature']=base64.b64encode(bytes(384)).decode();state['feed']=json.dumps(envelope).encode()
  if case=='corrupt-download':state['zip']=bytes(len(state['zip']))
  if case=='private':state['private']=True
  if case=='interrupted':state['interrupted']=True
  done(launch(cache,job),folder,cache,'updated' if case=='success' else 'current' if case=='stale' else 'private_access' if case=='private' else 'failed')
 folder,cache,job,_=prepare('wait-for-exit');parent=subprocess.Popen(['python','-c','import time;time.sleep(40)']);job['parent']=parent.pid;(cache/'busy').write_text('racing');proc=launch(cache,job)
 time.sleep(2);assert (folder/names[0]).read_bytes().startswith(b'old ');assert not (cache/'manifest.json').exists(),'Racing pauses network transfer before it begins';(cache/'busy').unlink()
 for i in range(100):
  if (cache/'status.json').exists() and json.loads((cache/'status.json').read_text(encoding='utf-8-sig')).get('state')=='ready':break
  time.sleep(.1)
 else:raise AssertionError('Update never staged')
 assert proc.poll() is None and (folder/names[0]).read_bytes().startswith(b'old ');parent.terminate();parent.wait();done(proc,folder,cache,'updated')
 folder,cache,job,_=prepare('rollback-locked-file');lock=root/'lock.ps1';stop=cache/'unlock';ready=cache/'locked'
 lock.write_text("param($Target,$Ready,$Stop)\n$f=[IO.File]::Open($Target,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);[IO.File]::WriteAllText($Ready,'ok');try{while(-not [IO.File]::Exists($Stop)){Start-Sleep -Milliseconds 50}}finally{$f.Dispose()}")
 locker=subprocess.Popen(['powershell.exe','-NoProfile','-File',str(lock),str(folder/names[1]),str(ready),str(stop)])
 try:
  for i in range(100):
   if ready.exists():break
   time.sleep(.05)
  assert ready.exists();done(launch(cache,job),folder,cache,'failed')
 finally:stop.write_text('stop');locker.wait(timeout=10)
 (N/'qa/updater.json').write_text(json.dumps({'passed':True,'checks':checks,'scope':'Real PowerShell worker against signed loopback fixtures in disposable folders. Preserves original game on failed signatures/downloads/locked replacement; waits for process exit; preserves saves. No public update was published.'},indent=2))
finally:server.shutdown()

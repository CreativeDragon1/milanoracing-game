"""Exercise native clients against the unchanged private Python host on loopback."""
from pathlib import Path
import os,sys,json,subprocess,secrets,socket,time,urllib.request,hashlib
N=Path(__file__).resolve().parents[1]
server=N.parent/'upgrade/server'
assert server.is_dir(), 'The compatibility server source is required for this integration test'
with socket.socket() as s:s.bind(('127.0.0.1',0)); port=s.getsockname()[1]
password=secrets.token_urlsafe(20);salt=secrets.token_hex(16)
digest=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
env={**os.environ,'BIND':'127.0.0.1','PORT':str(port),'PUBLIC_ORIGIN':'','PRIVATE_SITE':'1','TRUST_CLOUDFLARE':'0','SESSION_SECRET':secrets.token_hex(32),'SITE_PASSWORD_HASH':f'pbkdf2_sha256$600000${salt}${digest}'}
log=N/'qa/online-server.log'
with log.open('w') as out:
    process=subprocess.Popen([sys.executable,str(server/'milano_server.py')],env=env,stdout=out,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        origin=f'http://127.0.0.1:{port}'
        for _ in range(80):
            try:
                if urllib.request.urlopen(origin+'/healthz',timeout=.5).status==200:break
            except Exception:time.sleep(.1)
        child={**os.environ,'MILANO_QA_ORIGIN':origin,'MILANO_QA_PASSWORD':password}
        with (N/'qa/online-native.log').open('w',encoding='utf-8') as native_log:
            result=subprocess.run([str(N/'tools/Godot_v4.7.2-stable_win64_console.exe'),'--headless','--path',str(N/'game'),'--script','scripts/test_online.gd'],env=child,stdout=native_log,stderr=subprocess.STDOUT,timeout=65)
        output=(N/'qa/online-native.log').read_text(encoding='utf-8')
        assert result.returncode==0 and 'NATIVE_ONLINE_TEST ' in output and 'SCRIPT ERROR' not in output and '\nERROR:' not in output,output[-6000:]
        report=json.loads((N/'qa/online.json').read_text());assert report['passed'],report
        print(json.dumps(report,indent=2))
    finally:
        process.terminate();process.wait(timeout=10)

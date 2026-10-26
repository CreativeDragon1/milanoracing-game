"""Stage a signed release locally. Never uploads or changes public access."""
from pathlib import Path
import base64,json,hashlib,zipfile,shutil
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
N=Path(__file__).resolve().parents[1];server=N.parent/'upgrade/server';out=server/'updates';out.mkdir(exist_ok=True)
config=json.loads((N/'game/assets/update-config.json').read_text())
report=json.loads((N/'qa/packaged-rendering.json').read_text())
sha=lambda p:hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
package=json.loads((N/'qa/release.json').read_text())
assert package['packSHA256']==report['packSHA256'] and package['exeSHA256']==report['exeSHA256'],'Package the validated build first'
assert sha(N/'packages/Milano-Apex-Windows.zip')==next(f['sha256'] for f in package['files'] if f['name']=='Milano-Apex-Windows.zip'),'Installer archive must match the validated release'
files={name:{'sha256':sha(N/'build'/name),'bytes':(N/'build'/name).stat().st_size} for name in ['Milano Apex.exe','Milano Apex.pck']}
assert files['Milano Apex.exe']['sha256']==report['exeSHA256'] and files['Milano Apex.pck']['sha256']==report['packSHA256'],'Validate this build before signing'
key_path=N/'signing/private.pem'
assert key_path.is_file(),'The original private signing key is required. Do not generate a replacement key.'
feed=out/'windows.json'
if feed.exists():
    old=json.loads(base64.b64decode(json.loads(feed.read_text())['payload']))
    assert config['sequence']>old['sequence'] or (config['sequence']==old['sequence'] and files==old['files']),'Bump the release sequence before shipping changed code'
archive=out/f"windows-{config['sequence']}.zip";temp=archive.with_suffix('.tmp')
with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for name in files:z.write(N/'build'/name,name)
with zipfile.ZipFile(temp) as z:assert z.testzip() is None
temp.replace(archive)
payload=json.dumps({'platform':'windows-x64','version':config['version'],'sequence':config['sequence'],'archive':'/updates/'+archive.name,'sha256':sha(archive),'bytes':archive.stat().st_size,'files':files},sort_keys=True,separators=(',',':')).encode()
key=serialization.load_pem_private_key(key_path.read_bytes(),password=None)
envelope={'payload':base64.b64encode(payload).decode(),'signature':base64.b64encode(key.sign(payload,padding.PKCS1v15(),hashes.SHA256())).decode()}
pending=feed.with_suffix('.tmp');pending.write_text(json.dumps(envelope),encoding='utf-8');pending.replace(feed)
downloads=server/'downloads';downloads.mkdir(exist_ok=True)
shutil.copy2(N/'packages/Milano-Apex-Windows.zip',downloads/'Milano-Apex-Windows.zip')
print('Signed update and desktop download staged locally; server remains private.')

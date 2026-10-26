from pathlib import Path
import sys,os,asyncio,json,tempfile
from aiohttp import ClientTimeout,CookieJar
from aiohttp.test_utils import TestClient,TestServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
import milano_server as server
from private_access import make_hash
async def main():
 with tempfile.TemporaryDirectory() as directory:
  fixture=Path(directory);(fixture/'windows.json').write_text('{"test":true}');(fixture/'windows-123.zip').write_bytes(b'fixture')
  os.environ['MILANO_UPDATES_DIR']=str(fixture)
  os.environ['PRIVATE_SITE']='1'
  async with TestClient(TestServer(server.create_app()),timeout=ClientTimeout(total=8)) as client:
   for path in ['/api/build','/updates/windows.json','/updates/windows-123.zip']:
    response=await client.get(path);await response.read();assert response.status==401,(path,response.status)
   response=await client.get('/downloads/Milano-Apex-Windows.zip');assert response.status==200 and 'Private testing' in await response.text(),'Downloads prompt for private access, never expose the archive anonymously'
  os.environ['SITE_PASSWORD_HASH']=make_hash('test-only-password');os.environ['SESSION_SECRET']='loopback-test-session-secret-never-deployed'
  async with TestClient(TestServer(server.create_app()),timeout=ClientTimeout(total=8),cookie_jar=CookieJar(unsafe=True)) as client:
   response=await client.get('/downloads/Milano-Apex-Windows.zip');body=await response.text();assert 'name="next" value="/downloads/Milano-Apex-Windows.zip"' in body
   response=await client.post('/login',data={'password':'test-only-password','next':'/downloads/Milano-Apex-Windows.zip'},headers={'Origin':str(client.make_url('/')).rstrip('/')},allow_redirects=False)
   await response.read();assert response.status==303 and response.headers['Location']=='/downloads/Milano-Apex-Windows.zip'
   response=await client.get('/updates/windows.json');assert response.status==200 and (await response.json())['test'] is True
   response=await client.post('/login',data={'password':'test-only-password','next':'https://untrusted.invalid/'},headers={'Origin':str(client.make_url('/')).rstrip('/')},allow_redirects=False)
   await response.read();assert response.status==303 and response.headers['Location']=='/','Login return cannot redirect to an external host'
  os.environ['PRIVATE_SITE']='0'
  async with TestClient(TestServer(server.create_app()),timeout=ClientTimeout(total=8)) as client:
   for path in ['/api/build','/updates/windows.json','/updates/windows-123.zip']:
    response=await client.get(path);await response.read();assert response.status==200,(path,response.status);assert response.headers['Cache-Control']=='no-store'
   for path in ['/updates/private.pem','/updates/windows.txt','/updates/windows-123.zip.bak','/updates/..%5csigning%5cprivate.pem']:
    response=await client.get(path);await response.read();assert response.status==404,(path,response.status)
  report={'passed':True,'checks':['Private build/update routes require authentication','Download login returns to the selected archive','Authenticated update access works','Login return rejects external hosts','Manifest and build responses never cached','Only signed-release filenames served','Traversal rejected'],'scope':'Actual aiohttp application on loopback test servers; no production access changes.'}
  (Path(__file__).resolve().parents[1]/'qa/update-routes.json').write_text(json.dumps(report,indent=2));print(report)
asyncio.run(main())

"""Create a release identity and local signing key. Private key is never packaged."""
from pathlib import Path
import json,time,base64,argparse
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
N=Path(__file__).resolve().parents[1];keys=N/'signing';keys.mkdir(exist_ok=True)
path=keys/'private.pem'
if not path.exists() and (N/'game/assets/update-config.json').exists():
    raise RuntimeError('Original signing key missing; preserve the existing update channel.')
if not path.exists():
    key=rsa.generate_private_key(public_exponent=65537,key_size=3072)
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
key=serialization.load_pem_private_key(path.read_bytes(),password=None)
numbers=key.public_key().public_numbers()
enc=lambda n:base64.b64encode(n.to_bytes((n.bit_length()+7)//8,'big')).decode()
xml=f'<RSAKeyValue><Modulus>{enc(numbers.n)}</Modulus><Exponent>{enc(numbers.e)}</Exponent></RSAKeyValue>'
config=N/'game/assets/update-config.json'
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--new',action='store_true');parser.add_argument('--version');args=parser.parse_args()
previous=json.loads(config.read_text()) if config.exists() else {}
if args.new or not config.exists():
    config.write_text(json.dumps({'version':args.version or previous.get('version','0.4.0'),'sequence':max(int(time.time()),int(previous.get('sequence',0))+1),'feed':'https://game.milanoracing.team/updates/windows.json'},indent=2))
worker=N/'game/assets/update-worker.ps1';source=worker.read_text(encoding='utf-8')
import re
source=re.sub(r"\$rsa.FromXmlString\('(?:__PUBLIC_KEY_XML__|<RSAKeyValue>.*?</RSAKeyValue>)'\)","$rsa.FromXmlString('"+xml+"')",source)
worker.write_text(source,encoding='utf-8')
print('Prepared update identity; private signing key stays outside all packages.')

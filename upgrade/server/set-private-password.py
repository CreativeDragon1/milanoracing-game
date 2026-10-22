"""Run with sudo on Ubuntu. Password input is hidden and never stored as plaintext."""
import getpass,os,secrets
from pathlib import Path
from private_access import make_hash
path=Path('/etc/milano.env')
if os.geteuid()!=0:raise SystemExit('Run with sudo: sudo /opt/milano/.venv/bin/python /opt/milano/set-private-password.py')
password=getpass.getpass('Choose the private test password (12+ characters): ')
if len(password)<12 or len(password)>256:raise SystemExit('Use between 12 and 256 characters.')
if password!=getpass.getpass('Confirm password: '):raise SystemExit('Passwords did not match. Nothing changed.')
lines=path.read_text().splitlines() if path.exists() else ['PUBLIC_ORIGIN=https://game.milanoracing.team','BIND=127.0.0.1','PORT=8767','TRUST_CLOUDFLARE=1']
lines=[line for line in lines if not line.startswith(('SITE_PASSWORD_HASH=','SESSION_SECRET=','PRIVATE_SITE='))]
lines+=['PRIVATE_SITE=1','SITE_PASSWORD_HASH='+make_hash(password),'SESSION_SECRET='+secrets.token_hex(32)]
temporary=path.with_suffix('.env.new');fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f:f.write('\n'.join(lines)+'\n')
os.chmod(temporary,0o600);os.replace(temporary,path)
print('Private access configured. Restart milano to apply. Previous access cookies will no longer work.')

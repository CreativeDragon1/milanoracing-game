"""Copy only the verified source release and generated web assets to the requested clone."""
from pathlib import Path
import shutil,hashlib
U=Path(__file__).resolve().parents[1];root=U.parent
repo=(root/'github/milanoracing-game').resolve();target=repo/'upgrade'
assert (repo/'.git').is_dir() and target.resolve().parent==repo
versions=sorted((U/'release').glob('source-verification-*'),key=lambda p:p.stat().st_mtime)
source=versions[-1]/'Milano-Racing-Source/upgrade'
assert source.resolve().is_relative_to((U/'release').resolve())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source/'qa/standalone.html')==sha(U/'qa/standalone.html')
assert sha(source/'server/public/index.html')==sha(U/'server/public/index.html')
expected={}
for p in source.rglob('*'):
 if not p.is_file():continue
 rel=p.relative_to(source)
 if rel.as_posix() in ['qa/standalone.html','qa/game.js']:continue
 expected[rel]=p
for p in target.rglob('*'):
 if p.is_file() and p.relative_to(target) not in expected:
  assert p.resolve().is_relative_to(target.resolve());p.unlink()
for rel,p in expected.items():
 dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
shutil.copy2(U/'qa/standalone.html',repo/'Milano Racing - Grand Prix.html')
assert sha(repo/'Milano Racing - Grand Prix.html')==sha(U/'qa/standalone.html')
oversize=[str(p.relative_to(repo)) for p in repo.rglob('*') if p.is_file() and '.git' not in p.parts and p.stat().st_size>=100*1024*1024]
assert not oversize,oversize
print(f'Staged {len(expected)} verified source/web files and the standalone HTML in {repo}.')

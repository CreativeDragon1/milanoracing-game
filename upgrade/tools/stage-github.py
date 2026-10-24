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
 if 'node_modules' in rel.parts or '__pycache__' in rel.parts:continue
 if rel.as_posix() in ['qa/standalone.html','qa/game.js']:continue
 expected[rel]=p
for p in target.rglob('*'):
 if p.is_file() and p.relative_to(target) not in expected:
  assert p.resolve().is_relative_to(target.resolve());p.unlink()
for rel,p in expected.items():
 dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
shutil.copy2(U/'qa/standalone.html',repo/'Milano Racing.html')
assert sha(repo/'Milano Racing.html')==sha(U/'qa/standalone.html')
readme=repo/'README.md';text=readme.read_text(encoding='utf-8')
text=text.replace('# Milano Racing — Grand Prix','# Milano Racing')
text=text.replace('Milano Racing, featuring the MR 26. Start with **Grand Prix**; the older World Tour files remain in the repository for reference.','Milano Racing, featuring the MR 26. Open **Milano Racing.html** for the browser game; the independent native desktop source is under **native-desktop**.')
text=text.replace('[Milano Racing - Grand Prix.html](Milano%20Racing%20-%20Grand%20Prix.html)','[Milano Racing.html](Milano%20Racing.html)')
text=text.replace('MR 26 and 12 circuits:', 'MR 26 and 14 circuits:').replace('Interlagos and Zandvoort.', 'Interlagos, Zandvoort, Milano Riviera and Milano Solara.')
text=text.replace('The latest update adds terrain-fitted ground detail, supporting raceways, fuller planting and footprint-based spectator structures across the calendar.', 'The latest update adds Riviera and Solara, progressive steering, steadier cameras, local adaptive rivals and less repeated rendering and race-model work. Pit routes now keep their working areas clear of the racing surface, use smooth joins and transfer steering continuously out of assist. Reversed procedural grandstands, garage floors and service aprons are corrected. See upgrade/docs/PERFORMANCE-RESULTS.md for measured gains and remaining limits.')
readme.write_text(text,encoding='utf-8')
# Keep the earlier bookmark working without storing another 100 MB copy.
(repo/'Milano Racing - Grand Prix.html').write_text('<!doctype html><html><head><meta charset="utf-8"><title>Milano Racing</title></head><body><a href="Milano Racing.html">Open Milano Racing</a><script>location.replace("Milano Racing.html"+location.search+location.hash)</script></body></html>',encoding='utf-8')
oversize=[str(p.relative_to(repo)) for p in repo.rglob('*') if p.is_file() and '.git' not in p.parts and p.stat().st_size>=100*1024*1024]
assert not oversize,oversize
print(f'Staged {len(expected)} verified source/web files and the standalone HTML in {repo}.')

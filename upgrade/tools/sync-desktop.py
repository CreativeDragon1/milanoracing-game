from pathlib import Path
import shutil
u=Path(__file__).resolve().parents[1]
source=u/'server/public';target=u/'desktop/public'
if not (source/'index.html').is_file():raise SystemExit('Run build-base.py and build-web.py first.')
shutil.copytree(source,target,dirs_exist_ok=True)
# Remove obsolete generated assets only inside this desktop public folder.
for p in (target/'assets').iterdir():
 if p.is_file() and not (source/'assets'/p.name).exists():p.unlink()
shutil.copytree(u/'licenses',u/'desktop/licenses',dirs_exist_ok=True)
print('Desktop assets synchronized.')

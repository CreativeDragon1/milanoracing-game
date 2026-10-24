"""Archive obsolete generated textures after all circuits have been reimported."""
from pathlib import Path
import json, shutil

N=Path(__file__).resolve().parents[1]
folder=(N/'game/assets/generated').resolve()
archive=(N.parent/'work/unused-native-generated-20261025').resolve()
assert archive.is_relative_to(N.parent/'work')
ids=json.loads((N/'game/circuits/physics.json').read_text(encoding='utf-8'))
used=set()
for ident in ids:
    data=json.loads((N/'game/circuits'/f'{ident}.json').read_text(encoding='utf-8'))
    for material in data['materials'].values():
        for value in material.values():
            if isinstance(value,dict) and str(value.get('file','')).startswith('res://assets/generated/'):
                used.add(Path(value['file']).name)
assert used and all((folder/name).is_file() for name in used)
files=[p for p in folder.iterdir() if p.is_file() and p.suffix in ['.png','.jpg','.webp'] and p.name not in used]
archive.mkdir(parents=True,exist_ok=True)
size=0
for p in files:
    assert p.resolve().parent==folder
    size+=p.stat().st_size
    for source in [p,p.with_suffix(p.suffix+'.import')]:
        if source.exists():
            destination=archive/source.name
            if destination.exists():assert destination.read_bytes()==source.read_bytes()
            shutil.move(str(source),str(destination))
report={'retainedTextures':len(used),'archivedTextures':len(files),'sourceBytesRemoved':size,'archive':str(archive),'scope':'Only textures absent from every current circuit and car material export. Referenced texture resolution is unchanged.'}
(N/'qa/texture-archive.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report),flush=True)

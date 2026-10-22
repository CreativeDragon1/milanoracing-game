"""Stage exactly the CRC-checked native source package into the authorized clone."""
from pathlib import Path
import zipfile,hashlib,json
N=Path(__file__).resolve().parents[1];repo=N.parent/'github/milanoracing-game';target=(repo/'native-desktop').resolve()
assert (repo/'.git').is_dir() and target.parent==repo.resolve()
manifest=json.loads((N/'qa/release.json').read_text())
archive=N/'packages/Milano-Racing-Native-Source.zip'
expected=next(x['sha256'] for x in manifest['files'] if x['name']==archive.name)
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for item in z.infolist():
        rel=Path(item.filename).relative_to('Milano-Racing-Native-Source');out=(target/rel).resolve()
        assert out.is_relative_to(target)
        if item.is_dir():out.mkdir(parents=True,exist_ok=True);continue
        assert item.file_size<100*1024*1024,(rel,item.file_size)
        out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(z.read(item))
# These previous practice-only reports are superseded by the versioned packaged
# race suite. Keep evidence for this release together, without stale snapshots.
obsolete=['native-'+ident+'.json' for ident in ['bahrain','singapore','monza','monaco','austria','silverstone','abu-dhabi','milano','spa','suzuka','interlagos','zandvoort']]+['rendering.json']
for name in obsolete:
    path=(target/'qa'/name).resolve()
    assert path.is_relative_to(target/'qa')
    path.unlink(missing_ok=True)
attributes=repo/'.gitattributes'
rules=attributes.read_text()
if '*.ogv binary' not in rules:attributes.write_text(rules+'\n*.ogv binary\n',encoding='utf-8')
readme=repo/'README.md';text=readme.read_text(encoding='utf-8')
for marker in ['\n## Independent native desktop preview\n','\n## Native desktop\n']:
    if marker in text:text=text.split(marker)[0]
text+='\n## Native desktop\n'+'''
`native-desktop` is the independent Godot 4.7.2 Forward+/Vulkan game. Version 0.2 adds 22-car races, staged qualifying, tyre strategy, assisted pit stops, private-server online rooms and a recorded cinematic home screen. It includes all twelve prepared circuits and the original MR 26 artwork. Native wet-road and facade shaders, rain, spray, local shadows and graphics presets extend the desktop renderer.

The home screen uses a four-shot sequence recorded inside the native game, with smooth transitions and Milano branding. Circuit rendering is suspended during menu playback to reduce GPU work. The new interface separates race selection, setup and online rooms.

See [build and controls](native-desktop/README.md), [measured validation](native-desktop/docs/VALIDATION.md) and [accuracy boundaries](native-desktop/docs/ACCURACY.md). The circuits remain researched reconstructions; the supplied commercial-game reference quality and exact surveyed placement have not been achieved. Native online was verified with two clients on a private local server, not across the public Internet.

Prepared assets and menu footage are included. The pinned bootstrap downloads and verifies the official engine and export templates. Local Windows ZIPs are separate from this source repository. This update does not deploy the private game website or change its access controls.
'''
readme.write_text(text,encoding='utf-8')
print('Staged verified native source snapshot in',target)

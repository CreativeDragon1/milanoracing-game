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
readme=repo/'README.md';text=readme.read_text(encoding='utf-8')
marker='\n## Independent native desktop preview\n'
if marker in text:text=text.split(marker)[0]
text+=marker+'''
`native-desktop` is a new Godot 4.7.2 Forward+/Vulkan game runtime, without Electron or a browser. It reuses the researched circuit assets and MR 26 artwork, with native materials, shadows, post-processing, vegetation LODs, controls, cameras and pit service. All twelve circuits are included as prepared native scenes for reproducible builds.

This is a **practice preview**, not the full desktop replacement. Native qualifying, AI races and multiplayer are not implemented yet. The compatibility game above retains those modes. The native preview also has not yet met the supplied commercial-game visual benchmark or survey-exact placement standard.

See [native build and controls](native-desktop/README.md), [measured validation](native-desktop/docs/VALIDATION.md) and [accuracy limits](native-desktop/docs/ACCURACY.md). Prepared source assets are included; Godot's engine binaries and export templates are downloaded by the pinned, hash-checked bootstrap script. The local Windows download packages are separate from the source repository. Nothing in this update deploys the private game website.

The accompanying compatibility update repairs pit transitions and overlapping surfaces across all twelve venues, adds textured gravel and mapped runoff treatment, and fits all six sponsor logos without stretching. [Validation and references](upgrade/docs/Validation.html) describe the checks and source selection.
'''
readme.write_text(text,encoding='utf-8')
print('Staged verified native source snapshot in',target)

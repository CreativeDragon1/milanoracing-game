"""Pinned, hash-checked portable Godot toolchain. Does not install system services."""
from pathlib import Path
import hashlib, urllib.request, zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / 'tools'
BASE = 'https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable/'
FILES = {
    'Godot_v4.7.2-stable_win64.exe.zip': '731980f9608d61333e5baf54a2ef17210acc7a538446c0cb9969f002aca1e953',
    'Godot_v4.7.2-stable_export_templates.tpz': 'f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011',
}

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''): h.update(block)
    return h.hexdigest()

def main():
    for name, digest in FILES.items():
        path = TOOLS / name
        # Reuse the already downloaded archive from the initial authoring session.
        alias = TOOLS / ('templates.tpz' if name.endswith('.tpz') else name)
        if alias.exists(): path = alias
        if not path.exists():
            print('Downloading official Godot asset:', name, flush=True)
            temporary = path.with_suffix(path.suffix + '.partial')
            with urllib.request.urlopen(BASE + name, timeout=120) as response, temporary.open('wb') as out:
                while chunk := response.read(4 * 1024 * 1024): out.write(chunk)
            assert sha(temporary) == digest, 'Download checksum mismatch'
            temporary.replace(path)
        assert sha(path) == digest, f'Checksum mismatch: {path}'
        with zipfile.ZipFile(path) as archive:
            for member in archive.infolist():
                filename = Path(member.filename).name
                wanted = filename in ['windows_release_x86_64.exe', 'windows_release_x86_64_console.exe', 'version.txt'] if name.endswith('.tpz') else filename.endswith('.exe')
                if not wanted: continue
                destination = TOOLS / ('templates' if name.endswith('.tpz') else '') / filename
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, destination.open('wb') as out:
                    while chunk := source.read(4 * 1024 * 1024): out.write(chunk)
        print('Verified and extracted', name, flush=True)
    (TOOLS / '_sc_').touch()

if __name__ == '__main__': main()

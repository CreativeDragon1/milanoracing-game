"""Build the prepared native source snapshot with the pinned official engine."""
from pathlib import Path
import subprocess, sys

N = Path(__file__).resolve().parents[1]
E = N / 'tools/Godot_v4.7.2-stable_win64_console.exe'
G = N / 'game'

def run(*args, attempts=1):
    for attempt in range(1, attempts + 1):
        result = subprocess.run([str(E), '--headless', '--path', str(G), *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
        log = N / 'qa' / ('build-' + args[0].lstrip('-') + '-' + str(attempt) + '.log')
        log.parent.mkdir(exist_ok=True)
        output = result.stdout + result.stderr
        log.write_text(output, encoding='utf-8')
        script_error = 'SCRIPT ERROR:' in output or any(line.startswith('ERROR:') for line in output.splitlines())
        if result.returncode == 0 and not script_error: return
        print('Godot step failed; log:', log, 'exit:', result.returncode, flush=True)
        if script_error or attempt == attempts:
            raise RuntimeError('Godot build step failed. See ' + str(log))
        print('Resuming interrupted editor import, attempt', attempt + 1, flush=True)

assert E.is_file(), 'Run python tools/bootstrap.py first'
assert (G / 'circuits/monaco.scn').is_file(), 'Use the complete prepared source snapshot'
(N / 'build').mkdir(exist_ok=True)
run('--editor', '--import', attempts=3)
subprocess.run([sys.executable, str(N / 'tools/texture-imports.py')], check=True)
run('--editor', '--import', attempts=3)
if '--test' in sys.argv:
    run('--script', 'scripts/test_vehicle.gd')
    run('--script', 'scripts/test_race.gd')
run('--export-release', 'Windows Native')
for name in ['Milano Racing Native.exe', 'Milano Racing Native.pck']:
    assert (N / 'build' / name).stat().st_size > 1_000_000, name
print('Native Windows executable and resource pack exported.')

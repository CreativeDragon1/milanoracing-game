"""Matched, repeatable GPU runs; keep baseline reports separate from release QA."""
from pathlib import Path
import subprocess, json, time, sys, hashlib, os

N = Path(__file__).resolve().parents[1]
label = sys.argv[1]
ids = sys.argv[2:] or ['monza', 'singapore', 'interlagos']
out = N / 'qa' / ('performance-' + label)
out.mkdir(exist_ok=True)
exe = Path(os.environ.get('MILANO_BENCH_EXE',str(N / 'build/Milano Apex.exe')))
reports = []
for ident in ids:
    log = out / (ident + '.log')
    start = time.perf_counter()
    ready = None
    p = subprocess.Popen([str(exe), '--position', '-4000,-4000', '--log-file', str(log), '--rendering-method', 'forward_plus', '--', '--qa', '--qa-race', '--qa-seconds=30', '--circuit='+ident, '--qa-output='+out.as_posix()], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
    lines = []
    for line in p.stdout:
        lines.append(line)
        if 'NATIVE_READY ' in line: ready = time.perf_counter()-start
    assert p.wait(timeout=180)==0 and 'SCRIPT ERROR' not in ''.join(lines), ''.join(lines)[-2500:]
    report = json.loads((out / ('native-'+ident+'.json')).read_text())
    assert report.get('minimizedFrames',0)==0,'Minimized window invalidates GPU timing'
    report['startupToReadySeconds'] = ready
    report['totalSeconds'] = time.perf_counter()-start
    reports.append(report)
    print(ident, 'ready', round(ready or 0, 2), 'p50/p95', report['medianMs'], report['p95Ms'], flush=True)
(out / 'summary.json').write_text(json.dumps({'label':label, 'scope':'Same machine; exported executable; High, 1440x810, 22 cars, deterministic Elite driver, 30 seconds, 3 second frame warmup. Loading measured process launch to ready. Run one GPU benchmark at a time.', 'packSHA256':hashlib.sha256(exe.with_suffix('.pck').read_bytes()).hexdigest(), 'reports':reports}, indent=2))

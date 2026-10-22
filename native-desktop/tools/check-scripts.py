from pathlib import Path
import subprocess
N=Path(__file__).resolve().parents[1]
for file in sorted((N/'game/scripts').glob('*.gd')):
    r=subprocess.run([str(N/'tools/Godot_v4.7.2-stable_win64_console.exe'),'--headless','--path',str(N/'game'),'--check-only','--script',str(file)],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=30)
    output=r.stdout+r.stderr
    assert r.returncode==0 and 'SCRIPT ERROR' not in output and '\nERROR:' not in output,(file.name,output)
print('All native GDScript modules compile.')

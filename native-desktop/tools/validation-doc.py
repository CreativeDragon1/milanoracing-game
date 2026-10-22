from pathlib import Path
import json,shutil
N=Path(__file__).resolve().parents[1]
r=json.loads((N/'qa/packaged-rendering.json').read_text());v=json.loads((N/'qa/vehicle.json').read_text());g=json.loads((N/'qa/tree-grounding.json').read_text())
rows='\n'.join(f"| {x['circuit']} | {x['medianMs']:.2f} | {x['p95Ms']:.2f} | {x['restoredInstances']:,} |" for x in r['reports'])
text=f'''# Native desktop validation

The Windows preview is built with Godot 4.7.2 Forward+. All twelve circuits were launched from the exported executable and resource pack on an NVIDIA GeForce RTX 3050 6 GB Laptop GPU. No script or engine errors were reported by those final runs. Runtime readback confirmed the stored instanced geometry transforms on every circuit.

## Render sample

{r['scope']}

| Circuit | Median frame ms | 95th percentile ms | Verified static instances |
|---|---:|---:|---:|
{rows}

These measurements include rendering, frame pacing and the frame cap. They do not measure unlimited throughput, minimum FPS, a moving full-grid race or other computers. Shader compilation, camera movement, temperature and other applications can change performance. No cross-engine speed comparison is claimed.

## Controls and pits

The native vehicle/pit suite passed {v['checks']:,} checks, with no reported failures. It injects keyboard input, checks progressive steering and centering, accelerates and brakes, and traverses every assisted pit route through service and rejoining. Four rotating wheel parts were identified. The exported executable separately responded to injected keyboard acceleration and produced finite vehicle coordinates. This is software-input verification, not physical Bluetooth/controller testing or real-car correlation.

## Geometry checks

The conversion preserves original MR 26 geometry and artwork. Native instance metadata is kept on the CPU because headless conversion cannot reliably retain GPU instance state. It is uploaded on scene attachment and checked after rendering. This fixed missing windows, railings and fixtures.

Trees retain their original X/Z positions. Roots were checked against authored ground triangles; peripheral trees with no ground beneath them were omitted from the native preview. This prevents unsupported vegetation outside the actual terrain mesh. Existing source references, inferred dimensions and imagery dates are described in [ACCURACY.md](ACCURACY.md).

## Remaining work

The source archive was extracted into a fresh folder and imported without the original Godot cache. The first editor import exited during font processing; the second completed and the extracted source passed all 77,907 vehicle/pit assertions. The build script now retries interrupted editor imports up to three times, retains logs and stops immediately on script errors. The underlying first-import engine issue has not been independently diagnosed.

The native project is practice-only. Native race opponents, qualifying, race rules and online multiplayer are not implemented yet. The original compatibility game retains those modes. The native preview does not yet meet the supplied commercial-game image benchmark: facade detail, landscape assets, lighting, cockpit presentation and real-venue placement need further authored and surveyed data. Rendering features and passing tests do not establish that every location is exact or every visual defect is absent.

Engine source: [Godot renderers](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html), [native instance colour requirements](https://docs.godotengine.org/en/stable/classes/class_multimesh.html). Asset licences are included under `licenses`.

Executable SHA-256: `{r['exeSHA256']}`

Resource pack SHA-256: `{r['packSHA256']}`
'''
(N/'docs/VALIDATION.md').write_text(text,encoding='utf-8')
shutil.copy2(N.parent/'upgrade/licenses/NOTICE.txt',N/'licenses/NOTICE.txt')
p=N/'licenses/NOTICE.txt';t=p.read_text().replace('Electron and Chromium: distribution notices accompany the Windows executable.','Native runtime: Godot 4.7.2, MIT. Godot-MIT.txt and Godot-Third-Party.txt contain the engine and dependency notices. The native executable does not contain Electron or Chromium.');p.write_text(t)
print('Wrote native validation and distribution notices.')

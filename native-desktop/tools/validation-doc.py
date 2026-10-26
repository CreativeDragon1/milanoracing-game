"""Write release evidence from measured results, never assumed capabilities."""
from pathlib import Path
import json,shutil
N=Path(__file__).resolve().parents[1]
def read(name):return json.loads((N/'qa'/name).read_text())
r=read('packaged-rendering.json');m=read('packaged-modes.json');v=read('vehicle.json');race=read('race.json');online=read('online.json');ui=read('ui.json');reel=read('home-reel.json')
assert r['exeSHA256']==m['exeSHA256'] and r['packSHA256']==m['packSHA256']
rows='\n'.join(f"| {x['circuit']} | {x['medianMs']:.2f} | {x['p95Ms']:.2f} | {x['race']['physicsMeanMs']:.2f} |" for x in r['reports'])
mode_rows='\n'.join(f"| {x['mode']} | {x['race']['elapsedSeconds']:.1f} | {x['medianMs']:.2f} | {x['p95Ms']:.2f} |" for x in m['reports'])
text=f'''# Native desktop 0.3 validation

The final Windows executable and resource pack were tested on an NVIDIA GeForce RTX 3050 6 GB Laptop GPU with Godot 4.7.2 Forward+/Vulkan. All fourteen circuits completed the final packaged moving-grid samples without script or engine errors. Runtime readback verified stored static instance transforms, and all 22 drivers had finite positions.

## Packaged moving-grid samples

{r['scope']}

| Circuit | Median frame ms | 95th percentile ms | Mean race-model CPU ms |
|---|---:|---:|---:|
{rows}

These are frame-time samples including pacing and the frame cap, not unlimited throughput or minimum-FPS guarantees. A percentile does not capture every worst frame. The QA driver follows the model's optimized line; it is not a human driving the vehicle. Asset loading is outside the frame sample. Other GPUs, temperatures, background applications and camera positions can change results. Ultra is materially more expensive than High and is not the default.

## Longer packaged checks

| Mode | Runtime seconds | Median frame ms | 95th percentile ms |
|---|---:|---:|---:|
{mode_rows}

The Monaco and Spa runs continued through a complete one-lap 22-car race to results. The Singapore run exercised rain and wet materials. The home run exceeded the reel's duration, verified playback after looping, and confirmed 3D rendering was suspended. These are targeted regressions, not a claim that every rendering defect or gameplay bug is absent.

## Simulation, controls and UI

- Race model: {race['checks']:,} checks passed. Complete deterministic races on fourteen circuits, finite positions, qualifying progression, tyre strategy, pit queues, timing and teleport guards. Full qualifying clock settings are checked; expiry is accelerated in the progression tests.
- Vehicle and pits: {v['checks']:,} checks passed. Injected keyboard and gamepad axes, acceleration, braking, progressive steering, centering and complete assisted pit routes on all fourteen circuits. All four original wheel parts rotate. The exported executable separately passed the injected-keyboard smoke test.
- Adaptive pace: {read('learning.json')['checks']:,} synthetic regression and corridor-bound checks passed. This validates bounded local learning, not human-trained driving skill. See [performance and circuit update](PERFORMANCE-UPDATE.md).
- Traffic: {len(read('traffic.json')['reports'])} overtaking and qualifying-yield checks passed. Passing is constrained by space and difficulty, and preparation/cooldown laps yield to approaching push laps.
- Native UI: {ui['checks']} integration checks passed. Footage playback, rendering suspension, race launch, five-light countdown, pit request, tyre choice, pause, new qualifying, grid continuation, practice cleanup and circuit reload were exercised using native button signals.
- Online: {online['checks']} integration checks passed against a temporary private-password loopback Python server. Two native clients logged in, created/joined/readied a room, agreed on the countdown, received state, resumed identity after reconnect and received a server recovery penalty.

Software input is not physical Bluetooth/controller verification. Loopback checks do not establish WAN behaviour, cross-platform interoperability or public-server capacity. The existing server remains Python/aiohttp; no public deployment or access-policy change occurred.

## Cinematic home screen

Four unique native-game shots cover Monza, Singapore, Spa and Milano. Recorded at 60 FPS with scripted cameras, assembled with 0.65-second video and audio crossfades, then delivered as a {reel['seconds']}-second 1280 x 720, 30 FPS Theora loop. FFmpeg decoded both the preview MP4 and shipping OGV without decode errors. Native playback passed across the loop boundary. Menu playback pauses on focus loss and reduced motion; a warmed home screen suspends circuit rendering.

Godot MovieWriter reported ObjectDB leak warnings on shutdown during offline captures. The generated clips completed and decoded; normal runtime and final packaged checks did not report that warning. This capture-only shutdown issue remains recorded rather than being called fixed.

Reel SHA-256: `{reel['sha256']}`

## Geometry and remaining limits

The structure update fits building perimeters to the final terrain and mapped shoreline. Spa's historic endurance garages use local terrain heights, and sectional pit roofs follow their supporting rooms instead of spanning gaps with an elevated slab. Raidillon retains its footprint-bounded terrace canopies. Both Singapore Esplanade shells now have occupied lower podiums and solid edge slabs down to their terrain-fitted bases. Four Monaco frontages have small driving-corridor setbacks. The shared authoring audit covers {sum(len(x['sites']) for x in read('structure-grounding.json')['reports']):,} building sections and {sum(x['checks'] for x in read('structure-grounding.json')['reports']):,} independent ground-contact samples across all fourteen circuits; this is sampled clearance evidence, not surveyed building accuracy. Checks of noninstanced static triangles also distinguish the intentional Monaco tunnel and Suzuka crossover from road obstructions. The repaired geometry is baked into native scenes before launch.

The conversion preserves original MR 26 geometry and source circuit coordinates. The supplied 2colour_livery artwork uses the matching Designer_Livery_UV layout recovered from the supplied preview model. Wheel textures retain their original atlas. The requested inner-sidepod STEM decal is masked in a neutral part of the new atlas. Exact geometry and wheel UVs are unchanged; body UVs intentionally follow the designer layout. Instance metadata is retained on the CPU and uploaded after scene attachment, avoiding lost GPU instance transforms during headless conversion. Tree roots are grounded to authored triangles; unsupported peripheral vegetation was excluded. Native runtime metadata maps every source object, including duplicate-named tiles, to its intended road/facade material.

The venues remain researched reconstructions with inferred dimensions and mixed imagery dates. No new survey data or commercially detailed cockpit was added in this release. This build does not meet the supplied commercial-game reference images or every-detail placement standard. See [ACCURACY.md](ACCURACY.md).

The sporting model includes selected qualifying, race, tyre and pit procedures. It does not include safety cars, red flags, damage, fuel, ERS, DRS or a complete wet-tyre ruleset. Online uses ghost cars and its existing casual server rules.

First-time editor imports have occasionally exited during font processing on this workstation. The build retries interrupted imports up to three times, keeps logs, and stops immediately on script errors. The underlying engine/import issue has not been independently diagnosed.

## Reproduction and sources

`verify-packaged.py`, `verify-modes.py` and `verify-input.py` exercise the exported binary. `test_race.gd`, `test_vehicle.gd` and `test_ui.gd` exercise source subsystems. `verify-online.py` launches the private loopback server. `record-home.py` records and decodes the footage. Evidence JSON is in `qa`; generated captures and working logs are not distributed.

Official renderer and media references: [Godot performance](https://docs.godotengine.org/en/stable/tutorials/performance/optimizing_3d_performance.html), [reflection probes](https://docs.godotengine.org/en/stable/tutorials/3d/global_illumination/reflection_probes.html), [MovieWriter](https://docs.godotengine.org/en/stable/tutorials/animation/creating_movies.html), [VideoStreamPlayer](https://docs.godotengine.org/en/stable/classes/class_videostreamplayer.html) and [HTTPRequest redirect handling](https://docs.godotengine.org/en/stable/classes/class_httprequest.html). Asset licences and adapted V10 attribution are under `licenses`.

Executable SHA-256: `{r['exeSHA256']}`

Resource pack SHA-256: `{r['packSHA256']}`
'''
(N/'docs/VALIDATION.md').write_text(text,encoding='utf-8')
shutil.copy2(N.parent/'upgrade/licenses/NOTICE.txt',N/'licenses/NOTICE.txt')
p=N/'licenses/NOTICE.txt';t=p.read_text().replace('Electron and Chromium: distribution notices accompany the Windows executable.','Native runtime: Godot 4.7.2, MIT. Godot-MIT.txt and Godot-Third-Party.txt contain the engine and dependency notices. The native executable does not contain Electron or Chromium.');p.write_text(t)
print('Wrote native validation and distribution notices.')

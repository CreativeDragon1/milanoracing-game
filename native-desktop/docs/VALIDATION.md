# Native desktop 0.2 validation

The final Windows executable and resource pack were tested on an NVIDIA GeForce RTX 3050 6 GB Laptop GPU with Godot 4.7.2 Forward+/Vulkan. All twelve circuits completed the final packaged moving-grid samples without script or engine errors. Runtime readback verified stored static instance transforms, and all 22 drivers had finite positions.

## Packaged moving-grid samples

Exported Windows executable, 22-car moving grid with deterministic Elite QA driver. First 45 seconds per circuit, 3 second warmup, High preset, 1440x810 window, 144 FPS cap. Partial-lap samples, not minimum-FPS or other-hardware guarantees.

| Circuit | Median frame ms | 95th percentile ms | Mean race-model CPU ms |
|---|---:|---:|---:|
| bahrain | 6.96 | 8.33 | 1.12 |
| singapore | 7.18 | 10.65 | 1.13 |
| monza | 12.07 | 22.99 | 1.23 |
| monaco | 9.83 | 12.23 | 1.29 |
| austria | 8.10 | 9.12 | 1.32 |
| silverstone | 7.66 | 10.83 | 1.36 |
| abu-dhabi | 7.42 | 9.23 | 1.34 |
| milano | 7.14 | 9.58 | 1.31 |
| spa | 8.38 | 11.77 | 1.39 |
| suzuka | 8.00 | 10.67 | 1.29 |
| interlagos | 8.13 | 10.68 | 1.39 |
| zandvoort | 7.18 | 9.06 | 1.42 |

These are frame-time samples including pacing and the frame cap, not unlimited throughput or minimum-FPS guarantees. A percentile does not capture every worst frame. The QA driver follows the model's optimized line; it is not a human driving the vehicle. Asset loading is outside the frame sample. Other GPUs, temperatures, background applications and camera positions can change results. Ultra is materially more expensive than High and is not the default.

## Longer packaged checks

| Mode | Runtime seconds | Median frame ms | 95th percentile ms |
|---|---:|---:|---:|
| full-monaco | 118.6 | 9.78 | 12.91 |
| full-spa | 138.7 | 9.10 | 19.40 |
| rain | 35.0 | 7.72 | 10.88 |
| home | 24.0 | 6.94 | 7.00 |

The Monaco and Spa runs continued through a complete one-lap 22-car race to results. The Singapore run exercised rain and wet materials. The home run exceeded the reel's duration, verified playback after looping, and confirmed 3D rendering was suspended. These are targeted regressions, not a claim that every rendering defect or gameplay bug is absent.

## Simulation, controls and UI

- Race model: 92,053 checks passed. Complete deterministic races on twelve circuits, finite positions, qualifying progression, tyre strategy, pit queues, timing and teleport guards. Full qualifying clock settings are checked; expiry is accelerated in the progression tests.
- Vehicle and pits: 77,911 checks passed. Injected keyboard and gamepad axes, acceleration, braking, progressive steering, centering and complete assisted pit routes on all twelve circuits. All four original wheel parts rotate. The exported executable separately passed the injected-keyboard smoke test.
- Native UI: 14 integration checks passed. Footage playback, rendering suspension, race launch, five-light countdown, pit request, tyre choice, pause, new qualifying, grid continuation, practice cleanup and circuit reload were exercised using native button signals.
- Online: 7 integration checks passed against a temporary private-password loopback Python server. Two native clients logged in, created/joined/readied a room, agreed on the countdown, received state, resumed identity after reconnect and received a server recovery penalty.

Software input is not physical Bluetooth/controller verification. Loopback checks do not establish WAN behaviour, cross-platform interoperability or public-server capacity. The existing server remains Python/aiohttp; no public deployment or access-policy change occurred.

## Cinematic home screen

Four unique native-game shots cover Monza, Singapore, Spa and Milano. Recorded at 60 FPS with scripted cameras, assembled with 0.65-second video and audio crossfades, then delivered as a 17.4-second 1280 x 720, 30 FPS Theora loop. FFmpeg decoded both the preview MP4 and shipping OGV without decode errors. Native playback passed across the loop boundary. Menu playback pauses on focus loss and reduced motion; a warmed home screen suspends circuit rendering.

Godot MovieWriter reported ObjectDB leak warnings on shutdown during offline captures. The generated clips completed and decoded; normal runtime and final packaged checks did not report that warning. This capture-only shutdown issue remains recorded rather than being called fixed.

Reel SHA-256: `afa382aae4de5cafc101e0bf11ee0b8d4de35bcc613cc3db73881e9bfd7e207e`

## Geometry and remaining limits

The conversion preserves original MR 26 geometry, artwork and source circuit coordinates. Instance metadata is retained on the CPU and uploaded after scene attachment, avoiding lost GPU instance transforms during headless conversion. Tree roots are grounded to authored triangles; unsupported peripheral vegetation was excluded. Native runtime metadata maps every source object, including duplicate-named tiles, to its intended road/facade material.

The venues remain researched reconstructions with inferred dimensions and mixed imagery dates. No new survey data or commercially detailed cockpit was added in this release. This build does not meet the supplied commercial-game reference images or every-detail placement standard. See [ACCURACY.md](ACCURACY.md).

The sporting model includes selected qualifying, race, tyre and pit procedures. It does not include safety cars, red flags, damage, fuel, ERS, DRS or a complete wet-tyre ruleset. Online uses ghost cars and its existing casual server rules.

First-time editor imports have occasionally exited during font processing on this workstation. The build retries interrupted imports up to three times, keeps logs, and stops immediately on script errors. The underlying engine/import issue has not been independently diagnosed.

## Reproduction and sources

`verify-packaged.py`, `verify-modes.py` and `verify-input.py` exercise the exported binary. `test_race.gd`, `test_vehicle.gd` and `test_ui.gd` exercise source subsystems. `verify-online.py` launches the private loopback server. `record-home.py` records and decodes the footage. Evidence JSON is in `qa`; generated captures and working logs are not distributed.

Official renderer and media references: [Godot performance](https://docs.godotengine.org/en/stable/tutorials/performance/optimizing_3d_performance.html), [reflection probes](https://docs.godotengine.org/en/stable/tutorials/3d/global_illumination/reflection_probes.html), [MovieWriter](https://docs.godotengine.org/en/stable/tutorials/animation/creating_movies.html), [VideoStreamPlayer](https://docs.godotengine.org/en/stable/classes/class_videostreamplayer.html) and [HTTPRequest redirect handling](https://docs.godotengine.org/en/stable/classes/class_httprequest.html). Asset licences and adapted V10 attribution are under `licenses`.

Executable SHA-256: `c872fb81c8737fe2bd3bfa9ed9d724a7508d4990abbd5fb734ab3f1fae83a16d`

Resource pack SHA-256: `67a4ec0577422ef062b47aa49081677b1430cd8e05b57f05a2c6517ce3f7999f`

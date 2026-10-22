# Native desktop validation

The Windows preview is built with Godot 4.7.2 Forward+. All twelve circuits were launched from the exported executable and resource pack on an NVIDIA GeForce RTX 3050 6 GB Laptop GPU. No script or engine errors were reported by those final runs. Runtime readback confirmed the stored instanced geometry transforms on every circuit.

## Render sample

Exported Windows executable. Stationary driving view, 3 second warmup, 9 second sample, High preset, 1440x810 window, 144 FPS cap. Not a full-race benchmark.

| Circuit | Median frame ms | 95th percentile ms | Verified static instances |
|---|---:|---:|---:|
| bahrain | 8.45 | 12.62 | 110,468 |
| singapore | 11.23 | 20.02 | 134,373 |
| monza | 18.24 | 25.68 | 85,130 |
| monaco | 6.98 | 8.27 | 122,410 |
| austria | 13.48 | 20.82 | 85,926 |
| silverstone | 7.51 | 11.47 | 146,828 |
| abu-dhabi | 6.99 | 11.25 | 122,454 |
| milano | 7.63 | 10.61 | 44,339 |
| spa | 18.88 | 24.86 | 45,634 |
| suzuka | 10.28 | 13.51 | 56,659 |
| interlagos | 7.52 | 10.82 | 71,613 |
| zandvoort | 7.08 | 9.94 | 15,262 |

These measurements include rendering, frame pacing and the frame cap. They do not measure unlimited throughput, minimum FPS, a moving full-grid race or other computers. Shader compilation, camera movement, temperature and other applications can change performance. No cross-engine speed comparison is claimed.

## Controls and pits

The native vehicle/pit suite passed 77,907 checks, with no reported failures. It injects keyboard input, checks progressive steering and centering, accelerates and brakes, and traverses every assisted pit route through service and rejoining. Four rotating wheel parts were identified. The exported executable separately responded to injected keyboard acceleration and produced finite vehicle coordinates. This is software-input verification, not physical Bluetooth/controller testing or real-car correlation.

## Geometry checks

The conversion preserves original MR 26 geometry and artwork. Native instance metadata is kept on the CPU because headless conversion cannot reliably retain GPU instance state. It is uploaded on scene attachment and checked after rendering. This fixed missing windows, railings and fixtures.

Trees retain their original X/Z positions. Roots were checked against authored ground triangles; peripheral trees with no ground beneath them were omitted from the native preview. This prevents unsupported vegetation outside the actual terrain mesh. Existing source references, inferred dimensions and imagery dates are described in [ACCURACY.md](ACCURACY.md).

## Remaining work

The source archive was extracted into a fresh folder and imported without the original Godot cache. The first editor import exited during font processing; the second completed and the extracted source passed all 77,907 vehicle/pit assertions. The build script now retries interrupted editor imports up to three times, retains logs and stops immediately on script errors. The underlying first-import engine issue has not been independently diagnosed.

The native project is practice-only. Native race opponents, qualifying, race rules and online multiplayer are not implemented yet. The original compatibility game retains those modes. The native preview does not yet meet the supplied commercial-game image benchmark: facade detail, landscape assets, lighting, cockpit presentation and real-venue placement need further authored and surveyed data. Rendering features and passing tests do not establish that every location is exact or every visual defect is absent.

Engine source: [Godot renderers](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html), [native instance colour requirements](https://docs.godotengine.org/en/stable/classes/class_multimesh.html). Asset licences are included under `licenses`.

Executable SHA-256: `9e238ce618e459c31ce5faa1b4a4874b7237e7260b5fd2a73a290f66efeabfa4`

Resource pack SHA-256: `6570269df34fe306a9f054b55800e147c5bb430f5422ec2da0a94d6d4657ff19`

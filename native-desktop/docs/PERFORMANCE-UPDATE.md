# Milano Racing performance update

The browser and independent native desktop game now share fourteen circuits. The two additions are original designs: Milano Riviera (4.890 km, 12 turns) and Milano Solara (5.969 km, 14 turns). Riviera has coastal terraces, a harbour setting and a lighthouse. Solara has layered desert mesas, solar structures and a shaded paddock.

## Circuit design

Both use 14 m minimum road width, 17 m grids, flat grid sections, continuous-curvature transitions and separate pit routes. Their longest straights are 1.002 km and 1.171 km; the first turns begin 657 m and 743 m after the start. Elevation gradients peak at approximately 6.8%. Six sponsor groups receive dedicated zones on each circuit, using their original proportions.

The design reference is the FIA's [2026 Appendix O](https://www.fia.com/system/files/documents/appendix_o_2026_published_23122025.pdf), particularly its circuit length, straight length and width guidance. These are fictional game circuits, not FIA-homologated designs. Real runoff dimensions, barriers, drainage and homologation require vehicle-specific safety engineering. The game's physics and numerical checks do not provide that certification.

The lines are optimized with bounded lateral offsets, curvature costs and forward/backward speed constraints using tyre grip, downforce, braking and elevation. Riviera's local solver converged. Solara improved on its centreline result but reached its 38-iteration limit; neither result is claimed to be a global optimum. The same paths feed the guide and AI, with difficulty and tyre modifiers.

## Work removed from play

- Native vegetation, ground detail, car distance LODs and GPU instance buffers are prepared during the build instead of being constructed on each circuit load.
- Browser opponents share geometry submissions while retaining individual transforms, wheel animation and materials. Fixed scenery transforms are cached.
- A precomputed range-query structure replaces repeated AI road-clearance scans in both games. Physics still runs at 120 Hz with the full 22-car field.
- Native HUD updates run at 10 Hz; distant opponents keep their race simulation but avoid unnecessary wheel animation and shadow work.
- Browser circuit data decodes on selection. Circuit cards use small previews. Once decoded, hot-path values become direct properties.
- Browser tree instance transforms are cached. The original near-tree detail and shadow distances are retained. Fixed spatial groups and cached camera state reduce repeated foliage selection work. Ambient occlusion is computed at half resolution with depth-aware reconstruction. The main image, normals and depth remain at full resolution.

These follow Godot's guidance on [MultiMesh buffers](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html) and [pipeline compilation](https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html). Performance gains still depend on CPU, GPU, resolution, scene, thermal state and background applications. The accompanying measurement report separates simulation CPU costs from complete frame times.

## Steering and camera

Short keyboard taps now build steering progressively, with faster centering on release. Controller steering retains quick corrections with a bounded slew rate, deadzone and response curve. Artificial kerb yaw and cosmetic vertical shaking are removed. Camera targets and vehicle motion use interpolated poses and continuous track samples.

## Adaptive rivals

Adaptive rivals is available in pre-race setup. Clean offline race and qualifying laps fit a regularized five-weight pace model locally. It uses curvature, target speed, slope and width. Training runs between sessions; the profile is frozen throughout each race. Difficulty order and physical speed limits remain enforced. Adaptation is deliberately limited to a 0–6% pace adjustment, so one bad session cannot radically change the field.

The option can be disabled, and Reset learning clears the saved weights. Raw driving traces are not uploaded. Synthetic held-out tests demonstrate that the model can learn a pace relationship; this is not a claim that a large human-trained driving policy has been built. Physical controllers and Internet multiplayer still need separate hardware and WAN checks.


## Pit facilities and merges

Two procedural stand builders had their rotation sign reversed; seating now faces the circuit. Mapped stand sections retain their geographic orientation and receive a direction check. Some street circuits have no mapped grandstand sections in this dataset; the audit does not invent a coverage claim for them.

Mapped pit buildings have service-lane-facing recessed garage bays, lights, numbered fascias and equal sponsor allocations. Their floor elevations follow the working lane. Aprons extend to the garage thresholds; road and apron footprints are clipped from the ground together. Original venues and Monaco's temporary service area receive recessed modular garages where the race surface and existing buildings remain clear. Monza's service stop is located opposite the mapped Palazzina Box rather than the hospitality building.

Pit routes are faired and constrained to stay clear of the racing surface through the working corridor. Curvature-continuous endpoint joins replace hooks. A one-metre resampling supports steering and curvature-based speed planning. The intentional Yas Marina underground crossing is handled separately. These corrections reconcile mapped routes with the game's reconstructed widths; they are not new surveyed pit alignments.

Paint is omitted through the 120 m entry and exit transitions and wherever it would cross the racing surface. Pit entry blends decay the initial position error while the car continues moving, replacing the old stationary-start interpolation. Both native pit modes and browser race assist turn the wheels with the path, preserve yaw at the exit and retain the final assisted position for the handover.


## Loading, livery and traffic revision

Circuit construction now yields between bounded jobs while the loading screen stays responsive. The browser waits for the final image batch before enabling play. Native loading stages restore prepared scenery in small batches, apply surface materials incrementally and warm the renderer before handing over control. These changes retain the selected texture resolution, scenery and lighting settings.

The supplied Livery_FINAL artwork now uses the exact Designer_Livery_UV layout recovered from the supplied preview model. Positions, normals and wheels are unchanged. The requested inner-sidepod decal removal is retained. The desktop icon uses the original Milano logo on transparency, proportionally fitted without a border.

Short steering corrections use a progressive centre response. Full input retains the available steering angle; braking while turning uses a combined grip budget. AI drivers commit to an available passing lane until the move is clear, and preparation/cooldown laps yield to approaching qualifying push laps. Difficulty and space constraints remain enforced.

Pit garage volumes are clipped to the safe parts of mapped footprints, with separate overhead roofs. Bridge supports check both road and pit routes. Grandstands use final visible terrain heights for footing and seating clearance. A solid-geometry corridor audit covers all fourteen venues; it is a sampled check, not a proof that every mesh or camera view is defect-free.


## 25 October timing and typography pass

The interface uses regular Michroma throughout, including the driving HUD and map. Race and qualifying clocks use one rounded simulation time. Speed profiles reuse buffers and propagate squared-speed braking envelopes with equivalent results. Circuit asset requests are bounded, scenery and light creation yield between batches, and completed resources are collected without waiting on an unfinished background request. Day/night sky resources are reused; incremental filtering retains 512-pixel radiance maps and full-quality importance sampling. The garage allows reflections to finish before the driving session starts after a circuit change.

The current private website also provides a Windows ZIP download. Public builds exclude the page, game endpoints and ZIP; the preview remains loopback-only. Current benchmark evidence is in `qa/performance-comparison.json`; earlier tables remain historical.

## Measured packaged build for this pass

High, 1440 x 810, 22 moving cars, 30 seconds per sample, one GPU test at a time. Same restored instance counts. These are single sequential samples with uncontrolled background variation.

| Circuit | Median before / after (ms) | p95 before / after (ms) |
|---|---:|---:|
| singapore | 9.408 / 8.514 | 15.471 / 13.822 |
| suzuka | 10.483 / 8.857 | 18.204 / 17.509 |
| interlagos | 10.95 / 8.775 | 19.179 / 11.375 |

Loading duration and maximum loading gaps did not improve uniformly. The packaged build passed all fourteen circuit smoke runs, full Monaco and Spa race runs, a wet Singapore run, keyboard input and 63 UI checks. Physical controllers, WAN multiplayer and every possible camera/terrain viewpoint remain outside these checks.

Resource pack: 86323637ca14507cb16317ccc93a758c93d9dca2cd97c320f6209954a371b5ef

## Human handling and working pit-stop release

Steering, reverse, pit skipping and the responsive standings/strategy layout are covered in DRIVING-UPDATE.md. The crew exchanges only wheel assemblies: ten fixed axle/hub pieces remain attached in one shared draw batch per car. New opponent models cannot inherit removed wheels or a pit jack lift. The browser practice-mode idle-pose error is repaired and finite geometry is checked during service.

Idle crew poses no longer interpolate or upload unchanged geometry. Active service retains the articulated animation and synchronized pneumatic gun, jack and tyre effects. The native qualifying pit-exit skip completed in about 3.2 seconds in the UI test; this is a local observation, not a cross-device timing guarantee.

The final checks cover all 14 circuit loads, browser offline shader linking, packaged 22-car desktop grids, full Monaco and Spa desktop races, wet Singapore, home playback, keyboard input, synthetic controller inputs, pit service and pit exits. Physical-controller feel and pairing were not tested. Graphics presets, supplied livery and circuit detail are retained; no public deployment was performed.

The following are single 30-second High-preset samples at 1440 x 810 on this laptop, with one GPU test at a time. Background and thermal variation are uncontrolled. They are not minimum-FPS guarantees or evidence that all stutters are eliminated.

| Circuit | Median ms | p95 ms | p99 ms | Frames above 50 ms |
|---|---:|---:|---:|---:|
| bahrain | 9.14 | 13.25 | 14.16 | 0 |
| singapore | 10.61 | 16.95 | 19.81 | 0 |
| monza | 18.02 | 27.65 | 32.50 | 0 |
| monaco | 10.84 | 14.59 | 15.33 | 0 |
| austria | 8.97 | 12.30 | 14.95 | 0 |
| silverstone | 10.12 | 13.37 | 16.00 | 0 |
| abu-dhabi | 10.83 | 19.06 | 22.68 | 1 |
| milano | 10.72 | 16.98 | 19.65 | 0 |
| spa | 10.98 | 19.36 | 23.70 | 0 |
| suzuka | 9.01 | 16.47 | 21.16 | 1 |
| interlagos | 10.22 | 16.50 | 18.19 | 0 |
| zandvoort | 8.84 | 15.06 | 18.53 | 3 |
| riviera | 7.87 | 10.29 | 12.11 | 0 |
| solara | 9.05 | 13.77 | 16.37 | 0 |

Tested artifact SHA-256: `9f4d5d54fc3fddd7887ad1a6c787522733cca6f437f3f92428b877f18f19ee80`

## October 26 update and screen-fitting build

Fresh 30-second samples, High preset at 1440×810, one renderer at a time. Background load and temperatures were not controlled. The update retains existing graphics settings and scenery detail; these samples are regression evidence, not an FPS improvement claim or a no-stutter guarantee. Wider or larger windows may require more GPU work.

| Circuit | Median ms | p95 ms | p99 ms | Frames above 50 ms |
|---|---:|---:|---:|---:|
| bahrain | 22.19 | 31.64 | 37.09 | 3 |
| singapore | 18.05 | 29.82 | 35.66 | 4 |
| monza | 29.27 | 56.18 | 69.09 | 86 |
| monaco | 25.79 | 34.44 | 40.56 | 3 |
| austria | 13.64 | 19.08 | 25.91 | 2 |
| silverstone | 22.53 | 37.53 | 43.80 | 6 |
| abu-dhabi | 27.56 | 33.96 | 39.92 | 2 |
| milano | 26.14 | 34.21 | 41.18 | 1 |
| spa | 20.97 | 28.21 | 34.04 | 4 |
| suzuka | 24.05 | 35.92 | 42.88 | 1 |
| interlagos | 26.46 | 34.19 | 38.94 | 3 |
| zandvoort | 11.08 | 20.93 | 22.99 | 0 |
| riviera | 28.25 | 37.20 | 46.08 | 7 |
| solara | 17.40 | 33.64 | 37.34 | 1 |

Tested artifact SHA-256: `c00b053e8861154e0e735d3763425f25954be316984fead8516fac6e6c9c3c61`

Consecutive previous/current/previous Singapore comparison: median 10.85 / 17.70 / 17.48 ms; p95 22.69 / 24.50 / 30.88 ms. All three retained 183,054 static instances. The repeat of the previous build demonstrates substantial run-to-run variation; these samples do not establish a stable FPS improvement or regression. Raw records are in qa/screen-performance.json.

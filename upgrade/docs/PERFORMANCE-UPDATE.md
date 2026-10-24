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

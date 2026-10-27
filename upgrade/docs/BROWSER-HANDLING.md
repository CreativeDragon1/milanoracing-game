# Browser handling — 27 October 2026

Handling assist is on by default in Garage → Controls. It responds to the player's steering. It never selects a racing line, presses the brake, limits speed to a circuit schedule or releases the accelerator. This replaces the automatic corner-braking system from the previous build.

## Driving behaviour

- Short keyboard taps remain progressive. Continuing to hold a turn builds more steering authority, helping a late input become an effective turn.
- Committed turns receive up to 22% additional tyre-grip reserve and stronger yaw/slip stabilization. The reserve blends with steering input and tapers at very high speeds. Wet tyres and off-track surfaces retain their grip penalties.
- Controller input uses one response curve after its deadzone, retaining proportional steering and full lock. Direction changes and release remain bounded and smooth.
- The player owns both pedals. Pressing the brake still takes priority over a held accelerator, and the existing reverse sequence remains available.
- Racing-line colours and braking cues are recommendations only. They do not command the vehicle. Switching the line off does not change handling support.
- Assistance can be disabled for the unassisted vehicle model. The saved setting from the previous Corner assist control is preserved under the new Handling assist label.

The extra grip is a game assistance choice, not a claim about a real car's tyre performance. Players still need to slow for sufficiently tight corners; the game does not guarantee recovery from every speed or input.

## Verification

- `input-assist.cjs`: delayed steering inputs, short high-speed taps, release, countersteering, wet grip and independence from the racing-line target. Compares pedal behaviour with the previous scheduled-braking build. No automatic brake application is permitted.
- `beginner-handling.cjs`: input mappings and vehicle equations; partial-stick response, conflicting pedals, held steering, reverse and absence of automatic steering/braking.
- `beginner-circuits.cjs`: a software driver supplies both pedals and steering at 10 Hz, with a 100 ms control delay, on all 14 circuits. Its speed planner exists only in the test. This replaces the previous held-throttle test, which depended on automatic game braking.
- `physics.cjs`: two laps per circuit using the unassisted vehicle, including force constraints and track-limit/barrier checks.
- `beginner-browser.cjs`: rendered control, saved On/Off selection, keyboard events, software controller input, guide cues and reset.
- `player-controls-browser.cjs` and `pit-skip.cjs`: pit handover, responsive HUD, reverse, reset, disconnect and race-time/service accounting.

All circuit driving checks are automated regression tests. They do not establish human enjoyment or physical controller feel. No physical PlayStation/Xbox controller was paired for these checks.

## Interlagos pit exit

The rendered pit path intersected the circuit's walls/fences at three locations around pit-route samples 775, 799 and 927. The old opening check tested only the first endpoint of a barrier panel. Long diagonal panels could cross the lane even when that endpoint was outside it.

Opening detection now checks the whole panel against continuous pit segments, with lane-width clearance and height separation. A spatial index and cached answers keep this construction-time check out of the driving loop. Separate road decks, including the road above Yas Marina's pit tunnel, are preserved.

`pit-exit-clearance.cjs` checks the car-width path at multiple heights and exercises the driving cameras. Its report records the exact HTML tested. The Interlagos pit exit in the browser model is open-air; the ceiling report is checked using those camera views rather than assuming that the route should have a tunnel.

Rear cameras now follow the pit floor beneath the camera on slopes. Where a real pit tunnel exists, the wide and aerial views lower gradually before the entrance and retain roof and side-wall clearance. Checks cover 8,730 Interlagos and 6,993 Yas Marina car-path rays, all four fixed camera modes and moving wide/aerial tunnel transitions. These checks found no overhead mesh at the sampled Interlagos exit positions; they do not establish the exact cause of the separately reported apparent ceiling.

The separate surface-flicker investigation found a 12 mm strip of main-road geometry left beneath the pit edge. Near Interlagos's joins, the two asphalt layers were only 2–27 mm apart. Ground clipping now uses the exact asphalt boundary rather than an inset. `pit-surfaces.cjs` samples the lane centre and both edges, including 6 mm inside the boundary, and checks for holes, intrusions and nearly coplanar competing surfaces. This changes mesh fitting without reducing texture or scenery quality.

The handling changes add no rendering work or per-frame path solver. Textures, materials, scenery detail and the 120 Hz timestep are retained. Shader compilation and offline-load reports record the exact released HTML hash.

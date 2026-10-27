# Browser handling — 27 October 2026

The preserved Team Edition is the reference for steering and pedal response. The later stacked response curves and steering-dependent grip boosts have been removed. The current circuits, vehicle power, reverse gear and device layouts remain.

## Driving behaviour

- One time-based steering filter is shared by keyboard, controller and touch. Its response is the original Team Edition formula: 7.8 to 6 per second as speed rises, with return to centre at 9 per second. Filtered input maps directly to the available steering rack.
- Throttle and brake use the original progressive pedal ramps. Controller axes retain the current linear deadzone mapping; touch retains the current thumb pad. This restores the common response, not every old input-mapping or vehicle parameter.
- Handling assist is on by default. It makes the actual direction of travel follow the filtered steering request, bounded by available grip. The former tyre/stability blend reduced yaw after steering, then residual sideways velocity made the trajectory run wide even when the nose had turned. Assisted travel now removes that conflicting slip. With the aid off, the dynamic tyre/slip model remains.
- This is a beginner handling aid, not a claim of real-car tyre fidelity. Wet tyres, off-track grip and cornering limits remain; excessive speed can still exceed what a corner allows.
- Both pedals remain under player control. Braking takes priority over held throttle. Reverse still requires stopping, releasing the brake, then holding it again. The racing line does not steer, brake or impose a speed schedule.

## Steady driving camera

Chase now stays on the car's centreline at a fixed distance, height and field of view. Wide Chase, Nose and Aerial also use fixed framing. There is no corner look-ahead pan, sideways orbit or speed-dependent zoom. Both camera endpoints use the same interpolated car pose, so separate position/aim filters cannot swing the car across the screen. The horizon stays level through banking.

Clearance checks retract the rear camera along the same viewing axis when necessary, then ease it back out. Road decks take precedence over the surrounding terrain height field; nearby hills and upper levels no longer lift a camera that is over the road. Floor clearance remains, and the higher camera modes lower progressively before pit tunnels. These safety adjustments are distinct from the removed cinematic movement.

`driving-camera.cjs` checks all four views at 30, 60, 120 and 144 Hz, speed independence, heading wrap, obstacles, terrain clearance and resets. `driving-camera-browser.cjs` samples Chase and Wide Chase around all 14 rendered circuits and records framing, clearance and camera-update cost. `pit-exit-clearance.cjs` checks the actual pit/tunnel camera positions and moving transitions. These checks do not establish physical-device comfort or whole-game frame rates.

## Phone and tablet controls

Phones render the game in landscape. If the browser viewport remains portrait because of rotation lock, the page rotates its game canvas, menus and HUD together. Touch coordinates rotate with the game. This works within the page and does not change the operating system's rotation-lock setting or depend on fullscreen permission. The native [Screen Orientation lock API](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock) has limited browser support and may require fullscreen, so it is not the fallback used here.

The phone HUD keeps the lap clock, position, map, speed and compact pit controls. The full standings table and secondary telemetry are hidden while driving. Phone home controls and all six partners fit the landscape screen; settings keep their tabs and Done button visible while the controls scroll inside the panel. The pause menu uses two columns. iPad retains the larger HUD with raised thumb controls and wider spacing. Safe-area insets rotate with the phone view.

Steering responds immediately when a player taps the left or right side of the pad; dragging adjusts the request continuously. There is no extra touch-only response exponent. Full steering travel is 52 CSS pixels on phones and 66 on tablets, capped for smaller pads. GO and BRAKE accept a separate finger while steering stays held, and that finger can slide between the pedals without lifting. Cancellation, backgrounding and rotation release held controls; rotating during a session pauses the game.

## Verification

- `classic-handling.cjs` replays the preserved Team Edition input and rack requests at identical vehicle states. It checks release, left/right symmetry, proportional steering, keyboard/controller/touch requests, brake priority, reverse, variable timesteps, wet grip, guide independence and agreement between steering and actual travel. The report identifies the tested handling source by SHA256.
- `physics.cjs` runs two laps per circuit with the current default aid, checks the speed planner's force constraints and rejects barrier contacts and lap invalidations.
- `beginner-circuits.cjs` uses a software gamepad driver at 10 Hz with a 100 ms input delay. Its preview now includes the restored filter's settling time (0.7 seconds rather than 0.4); its speed schedule is unchanged. The earlier preview relied on the removed extra grip to recover overshoots. This is a test-driver adjustment, not automatic steering or braking in the game.
- `beginner-browser.cjs`, `touch-driving-browser.cjs` and `webkit-mobile.cjs` check rendered keyboard/gamepad input, saved assistance, multi-touch steering/pedals and phone/tablet layout. `player-controls-browser.cjs` and `pit-skip.cjs` check reverse, pit handover, reset and pause behaviour.
- The older `human-handling`, `beginner-handling`, `turn-in` and `input-assist` comparative reports refer to superseded tuning. They are historical, not current release evidence. The release gate instead requires the preserved-response replay and fresh all-circuit driving checks.

These are software and browser-emulation tests. They do not establish human enjoyment, physical controller feel or real iPhone/iPad ergonomics. No physical controller was paired for these checks.

## Interlagos pit exit

The rendered pit path intersected the circuit's walls/fences at three locations around pit-route samples 775, 799 and 927. The old opening check tested only the first endpoint of a barrier panel. Long diagonal panels could cross the lane even when that endpoint was outside it.

Opening detection now checks the whole panel against continuous pit segments, with lane-width clearance and height separation. A spatial index and cached answers keep this construction-time check out of the driving loop. Separate road decks, including the road above Yas Marina's pit tunnel, are preserved.

`pit-exit-clearance.cjs` checks the car-width path at multiple heights and exercises the driving cameras. Its report records the exact HTML tested. The Interlagos pit exit in the browser model is open-air; the ceiling report is checked using those camera views rather than assuming that the route should have a tunnel.

Rear cameras now follow the pit floor beneath the camera on slopes. Where a real pit tunnel exists, the wide and aerial views lower gradually before the entrance and retain roof and side-wall clearance. Checks cover 8,730 Interlagos and 6,993 Yas Marina car-path rays, all four fixed camera modes and moving wide/aerial tunnel transitions. These checks found no overhead mesh at the sampled Interlagos exit positions; they do not establish the exact cause of the separately reported apparent ceiling.

The separate surface-flicker investigation found a 12 mm strip of main-road geometry left beneath the pit edge. Near Interlagos's joins, the two asphalt layers were only 2–27 mm apart. Ground clipping now uses the exact asphalt boundary rather than an inset. `pit-surfaces.cjs` samples the lane centre and both edges, including 6 mm inside the boundary, and checks for holes, intrusions and nearly coplanar competing surfaces. This changes mesh fitting without reducing texture or scenery quality.

The handling changes add no rendering work or per-frame path solver. Textures, materials, scenery detail and the 120 Hz timestep are retained. Shader compilation and offline-load reports record the exact released HTML hash.

# Browser handling update — 27 October 2026

Corner assist is enabled by default, including for existing saved settings. It can be disabled in Garage → Controls. It manages entry speed and the return to throttle; the player still chooses every steering input. It works in practice, qualifying and races, with the visual racing line either on or off.

## What changed

- Removed a second, speed-dependent stick response curve that was weakening partial controller inputs before they reached the steering rack. The deadzone, one progressive response curve and full steering lock remain.
- Faster direction changes on keyboard and controller, with bounded input rates and prompt centering. High-speed key taps retain their progressive buildup.
- A separate corner-assist speed profile uses the actual centre-road curvature, elevation, bank and vehicle limits, with a grip reserve for corrections. It does not assume that the player follows the optimized racing line. The profile is calculated when the car setup changes, then cached.
- Preview braking includes the planned deceleration into a bend. Braking transitions through coasting to acceleration, instead of leaving the engine fighting the brakes when the accelerator is held.
- Racing-line colours and speed/braking cues follow the selected assistance setting. Switching off the visual line does not disable assistance.
- Resetting or driving through the pits clears the previous assisted-brake state. Reverse remains controlled by the player's pedals.

The renderer, materials, scenery detail, physics timestep and rival simulation are unchanged by this handling update. The extra driving work is a cached profile lookup and simple arithmetic, with no path solver in the physics loop.

## Verification

- `beginner-handling.cjs`: real input mappings and vehicle equations; partial-stick turning radius, conflicting pedals, direction changes, release, reverse, assist-off and absence of automatic steering.
- `beginner-circuits.cjs`: a simple software gamepad follower updates at 10 Hz, holds the accelerator and follows the centre of all 14 circuits. All completed a lap without barrier contacts or track-limit invalidations.
- `physics.cjs`: two laps on every circuit with the existing speed/steering driver and assistance unavailable. This checks that manual driving retains the vehicle's force constraints and clean-lap behaviour.
- `beginner-browser.cjs`: rendered controls, existing-settings migration, saved On/Off selection, keyboard events, software controller input, guide cues, setup refresh with the line hidden and reset.
- `player-controls-browser.cjs` and `pit-skip.cjs`: controller pit skip, responsive HUD, fade, reverse, reset, disconnect and unchanged race-time/service accounting.
- Release checks cover every circuit loading offline and shader compilation, including the fallback path. Their reports record the exact released HTML hash.

The circuit follower is an automated regression test, not a claim of human playtesting. PlayStation/Xbox mappings were exercised in software; physical controller hardware has not been tested in this update. Performance and handling feel on the player's actual machine still depend on its browser, display, input hardware and running applications.

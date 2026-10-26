# Driving and pit-stop update

Keyboard steering now reaches useful lock sooner at low speed. Controller response keeps a gentle centre at high speed, while allowing tighter low-speed turns. Full steering remains available without the car steering itself toward the racing line. The AI planner is unchanged.

Reverse uses the brake control: stop, release the brake, then press it again. The left trigger does the same on a standard Xbox or PlayStation controller. Reverse is limited to 28.8 km/h. Throttle first brakes reverse motion, then selects forward drive. The HUD displays R. Normal braking and automatic braking assistance cannot silently select reverse while stopping. Repeated start-line crossings cannot award false lap times.

During an assisted solo pit drive, select **Skip pit drive**, press **K**, or press **D-pad right**. A short fade covers the accelerated simulation; all competitors, clocks and tyre service advance together. The simulation yields between batches to keep the transition responsive. Skipping is unavailable online. Desktop practice pit stops also support skipping.

Standings and strategy share a responsive layout, with a compact classification on small landscape screens. The desktop HUD now recognises race-director pit status as well as practice stops.

The ten-person pit crew uses shared geometry in 13 instanced batches. Wheel-gun operators, tyre handlers and jack operators follow the service timeline. The car is visibly lifted, only its wheel assemblies are removed and refitted while the axle shafts, hubs and chassis remain attached, and the crew clears after service. Procedural pneumatic-tool, jack and tyre sounds follow the same timeline and the existing master volume. Skips silence those effects. The desktop uses an offline-baked copy of the same crew and animation.

Validation includes deterministic input manoeuvres, synthetic standard-gamepad triggers and axes, responsive rendered HUD checks, browser stop-versus-skip state equivalence on all 14 circuits, and rendered service checks. These do not substitute for hands-on testing of a physical controller or guarantee the absence of every rendering or performance issue.

Desktop pit skipping advances the entire race at 20 Hz while the view is covered, then restores all car poses once. Browser skipping retains the ordinary 120 Hz timestep. The desktop route avoids repeated hidden wheel and render work; opponent trajectories can differ slightly from a continuously rendered run because of its larger timestep.

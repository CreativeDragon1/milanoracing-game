# Milano Racing native desktop

Version 0.2 is an independent Windows game built with Godot 4.7.2 Forward+ and Vulkan. It uses native scenes and GDScript, with the original MR 26 geometry, sponsor artwork and researched circuit assets. Godot supplies the graphics engine and platform runtime; Milano's gameplay and asset pipeline live here.

## Play

Extract the entire `Milano-Racing-Native-Windows.zip` folder. Run `Milano Racing Native.exe` and keep its `.pck` alongside it. High is the default graphics setting. No server or account is needed for offline modes. This is a portable, unsigned executable, with no installer or automatic updater.

The home screen plays a recorded four-shot sequence through Monza, Marina Bay, Spa and Milano Autodromo. Choose RACE, GRAND PRIX or FREE PRACTICE, select the circuit and start. ONLINE opens the private-server lobby. SETUP contains graphics, lighting, weather, steering, volume, racing guide and reduced-motion preferences. Preferences stay on this computer; the server password and login cookie are not written to disk.

| Action | Keyboard | Standard controller |
|---|---|---|
| Drive | WASD or arrows | Left stick and triggers |
| Brake | S / down / Space | Left trigger |
| Camera | C | Y / Triangle |
| Request pit stop | P | X / Square |
| Next pit compound | T | Right shoulder |
| Recover | R | Back / Select |
| Garage / pause | Esc | Start / Options |
| Fullscreen | F11 | — |

Pair Bluetooth controllers in Windows first. Software-injected gamepad axes have been tested; physical controller pairing and device-specific mappings still need hardware testing. Recovering during a race adds a time penalty.

## Sessions

- **Race:** 22 cars, five-light start, four difficulties, 3 / 5 / 10 laps or a shortened distance. Progressive steering and Rookie braking assistance make the first difficulty more forgiving.
- **Grand Prix:** a five-minute qualifying session or Q1 / Q2 / Q3, followed by the earned grid. Full qualifying uses 18 / 15 / 13 minutes with 22 / 16 / 10 drivers, timed flying laps, elimination and earliest-time tie breaking.
- **Pit strategy:** soft / medium / hard compounds, wear, a queued assisted pit lane, service and rejoining. Races of five or more laps require two compounds. Pit routes and service are game reconstructions, with a shared service point rather than separate team garages.
- **Practice:** open running with the same vehicle, circuit and pit controls.
- **Online:** room codes, ready states, host start, server-owned countdown and results, interpolated remote cars and reconnection. Online is a casual ghost race; it does not use offline AI, car contact or compound rules.

This implements a selected sporting model, not every FIA procedure. Safety cars, red flags, damage, fuel management, ERS and DRS are not implemented. Rain changes grip and rendering; a full wet-tyre ruleset is not implemented. Qualifying tests verify the full clock settings and accelerate clock expiry for stage-progression coverage.

## Rendering and performance

The native renderer adds physically based asphalt and facade detail, wet-road clearcoat, water ripples, tyre spray, rain particles, local night shadows, rubber on the racing line and speed-sensitive cameras. Original logos and MR 26 artwork remain intact. High combines FSR2, screen-space reflections, ambient occlusion, indirect screen-space lighting, volumetric fog and native mesh/vegetation LODs. Ultra adds SDFGI and larger shadow maps and costs substantially more GPU time.

The 17.4-second home sequence was recorded from the native game at 60 FPS using scripted cameras. Its shipped 720p30 Theora version has four unique shots, crossfades and matching engine-audio fades. Once playback is ready, the menu suspends circuit rendering and caps itself at 60 FPS. Gameplay returns to a 144 FPS cap. Reduced motion pauses the footage; losing focus pauses playback as well.

All twelve circuits are included: Bahrain, Singapore, Monza, Monaco, Austria, Silverstone, Abu Dhabi, Milano Autodromo, Spa, Suzuka, Interlagos and Zandvoort. They are researched reconstructions, not surveyed digital twins. The native release has not reached the supplied commercial-game visual benchmark. See [measured validation](docs/VALIDATION.md) and [geometry provenance](docs/ACCURACY.md) for the remaining accuracy and testing limits.

## Private online play

The native client uses the existing Python/aiohttp server in `upgrade/server`. Keep the website private, use its configured site password and enter `https://game.milanoracing.team` after that server and tunnel are configured. Create a room, share its code, ready up and let the host start. HTTPS certificate verification stays enabled; plain HTTP is limited to local/private network addresses.

Two native clients have been tested against a private-password loopback server, including reconnect and server recovery penalties. This does not prove Internet latency, cross-platform interoperability or public-server capacity. This source update does not deploy the website, start a public tunnel or change access controls. The server's existing Ubuntu and Cloudflare setup instructions remain in the compatibility package.

## Build on Windows

Install Python 3.11 or newer, then run from this folder:

```
python tools/bootstrap.py
python tools/build.py --test
```

Bootstrap downloads the pinned official engine and export templates, verifies SHA-256 hashes and extracts them locally. The template download is about 1.2 GB. Prepared native scenes, textures and menu footage are included. Normal builds do not need the original workstation, a browser or FFmpeg. The exported executable and resource pack appear in `build`. With `--test`, the build also runs the vehicle/pit and race-model suites.

To edit, open `game/project.godot` in Godot 4.7.2. Interrupted first editor imports are retried up to three times with logs retained; script errors stop immediately. GPU regression commands are `python tools/verify-packaged.py`, `python tools/verify-modes.py` and `python tools/verify-input.py`. They launch game windows and require a Vulkan GPU. `scripts/test_race.gd` and `scripts/test_vehicle.gd` run through Godot's headless `--script` option. `scripts/test_ui.gd` requires the native renderer. `tools/verify-online.py` additionally requires the sibling Python server and its dependencies.

`python tools/record-home.py` regenerates the four-shot reel with Godot MovieWriter and FFmpeg. The recording is game-engine footage with scripted camera and vehicle paths, not footage of a human driving. Capture intermediates stay outside the shipping package.

## Asset authoring

The optional shared-geometry conversion requires sibling `upgrade` source and dependencies. Start its preview server at `http://127.0.0.1:8878`, run `node native-desktop/tools/export-world.cjs` from the repository root, then `prepare-assets.py`, `ground-detail.py` and Godot's `scripts/import_world.gd` converter for selected circuits. This is an offline authoring bridge; the delivered native game does not run HTML, Electron or Chromium.

Prepared `.scn` files are included for reproducible builds. Intermediate `.bin` exports and the Godot cache are not needed to play or export. Credits are under `licenses`. The recorded home reel uses the game's adapted V10 audio with the same attribution; no film soundtrack is included.

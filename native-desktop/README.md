# Milano Racing — native desktop

An independent Windows game project using Godot 4.7.2 Forward+ and Vulkan. The executable runs native scenes and GDScript, without Electron, Chromium, HTML or JavaScript. The existing researched circuit meshes, terrain, MR 26 model and supplied artwork are reused as source assets.

**This is a playable native practice preview.** It is not yet the full desktop replacement, a laser-scanned reconstruction, or a finished match for the supplied commercial-game references. Native qualifying, AI races and online multiplayer remain to be implemented. Those modes remain available in the separate compatibility game. See [accuracy and provenance](docs/ACCURACY.md) and [validation](docs/VALIDATION.md).

## Play

Extract the entire `Milano-Racing-Native-Preview-Windows.zip` folder. Run `Milano Racing Native.exe`; keep its `.pck` file alongside it. Choose a circuit, graphics level and lighting, then DRIVE. No server or account is needed for practice. The unsigned local executable may trigger Windows reputation prompts; it has no installer or automatic updater.

WASD or arrows drive; Space also brakes. C changes camera, P requests a pit stop, R recovers, Esc opens the garage, F11 toggles fullscreen. A connected standard controller uses the left stick and triggers; Start opens the garage, Y changes camera and Back recovers. Pair Bluetooth controllers in Windows first. Hardware controller testing is still outstanding.

## What is native

- Fixed 120 Hz assisted vehicle simulation, interpolated movement, progressive keyboard steering and curved controller response.
- Twelve circuits with variable widths, elevation, banking and connected pit routes. Pit service and rejoining run locally.
- HDR environment lighting, cascaded sun shadows, realtime night spotlights, screen-space reflections, ambient occlusion, indirect screen-space lighting and volumetric fog.
- FSR2 reconstruction, mipmapped anisotropic materials, native mesh LODs, spatially batched vegetation, close grass and gravel geometry.
- Original MR 26 geometry and sponsor artwork, native paint shading and recorded V10 layers driven by RPM and throttle.

Godot supplies the graphics engine and platform runtime. Milano's new game code and asset conversion are in this folder. Rendering features alone do not turn estimated source geometry into surveyed architecture.

## Build on Windows

Install Python 3.11 or newer. From this folder:

```
python tools/bootstrap.py
python tools/build.py
```

Bootstrap downloads the pinned official engine and export templates, checks their SHA-256 hashes and extracts them locally. The template download is about 1.2 GB. Prepared native scenes and textures are included in the source snapshot, so a normal build does not need a browser or the original workstation. The build imports assets, applies explicit 3D texture settings and exports `build/Milano Racing Native.exe` and `.pck`.

To edit, open `game/project.godot` in Godot 4.7.2. To run the rendering regression, use `python tools/verify-rendering.py`; it opens each circuit on the actual GPU and writes evidence under `qa`. `tools/build.py --test` also runs the deterministic vehicle/pit checks. Interrupted first-time editor imports are retried up to three times, with logs retained; script errors stop the build immediately. These tests do not establish real-car correlation or full-race performance.

## Rebuild the shared source geometry

This optional authoring step requires the sibling `upgrade` source package and its dependencies. Start its local preview server at `http://127.0.0.1:8878`, then run `node native-desktop/tools/export-world.cjs` from the repository root. Run `prepare-assets.py`, `ground-detail.py` and the Godot `scripts/import_world.gd` converter for the selected circuit IDs. The authoring bridge exports reusable geometry; no browser is involved when the delivered native game runs. The source scene coordinates are preserved through that conversion.

Prepared scene files are intentionally included for reproducible builds. Intermediate `.bin` geometry and Godot's cache are not required to play or export. Credits and data licences are in `licenses`. Publishing source does not deploy the game or change private website access.

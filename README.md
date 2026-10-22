# Milano Racing — Grand Prix

Milano Racing, featuring the MR 26. Start with **Grand Prix**; the older World Tour files remain in the repository for reference.

The latest update adds terrain-fitted ground detail, supporting raceways, fuller planting and footprint-based spectator structures across the calendar. Milano Autodromo is now a 6.54 km, 17-corner ridge circuit. All six partners share balanced trackside wall allocations, rotating gantries and pit facades. Track limits allow kerb use and brief excursions, with gradual grip loss outside the kerbs and warnings before race penalties.

Menus use Barlow headings, DM Sans controls and Milano’s colours, with visual race setup and tabbed settings. Embedded fonts also work offline. The environment guide lists references, inspection frames and the details that remain approximate; these are mapped game reconstructions, not survey-exact replicas.

## Play

Download [Milano Racing - Grand Prix.html](Milano%20Racing%20-%20Grand%20Prix.html) using GitHub's **Download raw file** button, then open the saved file in Edge or Chrome. All game assets are embedded; solo play works offline. Pair PS/Xbox controllers in the operating system, return to the game and press a controller button.

## Included

- MR 26 and 12 circuits: Milano Autodromo, Bahrain, Singapore, Monza, Monaco, Austria, Silverstone, Abu Dhabi, Spa, Suzuka, Interlagos and Zandvoort.
- Five-minute or full Q1/Q2/Q3 qualifying, 22-car solo races, four difficulties, tyre wear and assisted pit stops.
- Variable circuit widths, model-based racing lines, mapped surroundings, terrain, landmarks and revised cameras/materials.
- Python/aiohttp multiplayer server with rooms, invites, reconnects and up to 16 drivers. Online ghost races are separate from solo qualifying and AI tyre strategy.
- Windows desktop app source, website integration files and Ubuntu 24.04/Cloudflare setup instructions.

## Guides

Open these HTML guides locally after cloning/downloading the repository:

- [Start Here](upgrade/docs/Start%20Here.html)
- [Qualifying, races and controls](upgrade/docs/Race%20Weekend%20Guide.html)
- [Circuit research and width provenance](upgrade/docs/Circuit%20Research.html)
- [Whole-circuit environments: references, models and inspection frames](upgrade/docs/Venue%20Environment%20Research.html)
- [Ubuntu, SSH and Cloudflare](upgrade/docs/Ubuntu%20and%20Cloudflare%20Setup.html)
- [Validation and known limits](upgrade/docs/Validation.html)
- [Asset notices and licenses](upgrade/licenses/NOTICE.txt)

The guides also describe the ZIP distribution available from a local release build. Compiled Electron binaries and ZIP bundles are generated locally, not committed to Git.

## Build

From the repository root, with Python 3.12+ and Node.js installed:

```sh
python -m pip install Pillow
python upgrade/build-base.py
node --check upgrade/qa/game.js
python upgrade/build-web.py
```

Generated outputs are `upgrade/qa/standalone.html` and `upgrade/server/public`. The ready-to-run standalone file at the repository root and hosted assets are included in this revision. To refresh that root HTML after future source changes, copy `upgrade/qa/standalone.html` over it.

### Local server

```sh
python -m pip install -r upgrade/server/requirements.txt
```

For a loopback-only development preview on Linux/macOS:

```sh
PRIVATE_SITE=0 PUBLIC_ORIGIN= BIND=127.0.0.1 PORT=8878 python upgrade/server/milano_server.py
```

PowerShell:

```powershell
$env:PRIVATE_SITE='0'
$env:PUBLIC_ORIGIN=''
$env:BIND='127.0.0.1'
$env:PORT='8878'
python upgrade/server/milano_server.py
```

Open `http://127.0.0.1:8878/`. This development command listens only on the same computer. For hosting at `game.milanoracing.team`, follow the Ubuntu guide and keep `PRIVATE_SITE=1`; configure the password and session secret on the server. No credentials are included. Do not use the old root-level LAN launcher for the new game.

### Windows app

```sh
python upgrade/tools/sync-desktop.py
npm ci --prefix upgrade/desktop
npm run package:win --prefix upgrade/desktop
```

The executable is generated under `upgrade/release/Milano Racing-win32-x64`. Keep its supporting files with it. The website patch is under `upgrade/integration/website-files`.

## Checks

```sh
node upgrade/tests/physics.cjs
node upgrade/tests/weekend-core.cjs
node upgrade/tests/traffic.cjs
node upgrade/tests/input-and-snapshots.cjs
python upgrade/tests/race-core.py
python upgrade/tests/network.py
```

Browser checks need `npm ci --prefix upgrade` and Microsoft Edge. See [test instructions](upgrade/tests/README.txt). Reports are in `upgrade/qa`.

The packaged release was checked across all 12 circuits, qualifying/race state transitions, pit stops, offline HTML, desktop launch, terrain coverage, camera samples and local multiplayer. The source ZIP rebuilt byte-identical game outputs before this Git update. Hardware controller pairing, the real SSH/Cloudflare route and 24-hour production operation still require testing on the target setup.

## Accuracy and deployment

Circuit widths use historical satellite-derived boundaries and map estimates. Monaco, Singapore and some rebuilt sections remain estimates; this is not a survey-accurate reconstruction. Buildings and regional terrain are geographically based, with reconstructed detail where source data is absent. The dry race model implements selected sporting rules, not the full FIA rulebook. Milano Autodromo is original and is not FIA homologated.

This commit uploads the game and source to GitHub. It does not deploy the website, enable GitHub Pages or change the server's private-access defaults. The repository itself is public.

## Native desktop

`native-desktop` is the independent Godot 4.7.2 Forward+/Vulkan game. Version 0.2 adds 22-car races, staged qualifying, tyre strategy, assisted pit stops, private-server online rooms and a recorded cinematic home screen. It includes all twelve prepared circuits and the original MR 26 artwork. Native wet-road and facade shaders, rain, spray, local shadows and graphics presets extend the desktop renderer.

The home screen uses a four-shot sequence recorded inside the native game, with smooth transitions and Milano branding. Circuit rendering is suspended during menu playback to reduce GPU work. The new interface separates race selection, setup and online rooms.

See [build and controls](native-desktop/README.md), [measured validation](native-desktop/docs/VALIDATION.md) and [accuracy boundaries](native-desktop/docs/ACCURACY.md). The circuits remain researched reconstructions; the supplied commercial-game reference quality and exact surveyed placement have not been achieved. Native online was verified with two clients on a private local server, not across the public Internet.

Prepared assets and menu footage are included. The pinned bootstrap downloads and verifies the official engine and export templates. Local Windows ZIPs are separate from this source repository. This update does not deploy the private game website or change its access controls.

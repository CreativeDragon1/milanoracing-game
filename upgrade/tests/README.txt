Run commands from the extracted Source root, the directory containing upgrade/.

Build first:
  python -m pip install Pillow
  python upgrade/build-base.py
  node --check upgrade/qa/game.js
  python upgrade/build-web.py

Pure model checks:
  node upgrade/tests/track-limits.cjs
  node upgrade/tests/physics.cjs
  node upgrade/tests/weekend-core.cjs
  node upgrade/tests/traffic.cjs
  node upgrade/tests/input-and-snapshots.cjs
  python upgrade/tests/race-core.py

Network tests launch their own fresh local backend:
  python -m pip install -r upgrade/server/requirements.txt
  python upgrade/tests/network.py

Browser prerequisites:
  npm ci --prefix upgrade
  Microsoft Edge installed (Playwright channel msedge)
  node upgrade/tests/offline.cjs

For hosted browser tests, start a loopback-only development server.
PowerShell:
  $env:PRIVATE_SITE='0'; $env:PUBLIC_ORIGIN=''; $env:BIND='127.0.0.1'; $env:PORT='8878'
  python upgrade/server/milano_server.py
Linux:
  PRIVATE_SITE=0 PUBLIC_ORIGIN= BIND=127.0.0.1 PORT=8878 python3 upgrade/server/milano_server.py
In another terminal, from the source root:
  node upgrade/tests/track-limits-browser.cjs
  node upgrade/tests/weekend-browser.cjs
  node upgrade/tests/calendar-views.cjs
  node upgrade/tests/geometry-and-cameras.cjs
  node upgrade/tests/interface-refresh.cjs
  node upgrade/tests/venue-refresh.cjs
  node upgrade/tests/tunnel-clearance.cjs
  node upgrade/tests/camera-clearance.cjs
  node upgrade/tests/multiplayer-browser.cjs
  node upgrade/tests/landmarks.cjs
  node upgrade/tests/performance.cjs monaco singapore spa milano
  node upgrade/tests/grid-performance.cjs
  node upgrade/tests/calendar-benchmark.cjs

Run the performance check alone, without packaging or other tests competing for CPU/GPU. It measures one repeatable paused viewpoint per venue at 1440x900 Ultra, not a full-grid race or minimum frame rate. landmarks.cjs writes street and oblique inspection frames. geometry-and-cameras.cjs samples terrain coverage and finite camera poses; those checks do not certify survey accuracy.

integration.cjs additionally expects the existing Milano website development server on localhost:5173 with VITE_MILANO_GAME_ORIGIN=http://127.0.0.1:8878. That complete separate website is not in this package; merge the integration patch into it.
desktop.cjs requires the packaged Windows executable under upgrade/release.
ubuntu-soak.py must run on Linux with its listed dependencies and a local server; it is a bounded 5-minute load check, not 24-hour qualification.

Regeneration utilities in tools are optional research pipelines. The normal build uses processed checked-in JSON and textures. Original high-resolution Poly Haven tree GLTF/bin and DEM tile download caches are omitted; their source URLs and metadata are in research and licenses. Install NumPy, SciPy, Numba and Shapely 2.1+ for geographic/line tools, Blender for prepare-tree.py. Restore source tree_small_02 glTF assets before rerunning that optional decimation tool.

interface-refresh.cjs verifies Barlow/DM Sans typography, visible separator removal, settings render throttling, reduced motion and responsive layout. venue-refresh.cjs checks Monza banking clearance at 3,600 road points and the Monaco/Suzuka additions. grid-performance.cjs measures paused 22-car grids in all twelve venues; it is not a complete moving-race benchmark.

calendar-views.cjs captures six driving views per venue and audits all partner placements. track-limits.cjs covers kerb use, recovery, repeated excursions, deep/fast shortcuts and exact browser/Python event parity. calendar-environments.py rebuilds terrain-fitted ground and planting from cached OSM; redesign-milano.py changes only the original circuit. After a Milano geometry change, regenerate its terrain, racing line and pit route with their optional milano argument.

calendar-benchmark.cjs runs all twelve circuits sequentially: one paused viewpoint, a paused 22-car grid and a moving-AI start. Run it alone; it writes per-venue performance plus grid-performance.json and moving-performance.json.


Performance, handling and pit release checks:
  node upgrade/tests/controls-regression.cjs
  node upgrade/tests/learning-performance.cjs
  node upgrade/tests/race-cpu-benchmark.cjs
  python upgrade/tools/check-pit-alignment.py --assert
  node upgrade/tests/pit-driving.cjs
  node upgrade/tests/facilities.cjs
  node upgrade/tests/upgrade-benchmark.cjs release
The first three are CPU/model tests; the last three require the preview browser.
Run GPU measurements alone. Prior reports remain historical snapshots.

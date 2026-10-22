Run commands from the extracted Source root, the directory containing upgrade/.

Build first:
  python -m pip install Pillow
  python upgrade/build-base.py
  node --check upgrade/qa/game.js
  python upgrade/build-web.py

Pure model checks:
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
  node upgrade/tests/weekend-browser.cjs
  node upgrade/tests/geometry-and-cameras.cjs
  node upgrade/tests/camera-clearance.cjs
  node upgrade/tests/multiplayer-browser.cjs
  node upgrade/tests/landmarks.cjs
  node upgrade/tests/performance.cjs monaco singapore spa milano

Run the performance check alone, without packaging or other tests competing for CPU/GPU. It measures one repeatable paused viewpoint per venue at 1440x900 Ultra, not a full-grid race or minimum frame rate. landmarks.cjs writes street and oblique inspection frames. geometry-and-cameras.cjs samples terrain coverage and finite camera poses; those checks do not certify survey accuracy.

integration.cjs additionally expects the existing Milano website development server on localhost:5173 with VITE_MILANO_GAME_ORIGIN=http://127.0.0.1:8878. That complete separate website is not in this package; merge the integration patch into it.
desktop.cjs requires the packaged Windows executable under upgrade/release.
ubuntu-soak.py must run on Linux with its listed dependencies and a local server; it is a bounded 5-minute load check, not 24-hour qualification.

Regeneration utilities in tools are optional research pipelines. The normal build uses processed checked-in JSON and textures. Original high-resolution Poly Haven tree GLTF/bin and DEM tile download caches are omitted; their source URLs and metadata are in research and licenses. Install NumPy, SciPy, Numba and Shapely 2.1+ for geographic/line tools, Blender for prepare-tree.py. Restore source tree_small_02 glTF assets before rerunning that optional decimation tool.

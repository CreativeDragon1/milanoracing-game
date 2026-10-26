# Private Milano website game integration

The actual Milano React website now has a `/racing` page, gated to Vite's `private-game` build mode. The normal `npm run build` excludes that route, navigation entry, game page chunk, poster. Game assets are never copied into the website's public folder.

The page uses the website's existing Michroma heading font with a minimal car preview, circuit selector, Play button and a Windows desktop download. Phone controls use 48-pixel targets and 16-pixel select text. Playing on a phone or a short landscape window fills the usable viewport with safe-area padding, without requiring Safari's Fullscreen API. The desktop layout inherits the website's content edges and measures the sticky header rather than adding duplicate gutters.

The private page loads the real game only after Play. It supports circuit selection, a verified-origin ready handshake, fullscreen, opening a separate game window, pause when hidden/offscreen, and iframe teardown on exit. Keyboard, controller and touch remain the game's controls. The local preview serves the Python room backend, so multiplayer does not depend on an unstarted public domain.

## Local preview

1. Install the website dependencies with `npm ci`, and the game backend dependencies with `python -m pip install -r <game-folder>/upgrade/server/requirements.txt` if needed.
2. Set `MILANO_GAME_ROOT` to that `upgrade/server` directory. Set `MILANO_DESKTOP_ARCHIVE` to the tested `Milano-Apex-Windows.zip`. Alternatively place `{"gameRoot":"absolute path to upgrade/server","desktopArchive":"absolute path to Milano-Apex-Windows.zip","port":5183}` in the ignored `.private-game.local.json` file. The runner also accepts `--desktop-archive`.
3. Run `npm run build:private-game`.
4. Run `npm run preview:private-game` and open `http://127.0.0.1:5183/racing`.

The runner binds only to 127.0.0.1 and rejects other Host headers and remote peers. It is a local development preview, not an authenticated production host. No Cloudflare tunnel, DNS change, deployment or access-policy change is performed. Stop it with Ctrl+C in the terminal where it was launched.

`npm run build` continues to create the ordinary website in `dist/`; the private preview lives separately in `dist-private-game/`. `python scripts/private-game-preview.py --public-build --port 5184` can check the ordinary build locally: game routes and assets return 404.

The download endpoint serves one explicitly configured ZIP with attachment headers and byte-range support. The archive stays outside the website's public directory and is never bundled into a public build. Extract the whole ZIP and run `Milano Apex.exe` beside its `.pck` file. No installer is required. The download is for Windows PCs; the browser game remains the option for phones and tablets.

When the embedded game is hidden, the parent sends a visibility message checked against both its origin and window. The game pauses simulation and stops drawing 3D frames. Returning to the page leaves it paused for the player to resume. Exit destroys the iframe and restores the page's scroll position. The qualifying and lap display use the active session clock exclusively.

## Later hosting

Keep the private output off public static hosting. A future private deployment must protect the page and game backend with authenticated access first. The existing game backend is private by default. `VITE_MILANO_GAME_URL=https://game.milanoracing.team/` can select that backend at private build time after it has been securely configured. Its frame-ancestor and message-origin policies already allow the official Milano website. No credentials belong in Vite variables.

The website header keeps every link visible from 561 pixels upward, using a compact second row through 1080 pixels. Phone widths retain the full menu behind the menu button.

## Verification

Run `node qa/private-game.cjs` with the two loopback previews running and `MILANO_GAME_ROOT` set. It checks lazy loading, fourteen circuits, responsive widths from 320 to 768 pixels, loaded Michroma, phone viewport play and restored scrolling, live practice, message-origin filtering, real WebSocket/REST room flow, fullscreen, exit, no service-worker takeover, no retained detailed foundation samples, and exclusion from the normal production build. Physical controllers, Safari hardware and public Internet connectivity are outside this local check.

`node qa/private-game-phone.cjs` checks Chromium touch emulation, rotation, safe pause/resume and phone play. `node qa/header-responsive.cjs` checks the six links at twelve widths, including the 694-pixel app preview.

`node qa/racing-alignment.cjs` isolates layout at nine viewport sizes with a dummy iframe. `node qa/racing-timers.cjs` uses the real embedded game to check qualifying labels, lap rollover, hidden-frame suspension, short landscape resizing, exit and the private Windows download. A layout-only screenshot is not a game rendering test.

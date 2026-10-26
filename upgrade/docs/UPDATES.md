# Updates to the existing game

The Windows 0.4 build adds automatic, signed updates to the same game folder. Users with older builds need this updater-enabled download once. They do not need to reinstall for subsequent fixes. This work prepares the channel locally; it does not publish a release, open a tunnel, or make the game public.

The app checks after startup and every 15 minutes while at home. A helper verifies the release signature, downloads the archive, checks its size and SHA-256, then verifies each extracted file. Network transfer, hashing and extraction pause while racing or loading. A prepared fix is applied after the game closes; RESTART TO UPDATE on the home screen provides an immediate restart. Only `Milano Apex.exe` and `Milano Apex.pck` are replaced. The original files are backed up and restored if replacement fails. No user-data files are included or overwritten. The replacement is protected against ordinary errors, not an atomic transaction across sudden power loss.

The feed is pinned to `https://game.milanoracing.team/updates/windows.json`. TLS and the embedded RSA-3072 release public key are both checked. Redirects, arbitrary filenames, extra ZIP entries, changed hashes and older/equal release sequences are rejected. A missing host, failed download or rejected signature leaves the installed game playable. Install in a writable folder, not a protected system directory.

Private access remains enabled on the Python server. Sign in to ONLINE at the configured production origin so the helper can use the current private-session cookie. No password is bundled. The cookie is removed from the temporary job file when the helper finishes. Public users cannot fetch private updates; the loopback website preview is separate from the production updater endpoint. If Cloudflare Access is added ahead of the existing password gate, its service authentication must also be configured before automatic updates can use that route.

## Preparing future fixes

Run these steps from the main repository on the release workstation:

1. Keep the original `native-desktop/signing/private.pem` securely backed up offline. It is ignored by Git and excluded from both source and game archives. Never upload it to the website. Do not replace it with a newly generated key: installed clients trust the original public key.
2. Run `python native-desktop/tools/prepare-update-channel.py --new --version 0.4.1` to assign a new increasing sequence **before** building. Choose the intended display version. Reproducible source builds already include the public configuration and need no private key.
3. Build and validate the native app. Run `tools/test-updater.py`, `scripts/test_screen_fit.gd`, native UI checks and the packaged rendering/modes/input gates. Packaging requires matching hashes and performance evidence.
4. Run `python native-desktop/tools/package.py`, then `python native-desktop/tools/publish-update.py`. The latter signs only the checked binaries and stages an archive plus manifest in `upgrade/server/updates`; it also stages the full desktop download in `upgrade/server/downloads`. It does not upload anything.
5. On the private Ubuntu host, upload the numbered ZIP first, then atomically replace `updates/windows.json` last. Keep the previous archive for rollback inspection. Upload `downloads/Milano-Apex-Windows.zip` for new users. Do not expose the signing directory. Keep `PRIVATE_SITE=1` and existing access credentials until public launch is explicitly approved.
6. Verify an authenticated request to the private feed, and test a disposable installation of the previous updater-enabled build against the real host before distributing it widely. Local signed-fixture tests do not prove live Cloudflare/authentication behavior.

If a regression is found, publish the corrected previous code as a **new higher sequence**; clients deliberately reject downgrades. Existing user settings live outside the installation and remain untouched. Backups under `.milano-update` can be retained for recovery; they consume disk space and are not automatically deleted.

## Browser builds

The game home and private website include a desktop download. Hosted browser builds use content-hashed assets and revalidate their HTML. An already open browser checks the build ID every five minutes; a new version reloads only on the home screen, outside multiplayer. Driving, qualifying and paused sessions are never interrupted. An offline downloaded HTML file is a snapshot: it cannot overwrite itself. Its Play online link opens the hosted version; its desktop link uses the configured domain and requires private access until launch.

Upload new hashed assets first and retain existing hashes while clients still use them. Publish `public/index.html` and `public/build.json` last. Do not delete old live assets while players may still request them. The server ZIP is a private deployment package; desktop downloads must also be uploaded from the native package. The website integration must forward `/api/build`, `/updates/*`, `/downloads/*` and existing game/API routes to the private backend.

## Validation scope

The actual PowerShell helper was tested with signed loopback fixtures for successful replacement, waiting for game exit, paused heavy work, preserved saves, stale releases, bad signatures, corrupt/interrupted downloads, unsafe ZIP paths, private 401 responses and locked-file rollback. Godot's renderer was exercised at 4:3, 16:10, 16:9 and ultrawide sizes plus fullscreen. These are local tests; the production hostname and other people's installations were not changed.

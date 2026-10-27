# Host Milano Racing on Ubuntu

Set up SSH administration, an always-on multiplayer server, and Cloudflare Tunnel at **https://game.milanoracing.team**. The game stays password-protected for private testing.

This guide targets **Ubuntu Server 24.04 LTS** and the server files in this repository. Instructions were checked against the code and official documentation on **27 October 2026**. They have not been executed on your remote server or Cloudflare account.

## How it fits together

```text
Players: browser or Milano Apex for Windows
                  |
          HTTPS / WebSocket
                  |
        game.milanoracing.team
                  |
           Cloudflare Tunnel
                  |
        cloudflared on Ubuntu
                  |
         http://127.0.0.1:8767
                  |
        Python multiplayer server

Your computer -- SSH --> Ubuntu administration
```

Ubuntu serves the browser assets and coordinates multiplayer rooms. Players' computers render the graphics and run vehicle physics. The server needs no GPU, desktop environment, Godot installation, or continuously running browser.

The game service and tunnel start at boot and continue after you close SSH. Run **one Python game process**: rooms are stored in that process's memory, so multiple workers would split players between different room lists.

### Before starting

- An Ubuntu 24.04 LTS server that stays powered on, with a user who can run `sudo`.
- Its SSH address, username, and password or private key. Replace `SERVER_IP` and `YOUR_USER` below with those details.
- Access to the Cloudflare account managing the active `milanoracing.team` domain.
- Enough disk space for the repository, hosted assets, optional Windows download, and a backup. Check actual free space before copying releases.
- Two devices or testers for the final multiplayer check, preferably on different Internet connections.

Commands labelled **Windows PowerShell** run on your computer. Commands labelled **Ubuntu** run inside your SSH connection. Do not paste the whole guide into a terminal; work through one block at a time and check its result.

The public repository and any previously shared offline downloads are separate from the private hosted game. The password gate controls access to this server; it does not hide the repository.

## 1. Connect over SSH

**Windows PowerShell:**

```powershell
ssh YOUR_USER@SERVER_IP
```

If your provider supplied a private key:

```powershell
ssh -i "C:\path\to\your-key" YOUR_USER@SERVER_IP
```

For a nonstandard SSH port, add `-p PORT_NUMBER`. Compare the first-connection host fingerprint with the provider's console before accepting it. Password input is invisible while typing.

If SSH is not installed yet, use the server's local screen or provider console first. **Ubuntu console:**

```bash
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
```

Your provider's firewall must also allow your SSH connection. For a home server behind NAT, use its LAN address while on the same network, an existing VPN, or the optional Cloudflare SSH setup at the end of this guide after initial console/LAN setup.

Check the machine after connecting. **Ubuntu:**

```bash
cat /etc/os-release
python3 --version
uname -m
nproc
free -h
df -h /
```

These instructions assume a normal administrative user, not a root login. Keep the first SSH session open while testing firewall or SSH changes from a second window. See [Ubuntu's OpenSSH instructions](https://ubuntu.com/server/docs/how-to/security/openssh-server/) for key-based login and further configuration.

## 2. Install dependencies and get the game

**Ubuntu:**

```bash
sudo apt update
sudo apt install -y git python3 python3-venv curl ca-certificates rsync nano ufw
git clone --depth 1 --branch main https://github.com/CreativeDragon1/milanoracing-game.git "$HOME/milanoracing-game"
cd "$HOME/milanoracing-game"
git log -1 --oneline
test -s upgrade/server/public/index.html
test -s upgrade/server/public/build.json
test -s "upgrade/server/Multiplayer Circuits.json"
```

The three `test` commands are silent on success. Stop if any file is missing. If this checkout already exists, use `git -C "$HOME/milanoracing-game" pull --ff-only` instead of cloning over it.

The ready-to-host browser build is already committed under `upgrade/server/public`. **You do not need to build the graphics or install Node.js on this host.** Do not launch the old root-level `Milano LAN Server.py`; use `upgrade/server/milano_server.py`.

Install a dedicated service account and copy the backend to the paths used by the supplied service file:

```bash
id milano >/dev/null 2>&1 || sudo useradd --system --user-group --home-dir /opt/milano --shell /usr/sbin/nologin milano
sudo install -d -m 0755 /opt/milano
sudo rsync -a --exclude='.venv/' --exclude='__pycache__/' --exclude='*.pyc' --exclude='downloads/' --exclude='updates/' "$HOME/milanoracing-game/upgrade/server/" /opt/milano/
sudo chown -R root:root /opt/milano
sudo chmod -R u=rwX,go=rX /opt/milano
sudo python3 -m venv /opt/milano/.venv
sudo /opt/milano/.venv/bin/python -m pip install -r /opt/milano/requirements.txt
sudo /opt/milano/.venv/bin/python -m pip check
```

The runtime files are root-owned and readable by the unprivileged `milano` account. Python dependencies go inside the virtual environment, not Ubuntu's system Python. The current backend uses `aiohttp`; it does not require a database.

## 3. Configure private testing before exposing the tunnel

**Ubuntu, first installation:**

```bash
if ! sudo test -e /etc/milano.env; then
  sudo install -o root -g root -m 0600 /opt/milano/milano.env.example /etc/milano.env
fi
sudo nano /etc/milano.env
```

The configuration should contain:

```ini
PUBLIC_ORIGIN=https://game.milanoracing.team
BIND=127.0.0.1
PORT=8767
TRUST_CLOUDFLARE=1
PRIVATE_SITE=1
SITE_PASSWORD_HASH=
SESSION_SECRET=
```

Keep existing hash/secret values if this is an existing installation. For a new installation, the next command fills the blank values. In nano, save with **Ctrl+O**, **Enter**, then leave with **Ctrl+X**.

`PUBLIC_ORIGIN` must be exactly that HTTPS origin, with no path or trailing slash. Keep `BIND=127.0.0.1`; the backend must not listen directly on the public network. `TRUST_CLOUDFLARE=1` accepts the forwarded client IP only from a loopback connector.

Set a private test password through the supplied hidden prompt:

```bash
sudo /opt/milano/.venv/bin/python /opt/milano/set-private-password.py
sudo chmod 0600 /etc/milano.env
```

Choose at least 12 characters. The helper stores a salted password hash and generates a session secret; it does not store the plaintext password. Share the password only with testers. Never commit `/etc/milano.env`, the tunnel token, or an SSH private key.

Keep **`PRIVATE_SITE=1`** throughout setup. Without valid credentials the server remains locked. Unauthenticated visitors see only the access page; assets, multiplayer, downloads, and update files require authentication. `/healthz` is intentionally public and reveals only a basic health status.

## 4. Start the game as a service

**Ubuntu:**

```bash
sudo install -o root -g root -m 0644 /opt/milano/milano.service /etc/systemd/system/milano.service
sudo systemctl daemon-reload
sudo systemctl enable --now milano
sudo systemctl status milano --no-pager
curl -fsS http://127.0.0.1:8767/healthz
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8767/api/info
sudo ss -ltnp 'sport = :8767'
```

Expected results:

- Service: **active (running)**.
- Health: `{"status": "ok"}`.
- Unauthenticated `/api/info`: **401**, showing the private gate is working.
- Listener: **127.0.0.1:8767**, not `0.0.0.0:8767` or `[::]:8767`.

If a check fails, use `sudo journalctl -u milano -n 80 --no-pager` before continuing. An active service alone does not prove multiplayer works.

The supplied unit restarts on failure, limits privileges and logging, and has a **512 MB memory ceiling**. That is a limit for the game process, not a guarantee of how many players the machine can support.

## 5. Set the firewall without locking out SSH

For a **new server using SSH on port 22**, run this in Ubuntu:

```bash
sudo ufw allow OpenSSH
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status verbose
```

If SSH uses another port, allow that actual TCP port before enabling UFW. On a shared server, review its existing rules and other services first. Verify a second SSH connection before closing your current one. [Ubuntu firewall documentation](https://ubuntu.com/server/docs/firewalls/).

The game needs **no inbound 8767, 80, or 443 port**, and no game-port forwarding on the router. Cloudflared initiates outbound connections. A restrictive provider/network firewall must permit DNS and normal HTTPS for package installation, plus Cloudflare Tunnel traffic on **UDP/TCP 7844**. The default outgoing-allow rule above permits this. [Cloudflare tunnel prerequisites](https://developers.cloudflare.com/tunnel/get-started/#prerequisites).

## 6. Install Cloudflare's connector

**Ubuntu:**

```bash
sudo install -d -m 0755 /usr/share/keyrings
sudo curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
sudo chmod 0644 /usr/share/keyrings/cloudflare-main.gpg
printf '%s\n' 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
sudo apt update
sudo apt install -y cloudflared
cloudflared --version
command -v cloudflared
```

Use the stable package, not a nightly build. The supplied service expects `/usr/bin/cloudflared`. Its `--token-file` option requires cloudflared **2025.4.0 or newer**. These commands follow the [official package repository](https://pkg.cloudflare.com/index.html) and [token-file documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/#token-file).

## 7. Create the tunnel and save its token

**Cloudflare dashboard, on your computer:**

1. Confirm `milanoracing.team` is active in your account.
2. Open **Networking → Tunnels** and create a remotely managed Cloudflare Tunnel named `milano-game`. Some accounts show this under **Cloudflare One → Networks → Connectors**.
3. Select the Linux setup matching `uname -m` on your server.
4. Copy only the tunnel token from the displayed installation command, usually the long value following `--token` or `service install`. Treat it as a password.

Use the supplied `cloudflared-milano.service` below instead of also running the dashboard's `cloudflared service install` command. This keeps one connector service with a protected token file. [Cloudflare's setup guide](https://developers.cloudflare.com/tunnel/get-started/#create-a-tunnel).

If this server already has a tunnel serving other applications, reuse that connector and add the game route there instead. Do not stop another site's connector or create competing installations for it.

**Ubuntu, for the new `milano-game` connector:**

```bash
id cloudflared >/dev/null 2>&1 || sudo useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin cloudflared
sudo install -d -o root -g cloudflared -m 0750 /etc/cloudflared
sudo bash -c '
  umask 027
  read -r -s -p "Paste the tunnel token, then press Enter: " milano_tunnel_token
  printf "\n"
  test -n "$milano_tunnel_token" || exit 1
  printf "%s" "$milano_tunnel_token" > /etc/cloudflared/milano-token
  unset milano_tunnel_token
  chown root:cloudflared /etc/cloudflared/milano-token
  chmod 0640 /etc/cloudflared/milano-token
'
sudo install -o root -g root -m 0644 /opt/milano/cloudflared-milano.service /etc/systemd/system/cloudflared-milano.service
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-milano
sudo systemctl status cloudflared-milano --no-pager
```

The hidden prompt keeps the token out of shell history. Check that the tunnel shows **Healthy** in Cloudflare. If not:

```bash
sudo journalctl -u cloudflared-milano -n 80 --no-pager
sudo -u cloudflared test -r /etc/cloudflared/milano-token
```

Do not print the token while troubleshooting. This remotely managed setup uses dashboard routes and a token file; it does not need a local `config.yml`, tunnel credentials JSON, or `cloudflared tunnel login`.

## 8. Route the hostname to the private game

In the tunnel dashboard, add a **Published application** route (also called a public hostname):

| Field | Value |
| --- | --- |
| Subdomain | `game` |
| Domain | `milanoracing.team` |
| Path | Leave empty |
| Service type | `HTTP` |
| Service URL | `127.0.0.1:8767` |

If the dashboard uses one URL field, enter `http://127.0.0.1:8767`. Do not select HTTPS for the local Python service. Players still use HTTPS through Cloudflare. The route normally creates the required proxied DNS record; resolve any conflicting **game** record without changing the main website's DNS. [Cloudflare application routing](https://developers.cloudflare.com/tunnel/get-started/#publish-an-application).

Keep the original Host header; do not override it to localhost. In the domain's **Network** settings, ensure **WebSockets** is enabled. This game uses `wss://game.milanoracing.team/api/ws`; no separate TCP/UDP game route is needed. [Cloudflare WebSockets](https://developers.cloudflare.com/network/websockets/).

For this private test hostname, use a Cloudflare **Cache Rule** matching `http.host eq "game.milanoracing.team"` with **Bypass cache**. Make sure a broader cache rule does not override it. This avoids serving authenticated game files from a shared edge cache. Browsers can still use the server's private asset-cache headers. Do not force-cache login, HTML, `/api/*`, `/downloads/*`, or `/updates/*`. [Cloudflare cache-rule settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/).

The built-in password gate protects both browser and native multiplayer. Adding a separate Cloudflare Access login in front of the game would require additional native-client and updater authentication work; do not assume those clients can complete an interactive Access challenge. Keep the game's existing gate enabled even if you later add another access layer.

## 9. Verify private hosting and multiplayer

**Ubuntu or another terminal with curl:**

```bash
curl -fsS https://game.milanoracing.team/healthz
curl -sS -o /dev/null -w '%{http_code}\n' https://game.milanoracing.team/api/info
curl -sS -o /dev/null -w '%{http_code}\n' https://game.milanoracing.team/updates/windows.json
```

Expect health JSON, then **401** for both protected URLs without a login. The update route should be denied even before a release manifest is uploaded.

In a private/incognito browser window, open **https://game.milanoracing.team**. You should see **Private testing**, not the game. Enter the test password. Check that the menu, a circuit, controls, and audio load. In browser developer tools, Network should show `/api/ws` upgrading with **101 Switching Protocols** when multiplayer connects. HTTPS polling is available as a fallback.

### Race with testers

1. Both players open that same HTTPS address and log in. A downloaded `file://` HTML page is not the hosted multiplayer session.
2. Open the online/multiplayer menu. The host creates a room, chooses a circuit and a 1-, 3-, or 5-lap race, then shares its six-character code or invite link.
3. The other player joins that code. Both players select **Ready**; the host starts the race.
4. Check that each player sees the other moving and that the countdown and results agree.
5. Repeat with one player on mobile data or another network. A same-Wi-Fi test does not verify Internet hosting.

For **Milano Apex on Windows**, open **Online**, set the server to `https://game.milanoracing.team`, enter the private test password, and join the same room. Use the current desktop build. Browser and native clients use the same room protocol; test the mixed pair on the actual host before an event.

### Current multiplayer scope

- Rooms support **2–16 drivers**, with a server-wide cap of **32 rooms**. These are code limits, not measured server capacity.
- Rooms are unlisted by default; hosts can opt into the room browser. This is room discovery, not skill-ranked matchmaking.
- Online opponents are ghosts. Solo 22-car races, qualifying, and AI pit strategy are separate from online sessions.
- The server coordinates starts, checkpoints, penalties, and results; it does not simulate every car's physics or provide competition-grade anti-cheat.
- Reconnect grace is 30 seconds. Restarting the server clears rooms and interrupts races.
- Distance and connection quality still affect latency. Cloudflare can reconnect sockets, so test recovery as well as initial joining.

These details come from [`race_core.py`](upgrade/server/race_core.py), the [browser client](upgrade/src/multiplayer.js), and the [native client](native-desktop/game/scripts/online_client.gd).

## 10. Add the desktop download and automatic-update files

The repository includes desktop source. The compiled Windows ZIP is published separately as a GitHub release asset because it is too large for ordinary Git. Pulling `main` does not install that ZIP. The game's existing download button serves `/downloads/Milano-Apex-Windows.zip` from this Ubuntu host and returns 404 until the archive is installed.

### Install the published Windows package on Ubuntu

Release: [Milano Apex 0.4.0](https://github.com/CreativeDragon1/milanoracing-game/releases/tag/desktop-v0.4.0). The ZIP is **393,638,455 bytes**. GitHub is the distribution source for the server administrator; players download from **game.milanoracing.team**, without being sent to GitHub.

Run the following on the Ubuntu server. It verifies the package before installing it and replaces the served file atomically. It does not change access settings, restart the game, or interrupt multiplayer rooms. These paths match the installation in this guide; use the actual service directory if yours differs.

```bash
(
set -eu
milano_release_dir=$(mktemp -d "$HOME/milano-desktop-release.XXXXXX")
cd "$milano_release_dir"
curl --fail --location --retry 3 --output Milano-Apex-Windows.zip https://github.com/CreativeDragon1/milanoracing-game/releases/download/desktop-v0.4.0/Milano-Apex-Windows.zip
printf '%s  %s\n' 'd2884f0aa461aabd6f27a0f488050eafe4713b9e089a4ee6b7f38aea52258292' 'Milano-Apex-Windows.zip' | sha256sum --check -
sudo install -d -o root -g root -m 0755 /opt/milano/downloads
if sudo test -f /opt/milano/downloads/Milano-Apex-Windows.zip; then
  sudo cp -p /opt/milano/downloads/Milano-Apex-Windows.zip "/opt/milano/downloads/Milano-Apex-Windows.zip.previous-$(date +%Y%m%d-%H%M%S)"
fi
sudo install -o root -g root -m 0644 Milano-Apex-Windows.zip /opt/milano/downloads/Milano-Apex-Windows.zip.pending
sudo mv -f /opt/milano/downloads/Milano-Apex-Windows.zip.pending /opt/milano/downloads/Milano-Apex-Windows.zip
curl --fail --head https://game.milanoracing.team/downloads/Milano-Apex-Windows.zip
)
```

The last request must return **200** and `Content-Length: 393638455`, with an attachment filename of `Milano-Apex-Windows.zip`. Test the download in a browser without a saved login if the game is public. The direct public link is [Download Milano Apex for Windows](https://game.milanoracing.team/downloads/Milano-Apex-Windows.zip). Extract the entire ZIP and run `Milano Apex.exe` beside `Milano Apex.pck`.

This installs the full desktop download only. It does **not** publish the signed automatic-update feed described below. The native package remains version 0.4.0; the separate steady-camera browser update does not change its executable.

### Alternatively, copy the validated local archive

**Windows PowerShell, using your tested local release:**

```powershell
scp "$env:USERPROFILE\Downloads\Milano-Apex-Windows.zip" YOUR_USER@SERVER_IP:~/
```

**Ubuntu:**

```bash
sudo install -d -m 0755 /opt/milano/downloads
sudo install -o root -g root -m 0644 "$HOME/Milano-Apex-Windows.zip" /opt/milano/downloads/Milano-Apex-Windows.zip
```

After logging in, test `https://game.milanoracing.team/downloads/Milano-Apex-Windows.zip`. The Windows package is for Windows PCs; phones and Ubuntu players can use the browser game.

Automatic bug fixes need **signed release files**, separately prepared on the release workstation. Follow [the desktop update guide](native-desktop/docs/UPDATES.md). Create `/opt/milano/updates` with readable release files, upload the numbered `windows-SEQUENCE.zip` first, then atomically replace `windows.json` last. Keep the previous numbered archive. Do not invent a manifest or upload the private signing key: installed clients trust the original key, which must stay off the server and out of Git.

The update feed is `https://game.milanoracing.team/updates/windows.json`. Older app builds need the updater-enabled download once. Thereafter verified fixes can replace the existing executable/resource pack after the game closes. An offline browser HTML file cannot update itself; hosted browser sessions check for new builds and reload at the home screen.

Uploading game source to GitHub alone does not update this Ubuntu installation or other people's desktop apps. Verify a real update on a disposable installation before sending it to testers.

## 11. Connect it to the Milano website

This guide hosts the game at the **root of its own subdomain**, not at `/play` behind an arbitrary path prefix. The current server and assets use root-relative URLs.

The website's private game integration can use `VITE_MILANO_GAME_URL=https://game.milanoracing.team/` when building its private preview. Keep the website's normal public build unchanged while testing. The game permits embedding from `https://milanoracing.team` and `https://www.milanoracing.team`; test the iframe, private login, mobile layout, and download button on the actual website origin.

The website is a separate checkout; hosting this game repository does not deploy its `/racing` page. See [website integration instructions](upgrade/integration/README.md). Never put a private password, session secret, or tunnel token in frontend build variables.

## 12. Operate it and install future changes

### Routine checks

**Ubuntu:**

```bash
sudo systemctl status milano cloudflared-milano --no-pager
sudo journalctl -u milano -n 80 --no-pager
sudo journalctl -u cloudflared-milano -n 80 --no-pager
sudo systemctl show milano -p MemoryCurrent -p MemoryMax -p CPUUsageNSec -p NRestarts
free -h
df -h /
journalctl --disk-usage
```

Keep the server and, if applicable, its VM host awake. Start with one event room and measure memory, CPU, and connection latency under actual attendance. Low FPS usually concerns the playing device; delayed rivals or repeated disconnects need network/server investigation. Extra Python workers will not improve this architecture because they do not share room state.

Install Ubuntu and cloudflared updates between sessions. Cloudflared's service disables its own updater because it is managed through apt. Use `sudo apt update` and `sudo apt install --only-upgrade cloudflared`, then restart `cloudflared-milano` at a quiet time. Connector restarts briefly interrupt connections. For Python changes, review and update the pinned requirements in the project and test them before deployment.

### Deploy a new GitHub revision

Do this when no race is active. Run each block separately and stop on any error.

**Ubuntu — fetch and check:**

```bash
cd "$HOME/milanoracing-game"
git status --short
git pull --ff-only
git log -1 --oneline
test -s upgrade/server/public/index.html
test -s upgrade/server/public/build.json
```

Do not overwrite local checkout edits if `git status` lists any. Note the old revision before updating if you need to track which code was deployed.

**Ubuntu — back up and copy:**

```bash
milano_backup="/opt/milano-backup-$(date +%Y%m%d-%H%M%S)"
sudo cp -a /opt/milano "$milano_backup"
printf 'Backup: %s\n' "$milano_backup"
sudo systemctl stop milano
sudo rsync -a --exclude='.venv/' --exclude='__pycache__/' --exclude='*.pyc' --exclude='downloads/' --exclude='updates/' --exclude='public/index.html' --exclude='public/build.json' "$HOME/milanoracing-game/upgrade/server/" /opt/milano/
sudo install -o root -g root -m 0644 "$HOME/milanoracing-game/upgrade/server/public/index.html" /opt/milano/public/index.html
sudo install -o root -g root -m 0644 "$HOME/milanoracing-game/upgrade/server/public/build.json" /opt/milano/public/build.json
sudo chown -R root:root /opt/milano
sudo chmod -R u=rwX,go=rX /opt/milano
sudo /opt/milano/.venv/bin/python -m pip install -r /opt/milano/requirements.txt
sudo /opt/milano/.venv/bin/python -m pip check
```

**Ubuntu — start and verify:**

```bash
sudo install -o root -g root -m 0644 /opt/milano/milano.service /etc/systemd/system/milano.service
sudo systemctl daemon-reload
sudo systemctl start milano
sudo systemctl status milano --no-pager
curl -fsS http://127.0.0.1:8767/healthz
curl -sS -o /dev/null -w '%{http_code}\n' https://game.milanoracing.team/api/info
```

Expect health JSON and an unauthenticated **401**. Then log in and test a two-player race. The copy preserves `/etc/milano.env`, the tunnel token, desktop downloads, and signed updates. It also retains old hashed assets so existing browser tabs can still request their previous files. Do not add `rsync --delete`, rebuild in the live public folder, or purge those assets during an event. Backups consume disk space; retain a known-good copy and review older ones manually.

### Roll back if needed

Set `milano_backup` to the **exact backup path printed above**, and verify it contains the previous server. The following keeps the failed installation for inspection:

```bash
milano_backup=/opt/milano-backup-YYYYMMDD-HHMMSS
sudo test -f "$milano_backup/milano_server.py" && sudo test -f "$milano_backup/public/index.html"
```

Continue only if both checks succeeded:

```bash
sudo systemctl stop milano
sudo mv /opt/milano "/opt/milano-failed-$(date +%Y%m%d-%H%M%S)"
sudo cp -a "$milano_backup" /opt/milano
sudo install -o root -g root -m 0644 /opt/milano/milano.service /etc/systemd/system/milano.service
sudo systemctl daemon-reload
sudo systemctl start milano
curl -fsS http://127.0.0.1:8767/healthz
```

The backup includes the virtual environment, restored to its original `/opt/milano/.venv` path. Environment credentials and the tunnel remain unchanged. Browser build detection can return clients to the restored version; desktop updates deliberately reject older signed sequences, so desktop recovery requires a newly signed release with a higher sequence.

### Change the private test password

```bash
sudo /opt/milano/.venv/bin/python /opt/milano/set-private-password.py
sudo systemctl restart milano
```

This revokes existing login cookies and ends active rooms through the restart. Normal private logins last 12 hours. Keep `PRIVATE_SITE=1`; a public launch should be a separate deliberate change.

## 13. Troubleshooting

| Symptom | What to check |
| --- | --- |
| SSH timeout/refused | Correct address, username and SSH port; provider firewall; `ssh` service. Recover through the provider console if needed. |
| `externally-managed-environment` from pip | Use `/opt/milano/.venv/bin/python -m pip`, not system pip. |
| Game service fails | Read its journal; confirm dependencies, `/etc/milano.env`, runtime files and directory permissions. Invalid `PUBLIC_ORIGIN` prevents startup. |
| Cloudflare 502 | Confirm local `/healthz` works. The route must be **HTTP** to **127.0.0.1:8767** on the same machine as cloudflared. |
| Tunnel offline / 1033 | Check the connector service, token readability, outbound connectivity and Cloudflare tunnel status. UDP blockage may require the documented HTTP/2 transport over TCP 7844. |
| DNS conflict or wrong site | Check only the `game.milanoracing.team` record and tunnel route. Keep the main website records intact. |
| Password accepted locally but not through the domain / 403 | Match `PUBLIC_ORIGIN` exactly, retain the external Host header, and use the HTTPS game address. Check for an additional Cloudflare Access challenge. |
| “Test access is not configured yet” | Run the password helper and restart `milano`. Do not disable private mode to fix this. |
| No rooms / room not found | Players must use the same server. Check the code, started/full room state, and whether it is listed. A restart clears rooms. |
| Online connects then drops | Check `/api/ws`, WebSocket support, Internet stability, service restarts and logs. Don't add interactive challenges to routine API traffic. |
| 429 responses | Wait, close duplicate game tabs, and inspect request rates. Do not remove rate limiting as the first fix. |
| Download/update 404 after login | Upload the exact archive/manifest names to `downloads`/`updates`. A Git pull does not supply them. |
| Repeated restarts / memory limit | Check `NRestarts`, journal, and memory use. Investigate the workload before changing the 512 MB service limit. |
| Old graphics or mixed assets | Confirm the hosted build files match the new release and that no Cloudflare rule forces shared caching. Return to the menu or reload after the race. |

## Optional: SSH through Cloudflare too

Ordinary SSH above is sufficient for setup. If you also want administrative SSH through the tunnel, use a **separate** hostname, for example `ssh.milanoracing.team`:

1. First create a Cloudflare Access self-hosted application for that SSH hostname, allowing only your administrator email/account. Do not use an Everyone or bypass policy.
2. Add a tunnel route for that hostname with service **`ssh://127.0.0.1:22`** (use the actual SSH port if different).
3. Install cloudflared on your Windows computer too. Add this block to `%USERPROFILE%\.ssh\config`, replacing `YOUR_USER` and ensuring `cloudflared.exe` is available on PATH:

```sshconfig
Host milano-admin
    HostName ssh.milanoracing.team
    User YOUR_USER
    ProxyCommand cloudflared.exe access ssh --hostname %h
```

**Windows PowerShell:**

```powershell
ssh milano-admin
```

Complete the Access login in your browser; the Ubuntu SSH key/password is still required. Test this path before altering direct SSH access, and retain a console recovery option. Keep this Access application separate from the game's password gate. [Official Cloudflare SSH instructions](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/ssh/ssh-cloudflared-authentication/).

## Ready for a private event

- [ ] Both services are active and enabled at boot.
- [ ] The backend listens only on loopback; game ports are not exposed directly.
- [ ] Incognito visitors see the private gate; protected API requests return 401.
- [ ] Testers can log in, load a circuit, create/join a room, ready up, and finish a race.
- [ ] Two different Internet connections have been tested through the actual domain.
- [ ] Browser/native mixed play and the Windows download have been checked if being offered.
- [ ] A quiet-time reboot has confirmed both services return; no races were active during it.
- [ ] A known-good backup and the server recovery route are available.

Local test reports in this repository are useful evidence, but they do not replace these checks on the actual Ubuntu host and Cloudflare route.

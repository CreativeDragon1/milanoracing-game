"""Refresh release evidence from completed checks; never claims an external deployment."""
from pathlib import Path
import json,re,html,shutil
U=Path(__file__).resolve().parents[1]
def read(name):return json.loads((U/'qa'/name).read_text(encoding='utf-8'))
p=U/'docs/Validation.html';text=p.read_text(encoding='utf-8')
text=re.sub(r'<!-- current-update-start -->.*?<!-- current-update-end -->','',text,flags=re.S)
network=read('network-win32.json');weekend=read('weekend-core.json')
text=re.sub(r'A separate 16-client test sent [\d,]+ updates over 20 seconds; local Windows p95 response was [\d.]+ ms\.',f'A separate 16-client test sent {network["updates"]:,} updates over 20 seconds; local Windows p95 response was {network["p95ResponseMs"]:.2f} ms.',text)
text=text.replace('The existing local React website builds and embeds the game. Two browser clients join, ready, start, drive, reconnect after an interruption and rejoin a new room.','The existing local React website built and embedded the game in the earlier integration check. The updated game passed a fresh two-browser-client join, ready, start, drive and reconnect regression.')
text=text.replace('<h2>Geometry and sporting scope</h2>','''<!-- current-update-start --><h2>Handling, traffic and environment update</h2><p>Keyboard steering now ramps progressively and recentres after release. Unit checks cover four speeds, standard gamepad deadzones/triggers and buffered multiplayer interpolation. Player rendering interpolates the fixed simulation steps. Physical Bluetooth pairing and subjective controller feel still require hardware testing.</p><p>Twenty-one AI opponents were simulated for three minutes on each circuit, with no detected car overlap or road-bound violation in those runs. Passing checks look ahead through narrowing corners; following speed uses braking distance, and lane changes accelerate smoothly. The full qualifying/race regression completed '''+f'{weekend["checks"]:,}'+''' checks. These deterministic checks do not guarantee that every possible racing incident is covered.</p><p>Whole-circuit surroundings now combine mapped neighbourhoods, roads, forests, shorelines, piers, bridge decks/supports and authored venue structures. Concave roofs preserve courtyards. Shared static geometry and spatial batches reduce repeated submissions; dynamic racing-line arrows and foliage keep dynamic bounds. <a href="Venue%20Environment%20Research.html">Venue Environment Research</a> lists every circuit, primary references, current models and remaining fidelity work.</p><h2>Measured render performance</h2><p>One repeatable paused driving viewpoint per venue, 1440×900 viewport with Ultra supersampling, Edge and an RTX 3050 6 GB Laptop GPU. These are eight-second frame-interval samples, not full-grid race benchmarks or minimum frame rates. Monaco remains the heaviest of these scenes.</p>__PERFORMANCE_TABLE__<!-- current-update-end --><h2>Geometry and sporting scope</h2>''')
text=text.replace('Monaco remains the heaviest of these scenes.','Frame times vary with viewpoint, traffic, device load and graphics settings.')
rows=[]
tour=json.loads((U/'src/world-tour-data.json').read_text(encoding='utf-8'))
for ident,venue in tour.items():
 d=read(f'performance-updated-{ident}.json')
 rows.append(f'<tr><td>{html.escape(venue["name"])}</td><td>{d["medianMs"]:.1f} ms</td><td>{d["p95Ms"]:.1f} ms</td><td>{d["diagnostics"]["drawCalls"]:,}</td></tr>')
table='<table><tr><th>Venue</th><th>Median frame</th><th>95th percentile</th><th>Draw calls, all passes</th></tr>'+''.join(rows)+'</table>'
text=text.replace('__PERFORMANCE_TABLE__',table)
text=re.sub(r'<!-- interface-refresh-start -->.*?<!-- interface-refresh-end -->','',text,flags=re.S)
ui=read('interface-refresh.json');venue=read('venue-refresh.json');grid=read('grid-performance.json')
monza=next(v for v in venue if v['id']=='monza')
assert not monza['bankingRoadIntersections']
refresh='''<!-- interface-refresh-start --><h2>Interface and venue refresh</h2><p>The interface uses Barlow headings, DM Sans controls and the original Michroma wordmark. Decorative slash separators were removed. Settings use Controls, Display and Audio tabs; pre-race settings pair a circuit diagram with native controls. The font binaries are embedded for offline use, with their OFL licences. <a href="https://github.com/jpt/barlow">Barlow source</a>.</p>'''
refresh+=f'<p>Desktop and phone browser checks passed at 1440×900 and 390×844. Reduced-motion mode disables panel animation. Opaque settings rendered the backdrop at {ui["settingsRendersPerSecond"]:g} frames per second during the measured two-second sample; keyboard, controller and network polling continue. This throttle is not used while driving.</p>'
refresh+='''<p>Monza’s historic banking previously crossed the modern pit straight. The new mesh is clipped against the entire variable-width GP corridor; 3,600 sampled upward road rays found no banking intersections. Monaco now has ten mapped limestone cliff meshes, a continuous tunnel roof, retaining wall, open sea-side colonnade and lighting. Suzuka now includes Rocky Coaster, Adventure Drive, twin GP Racers, mapped driving attractions, park pavilions and a wheel based on the venue’s published approximate 50 m height. These are referenced reconstructions; ride profiles and cliff details remain estimated.</p><p>The updated standalone build started practice with all network requests blocked. Qualifying, grid formation, driving with 21 opponents and a completed pit stop passed the browser regression. Two independent multiplayer clients joined, drove and reconnected successfully. Earlier model tests remain applicable to unchanged physics; this update does not claim additional real-controller hardware testing.</p>'''
refresh+='<h3>Full-grid render sample</h3><p>Paused 22-car grids, 1440×900 Ultra, eight seconds after warm-up, on the same RTX 3050 laptop. These measure rendering at the start grid; they do not establish minimum performance throughout a moving race.</p><table><tr><th>Venue</th><th>Median frame</th><th>95th percentile</th></tr>'
for r in grid['results']:refresh+=f'<tr><td>{html.escape(tour[r["id"]]["name"])}</td><td>{r["medianMs"]:.1f} ms</td><td>{r["p95Ms"]:.1f} ms</td></tr>'
refresh+='</table>'
images=U/'docs/inspection';images.mkdir(exist_ok=True)
for name,label in [('interface-home-final.png','Updated home screen'),('interface-weekend-final.png','Race setup'),('interface-settings-final.png','Tabbed settings')]:
 shutil.copy2(U/'qa'/name,images/name)
 refresh+=f'<figure style="margin:20px 0"><img loading="lazy" src="inspection/{name}" alt="{label}"><figcaption class="small">{label}</figcaption></figure>'
refresh+='<!-- interface-refresh-end -->'
text=text.replace('<h2>Geometry and sporting scope</h2>',refresh+'<h2>Geometry and sporting scope</h2>')
text=text.replace('Nothing has been published. The server defaults to private access','No live game deployment has been performed. Uploading the source to the requested public GitHub repository does not change the game server or domain. The server defaults to private access')
p.write_text(text,encoding='utf-8')
p=U/'docs/Start Here.html';text=p.read_text(encoding='utf-8')
if 'Venue%20Environment' not in text:text=text.replace('<li><a href="Circuit%20Research.html">','<li><a href="Venue%20Environment%20Research.html">Whole-circuit surroundings: sources and model coverage</a></li><li><a href="Circuit%20Research.html">')
text=text.replace('the packages and website source are local. No Cloudflare tunnel, DNS, live website deployment or public release has been performed.','the packages are local deliverables. The source can be uploaded to the requested GitHub repository without deploying the game. No Cloudflare tunnel, DNS or live website deployment has been performed; private server access remains the default.')
p.write_text(text,encoding='utf-8')
print('Updated validation evidence and guide links.')

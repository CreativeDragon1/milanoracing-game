"""Private, loopback-only website preview with the real Milano game backend.
Never use this development runner as a public production server.
"""
from pathlib import Path
import asyncio, argparse, ipaddress, json, os, sys
from urllib.parse import urlsplit
from aiohttp import web

ROOT=Path(__file__).resolve().parents[1]
config_path=ROOT/".private-game.local.json"
config=json.loads(config_path.read_text()) if config_path.exists() else {}
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--game-root",default=os.environ.get("MILANO_GAME_ROOT",config.get("gameRoot","")))
parser.add_argument("--port",type=int,default=config.get("port",5183))
parser.add_argument("--desktop-archive",default=os.environ.get("MILANO_DESKTOP_ARCHIVE",config.get("desktopArchive","")))
parser.add_argument("--public-build",action="store_true",help="Inspect the normal public build without the game routes")
args=parser.parse_args()
if not args.game_root:parser.error("Set MILANO_GAME_ROOT to the game's upgrade/server folder, or pass --game-root.")
GAME=Path(args.game_root).expanduser().resolve()
SITE=ROOT/("dist" if args.public_build else "dist-private-game")
assert (GAME/"milano_server.py").is_file(),"Game backend not found"
assert (SITE/"index.html").is_file(),"Run npm run build:private-game first (or npm run build for --public-build)"
assert 1024<=args.port<=65535,"Invalid local preview port"
# Process-local settings only. Production environment files are never edited.
os.environ["PUBLIC_ORIGIN"]=""
os.environ["TRUST_CLOUDFLARE"]="0"
sys.path.insert(0,str(GAME))
import milano_server as game

@web.middleware
async def local_only(request,handler):
    try:
        local=ipaddress.ip_address(request.remote or "").is_loopback
        host=urlsplit("http://"+request.host)
        allowed=host.hostname in ("127.0.0.1","localhost","::1") and host.port==args.port
    except ValueError:local=allowed=False
    if not local or not allowed:raise web.HTTPForbidden(text="This preview is available only on this computer.")
    response=await handler(request)
    response.headers["Cache-Control"]="no-store"
    response.headers["X-Robots-Tag"]="noindex, nofollow, noarchive"
    return response

async def site_file(request):
    relative=request.match_info.get("path","").lstrip("/")
    if relative.startswith(("api/","play/","assets/","downloads/")) or relative=="sw.js":raise web.HTTPNotFound()
    file=(SITE/relative).resolve()
    if not file.is_relative_to(SITE.resolve()) or any(part.startswith('.') for part in Path(relative).parts):raise web.HTTPNotFound()
    if file.is_file():return web.FileResponse(file)
    return web.FileResponse(SITE/"index.html")

async def asset(request):
    name=request.match_info["name"]
    if "/" in name or "\\" in name or name.startswith(".") or name.endswith(".gz"):raise web.HTTPNotFound()
    for folder in ([SITE/"assets"] if args.public_build else [SITE/"assets",GAME/"public/assets"]):
        file=folder/name
        if file.is_file():return web.FileResponse(file)
    raise web.HTTPNotFound()

async def game_entry(request):return await game.index(request)
async def desktop_download(request):
    # One explicitly configured archive; never expose an arbitrary filesystem path.
    archive=Path(args.desktop_archive).expanduser().resolve() if args.desktop_archive else None
    if not archive or archive.suffix.lower()!=".zip" or not archive.is_file():
        raise web.HTTPNotFound(text="The desktop download is not installed in this preview.")
    return web.FileResponse(archive,headers={"Content-Type":"application/zip","Content-Disposition":'attachment; filename="Milano-Apex-Windows.zip"',"X-Content-Type-Options":"nosniff"})
async def robots(request):return web.Response(text="User-agent: *\nDisallow: /\n",content_type="text/plain")

app=web.Application(middlewares=[local_only,game.headers],client_max_size=4096)
app["sockets"]=set();app.on_shutdown.append(game.close_sockets)
app.cleanup_ctx.append(game.maintenance)
app.router.add_get('/assets/{name}',asset)
app.router.add_get('/robots.txt',robots)
app.router.add_get('/healthz',game.health)
if not args.public_build:
    app.router.add_get('/downloads/Milano-Apex-Windows.zip',desktop_download)
    app.router.add_get('/play/',game_entry)
    app.router.add_get('/api/info',game.info)
    app.router.add_post('/api/race',game.race)
    app.router.add_get('/api/ws',game.websocket)
    app.router.add_get('/favicon.ico',game.favicon)
    app.router.add_get('/icon-192.png',lambda request:web.FileResponse(GAME/'public/icon-192.png'))
    app.router.add_get('/icon-512.png',lambda request:web.FileResponse(GAME/'public/icon-512.png'))
    app.router.add_get('/manifest.webmanifest',lambda request:web.FileResponse(GAME/'public/manifest.webmanifest'))
app.router.add_get('/{path:.*}',site_file)
print(f"Private Milano website preview: http://127.0.0.1:{args.port}/racing",flush=True)
print("Listening only on this computer. No tunnel or public deployment is started.",flush=True)
web.run_app(app,host="127.0.0.1",port=args.port,access_log=None,print=None)

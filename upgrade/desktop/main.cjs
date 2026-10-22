const {app,BrowserWindow,Menu,shell,session}=require('electron');const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const PUBLIC=path.join(__dirname,'public');let origin,server,win;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.hdr':'application/octet-stream','.wav':'audio/wav','.ttf':'font/ttf'};
if(!app.requestSingleInstanceLock())app.quit();else app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
app.whenReady().then(async()=>{
 server=http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{return res.writeHead(400).end()}
 if(pathname.startsWith('/api/'))return res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Open Online Grid from the Game menu.'}));
 const relative=pathname==='/'?'index.html':pathname.slice(1),file=path.resolve(PUBLIC,relative);if(!file.startsWith(path.resolve(PUBLIC)+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 session.defaultSession.setPermissionRequestHandler((web,permission,callback)=>callback(['fullscreen','pointerLock'].includes(permission)));
 win=new BrowserWindow({width:1600,height:1000,minWidth:960,minHeight:640,backgroundColor:'#080c16',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 const allowed=url=>{try{const u=new URL(url);return u.origin===origin||u.origin==='https://game.milanoracing.team'}catch{return false}};
 win.webContents.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault()});
 win.webContents.setWindowOpenHandler(({url})=>{if(allowed(url))win.loadURL(url);else{try{const u=new URL(url);if(u.protocol==='https:'&&['milanoracing.team','www.milanoracing.team','commons.wikimedia.org','creativecommons.org','www.openstreetmap.org'].includes(u.hostname))shell.openExternal(url)}catch{}}return {action:'deny'}});
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Game',submenu:[{label:'Offline garage',click:()=>win.loadURL(origin)},{label:'Online grid',click:()=>win.loadURL('https://game.milanoracing.team/?multiplayer=1')},{type:'separator'},{role:'togglefullscreen'},{role:'quit'}]}]));
 win.once('ready-to-show',()=>{if(process.env.MILANO_QA!=='1')win.show()});await win.loadURL(origin);
});app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>server?.close());

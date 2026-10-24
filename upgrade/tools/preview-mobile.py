from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
class Preview(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(Path(__file__).resolve().parents[1]/'server/public'),**kwargs)
    def do_GET(self):
        route=self.path.split('?')[0]
        if route=='/api/info':
            body=b'{"name":"Static preview","available":false}'
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        if route in ['/favicon.ico','/favicon.png']:
            self.send_response(204);self.end_headers();return
        if route=='/sw.js':
            body=b"self.addEventListener('install',()=>self.skipWaiting());"
            self.send_response(200);self.send_header('Content-Type','application/javascript');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        if self.path.split('?')[0]=='/':self.path='/index.html'+('?' + self.path.split('?',1)[1] if '?' in self.path else '')
        super().do_GET()
    def log_message(self,*args):pass
ThreadingHTTPServer(('127.0.0.1',8879),Preview).serve_forever()

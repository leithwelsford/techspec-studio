from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
PORT = 8001
with TCPServer(("", PORT), SimpleHTTPRequestHandler) as httpd:
    print(f"Serving on http://0.0.0.0:{PORT}")
    httpd.serve_forever()

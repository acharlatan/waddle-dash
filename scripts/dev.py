"""Serve the static site locally, including the managed preview arguments."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--host', default='127.0.0.1')
parser.add_argument('--port', default=8000, type=int)
parser.add_argument('--strictPort', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent / 'public'
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
with ThreadingHTTPServer((args.host, args.port), handler) as server:
    print(f'Serving {root} on http://{args.host}:{args.port}', flush=True)
    server.serve_forever()

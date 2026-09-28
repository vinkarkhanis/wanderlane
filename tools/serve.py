"""Local-only static preview with enough backlog for parallel ES-module loads."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8123)
    args = parser.parse_args()
    handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).resolve().parent.parent))
    with PreviewServer(("127.0.0.1", args.port), handler) as server:
        print(f"Wanderlane preview: http://127.0.0.1:{args.port}", flush=True)
        server.serve_forever()

"""Local-only static preview with enough backlog for parallel ES-module loads."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import hashlib
import json
import re
from urllib.parse import urlsplit


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


class PreviewHandler(SimpleHTTPRequestHandler):
    # Source modules change in place during development. Never reuse a module
    # from a previous version alongside freshly loaded game code.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path not in ("/", "/index.html"):
            return super().do_GET()
        root = Path(self.directory)
        html = (root / "index.html").read_text(encoding="utf-8")
        manifest = root / "assets" / "cities" / "pune" / "manifest.json"
        if manifest.exists():
            data_version = hashlib.sha256(manifest.read_bytes()).hexdigest()[:12]
            html = html.replace("</head>", '<meta name="wanderlane-preview-data" content="' + data_version + '"></head>')
        # An already-open browser can retain older modules even after reload.
        # Version every local import so the preview always loads one source set.
        versions = {}
        for source in (root / "src").rglob("*.js"):
            url = "/" + source.relative_to(root).as_posix()
            digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
            versions[url] = url + "?preview=" + digest
        def version_imports(match):
            mapping = json.loads(match.group(2))
            mapping.setdefault("imports", {}).update(versions)
            return match.group(1) + json.dumps(mapping) + match.group(3)
        html = re.sub(r'(<script\s+type="importmap"[^>]*>)(.*?)(</script>)',
                      version_imports, html, flags=re.DOTALL)
        html = html.replace('src="./src/main.js"', 'src="' + versions["/src/main.js"] + '"')
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8123)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(Path(__file__).resolve().parent.parent))
    with PreviewServer(("127.0.0.1", args.port), handler) as server:
        print(f"Wanderlane preview: http://127.0.0.1:{args.port}", flush=True)
        server.serve_forever()

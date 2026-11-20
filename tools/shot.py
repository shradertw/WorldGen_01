"""Screenshot the map for one or more seeds.

Usage: python3 tools/shot.py OUT_DIR SEED [SEED ...]
Serves the repo on a local port, opens index.html?seed=SEED in headless
Chrome, waits for generation to finish and saves the canvas as PNG.
"""
import functools
import http.server
import os
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    out, seeds = sys.argv[1], sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    srv = serve()
    port = srv.server_address[1]
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome")
        page = browser.new_page(viewport={"width": 1100, "height": 1150})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        for seed in seeds:
            page.goto(f"http://127.0.0.1:{port}/index.html?seed={seed}")
            page.wait_for_function("document.body.dataset.state === 'done' || document.body.dataset.state === 'error'", timeout=180000)
            info = page.inner_text("#info")
            page.locator("#map").screenshot(path=os.path.join(out, f"seed_{seed}.png"))
            print(seed, info, page.evaluate("document.body.dataset.state"))
        if errors:
            print("ERRORS:", errors)
        browser.close()
    srv.shutdown()


if __name__ == "__main__":
    main()

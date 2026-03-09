#!/usr/bin/env python3
"""HORUS Python Seeker Kernel (Selenium + TOR + identity rotation).

This kernel is API-less and browser-driven:
- routes browser traffic through TOR SOCKS5 (127.0.0.1:9050 by default)
- rotates TOR identity between scrape targets via NEWNYM on control port 9051
- captures XHR/fetch payload hints from browser performance logs
- supports DOM extraction for local/offline snapshots
"""

from __future__ import annotations

import json
import os
import socket
import time
import uuid
from pathlib import Path
from typing import Any

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

try:
    import undetected_chromedriver as uc
except Exception:  # pragma: no cover - fallback path
    uc = None

ROOT = Path(__file__).resolve().parents[1]
RAW_FILE = ROOT / "data" / "threats" / "raw" / "seeker-source.html"
OUT_FILE = ROOT / "data" / "threats" / "seeker_kernel_output.json"

TOR_PROXY_HOST = os.environ.get("HORUS_TOR_HOST", "127.0.0.1")
TOR_PROXY_PORT = int(os.environ.get("HORUS_TOR_PORT", "9050"))
TOR_CONTROL_HOST = os.environ.get("HORUS_TOR_CONTROL_HOST", "127.0.0.1")
TOR_CONTROL_PORT = int(os.environ.get("HORUS_TOR_CONTROL_PORT", "9051"))
TOR_CONTROL_PASSWORD = os.environ.get("HORUS_TOR_CONTROL_PASSWORD", "")

SEEKER_UA = os.environ.get(
    "HORUS_SEEKER_UA",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
)

FLIGHTRADAR_URL = os.environ.get("HORUS_FLIGHTRADAR_URL", "")
SHODAN_SEARCH_URL = os.environ.get("HORUS_SHODAN_SEARCH_URL", "")


def rotate_tor_identity() -> None:
    """Send NEWNYM to TOR control port for per-target identity rotation."""
    with socket.create_connection((TOR_CONTROL_HOST, TOR_CONTROL_PORT), timeout=5) as conn:
        auth_cmd = "AUTHENTICATE\r\n" if not TOR_CONTROL_PASSWORD else f'AUTHENTICATE "{TOR_CONTROL_PASSWORD}"\r\n'
        conn.sendall(auth_cmd.encode("utf-8"))
        _ = conn.recv(1024)
        conn.sendall(b"SIGNAL NEWNYM\r\n")
        _ = conn.recv(1024)
        conn.sendall(b"QUIT\r\n")


class EvaderBrowser:
    def __init__(self, proxy_host: str, proxy_port: int, user_agent: str) -> None:
        self.proxy = f"socks5://{proxy_host}:{proxy_port}"
        self.user_agent = user_agent
        self.driver: webdriver.Chrome | None = None

    def launch(self) -> None:
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument(f"--proxy-server={self.proxy}")
        options.add_argument(f"--user-agent={self.user_agent}")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--disable-webrtc")
        options.add_argument("--disable-features=WebRtcHideLocalIpsWithMdns")
        options.add_argument("--incognito")
        options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

        if uc is not None:
            self.driver = uc.Chrome(options=options, use_subprocess=True)
        else:
            self.driver = webdriver.Chrome(options=options)

    def close(self) -> None:
        if self.driver is not None:
            self.driver.quit()
            self.driver = None

    def scrape_dom_nodes(self, target_url: str) -> list[dict[str, Any]]:
        if self.driver is None:
            raise RuntimeError("driver not launched")
        self.driver.get(target_url)
        time.sleep(2)
        rows = self.driver.find_elements(By.CSS_SELECTOR, "[data-lat][data-lon]")
        nodes: list[dict[str, Any]] = []
        for i, row in enumerate(rows):
            lat = float(row.get_attribute("data-lat"))
            lon = float(row.get_attribute("data-lon"))
            nodes.append(
                {
                    "id": row.get_attribute("data-id") or f"py-seeker-{i}-{uuid.uuid4().hex[:8]}",
                    "lat": lat,
                    "lon": lon,
                    "nodeType": row.get_attribute("data-type") or "seeker-footprint",
                    "confidence": float(row.get_attribute("data-confidence") or 0.6),
                    "verified": (row.get_attribute("data-verified") or "true").lower() == "true",
                    "noisy": (row.get_attribute("data-noisy") or "false").lower() == "true",
                    "metadata": {"source": target_url, "proxy": self.proxy, "userAgent": self.user_agent},
                }
            )
        return nodes

    def extract_network_blobs(self) -> list[dict[str, Any]]:
        if self.driver is None:
            return []
        blobs: list[dict[str, Any]] = []
        for entry in self.driver.get_log("performance"):
            try:
                message = json.loads(entry["message"]).get("message", {})
                method = message.get("method")
                params = message.get("params", {})
                if method == "Network.responseReceived":
                    response = params.get("response", {})
                    mime = response.get("mimeType", "")
                    if "json" in mime or "javascript" in mime:
                        blobs.append({
                            "url": response.get("url"),
                            "status": response.get("status"),
                            "mimeType": mime,
                        })
            except Exception:
                continue
        return blobs


def run() -> int:
    targets: list[str] = []
    if RAW_FILE.exists():
        targets.append(RAW_FILE.resolve().as_uri())
    if FLIGHTRADAR_URL:
        targets.append(FLIGHTRADAR_URL)
    if SHODAN_SEARCH_URL:
        targets.append(SHODAN_SEARCH_URL)

    if not targets:
        payload = {"generatedAt": 0, "nodes": [], "networkBlobs": [], "warning": "no targets configured"}
        OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"No targets configured. Wrote empty payload -> {OUT_FILE}")
        return 0

    all_nodes: list[dict[str, Any]] = []
    all_blobs: list[dict[str, Any]] = []

    for idx, target in enumerate(targets):
        try:
            rotate_tor_identity()
        except Exception as error:
            print(f"[warn] TOR NEWNYM failed for target {target}: {error}")

        browser = EvaderBrowser(TOR_PROXY_HOST, TOR_PROXY_PORT, SEEKER_UA)
        browser.launch()
        try:
            nodes = browser.scrape_dom_nodes(target)
            all_nodes.extend(nodes)
            all_blobs.extend(browser.extract_network_blobs())
        finally:
            browser.close()

        if idx < len(targets) - 1:
            time.sleep(3)

    payload = {
      "generatedAt": int(time.time()),
      "targets": targets,
      "proxy": f"socks5://{TOR_PROXY_HOST}:{TOR_PROXY_PORT}",
      "nodes": all_nodes,
      "networkBlobs": all_blobs,
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(all_nodes)} seeker nodes -> {OUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())

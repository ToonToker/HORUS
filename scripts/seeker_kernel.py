#!/usr/bin/env python3
"""HORUS Python Seeker Kernel (Selenium + TOR SOCKS5).

- Uses isolated browser profiles per scrape run.
- Enforces SOCKS5 proxy routing (default: 127.0.0.1:9050).
- Parses local raw snapshots by default to keep runtime offline-first.
"""

from __future__ import annotations

import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options as FirefoxOptions

ROOT = Path(__file__).resolve().parents[1]
RAW_FILE = ROOT / "data" / "threats" / "raw" / "seeker-source.html"
OUT_FILE = ROOT / "data" / "threats" / "seeker_kernel_output.json"

TOR_PROXY_HOST = os.environ.get("HORUS_TOR_HOST", "127.0.0.1")
TOR_PROXY_PORT = int(os.environ.get("HORUS_TOR_PORT", "9050"))
SEEKER_UA = os.environ.get(
    "HORUS_SEEKER_UA",
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
)


def _browser() -> tuple[webdriver.Firefox, tempfile.TemporaryDirectory[str]]:
    profile_dir = tempfile.TemporaryDirectory(prefix="horus-seeker-")

    options = FirefoxOptions()
    options.add_argument("-headless")
    options.set_preference("network.proxy.type", 1)
    options.set_preference("network.proxy.socks", TOR_PROXY_HOST)
    options.set_preference("network.proxy.socks_port", TOR_PROXY_PORT)
    options.set_preference("network.proxy.socks_remote_dns", True)
    options.set_preference("media.peerconnection.enabled", False)
    options.set_preference("privacy.resistFingerprinting", True)
    options.set_preference("webgl.disabled", False)
    options.set_preference("general.useragent.override", SEEKER_UA)
    options.set_preference("browser.cache.disk.enable", False)
    options.set_preference("browser.cache.memory.enable", False)

    options.set_preference("profile", profile_dir.name)
    driver = webdriver.Firefox(options=options)
    return driver, profile_dir


def _extract_nodes(driver: webdriver.Firefox) -> list[dict[str, Any]]:
    rows = driver.find_elements(By.CSS_SELECTOR, "[data-lat][data-lon]")
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
                "metadata": {
                    "source": "seeker-source.html",
                    "proxy": f"socks5://{TOR_PROXY_HOST}:{TOR_PROXY_PORT}",
                    "userAgent": SEEKER_UA,
                },
            }
        )
    return nodes


def run() -> int:
    if not RAW_FILE.exists():
        payload = {"generatedAt": 0, "nodes": [], "warning": f"missing {RAW_FILE}"}
        OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"No raw seeker file found. Wrote empty payload -> {OUT_FILE}")
        return 0

    driver, profile_dir = _browser()
    try:
        driver.get(RAW_FILE.resolve().as_uri())
        nodes = _extract_nodes(driver)
    finally:
        driver.quit()
        profile_dir.cleanup()

    payload = {"generatedAt": int(Path(RAW_FILE).stat().st_mtime), "nodes": nodes}
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(nodes)} seeker nodes -> {OUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())

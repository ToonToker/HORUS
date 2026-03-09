#!/usr/bin/env python3
"""HORUS Python Seeker Kernel (Selenium + TOR + Pydantic Synaptic Filter).

Pipeline:
1) EvaderBrowser acquires raw nodes from DOM/network hints.
2) Pydantic validation enforces strict schema + poison-payload veto.
3) SQLite upsert deduplicates nodes and links source->node edges.
4) Output payload is emitted for downstream local ingestion.
"""

from __future__ import annotations

import hashlib
import json
import os
import socket
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

try:
    import undetected_chromedriver as uc
except Exception:  # pragma: no cover
    uc = None

ROOT = Path(__file__).resolve().parents[1]
RAW_FILE = ROOT / "data" / "threats" / "raw" / "seeker-source.html"
OUT_FILE = ROOT / "data" / "threats" / "seeker_kernel_output.json"
DB_PATH = Path(os.environ.get("HORUS_DB_PATH", ROOT / "horus.db"))
ANOMALY_LOG = ROOT / "data" / "threats" / "synaptic_anomalies.log"

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


class OSINTNode(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    nodeType: str = Field(min_length=2)
    confidence: float = Field(ge=0, le=1)
    verified: bool
    noisy: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id")
    @classmethod
    def id_required(cls, value: str) -> str:
      if not value.strip():
          raise ValueError("empty id")
      return value

    @field_validator("metadata")
    @classmethod
    def poison_veto(cls, value: dict[str, Any]) -> dict[str, Any]:
      serialized = json.dumps(value).lower()
      poison_terms = ("tracking_pixel", "utm_", "doubleclick", "beacon", "telemetry")
      if any(term in serialized for term in poison_terms):
          raise ValueError("poisoned metadata")
      return value


def _log_anomaly(reason: str, payload: dict[str, Any]) -> None:
    ANOMALY_LOG.parent.mkdir(parents=True, exist_ok=True)
    with ANOMALY_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": int(time.time()), "reason": reason, "payload": payload}) + "\n")


def rotate_tor_identity() -> None:
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
            nodes.append({
                "id": row.get_attribute("data-id") or f"py-seeker-{i}-{uuid.uuid4().hex[:8]}",
                "lat": float(row.get_attribute("data-lat")),
                "lon": float(row.get_attribute("data-lon")),
                "nodeType": row.get_attribute("data-type") or "seeker-footprint",
                "confidence": float(row.get_attribute("data-confidence") or 0.6),
                "verified": (row.get_attribute("data-verified") or "true").lower() == "true",
                "noisy": (row.get_attribute("data-noisy") or "false").lower() == "true",
                "metadata": {"source": target_url, "proxy": self.proxy, "userAgent": self.user_agent},
            })
        return nodes


def _connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS synaptic_nodes (
          id TEXT PRIMARY KEY,
          external_identifier TEXT UNIQUE NOT NULL,
          node_type TEXT NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          confidence REAL NOT NULL,
          properties_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS synaptic_edges (
          id TEXT PRIMARY KEY,
          source_identifier TEXT NOT NULL,
          target_identifier TEXT NOT NULL,
          relationship TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE(source_identifier, target_identifier, relationship)
        )
        """
    )
    return conn


def _upsert_validated_nodes(nodes: list[OSINTNode], source_id: str) -> int:
    if not nodes:
        return 0
    conn = _connect_db()
    ts = int(time.time())
    inserted = 0
    for node in nodes:
        payload_json = node.model_dump_json()
        conn.execute(
            """
            INSERT INTO synaptic_nodes (id, external_identifier, node_type, lat, lon, confidence, properties_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(external_identifier) DO UPDATE SET
              node_type=excluded.node_type,
              lat=excluded.lat,
              lon=excluded.lon,
              confidence=excluded.confidence,
              properties_json=excluded.properties_json,
              updated_at=excluded.updated_at
            """,
            (node.id, node.id, node.nodeType, node.lat, node.lon, node.confidence, payload_json, ts),
        )
        edge_id = hashlib.sha256(f"{source_id}:{node.id}:DISCOVERED".encode()).hexdigest()[:24]
        conn.execute(
            """
            INSERT OR IGNORE INTO synaptic_edges (id, source_identifier, target_identifier, relationship, created_at)
            VALUES (?, ?, ?, 'DISCOVERED', ?)
            """,
            (edge_id, source_id, node.id, ts),
        )
        inserted += 1
    conn.commit()
    conn.close()
    return inserted


def _validate(raw_nodes: list[dict[str, Any]]) -> list[OSINTNode]:
    accepted: list[OSINTNode] = []
    for payload in raw_nodes:
        try:
            node = OSINTNode.model_validate(payload)
            if node.noisy or node.confidence < 0.35:
                _log_anomaly("58NS_VETO_LOW_CONFIDENCE", payload)
                continue
            accepted.append(node)
        except ValidationError as e:
            _log_anomaly(f"58NS_VETO_SCHEMA:{e.errors()[0]['msg']}", payload)
    return accepted


def run() -> int:
    targets: list[str] = []
    if RAW_FILE.exists():
        targets.append(RAW_FILE.resolve().as_uri())
    if FLIGHTRADAR_URL:
        targets.append(FLIGHTRADAR_URL)
    if SHODAN_SEARCH_URL:
        targets.append(SHODAN_SEARCH_URL)

    if not targets:
        payload = {"generatedAt": 0, "nodes": [], "warning": "no targets configured"}
        OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"No targets configured. Wrote empty payload -> {OUT_FILE}")
        return 0

    accepted_nodes: list[OSINTNode] = []
    for idx, target in enumerate(targets):
        source_id = hashlib.sha1(target.encode()).hexdigest()[:16]
        try:
            rotate_tor_identity()
        except Exception as error:
            _log_anomaly(f"TOR_NEWNYM_FAILED:{error}", {"target": target})

        browser = EvaderBrowser(TOR_PROXY_HOST, TOR_PROXY_PORT, SEEKER_UA)
        browser.launch()
        try:
            raw_nodes = browser.scrape_dom_nodes(target)
        finally:
            browser.close()

        validated = _validate(raw_nodes)
        _upsert_validated_nodes(validated, source_id)
        accepted_nodes.extend(validated)

        if idx < len(targets) - 1:
            time.sleep(2)

    payload = {
        "generatedAt": int(time.time()),
        "targets": targets,
        "proxy": f"socks5://{TOR_PROXY_HOST}:{TOR_PROXY_PORT}",
        "nodes": [n.model_dump() for n in accepted_nodes],
        "accepted": len(accepted_nodes),
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Validated {len(accepted_nodes)} nodes -> {OUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())

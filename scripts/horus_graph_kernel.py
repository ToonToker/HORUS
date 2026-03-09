#!/usr/bin/env python3
"""HORUS Graph Kernel API (local SSE + graph persistence)."""

from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get("HORUS_GRAPH_DB_PATH", ROOT / "horus_graph.db"))
SCHEMA_PATH = ROOT / "horus_kernel" / "database" / "schema.sql"
CONFIG_PATH = ROOT / "data" / "mcp" / "config.json"

app = FastAPI(title="HORUS Graph Kernel")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_label_type ON intel_nodes(label, type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_source_target ON intel_edges(source_node, target_node)")
    return conn


def resolve_entity(data: dict[str, Any]) -> tuple[str, bool]:
    node_id = str(data.get("node_id") or data.get("id") or "").strip()
    label = str(data.get("label") or data.get("nodeType") or "Unknown").strip()
    node_type = str(data.get("type") or "OSINT").strip()
    metadata = dict(data.get("metadata") or data)
    lat = data.get("lat")
    lon = data.get("lon")

    if not node_id:
        fingerprint = f"{label}:{metadata.get('ip') or metadata.get('wallet') or metadata.get('handle') or uuid.uuid4().hex}"
        node_id = fingerprint.replace(" ", "_")

    conn = _conn()
    existing = conn.execute("SELECT node_id FROM intel_nodes WHERE node_id = ?", (node_id,)).fetchone()
    conn.execute(
        """
        INSERT INTO intel_nodes (node_id, label, type, lat, lon, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(node_id) DO UPDATE SET
          label=excluded.label,
          type=excluded.type,
          lat=COALESCE(excluded.lat, intel_nodes.lat),
          lon=COALESCE(excluded.lon, intel_nodes.lon),
          metadata=excluded.metadata,
          timestamp=CURRENT_TIMESTAMP
        """,
        (node_id, label, node_type, lat, lon, json.dumps(metadata)),
    )
    conn.commit()
    conn.close()
    return node_id, existing is None


def link_nodes(source: str, target: str, relationship: str, weight: float = 1.0) -> str:
    edge_id = f"edge-{source}-{target}-{abs(hash((relationship, round(weight, 3))))}"
    conn = _conn()
    for nid in (source, target):
        conn.execute(
            """
            INSERT INTO intel_nodes (node_id, label, type, metadata)
            VALUES (?, ?, 'OSINT', '{}')
            ON CONFLICT(node_id) DO NOTHING
            """,
            (nid, nid),
        )
    conn.execute(
        """
        INSERT OR REPLACE INTO intel_edges (edge_id, source_node, target_node, relationship, weight)
        VALUES (?, ?, ?, ?, ?)
        """,
        (edge_id, source, target, relationship, weight),
    )
    conn.commit()
    conn.close()
    return edge_id


@app.post('/api/kernel/sync')
async def kernel_sync(payload: dict[str, Any]):
    layer = str(payload.get("id") or payload.get("layer") or "unknown")
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        existing = {}
    existing[layer] = {
        "name": payload.get("name", layer),
        "active": bool(payload.get("active", True)),
        "settings": payload.get("settings", {}),
        "status": payload.get("status", "idle"),
        "updatedAt": int(time.time() * 1000),
    }
    CONFIG_PATH.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    return {"ok": True, "layer": layer, "config": existing[layer]}


@app.post('/api/kernel/ingest')
async def kernel_ingest(payload: dict[str, Any]):
    source = str(payload.get("source") or "kernel")
    nodes = list(payload.get("nodes") or [])
    accepted = []
    edges = []
    for n in nodes:
        node_id, created = resolve_entity(n)
        accepted.append({"id": node_id, "created": created, **n})
        src = n.get("source_node") or source
        edge_id = link_nodes(str(src), node_id, str(n.get("relationship") or "Connected_To"), float(n.get("weight") or 1.0))
        edges.append({"edge_id": edge_id, "source": src, "target": node_id})
    return {"ok": True, "accepted": accepted, "edges": edges}


@app.get('/api/kernel/events')
async def kernel_events(request: Request):
    async def event_stream():
        last_seen = "1970-01-01 00:00:00"
        while True:
            if await request.is_disconnected():
                break
            conn = _conn()
            rows = conn.execute(
                "SELECT node_id, label, type, lat, lon, metadata, timestamp FROM intel_nodes WHERE timestamp > ? ORDER BY timestamp ASC LIMIT 200",
                (last_seen,),
            ).fetchall()
            edge_rows = conn.execute(
                "SELECT edge_id, source_node, target_node, relationship, weight FROM intel_edges ORDER BY rowid DESC LIMIT 200"
            ).fetchall()
            conn.close()

            if rows:
                for r in rows:
                    payload = {
                        "node": {
                            "id": r["node_id"],
                            "nodeType": r["label"],
                            "kind": r["type"],
                            "lat": r["lat"],
                            "lon": r["lon"],
                            "metadata": json.loads(r["metadata"] or "{}"),
                            "ts": int(time.time() * 1000),
                        },
                        "edges": [
                            {
                                **dict(e),
                                "source": dict(conn.execute("SELECT node_id, lat, lon FROM intel_nodes WHERE node_id = ?", (e["source_node"],)).fetchone() or {}),
                                "target": dict(conn.execute("SELECT node_id, lat, lon FROM intel_nodes WHERE node_id = ?", (e["target_node"],)).fetchone() or {}),
                            }
                            for e in edge_rows if e["target_node"] == r["node_id"]
                        ],
                    }
                    last_seen = r["timestamp"]
                    yield f"data: {json.dumps(payload)}\n\n"
            else:
                yield "event: heartbeat\ndata: {}\n\n"
            time.sleep(1)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get('/api/kernel/graph')
async def kernel_graph():
    conn = _conn()
    nodes = [dict(r) for r in conn.execute("SELECT * FROM intel_nodes ORDER BY timestamp DESC LIMIT 5000").fetchall()]
    edges = [dict(r) for r in conn.execute("SELECT * FROM intel_edges ORDER BY rowid DESC LIMIT 5000").fetchall()]
    conn.close()
    return JSONResponse({"nodes": nodes, "edges": edges})


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)

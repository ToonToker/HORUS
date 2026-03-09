#!/usr/bin/env python3
"""HORUS MCP stdio server using official `mcp` Python library.

Tools exposed:
- add_node
- add_edge
- get_target_graph (recursive CTE, 3 hops)
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

DB_PATH = Path(os.environ.get("HORUS_DB_PATH", "horus.db"))
mcp = FastMCP("horus-intel-graph")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS intel_nodes (
          id TEXT PRIMARY KEY,
          case_id TEXT NOT NULL,
          type TEXT NOT NULL,
          properties_json TEXT NOT NULL DEFAULT '{}',
          geometry TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS intel_edges (
          id TEXT PRIMARY KEY,
          case_id TEXT NOT NULL,
          source_node_id TEXT NOT NULL,
          target_node_id TEXT NOT NULL,
          relationship_type TEXT NOT NULL,
          weight REAL NOT NULL DEFAULT 1,
          properties_json TEXT NOT NULL DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(source_node_id) REFERENCES intel_nodes(id),
          FOREIGN KEY(target_node_id) REFERENCES intel_nodes(id)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS intel_nodes_case_idx ON intel_nodes(case_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS intel_edges_case_idx ON intel_edges(case_id, source_node_id, target_node_id)")
    return conn


def _case(case_id: str | None) -> str:
    return case_id.strip() if case_id and case_id.strip() else "default-case"


@mcp.tool()
def add_node(node_type: str, properties: dict[str, Any], lat: float, lng: float, case_id: str = "default-case") -> dict[str, Any]:
    node_id = str(properties.get("id") or f"node-{abs(hash((node_type, lat, lng, json.dumps(properties, sort_keys=True))))}")
    geometry = json.dumps({"type": "Point", "coordinates": [float(lng), float(lat)]})

    conn = _conn()
    conn.execute(
        """
        INSERT OR REPLACE INTO intel_nodes (id, case_id, type, properties_json, geometry)
        VALUES (?, ?, ?, ?, ?)
        """,
        (node_id, _case(case_id), node_type, json.dumps(properties), geometry),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "id": node_id}


@mcp.tool()
def add_edge(source_id: str, target_id: str, relationship: str, weight: float = 1.0, case_id: str = "default-case") -> dict[str, Any]:
    edge_id = f"edge-{source_id}-{target_id}-{abs(hash((relationship, weight)))}"
    conn = _conn()
    conn.execute(
        """
        INSERT OR REPLACE INTO intel_edges (id, case_id, source_node_id, target_node_id, relationship_type, weight, properties_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (edge_id, _case(case_id), source_id, target_id, relationship, float(weight), "{}"),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "id": edge_id}


@mcp.tool()
def get_target_graph(node_id: str, case_id: str = "default-case", max_depth: int = 3) -> dict[str, Any]:
    depth = max(1, min(int(max_depth), 3))
    conn = _conn()

    rows = conn.execute(
        """
        WITH RECURSIVE traversal(depth, node_id) AS (
          SELECT 0, ?
          UNION
          SELECT t.depth + 1,
                 CASE WHEN e.source_node_id = t.node_id THEN e.target_node_id ELSE e.source_node_id END
          FROM traversal t
          JOIN intel_edges e
            ON e.case_id = ?
           AND (e.source_node_id = t.node_id OR e.target_node_id = t.node_id)
          WHERE t.depth < ?
        )
        SELECT DISTINCT node_id, MIN(depth) AS depth
        FROM traversal
        GROUP BY node_id
        ORDER BY depth ASC, node_id ASC
        """,
        (node_id, _case(case_id), depth),
    ).fetchall()

    discovered = [r["node_id"] for r in rows]
    if not discovered:
        conn.close()
        return {"nodes": [], "edges": [], "root": node_id, "depth": depth}

    placeholders = ",".join("?" for _ in discovered)
    nodes = conn.execute(
        f"SELECT id, type, properties_json, geometry, case_id, created_at FROM intel_nodes WHERE case_id = ? AND id IN ({placeholders})",
        (_case(case_id), *discovered),
    ).fetchall()
    edges = conn.execute(
        f"""
        SELECT id, source_node_id, target_node_id, relationship_type, weight, case_id, created_at
        FROM intel_edges
        WHERE case_id = ? AND source_node_id IN ({placeholders}) AND target_node_id IN ({placeholders})
        """,
        (_case(case_id), *discovered, *discovered),
    ).fetchall()
    conn.close()

    return {
        "root": node_id,
        "depth": depth,
        "nodes": [dict(r) for r in nodes],
        "edges": [dict(r) for r in edges],
        "chain": [{"node_id": r["node_id"], "depth": r["depth"]} for r in rows],
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")

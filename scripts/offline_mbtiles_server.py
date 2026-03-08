#!/usr/bin/env python3
"""Local MBTiles tile server (XYZ requests -> TMS rows) for air-gapped Leaflet."""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
import uvicorn

app = FastAPI(title="HORUS Offline MBTiles Server")
conn: sqlite3.Connection | None = None


def _get_tile(z: int, x: int, y: int) -> bytes:
    if conn is None:
        raise RuntimeError("MBTiles connection not initialized")
    n = 2 ** z
    tms_y = (n - 1) - y
    row = conn.execute(
        "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
        (z, x, tms_y),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Tile not found")
    return row[0]


@app.get("/tiles/{z}/{x}/{y}.png")
def tile(z: int, x: int, y: int):
    return Response(content=_get_tile(z, x, y), media_type="image/png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mbtiles", default="maps/offline.mbtiles")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8099, type=int)
    args = parser.parse_args()

    mbtiles_path = Path(args.mbtiles)
    if not mbtiles_path.exists():
        raise SystemExit(f"MBTiles not found: {mbtiles_path}")

    conn = sqlite3.connect(str(mbtiles_path), check_same_thread=False)
    uvicorn.run(app, host=args.host, port=args.port)

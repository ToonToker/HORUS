# PROJECT HORUS — Sovereign Geospatial Engine

HORUS is now a **local-first geospatial intelligence stack** under a ZERO-API-MANDATE.

## What changed
- No external API ingestion in runtime server code.
- Local data directories are the source of truth:
  - `data/boundaries`
  - `data/conflicts`
  - `data/threats`
- Local SQLite persistence for Sovereign Witness annotations (`horus.db`).
- Outbound web fetches are blocked by policy in `server.ts`.
- No binary map assets are required in-repo; the client uses an inline tactical raster fallback tile by default.

## Install
```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Offline data model
Place local files here:
- Boundaries (GADM-style): `data/boundaries/*.geojson`
- Conflict events (ACLED/UCDP): `data/conflicts/acled.csv` or `acled.json`
- Threat telemetry and infrastructure:
  - `data/threats/threat_arcs.json`
  - `data/threats/breaches.csv`
  - `data/threats/seismic_faults.geojson`
  - `data/threats/power_grid.geojson`
  - `data/threats/satellite_ground_stations.geojson`
  - `data/threats/subsea_cables.geojson`

## Sovereign Witness workflow
1. Click any coordinate on the map.
2. Enter Markdown note, status, and Akh-Status in sidebar.
3. Save annotation to local SQLite.

API:
- `GET /api/witness/annotations`
- `POST /api/witness/annotations`
- `GET /api/sovereign/status`

## Fetch script
Use helper:
```bash
./scripts/fetch-local-data.sh
```

This script is a scaffold for air-gapped data acquisition workflows.

## Notes
- This implementation uses local SQLite for persistence and is **SpatiaLite-ready**.
- For full PostGIS deployment, mirror the schema in your local Postgres instance.

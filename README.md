# PROJECT HORUS — Sovereign Geospatial Engine

HORUS is a **local-first geospatial intelligence stack** under a ZERO-API-MANDATE.

## Install
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

## Offline data roots
- `data/boundaries` — GADM-style GeoJSON
- `data/conflicts` — ACLED/UCDP CSV
- `data/threats` — threat overlays + SIGINT files

## HORUS-SIGINT modules (local correlation)
- RF Acoustic Hekau nodes: `data/threats/radio_stations.csv`
- Maritime AIS tracks: `data/threats/ais_vessels.csv`
- Cyber threat events: `data/threats/cyber_attacks.json`
- WiGle signal fog: `data/threats/wigle_cells.csv`
- Shodan scrape cache: `data/threats/shodan_scrape.csv`
- Name-to-grid ghost markers: `data/threats/name_address_grid.csv`
- Deep-location people records: `data/threats/deep_location_people.csv`

## Local scraping/normalization scripts
Use archived/raw captures (not runtime API calls):
```bash
node scripts/scrape-rf-maritime.mjs
node scripts/scrape-cyber.mjs
```
Input archive folder: `data/threats/raw`

## APIs
- `GET /api/health`
- `GET /api/sovereign/status`
- `GET /api/witness/annotations`
- `POST /api/witness/annotations`
- `POST /api/sigint/investigate`

## Notes
- Runtime outbound network requests are blocked in `server.ts`.
- Witness annotations and investigation records persist in local SQLite (`horus.db`).

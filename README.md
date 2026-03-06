# PROJECT HORUS — Sovereign Geospatial Engine

HORUS is a **local-first geospatial intelligence suite** under a ZERO-API-MANDATE.

## Run
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

## Core architecture
- Zero outbound runtime API calls (blocked in server runtime).
- Local map engine with local tiles from: `maps/tiles/{z}/{x}/{y}.svg`.
- Local datasets from:
  - `data/boundaries`
  - `data/conflicts`
  - `data/threats`

## Sovereign Control Panel
Use the ⚙ **Settings** button in the top-right to configure:
- Scraping frequency (slider)
- TOR/proxy routing toggle
- Local data paths (WiGle, breach dump, boundaries)
- Preferred raw radio/AIS source URLs

## SIGINT layer files
- RF nodes: `data/threats/radio_stations.csv`
- Maritime: `data/threats/ais_vessels.csv`
- Cyber: `data/threats/cyber_attacks.json`
- WiFi signal fog: `data/threats/wigle_cells.csv`
- Shodan-strip cache: `data/threats/shodan_scrape.csv`
- Resonance/identity: `data/threats/name_address_grid.csv`, `data/threats/deep_location_people.csv`

## APIs
- `GET /api/health`
- `GET /api/sovereign/status`
- `GET /api/witness/annotations`
- `POST /api/witness/annotations`
- `POST /api/sigint/investigate`

## Helpers
```bash
./scripts/fetch-local-data.sh
node scripts/scrape-rf-maritime.mjs
node scripts/scrape-cyber.mjs
```

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
- Local MBTiles-backed tile server at `/maps/tiles/{z}/{x}/{y}.png` with XYZ→TMS inversion support (`y = (2^z - 1) - y`) and Leaflet `tms: true` compatibility.
- Local datasets from:
  - `data/boundaries`
  - `data/conflicts`
  - `data/threats`
  - `data/mcp`

## New HORUS-INTELLIGENCE-ENTITY upgrades
- **Sentinel Veto Gatekeeper:** audits incoming packets for poisoned metadata/tracking headers before ingest.
- **MCP Anchor Bridge:** loads local MCP context snapshots (`data/mcp/lob_context.json`, `data/mcp/osint_context.json`) and emits geospatial MCP nodes.
- **Seeker Pipes:** `POST /api/seeker/ingest` accepts autonomous node discoveries (IP/wallet/MAC footprints).
- **Maat Filter + 58ns Veto:** validation audit rejects `ISFET` noisy/unverified/low-confidence nodes before rendering and stores them in a local high-entropy quarantine queue.
- **Case Isolation:** create/activate isolated investigations via API/UI, stored under `cases/<case-id>` and SQLite case IDs.
- **Temporal layers:** liquidity heatmap + seismic windows available as independent render layers.

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
- `GET /api/mcp/context`
- `POST /api/mcp/rpc` (JSON-RPC context bridge for local agent clients, includes `add_intel_node` and `link_intel_nodes`)
- `GET /api/mcp/sse` (JSON-RPC notifications over SSE)
- `GET /api/cases`
- `POST /api/cases`
- `POST /api/cases/activate`
- `GET /api/witness/annotations`
- `POST /api/witness/annotations`
- `POST /api/seeker/ingest`
- `GET /api/validation/high-entropy`
- `GET /api/intel/resource-nodes`
- `GET /api/intel/graph`
- `POST /api/sigint/investigate`

## Helpers
```bash
./scripts/fetch-local-data.sh
node scripts/scrape-rf-maritime.mjs
node scripts/scrape-cyber.mjs
node scripts/seeker-kernel.mjs
python scripts/offline_mbtiles_server.py --mbtiles maps/offline.mbtiles --port 8099
python scripts/horus_mcp_stdio.py
```


## Local MCP socket
- HORUS also exposes a local JSON-RPC newline protocol socket at `/tmp/horus-mcp.sock` for agent-to-agent context pull in air-gapped mode.


## Containerized pristine runtime
```bash
docker compose up --build
```
This keeps HORUS isolated with local mounted data/cases/tiles for Bazzell-standard separation.


## MCP server modes
- Official Python MCP stdio server: `python scripts/horus_mcp_stdio.py`
- Exposed MCP tools: `add_node`, `add_edge`, `get_target_graph`
- Local UNIX socket JSON-RPC: `/tmp/horus-mcp.sock`
- HTTP JSON-RPC: `POST /api/mcp/rpc`
- SSE notifications: `GET /api/mcp/sse`
- Optional stdio JSON-RPC bridge: `HORUS_ENABLE_STDIO_MCP=1 node -e "import('./server.ts')"`

## Air-gap veto middleware (Python)
- `scripts/airgap_veto_middleware.py` installs a strict outbound veto that exits the process if any backend code attempts non-local outbound sockets or URL opens.
- Use in Python kernels before network modules initialize:
```python
from scripts.airgap_veto_middleware import install_airgap_veto
install_airgap_veto(allowed_proxy_hosts=['127.0.0.1'])
```


## Recursive CTE graph chains
- `get_target_graph` in `scripts/horus_mcp_stdio.py` uses a recursive SQLite CTE to traverse connected nodes up to 3 hops and returns a JSON graph payload.

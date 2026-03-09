#!/usr/bin/env bash
set -euo pipefail
mkdir -p data/boundaries data/conflicts data/threats data/threats/raw

echo "HORUS local data scaffold ready."
echo "Populate:"
echo "  data/boundaries/*.geojson"
echo "  data/conflicts/acled.csv"
echo "  data/threats/{radio_stations.csv,ais_vessels.csv,cyber_attacks.json,wigle_cells.csv,shodan_scrape.csv,name_address_grid.csv,deep_location_people.csv}"
echo "If you captured raw web HTML/JSON snapshots, place under data/threats/raw and run:"
echo "  node scripts/scrape-rf-maritime.mjs"
echo "  node scripts/scrape-cyber.mjs"

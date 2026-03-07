#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const rawDir = path.join(process.cwd(), 'data', 'threats', 'raw');
const outRadio = path.join(process.cwd(), 'data', 'threats', 'radio_stations.csv');
const outAis = path.join(process.cwd(), 'data', 'threats', 'ais_vessels.csv');

const radioHtml = fs.existsSync(path.join(rawDir, 'radio.html')) ? fs.readFileSync(path.join(rawDir, 'radio.html'), 'utf8') : '';
const maritimeHtml = fs.existsSync(path.join(rawDir, 'maritime.html')) ? fs.readFileSync(path.join(rawDir, 'maritime.html'), 'utf8') : '';

const radioRows = [];
for (const m of radioHtml.matchAll(/data-station="([^"]+)"\s+data-country="([^"]+)"\s+data-stream="([^"]+)"\s+data-lat="([^"]+)"\s+data-lon="([^"]+)"/g)) {
  radioRows.push([m[1], m[2], m[3], m[4], m[5]].join(','));
}

const vesselRows = [];
for (const m of maritimeHtml.matchAll(/data-callsign="([^"]+)"\s+data-cargo="([^"]+)"\s+data-lat="([^"]+)"\s+data-lon="([^"]+)"\s+data-heading="([^"]+)"\s+data-speed="([^"]+)"/g)) {
  vesselRows.push([m[1], m[2], m[3], m[4], m[5], m[6]].join(','));
}

fs.writeFileSync(outRadio, ['name,country,stream_url,lat,lon', ...radioRows].join('\n') + '\n');
fs.writeFileSync(outAis, ['callsign,cargo,lat,lon,heading,speed', ...vesselRows].join('\n') + '\n');
console.log(`Wrote ${radioRows.length} RF rows and ${vesselRows.length} AIS rows`);

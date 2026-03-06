#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const rawPath = path.join(process.cwd(), 'data', 'threats', 'raw', 'cyber.json');
const shodanHtmlPath = path.join(process.cwd(), 'data', 'threats', 'raw', 'shodan.html');
const cyberOut = path.join(process.cwd(), 'data', 'threats', 'cyber_attacks.json');
const shodanOut = path.join(process.cwd(), 'data', 'threats', 'shodan_scrape.csv');

const cyberRaw = fs.existsSync(rawPath) ? JSON.parse(fs.readFileSync(rawPath, 'utf8')) : { events: [] };
const normEvents = (cyberRaw.events || []).map((e, i) => ({
  id: e.id || `cy-${i}`,
  lat: Number(e.lat),
  lon: Number(e.lon),
  intensity: Number(e.intensity || 1),
  attackType: e.attackType || 'Unknown',
  attackerIp: e.attackerIp || '0.0.0.0',
  targetPort: Number(e.targetPort || 0),
  ts: Number(e.ts || Date.now()),
}));
fs.writeFileSync(cyberOut, JSON.stringify({ events: normEvents }, null, 2));

const shodanHtml = fs.existsSync(shodanHtmlPath) ? fs.readFileSync(shodanHtmlPath, 'utf8') : '';
const rows = [];
for (const m of shodanHtml.matchAll(/data-ip="([^"]+)"\s+data-port="([^"]+)"\s+data-service="([^"]+)"\s+data-lat="([^"]+)"\s+data-lon="([^"]+)"/g)) {
  rows.push([m[1], m[2], m[3], m[4], m[5]].join(','));
}
fs.writeFileSync(shodanOut, ['ip,port,service,lat,lon', ...rows].join('\n') + '\n');
console.log(`Wrote ${normEvents.length} cyber events and ${rows.length} shodan rows`);

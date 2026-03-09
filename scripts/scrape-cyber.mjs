#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const rawPath = path.join(process.cwd(), 'data', 'threats', 'raw', 'cyber.json');
const shodanHtmlPath = path.join(process.cwd(), 'data', 'threats', 'raw', 'shodan.html');
const cyberOut = path.join(process.cwd(), 'data', 'threats', 'cyber_attacks.json');
const shodanOut = path.join(process.cwd(), 'data', 'threats', 'shodan_scrape.csv');

async function getStealthChromium() {
  const { chromium } = await import('playwright-extra');
  const stealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
  chromium.use(stealthPlugin());
  return chromium;
}

async function parseShodanWithPlaywright() {
  if (!fs.existsSync(shodanHtmlPath)) return [];
  const chromium = await getStealthChromium();
  const browser = await chromium.launch({ headless: true, args: ['--disable-webrtc'] });
  const context = await browser.newContext({ userAgent: 'HORUS-SHODAN-STRIP/1.0' });
  const { stealth } = await import('playwright-stealth');
  await stealth(context);

  const page = await context.newPage();
  await page.setContent(fs.readFileSync(shodanHtmlPath, 'utf8'));
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-ip][data-port][data-service][data-lat][data-lon]')].map((el) => [
    el.getAttribute('data-ip'),
    el.getAttribute('data-port'),
    el.getAttribute('data-service'),
    el.getAttribute('data-lat'),
    el.getAttribute('data-lon'),
  ]));
  await context.close();
  await browser.close();
  return rows.map((r) => r.join(','));
}

async function run() {
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

  const rows = await parseShodanWithPlaywright();
  fs.writeFileSync(shodanOut, ['ip,port,service,lat,lon', ...rows].join('\n') + '\n');
  console.log(`Wrote ${normEvents.length} cyber events and ${rows.length} shodan rows`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

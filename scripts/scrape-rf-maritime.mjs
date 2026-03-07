#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const rawDir = path.join(process.cwd(), 'data', 'threats', 'raw');
const outRadio = path.join(process.cwd(), 'data', 'threats', 'radio_stations.csv');
const outAis = path.join(process.cwd(), 'data', 'threats', 'ais_vessels.csv');

async function run() {
  let chromium;
  try {
    const mod = await import('playwright');
    chromium = mod.chromium;
  } catch {
    chromium = null;
  }

  const radioHtmlPath = path.join(rawDir, 'radio.html');
  const maritimeHtmlPath = path.join(rawDir, 'maritime.html');
  const radioRows = [];
  const vesselRows = [];

  if (chromium && fs.existsSync(radioHtmlPath)) {
    const browser = await chromium.launch({ headless: true, args: ['--disable-webrtc'] });
    const context = await browser.newContext({ userAgent: 'HORUS-RF/1.0' });
    await context.addInitScript("Object.defineProperty(window,'RTCPeerConnection',{value:undefined});");
    const page = await context.newPage();
    await page.setContent(fs.readFileSync(radioHtmlPath, 'utf8'));
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-station][data-country][data-stream][data-lat][data-lon]')].map((el) => [
      el.getAttribute('data-station'),
      el.getAttribute('data-country'),
      el.getAttribute('data-stream'),
      el.getAttribute('data-lat'),
      el.getAttribute('data-lon'),
    ]));
    rows.forEach((r) => radioRows.push(r.join(',')));
    await context.close();
    await browser.close();
  }

  if (chromium && fs.existsSync(maritimeHtmlPath)) {
    const browser = await chromium.launch({ headless: true, args: ['--disable-webrtc'] });
    const context = await browser.newContext({ userAgent: 'HORUS-MARITIME/1.0' });
    await context.addInitScript("Object.defineProperty(window,'RTCPeerConnection',{value:undefined});");
    const page = await context.newPage();
    await page.setContent(fs.readFileSync(maritimeHtmlPath, 'utf8'));
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-callsign][data-cargo][data-lat][data-lon][data-heading][data-speed]')].map((el) => [
      el.getAttribute('data-callsign'),
      el.getAttribute('data-cargo'),
      el.getAttribute('data-lat'),
      el.getAttribute('data-lon'),
      el.getAttribute('data-heading'),
      el.getAttribute('data-speed'),
    ]));
    rows.forEach((r) => vesselRows.push(r.join(',')));
    await context.close();
    await browser.close();
  }

  fs.writeFileSync(outRadio, ['name,country,stream_url,lat,lon', ...radioRows].join('\n') + '\n');
  fs.writeFileSync(outAis, ['callsign,cargo,lat,lon,heading,speed', ...vesselRows].join('\n') + '\n');
  console.log(`Wrote ${radioRows.length} RF rows and ${vesselRows.length} AIS rows`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

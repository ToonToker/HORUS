#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const rawDir = path.join(process.cwd(), 'data', 'threats', 'raw');
const outRadio = path.join(process.cwd(), 'data', 'threats', 'radio_stations.csv');
const outAis = path.join(process.cwd(), 'data', 'threats', 'ais_vessels.csv');

async function getStealthChromium() {
  const { chromium } = await import('playwright-extra');
  const stealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
  chromium.use(stealthPlugin());
  return chromium;
}

async function applyPlaywrightStealth(context) {
  const { stealth } = await import('playwright-stealth');
  await stealth(context);
}

async function extractWithContext(chromium, htmlPath, selector, mapper, userAgent) {
  if (!fs.existsSync(htmlPath)) return [];
  const browser = await chromium.launch({ headless: true, args: ['--disable-webrtc'] });
  const context = await browser.newContext({ userAgent });
  await applyPlaywrightStealth(context);
  const page = await context.newPage();
  await page.setContent(fs.readFileSync(htmlPath, 'utf8'));
  const rows = await page.evaluate(({ selector, mapper }) => {
    return [...document.querySelectorAll(selector)].map((el) => mapper.map((k) => el.getAttribute(k)));
  }, { selector, mapper });
  await context.close();
  await browser.close();
  return rows;
}

async function run() {
  const chromium = await getStealthChromium();
  const radioRows = await extractWithContext(
    chromium,
    path.join(rawDir, 'radio.html'),
    '[data-station][data-country][data-stream][data-lat][data-lon]',
    ['data-station', 'data-country', 'data-stream', 'data-lat', 'data-lon'],
    'HORUS-RF/1.0',
  );

  const vesselRows = await extractWithContext(
    chromium,
    path.join(rawDir, 'maritime.html'),
    '[data-callsign][data-cargo][data-lat][data-lon][data-heading][data-speed]',
    ['data-callsign', 'data-cargo', 'data-lat', 'data-lon', 'data-heading', 'data-speed'],
    'HORUS-MARITIME/1.0',
  );

  fs.writeFileSync(outRadio, ['name,country,stream_url,lat,lon', ...radioRows.map((r) => r.join(','))].join('\n') + '\n');
  fs.writeFileSync(outAis, ['callsign,cargo,lat,lon,heading,speed', ...vesselRows.map((r) => r.join(','))].join('\n') + '\n');
  console.log(`Wrote ${radioRows.length} RF rows and ${vesselRows.length} AIS rows`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

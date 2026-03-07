#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const OUT = path.join(process.cwd(), 'data', 'threats', 'seeker_kernel_output.json');
const UA = 'HORUS-Seeker/1.0 (+local-kernel; airgapped)';

async function run() {
  let chromium;
  try {
    const mod = await import('playwright');
    chromium = mod.chromium;
  } catch {
    console.error('playwright not installed; falling back to local raw snapshot parsing only.');
  }

  const found = [];

  if (chromium) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();

    const targetFile = path.join(process.cwd(), 'data', 'threats', 'raw', 'seeker-source.html');
    if (fs.existsSync(targetFile)) {
      const html = fs.readFileSync(targetFile, 'utf8');
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const nodes = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-lat][data-lon]')];
        return rows.map((el, i) => ({
          id: el.getAttribute('data-id') || `kernel-${i}`,
          lat: Number(el.getAttribute('data-lat')),
          lon: Number(el.getAttribute('data-lon')),
          nodeType: el.getAttribute('data-type') || 'seeker-footprint',
          confidence: Number(el.getAttribute('data-confidence') || 0.6),
          verified: (el.getAttribute('data-verified') || 'true') === 'true',
          noisy: (el.getAttribute('data-noisy') || 'false') === 'true',
          metadata: { source: 'seeker-source.html' },
        }));
      });
      found.push(...nodes);
    }

    await browser.close();
  }

  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: Date.now(), userAgent: UA, nodes: found }, null, 2));
  console.log(`Wrote ${found.length} seeker nodes -> ${OUT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

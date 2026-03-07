#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const OUT = path.join(process.cwd(), 'data', 'threats', 'seeker_kernel_output.json');
const UA_POOL = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];
const PROXY_POOL = (process.env.HORUS_PROXY_POOL || 'socks5://127.0.0.1:9050').split(',').map((s) => s.trim()).filter(Boolean);

function privacyInitScript() {
  return `
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'connection', { get: () => ({ downlink: 10, effectiveType: '4g', rtt: 50 }) });
    Object.defineProperty(window, 'RTCPeerConnection', { value: undefined });
    const fakeVendor = 'Intel Inc.';
    const fakeRenderer = 'Intel Iris OpenGL';
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return fakeVendor;
      if (param === 37446) return fakeRenderer;
      return getParameter.call(this, param);
    };
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const ctx = this.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.globalAlpha = 0.99;
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
      }
      return toDataURL.apply(this, args);
    };
  `;
}

async function parseSnapshot(chromium, targetFile, proxy, userAgent) {
  const browser = await chromium.launch({
    headless: true,
    proxy: proxy ? { server: proxy } : undefined,
    args: ['--disable-webrtc', '--disable-features=WebRtcHideLocalIpsWithMdns'],
  });
  const context = await browser.newContext({ userAgent, javaScriptEnabled: true });
  await context.addInitScript(privacyInitScript());
  const page = await context.newPage();
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
  await context.close();
  await browser.close();
  return nodes;
}

async function run() {
  let chromium;
  try {
    const mod = await import('playwright');
    chromium = mod.chromium;
  } catch {
    console.error('playwright not installed; falling back to local raw snapshot parsing only.');
  }

  const found = [];
  const targetFile = path.join(process.cwd(), 'data', 'threats', 'raw', 'seeker-source.html');
  if (chromium && fs.existsSync(targetFile)) {
    for (let i = 0; i < PROXY_POOL.length; i += 1) {
      const proxy = PROXY_POOL[i] || undefined;
      const userAgent = UA_POOL[i % UA_POOL.length];
      const nodes = await parseSnapshot(chromium, targetFile, proxy, userAgent);
      found.push(...nodes.map((n) => ({ ...n, metadata: { ...(n.metadata || {}), proxy, userAgent } })));
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: Date.now(), proxies: PROXY_POOL.length, nodes: found }, null, 2));
  console.log(`Wrote ${found.length} seeker nodes -> ${OUT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

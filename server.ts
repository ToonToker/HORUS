import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import * as satellite from "satellite.js";

type Entity = Record<string, any>;

type CameraSource = {
  name: string;
  url: string;
  baseLat: number;
  baseLon: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("worldview.db");

const CAMERA_SOURCES: CameraSource[] = [
  { name: "NYCDOT", url: "https://webcams.nyctmc.org/", baseLat: 40.7128, baseLon: -74.006 },
  { name: "Caltrans", url: "https://cwwp2.dot.ca.gov/vm/iframemap.htm", baseLat: 34.0522, baseLon: -118.2437 },
];

const INGESTION_INTERVALS_MS = {
  aircraft: 15000,
  military: 20000,
  earthquakes: 60000,
  satellites: 3600000,
  cctv: 60000,
  fires: 60000,
  weatherAlerts: 60000,
};

const state = {
  aircraft: [] as Entity[],
  militaryFlights: [] as Entity[],
  earthquakes: [] as Entity[],
  satellites: [] as Entity[],
  wildfire: [] as Entity[],
  weatherAlerts: [] as Entity[],
  cctv: [] as Entity[],
  satrecs: [] as { name: string; satrec: satellite.SatRec; tle1: string; tle2: string }[],
  tleCount: 0,
  lastRun: {} as Record<string, number>,
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let curr = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(curr);
      curr = "";
    } else {
      curr += c;
    }
  }
  out.push(curr);
  return out.map((v) => v.trim());
}

function extractMediaUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const absoluteRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|m3u8)(?:\?[^\s"'<>]*)?)/gi;
  for (const m of html.matchAll(absoluteRegex)) urls.add(m[1]);

  const relativeRegex = /(?:src|href)=["']([^"']+\.(?:jpg|jpeg|png|m3u8)(?:\?[^"']*)?)["']/gi;
  for (const m of html.matchAll(relativeRegex)) {
    try {
      urls.add(new URL(m[1], baseUrl).toString());
    } catch {
      // ignore malformed url
    }
  }

  return [...urls];
}

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "WORLDVIEW-Ingestion-Worker/1.0" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "WORLDVIEW-Ingestion-Worker/1.0" },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function ingestAircraftOpenSky() {
  const data = await fetchJson("https://opensky-network.org/api/states/all");
  if (!data?.states?.length) return;

  state.aircraft = data.states
    .map((s: any[]) => ({
      id: s[0],
      type: "aircraft",
      source: "OpenSky",
      callsign: s[1]?.trim() || "UNKNOWN",
      lon: s[5],
      lat: s[6],
      alt: s[7] || s[13] || 0,
      speed: s[9] || 0,
      heading: s[10] || 0,
      ts: Date.now(),
    }))
    .filter((a: Entity) => Number.isFinite(a.lat) && Number.isFinite(a.lon));

  state.lastRun.aircraft = Date.now();
}

async function ingestMilitaryFlights() {
  const candidates = [
    "https://api.airplanes.live/v2/mil",
    "https://api.adsb.lol/v2/mil",
  ];

  for (const endpoint of candidates) {
    const data = await fetchJson(endpoint);
    const list = data?.ac || data?.aircraft || data?.states;
    if (!Array.isArray(list) || list.length === 0) continue;

    state.militaryFlights = list
      .map((f: any, i: number) => ({
        id: f.hex || f.icao || f.id || `mil-${i}`,
        type: "militaryFlight",
        source: endpoint.includes("airplanes.live") ? "TheAirTraffic" : "ADSB-Exchange Community",
        callsign: (f.flight || f.callsign || f.call || "MIL").toString().trim(),
        lat: Number(f.lat ?? f.latitude),
        lon: Number(f.lon ?? f.longitude),
        alt: Number(f.alt_baro ?? f.alt_geom ?? f.altitude ?? 0),
        speed: Number(f.gs ?? f.speed ?? 0),
        heading: Number(f.track ?? f.heading ?? 0),
        ts: Date.now(),
      }))
      .filter((f: Entity) => Number.isFinite(f.lat) && Number.isFinite(f.lon));

    state.lastRun.military = Date.now();
    return;
  }
}

async function ingestEarthquakes() {
  const data = await fetchJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson");
  if (!data?.features) return;

  state.earthquakes = data.features.map((f: any) => ({
    id: f.id,
    type: "earthquake",
    source: "USGS",
    title: f.properties?.title,
    mag: f.properties?.mag,
    lon: f.geometry?.coordinates?.[0],
    lat: f.geometry?.coordinates?.[1],
    depth: f.geometry?.coordinates?.[2],
    ts: f.properties?.time || Date.now(),
  })).filter((q: Entity) => Number.isFinite(q.lat) && Number.isFinite(q.lon));

  state.lastRun.earthquakes = Date.now();
}

async function ingestSatellites() {
  const text = await fetchText("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle");
  if (!text) return;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const satrecs: typeof state.satrecs = [];

  for (let i = 0; i < lines.length - 2; i += 3) {
    const [name, tle1, tle2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (!tle1?.startsWith("1 ") || !tle2?.startsWith("2 ")) continue;
    try {
      satrecs.push({ name, satrec: satellite.twoline2satrec(tle1, tle2), tle1, tle2 });
    } catch {
      // ignore parse errors
    }
  }

  state.satrecs = satrecs.slice(0, 750);
  state.tleCount = state.satrecs.length;
  state.lastRun.satellites = Date.now();
}

async function ingestCctvFeeds() {
  const cameras: Entity[] = [];
  for (const src of CAMERA_SOURCES) {
    const html = await fetchText(src.url);
    if (!html) continue;
    const urls = extractMediaUrls(html, src.url).slice(0, 24);
    urls.forEach((streamUrl, idx) => {
      cameras.push({
        id: `${src.name.toLowerCase()}-${idx}`,
        type: "cctvMesh",
        source: src.name,
        streamUrl,
        status: "Live",
        cameraModel: "DOT Public Feed",
        lat: src.baseLat + ((idx % 6) - 3) * 0.015,
        lon: src.baseLon + (Math.floor(idx / 6) - 2) * 0.015,
        ts: Date.now(),
      });
    });
  }

  if (cameras.length > 0) {
    state.cctv = cameras;
    state.lastRun.cctv = Date.now();
  }
}

async function ingestWildfires() {
  const csv = await fetchText("https://firms.modaps.eosdis.nasa.gov/data/active_fire/c6.1/csv/MODIS_C6_1_Global_24h.csv");
  if (!csv) return;
  const lines = csv.split("\n").filter(Boolean);
  if (lines.length < 2) return;

  const header = parseCsvLine(lines[0]);
  const idxLat = header.findIndex((h) => h.toLowerCase() === "latitude");
  const idxLon = header.findIndex((h) => h.toLowerCase() === "longitude");
  const idxBright = header.findIndex((h) => h.toLowerCase().startsWith("brightness"));
  const idxDate = header.findIndex((h) => h.toLowerCase() === "acq_date");

  const out: Entity[] = [];
  for (let i = 1; i < Math.min(lines.length, 1500); i += 1) {
    const cols = parseCsvLine(lines[i]);
    const lat = Number(cols[idxLat]);
    const lon = Number(cols[idxLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: `firms-${i}`,
      type: "wildfire",
      source: "NASA FIRMS",
      lat,
      lon,
      brightness: Number(cols[idxBright] || 0),
      ts: Date.parse(cols[idxDate] || "") || Date.now(),
    });
  }

  state.wildfire = out;
  state.lastRun.fires = Date.now();
}

function getCentroidFromGeometry(geometry: any): { lat: number; lon: number } | null {
  if (!geometry) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    return { lon: geometry.coordinates[0], lat: geometry.coordinates[1] };
  }

  const poly = geometry.coordinates?.[0];
  if (!Array.isArray(poly) || poly.length === 0) return null;
  let latSum = 0;
  let lonSum = 0;
  for (const c of poly) {
    lonSum += Number(c[0] || 0);
    latSum += Number(c[1] || 0);
  }
  return { lat: latSum / poly.length, lon: lonSum / poly.length };
}

async function ingestWeatherAlerts() {
  const data = await fetchJson("https://api.weather.gov/alerts/active?status=actual&message_type=alert");
  if (!data?.features) return;

  state.weatherAlerts = data.features
    .map((f: any, idx: number) => {
      const centroid = getCentroidFromGeometry(f.geometry);
      if (!centroid) return null;
      return {
        id: f.id || `noaa-${idx}`,
        type: "weatherRadar",
        source: "NOAA",
        event: f.properties?.event,
        severity: f.properties?.severity,
        headline: f.properties?.headline,
        lat: centroid.lat,
        lon: centroid.lon,
        ts: Date.parse(f.properties?.sent || "") || Date.now(),
      };
    })
    .filter(Boolean) as Entity[];

  state.lastRun.weatherAlerts = Date.now();
}

function propagateSatellites() {
  const now = new Date();
  state.satellites = state.satrecs
    .map((s) => {
      try {
        const pv = satellite.propagate(s.satrec, now);
        if (!pv.position || typeof pv.position === "boolean") return null;
        const gmst = satellite.gstime(now);
        const geo = satellite.eciToGeodetic(pv.position, gmst);
        return {
          id: s.name,
          type: "satellite",
          source: "CelesTrak",
          name: s.name,
          lon: satellite.degreesLong(geo.longitude),
          lat: satellite.degreesLat(geo.latitude),
          alt: geo.height * 1000,
          tle1: s.tle1,
          tle2: s.tle2,
          ts: now.getTime(),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Entity[];
}

async function runIngestionBoot() {
  await Promise.allSettled([
    ingestAircraftOpenSky(),
    ingestMilitaryFlights(),
    ingestEarthquakes(),
    ingestSatellites(),
    ingestCctvFeeds(),
    ingestWildfires(),
    ingestWeatherAlerts(),
  ]);
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function startServer() {
  initDb();

  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/cases", (_req, res) => res.json(db.prepare("SELECT * FROM cases ORDER BY created_at DESC").all()));
  app.post("/api/cases", (req, res) => {
    const { id, title, description } = req.body;
    db.prepare("INSERT INTO cases (id, title, description) VALUES (?, ?, ?)").run(id, title, description);
    res.json({ success: true });
  });
  app.get("/api/alerts", (_req, res) => res.json(db.prepare("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50").all()));

  app.get("/api/ingestion/status", (_req, res) => {
    res.json({
      counts: {
        aircraft: state.aircraft.length,
        militaryFlights: state.militaryFlights.length,
        satellites: state.satellites.length,
        earthquakes: state.earthquakes.length,
        weatherAlerts: state.weatherAlerts.length,
        wildfire: state.wildfire.length,
        cctv: state.cctv.length,
        tleCount: state.tleCount,
      },
      lastRun: state.lastRun,
      intervalsMs: INGESTION_INTERVALS_MS,
    });
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.emit("data:aircraft", state.aircraft);
    socket.emit("data:militaryFlights", state.militaryFlights);
    socket.emit("data:satellites", state.satellites);
    socket.emit("data:earthquakes", state.earthquakes);
    socket.emit("data:wildfires", state.wildfire);
    socket.emit("data:weatherAlerts", state.weatherAlerts);
    socket.emit("data:cctvMesh", state.cctv);
    socket.emit("data:satelliteTLE", state.satrecs.map((s) => ({ name: s.name, tle1: s.tle1, tle2: s.tle2 })));

    socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
  });

  await runIngestionBoot();
  propagateSatellites();

  setInterval(ingestAircraftOpenSky, INGESTION_INTERVALS_MS.aircraft);
  setInterval(ingestMilitaryFlights, INGESTION_INTERVALS_MS.military);
  setInterval(ingestEarthquakes, INGESTION_INTERVALS_MS.earthquakes);
  setInterval(ingestSatellites, INGESTION_INTERVALS_MS.satellites);
  setInterval(ingestCctvFeeds, INGESTION_INTERVALS_MS.cctv);
  setInterval(ingestWildfires, INGESTION_INTERVALS_MS.fires);
  setInterval(ingestWeatherAlerts, INGESTION_INTERVALS_MS.weatherAlerts);

  setInterval(() => {
    propagateSatellites();
    io.emit("data:aircraft", state.aircraft);
    io.emit("data:militaryFlights", state.militaryFlights);
    io.emit("data:satellites", state.satellites);
    io.emit("data:earthquakes", state.earthquakes);
    io.emit("data:wildfires", state.wildfire);
    io.emit("data:weatherAlerts", state.weatherAlerts);
    io.emit("data:cctvMesh", state.cctv);
    io.emit("data:satelliteTLE", state.satrecs.map((s) => ({ name: s.name, tle1: s.tle1, tle2: s.tle2 })));
  }, 2000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

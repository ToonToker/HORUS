import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

type Entity = Record<string, any>;

type WitnessAnnotation = {
  id: string;
  lat: number;
  lon: number;
  noteMarkdown: string;
  status: "ACTIVE" | "COMPROMISED" | "NEUTRAL";
  akhStatus: number;
  metadata: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("horus.db");
const DATA_ROOT = path.join(__dirname, "data");
const DATA_DIRS = {
  boundaries: path.join(DATA_ROOT, "boundaries"),
  conflicts: path.join(DATA_ROOT, "conflicts"),
  threats: path.join(DATA_ROOT, "threats"),
};

const state = {
  borders: [] as Entity[],
  conflictZones: [] as Entity[],
  threatArcs: [] as Entity[],
  breaches: [] as Entity[],
  seismicFaults: [] as Entity[],
  powerGrid: [] as Entity[],
  groundStations: [] as Entity[],
  subseaCables: [] as Entity[],
  annotations: [] as Entity[],
  rfNodes: [] as Entity[],
  vessels: [] as Entity[],
  cyberThreats: [] as Entity[],
  wardriving: [] as Entity[],
  resonanceLinks: [] as Entity[],
  ghostMarkers: [] as Entity[],
  investigations: [] as Entity[],
  lastScan: 0,
};

function assertLocalPath(p: string) {
  if (/^https?:\/\//i.test(p)) {
    throw new Error(`Outbound network access blocked by ZERO-API-MANDATE: ${p}`);
  }
}

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  assertLocalPath(u);
  throw new Error("Only local fetch calls are allowed.");
}) as typeof fetch;

function ensureDataDirs() {
  Object.values(DATA_DIRS).forEach((d) => fs.mkdirSync(d, { recursive: true }));
}

function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS witness_annotations (
      id TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      note_markdown TEXT NOT NULL,
      status TEXT NOT NULL,
      akh_status INTEGER NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sovereign_cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      isolated_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS investigation_results (
      id TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      source TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function readJsonFile(filePath: string): any | null {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}
function readCsv(filePath: string): string[][] {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(",").map((v) => v.trim()));
}

function geoFeatures(filePath: string, type: string) {
  const doc = readJsonFile(filePath);
  return Array.isArray(doc?.features) ? doc.features.map((f: any, i: number) => ({ id: `${type}-${i}`, type, geometry: f.geometry, properties: f.properties ?? {} })) : [];
}

function loadBoundaries() {
  const files = fs.readdirSync(DATA_DIRS.boundaries).filter((f) => f.endsWith(".geojson") || f.endsWith(".json"));
  state.borders = files.flatMap((f) => {
    const geo = readJsonFile(path.join(DATA_DIRS.boundaries, f));
    return Array.isArray(geo?.features) ? geo.features.map((feat: any, idx: number) => ({ id: `${f}-${idx}`, type: "boundary", level: feat.properties?.level ?? 0, name: feat.properties?.name ?? f, geometry: feat.geometry, properties: feat.properties ?? {} })) : [];
  });
}

function loadConflicts() {
  const rows = readCsv(path.join(DATA_DIRS.conflicts, "acled.csv"));
  state.conflictZones = rows.length > 1
    ? rows.slice(1).map((r, i) => ({ id: `acled-${i}`, type: "conflict", lat: Number(r[0]), lon: Number(r[1]), intensity: Number(r[2] ?? 1), ts: Date.now() - i * 3600_000 })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon))
    : [];
}

function loadThreats() {
  const threats = readJsonFile(path.join(DATA_DIRS.threats, "threat_arcs.json"));
  const breaches = readCsv(path.join(DATA_DIRS.threats, "breaches.csv"));
  state.threatArcs = Array.isArray(threats?.arcs) ? threats.arcs : [];
  state.breaches = breaches.length > 1 ? breaches.slice(1).map((r, i) => ({ id: `breach-${i}`, type: "breach", lat: Number(r[2]), lon: Number(r[3]), email: r[0], ip: r[1] })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon)) : [];
  state.seismicFaults = geoFeatures(path.join(DATA_DIRS.threats, "seismic_faults.geojson"), "seismicFault");
  state.powerGrid = geoFeatures(path.join(DATA_DIRS.threats, "power_grid.geojson"), "powerGrid");
  state.groundStations = geoFeatures(path.join(DATA_DIRS.threats, "satellite_ground_stations.geojson"), "groundStation");
  state.subseaCables = geoFeatures(path.join(DATA_DIRS.threats, "subsea_cables.geojson"), "subseaCable");
}

function loadSigintSuite() {
  const radio = readCsv(path.join(DATA_DIRS.threats, "radio_stations.csv"));
  const vessels = readCsv(path.join(DATA_DIRS.threats, "ais_vessels.csv"));
  const wigle = readCsv(path.join(DATA_DIRS.threats, "wigle_cells.csv"));
  const cyber = readJsonFile(path.join(DATA_DIRS.threats, "cyber_attacks.json"));
  const shodanRows = readCsv(path.join(DATA_DIRS.threats, "shodan_scrape.csv"));
  const nameGrid = readCsv(path.join(DATA_DIRS.threats, "name_address_grid.csv"));

  state.rfNodes = radio.length > 1 ? radio.slice(1).map((r, i) => ({ id: `rf-${i}`, name: r[0], country: r[1], streamUrl: r[2], lat: Number(r[3]), lon: Number(r[4]), ts: Date.now() - i * 120_000 })) : [];
  state.vessels = vessels.length > 1 ? vessels.slice(1).map((r, i) => ({ id: `vessel-${i}`, callsign: r[0], cargo: r[1], lat: Number(r[2]), lon: Number(r[3]), heading: Number(r[4]), speed: Number(r[5]), ts: Date.now() - i * 60_000 })) : [];
  state.wardriving = wigle.length > 1 ? wigle.slice(1).map((r, i) => ({ id: `wigle-${i}`, lat: Number(r[0]), lon: Number(r[1]), density: Number(r[2]), ts: Date.now() - i * 300_000 })) : [];
  state.cyberThreats = Array.isArray(cyber?.events) ? cyber.events : [];
  state.ghostMarkers = nameGrid.length > 1 ? nameGrid.slice(1).map((r, i) => ({ id: `ghost-${i}`, name: r[0], address: r[1], lat: Number(r[2]), lon: Number(r[3]) })) : [];

  const shodan = shodanRows.length > 1 ? shodanRows.slice(1).map((r, i) => ({ id: `shodan-${i}`, ip: r[0], port: Number(r[1]), service: r[2], lat: Number(r[3]), lon: Number(r[4]) })) : [];
  state.resonanceLinks = shodan.flatMap((s) => {
    const b = state.breaches.find((x) => x.ip === s.ip);
    if (!b) return [];
    return [{ id: `res-${s.id}`, from: { lat: b.lat, lon: b.lon }, to: { lat: s.lat, lon: s.lon }, ip: s.ip, port: s.port, service: s.service }];
  });
}

function loadAnnotations() {
  state.annotations = db.prepare("SELECT id, lat, lon, note_markdown as noteMarkdown, status, akh_status as akhStatus, metadata, created_at as createdAt, updated_at as updatedAt FROM witness_annotations ORDER BY updated_at DESC").all() as Entity[];
}

function scanLocalData() {
  loadBoundaries();
  loadConflicts();
  loadThreats();
  loadSigintSuite();
  loadAnnotations();
  state.lastScan = Date.now();
}

function investigateCoordinate(lat: number, lon: number) {
  const rows = readCsv(path.join(DATA_DIRS.threats, "deep_location_people.csv"));
  const candidates = rows.length > 1 ? rows.slice(1).map((r) => ({ owner: r[0], associate: r[1], phone: r[2], propertyValue: r[3], lat: Number(r[4]), lon: Number(r[5]) })) : [];
  const nearby = candidates.filter((c) => Math.abs(c.lat - lat) < 1.2 && Math.abs(c.lon - lon) < 1.2);
  const id = `inv-${Date.now()}`;
  db.prepare("INSERT INTO investigation_results (id, lat, lon, source, payload) VALUES (?, ?, ?, ?, ?)").run(id, lat, lon, "local-deep-location", JSON.stringify(nearby));
  state.investigations = [{ id, lat, lon, records: nearby }, ...state.investigations].slice(0, 50);
  return { owners: nearby.length, associates: new Set(nearby.map((n) => n.associate)).size, resonancePoints: nearby.length };
}

async function startServer() {
  ensureDataDirs();
  initDb();
  scanLocalData();

  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json());
  app.use("/data", express.static(DATA_ROOT));

  app.get("/api/health", (_req, res) => res.json({ status: "field-of-reeds-ready", offline: true }));
  app.get("/api/sovereign/status", (_req, res) => res.json({
    dataDirs: DATA_DIRS,
    counts: {
      borders: state.borders.length,
      conflictZones: state.conflictZones.length,
      rfNodes: state.rfNodes.length,
      vessels: state.vessels.length,
      cyberThreats: state.cyberThreats.length,
      wardriving: state.wardriving.length,
      resonanceLinks: state.resonanceLinks.length,
      ghostMarkers: state.ghostMarkers.length,
      annotations: state.annotations.length,
    },
    lastScan: state.lastScan,
    outboundNetworkBlocked: true,
  }));

  app.get("/api/witness/annotations", (_req, res) => res.json(state.annotations));
  app.post("/api/witness/annotations", (req, res) => {
    const payload = req.body as Partial<WitnessAnnotation>;
    const id = payload.id ?? `note-${Date.now()}`;
    db.prepare(`INSERT INTO witness_annotations (id, lat, lon, note_markdown, status, akh_status, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET lat=excluded.lat, lon=excluded.lon, note_markdown=excluded.note_markdown, status=excluded.status, akh_status=excluded.akh_status, metadata=excluded.metadata, updated_at=CURRENT_TIMESTAMP`).run(
      id, Number(payload.lat ?? 0), Number(payload.lon ?? 0), payload.noteMarkdown ?? "", payload.status ?? "NEUTRAL", Math.max(1, Math.min(5, Number(payload.akhStatus ?? 3))), JSON.stringify(payload.metadata ?? {}),
    );
    loadAnnotations();
    io.emit("data:witnessAnnotations", state.annotations);
    res.json({ success: true, id });
  });

  app.post("/api/sigint/investigate", (req, res) => {
    const { lat, lon } = req.body;
    const summary = investigateCoordinate(Number(lat), Number(lon));
    io.emit("data:ghostMarkers", state.ghostMarkers);
    res.json(summary);
  });

  io.on("connection", (socket) => {
    [
      ["data:borders", state.borders], ["data:conflictZones", state.conflictZones], ["data:threatArcs", state.threatArcs], ["data:breaches", state.breaches],
      ["data:seismicFaults", state.seismicFaults], ["data:powerGrid", state.powerGrid], ["data:groundStations", state.groundStations], ["data:subseaCables", state.subseaCables],
      ["data:witnessAnnotations", state.annotations], ["data:rfNodes", state.rfNodes], ["data:vessels", state.vessels], ["data:cyberThreats", state.cyberThreats], ["data:wardriving", state.wardriving], ["data:resonanceLinks", state.resonanceLinks], ["data:ghostMarkers", state.ghostMarkers],
    ].forEach(([event, payload]) => socket.emit(event as string, payload));
  });

  setInterval(() => {
    scanLocalData();
    io.emit("data:borders", state.borders);
    io.emit("data:conflictZones", state.conflictZones);
    io.emit("data:threatArcs", state.threatArcs);
    io.emit("data:breaches", state.breaches);
    io.emit("data:seismicFaults", state.seismicFaults);
    io.emit("data:powerGrid", state.powerGrid);
    io.emit("data:groundStations", state.groundStations);
    io.emit("data:subseaCables", state.subseaCables);
    io.emit("data:rfNodes", state.rfNodes);
    io.emit("data:vessels", state.vessels);
    io.emit("data:cyberThreats", state.cyberThreats);
    io.emit("data:wardriving", state.wardriving);
    io.emit("data:resonanceLinks", state.resonanceLinks);
    io.emit("data:ghostMarkers", state.ghostMarkers);
  }, 30000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`HORUS server running on http://localhost:${PORT}`));
}

startServer();

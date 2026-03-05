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
  lastScan: 0,
};

function assertLocalPath(p: string) {
  if (/^https?:\/\//i.test(p)) {
    throw new Error(`Outbound network access blocked by ZERO-API-MANDATE: ${p}`);
  }
}

globalThis.fetch = (async (input: RequestInfo | URL, _init?: RequestInit) => {
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
  `);
}

function readJsonFile(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readCsv(filePath: string): string[][] {
  if (!fs.existsSync(filePath)) return [];
  const rows = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((v) => v.trim()));
  return rows;
}

function loadBoundaries() {
  const files = fs.readdirSync(DATA_DIRS.boundaries).filter((f) => f.endsWith(".geojson") || f.endsWith(".json"));
  state.borders = files.flatMap((f) => {
    const geo = readJsonFile(path.join(DATA_DIRS.boundaries, f));
    if (!geo) return [];
    if (Array.isArray(geo.features)) {
      return geo.features.map((feat: any, idx: number) => ({
        id: `${f}-${idx}`,
        type: "boundary",
        level: feat.properties?.level ?? 0,
        name: feat.properties?.name ?? f,
        geometry: feat.geometry,
        properties: feat.properties ?? {},
      }));
    }
    return [];
  });
}

function loadConflicts() {
  const jsonPath = path.join(DATA_DIRS.conflicts, "acled.json");
  const csvPath = path.join(DATA_DIRS.conflicts, "acled.csv");
  const geo = readJsonFile(jsonPath);
  if (geo?.events && Array.isArray(geo.events)) {
    state.conflictZones = geo.events;
    return;
  }
  const rows = readCsv(csvPath);
  if (rows.length < 2) return;
  const header = rows[0];
  const idxLat = header.indexOf("latitude");
  const idxLon = header.indexOf("longitude");
  const idxIntensity = header.indexOf("intensity");
  state.conflictZones = rows.slice(1).map((r, i) => ({
    id: `acled-${i}`,
    type: "conflict",
    lat: Number(r[idxLat]),
    lon: Number(r[idxLon]),
    intensity: Number(r[idxIntensity] ?? 1),
  })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}

function loadThreats() {
  const threats = readJsonFile(path.join(DATA_DIRS.threats, "threat_arcs.json"));
  const breaches = readCsv(path.join(DATA_DIRS.threats, "breaches.csv"));
  const seismic = readJsonFile(path.join(DATA_DIRS.threats, "seismic_faults.geojson"));
  const power = readJsonFile(path.join(DATA_DIRS.threats, "power_grid.geojson"));
  const ground = readJsonFile(path.join(DATA_DIRS.threats, "satellite_ground_stations.geojson"));
  const subsea = readJsonFile(path.join(DATA_DIRS.threats, "subsea_cables.geojson"));

  state.threatArcs = Array.isArray(threats?.arcs) ? threats.arcs : [];
  state.breaches = breaches.length > 1
    ? breaches.slice(1).map((r, i) => ({ id: `breach-${i}`, type: "breach", lat: Number(r[2]), lon: Number(r[3]), email: r[0], ip: r[1] })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon))
    : [];

  const geoToFeatures = (doc: any, type: string) => (Array.isArray(doc?.features) ? doc.features.map((f: any, i: number) => ({ id: `${type}-${i}`, type, geometry: f.geometry, properties: f.properties ?? {} })) : []);
  state.seismicFaults = geoToFeatures(seismic, "seismicFault");
  state.powerGrid = geoToFeatures(power, "powerGrid");
  state.groundStations = geoToFeatures(ground, "groundStation");
  state.subseaCables = geoToFeatures(subsea, "subseaCable");
}

function loadAnnotations() {
  state.annotations = db.prepare("SELECT id, lat, lon, note_markdown as noteMarkdown, status, akh_status as akhStatus, metadata, created_at as createdAt, updated_at as updatedAt FROM witness_annotations ORDER BY updated_at DESC").all() as Entity[];
}

function scanLocalData() {
  loadBoundaries();
  loadConflicts();
  loadThreats();
  loadAnnotations();
  state.lastScan = Date.now();
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
  app.use("/tiles", express.static(path.join(__dirname, "tiles")));
  app.use("/data", express.static(DATA_ROOT));

  app.get("/api/health", (_req, res) => res.json({ status: "field-of-reeds-ready", offline: true }));
  app.get("/api/sovereign/status", (_req, res) => {
    res.json({
      dataDirs: DATA_DIRS,
      counts: {
        borders: state.borders.length,
        conflictZones: state.conflictZones.length,
        threatArcs: state.threatArcs.length,
        breaches: state.breaches.length,
        annotations: state.annotations.length,
      },
      lastScan: state.lastScan,
      outboundNetworkBlocked: true,
    });
  });

  app.get("/api/witness/annotations", (_req, res) => res.json(state.annotations));
  app.post("/api/witness/annotations", (req, res) => {
    const payload = req.body as Partial<WitnessAnnotation>;
    const id = payload.id ?? `note-${Date.now()}`;
    db.prepare(`
      INSERT INTO witness_annotations (id, lat, lon, note_markdown, status, akh_status, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        lat=excluded.lat,
        lon=excluded.lon,
        note_markdown=excluded.note_markdown,
        status=excluded.status,
        akh_status=excluded.akh_status,
        metadata=excluded.metadata,
        updated_at=CURRENT_TIMESTAMP
    `).run(
      id,
      Number(payload.lat ?? 0),
      Number(payload.lon ?? 0),
      payload.noteMarkdown ?? "",
      payload.status ?? "NEUTRAL",
      Math.max(1, Math.min(5, Number(payload.akhStatus ?? 3))),
      JSON.stringify(payload.metadata ?? {}),
    );
    loadAnnotations();
    io.emit("data:witnessAnnotations", state.annotations);
    res.json({ success: true, id });
  });

  io.on("connection", (socket) => {
    socket.emit("data:borders", state.borders);
    socket.emit("data:conflictZones", state.conflictZones);
    socket.emit("data:threatArcs", state.threatArcs);
    socket.emit("data:breaches", state.breaches);
    socket.emit("data:seismicFaults", state.seismicFaults);
    socket.emit("data:powerGrid", state.powerGrid);
    socket.emit("data:groundStations", state.groundStations);
    socket.emit("data:subseaCables", state.subseaCables);
    socket.emit("data:witnessAnnotations", state.annotations);
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
  }, 30000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`HORUS server running on http://localhost:${PORT}`);
  });
}

startServer();

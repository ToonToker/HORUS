import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import net from "net";
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

type ValidationDecision = { valid: boolean; reason: string; latencyNs: number };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("horus.db");
const DATA_ROOT = path.join(__dirname, "data");
const CASE_ROOT = path.join(__dirname, "cases");
const DATA_DIRS = {
  boundaries: path.join(DATA_ROOT, "boundaries"),
  conflicts: path.join(DATA_ROOT, "conflicts"),
  threats: path.join(DATA_ROOT, "threats"),
  mcp: path.join(DATA_ROOT, "mcp"),
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
  seekerNodes: [] as Entity[],
  mcpNodes: [] as Entity[],
  liquidityHeatmap: [] as Entity[],
  seismicWindows: [] as Entity[],
  investigations: [] as Entity[],
  highEntropyNodes: [] as Entity[],
  activeCaseId: "default-case",
  lastScan: 0,
  audit: {
    accepted: 0,
    vetoed: 0,
    lastReason: "",
  },
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
  fs.mkdirSync(CASE_ROOT, { recursive: true });
}

function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS witness_annotations (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL DEFAULT 'default-case',
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
      case_id TEXT NOT NULL DEFAULT 'default-case',
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      source TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS seeker_nodes (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      confidence REAL NOT NULL,
      payload TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS runtime_settings (
      id TEXT PRIMARY KEY,
      scrape_frequency_sec INTEGER NOT NULL DEFAULT 30,
      tor_enabled INTEGER NOT NULL DEFAULT 0,
      radio_source TEXT NOT NULL DEFAULT 'archive://radio/raw',
      ais_source TEXT NOT NULL DEFAULT 'archive://ais/raw',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS high_entropy_nodes (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      source TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS intel_resource_nodes (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      node_family TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      intensity REAL NOT NULL DEFAULT 1,
      confidence REAL NOT NULL DEFAULT 0.5,
      payload TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO runtime_settings (id) VALUES ('global');
  `);

  db.prepare(`INSERT OR IGNORE INTO sovereign_cases (id, title, isolated_path) VALUES (?, ?, ?)`).run(
    state.activeCaseId,
    "Default Investigation",
    path.join(CASE_ROOT, state.activeCaseId),
  );
  fs.mkdirSync(path.join(CASE_ROOT, state.activeCaseId), { recursive: true });
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
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(",").map((v) => v.trim()));
}

function geoFeatures(filePath: string, type: string) {
  const doc = readJsonFile(filePath);
  return Array.isArray(doc?.features)
    ? doc.features.map((f: any, i: number) => ({
      id: `${type}-${i}`,
      type,
      geometry: f.geometry,
      properties: f.properties ?? {},
    }))
    : [];
}

function maatValidationPipe(node: Entity): ValidationDecision {
  const start = process.hrtime.bigint();
  const confidence = Number(node.confidence ?? 1);
  const verified = node.verified !== false;
  const noisy = node.noisy === true;
  const valid = confidence >= 0.58 && verified && !noisy;
  const reason = valid ? "MAAT_OK" : "ISFET_VETO";
  const latencyNs = Number(process.hrtime.bigint() - start);
  return { valid, reason, latencyNs };
}

class SentinelGatekeeper {
  audit(packet: Entity): ValidationDecision & { entropy: "LOW" | "HIGH"; flags: string[] } {
    const base = maatValidationPipe(packet);
    const flags: string[] = [];
    const headers = (packet.headers ?? packet.metadata?.headers ?? {}) as Record<string, any>;

    const trackingHeader = Object.keys(headers).find((k) => /pixel|tracker|beacon/i.test(k));
    if (trackingHeader) flags.push(`TRACKING_HEADER:${trackingHeader}`);

    const ua = String(headers["user-agent"] ?? headers["User-Agent"] ?? packet.metadata?.userAgent ?? "");
    if (ua && /HeadlessChrome|PhantomJS|Crawler/i.test(ua) && packet.metadata?.allowHeadless !== true) {
      flags.push("SUSPECT_UA");
    }

    if (packet.metadata?.trackingPixel === true || packet.metadata?.poisoned === true) {
      flags.push("POISONED_METADATA");
    }

    const entropy = flags.length > 0 || !base.valid ? "HIGH" : "LOW";
    const valid = base.valid && entropy === "LOW";
    return { valid, reason: valid ? "MAAT_OK" : "ISFET_VETO", latencyNs: base.latencyNs, entropy, flags };
  }
}

const gatekeeper = new SentinelGatekeeper();

function persistIntelResourceNode(nodeFamily: string, node: Entity) {
  if (!Number.isFinite(node.lat) || !Number.isFinite(node.lon)) return;
  db.prepare(`
    INSERT OR REPLACE INTO intel_resource_nodes (id, case_id, node_family, lat, lon, intensity, confidence, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    node.id,
    state.activeCaseId,
    nodeFamily,
    Number(node.lat),
    Number(node.lon),
    Number(node.intensity ?? node.speed ?? node.density ?? 1),
    Number(node.confidence ?? 0.6),
    JSON.stringify(node),
  );
}


function applyMaatFilter(nodes: Entity[]): Entity[] {
  const out: Entity[] = [];
  for (const node of nodes) {
    const decision = gatekeeper.audit(node);
    if (decision.valid) {
      state.audit.accepted += 1;
      out.push({ ...node, validation: decision });
    } else {
      state.audit.vetoed += 1;
      state.audit.lastReason = decision.reason;
    }
  }
  return out;
}

function loadBoundaries() {
  const files = fs.readdirSync(DATA_DIRS.boundaries).filter((f) => f.endsWith(".geojson") || f.endsWith(".json"));
  state.borders = files.flatMap((f) => {
    const geo = readJsonFile(path.join(DATA_DIRS.boundaries, f));
    return Array.isArray(geo?.features)
      ? geo.features.map((feat: any, idx: number) => ({
        id: `${f}-${idx}`,
        type: "boundary",
        level: feat.properties?.level ?? 0,
        name: feat.properties?.name ?? f,
        geometry: feat.geometry,
        properties: feat.properties ?? {},
      }))
      : [];
  });
}

function loadConflicts() {
  const rows = readCsv(path.join(DATA_DIRS.conflicts, "acled.csv"));
  const raw = rows.length > 1
    ? rows.slice(1).map((r, i) => ({
      id: `acled-${i}`,
      type: "conflict",
      lat: Number(r[0]),
      lon: Number(r[1]),
      intensity: Number(r[2] ?? 1),
      confidence: 0.9,
      verified: true,
      ts: Date.now() - i * 3600_000,
    })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon))
    : [];
  state.conflictZones = applyMaatFilter(raw);

  state.seismicWindows = state.conflictZones.map((c) => ({
    id: `seismic-${c.id}`,
    lat: c.lat,
    lon: c.lon,
    intensity: c.intensity,
    ts: c.ts,
  }));
}

function loadThreats() {
  const threats = readJsonFile(path.join(DATA_DIRS.threats, "threat_arcs.json"));
  const breaches = readCsv(path.join(DATA_DIRS.threats, "breaches.csv"));

  state.threatArcs = Array.isArray(threats?.arcs) ? threats.arcs : [];
  state.breaches = breaches.length > 1
    ? breaches.slice(1).map((r, i) => ({ id: `breach-${i}`, type: "breach", lat: Number(r[2]), lon: Number(r[3]), email: r[0], ip: r[1], confidence: 0.85, verified: true })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon))
    : [];
  state.breaches = applyMaatFilter(state.breaches);

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

  state.rfNodes = applyMaatFilter(radio.length > 1 ? radio.slice(1).map((r, i) => ({ id: `rf-${i}`, name: r[0], country: r[1], streamUrl: r[2], lat: Number(r[3]), lon: Number(r[4]), confidence: 0.75, verified: true, ts: Date.now() - i * 120_000 })) : []);
  state.rfNodes.forEach((n) => persistIntelResourceNode("rf", n));
  state.vessels = applyMaatFilter(vessels.length > 1 ? vessels.slice(1).map((r, i) => ({ id: `vessel-${i}`, callsign: r[0], cargo: r[1], lat: Number(r[2]), lon: Number(r[3]), heading: Number(r[4]), speed: Number(r[5]), confidence: 0.8, verified: true, ts: Date.now() - i * 60_000 })) : []);
  state.vessels.forEach((n) => persistIntelResourceNode("maritime", n));
  state.wardriving = applyMaatFilter(wigle.length > 1 ? wigle.slice(1).map((r, i) => ({ id: `wigle-${i}`, lat: Number(r[0]), lon: Number(r[1]), density: Number(r[2]), confidence: 0.65, verified: true, ts: Date.now() - i * 300_000 })) : []);
  state.cyberThreats = applyMaatFilter(Array.isArray(cyber?.events) ? cyber.events.map((e: any) => ({ ...e, confidence: Number(e.confidence ?? 0.8), verified: true })) : []);
  state.cyberThreats.forEach((n) => persistIntelResourceNode("cyber", n));
  state.ghostMarkers = applyMaatFilter(nameGrid.length > 1 ? nameGrid.slice(1).map((r, i) => ({ id: `ghost-${i}`, name: r[0], address: r[1], lat: Number(r[2]), lon: Number(r[3]), confidence: 0.6, verified: true })) : []);

  const shodan = shodanRows.length > 1 ? shodanRows.slice(1).map((r, i) => ({ id: `shodan-${i}`, ip: r[0], port: Number(r[1]), service: r[2], lat: Number(r[3]), lon: Number(r[4]) })) : [];
  state.resonanceLinks = shodan.flatMap((s) => {
    const b = state.breaches.find((x) => x.ip === s.ip);
    if (!b) return [];
    return [{ id: `res-${s.id}`, from: { lat: b.lat, lon: b.lon }, to: { lat: s.lat, lon: s.lon }, ip: s.ip, port: s.port, service: s.service }];
  });

  state.liquidityHeatmap = [...state.cyberThreats, ...state.vessels].slice(0, 200).map((n, i) => ({
    id: `liq-${i}`,
    lat: Number(n.lat),
    lon: Number(n.lon),
    intensity: Number(n.intensity ?? n.speed ?? 1),
    ts: n.ts,
  })).filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lon));
}

function loadMcpBridge() {
  const lob = readJsonFile(path.join(DATA_DIRS.mcp, "lob_context.json"));
  const osint = readJsonFile(path.join(DATA_DIRS.mcp, "osint_context.json"));

  const lobNodes = Array.isArray(lob?.nodes) ? lob.nodes : [];
  const osintNodes = Array.isArray(osint?.nodes) ? osint.nodes : [];
  state.mcpNodes = applyMaatFilter([...lobNodes, ...osintNodes].map((n: any, i: number) => ({
    id: n.id ?? `mcp-${i}`,
    lat: Number(n.lat),
    lon: Number(n.lon),
    kind: n.kind ?? "mcp",
    confidence: Number(n.confidence ?? 0.7),
    verified: n.verified !== false,
    ts: Number(n.ts ?? Date.now()),
  })).filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lon)));
  state.mcpNodes.forEach((n) => persistIntelResourceNode("mcp", n));
}

function loadAnnotations() {
  state.annotations = db.prepare(`
    SELECT id, case_id as caseId, lat, lon, note_markdown as noteMarkdown, status,
           akh_status as akhStatus, metadata, created_at as createdAt, updated_at as updatedAt
    FROM witness_annotations
    WHERE case_id = ?
    ORDER BY updated_at DESC
  `).all(state.activeCaseId) as Entity[];
}

function loadSeekerNodes() {
  state.seekerNodes = db.prepare(`
    SELECT id, case_id as caseId, node_type as nodeType, lat, lon, confidence,
           payload, created_at as createdAt
    FROM seeker_nodes
    WHERE case_id = ?
    ORDER BY created_at DESC
    LIMIT 500
  `).all(state.activeCaseId).map((r: any) => ({ ...r, ...JSON.parse(r.payload || "{}") }));
}

function loadHighEntropyNodes() {
  state.highEntropyNodes = db.prepare(`
    SELECT id, case_id as caseId, source, reason, payload, created_at as createdAt
    FROM high_entropy_nodes
    WHERE case_id = ?
    ORDER BY created_at DESC
    LIMIT 500
  `).all(state.activeCaseId).map((r: any) => ({ ...r, ...JSON.parse(r.payload || "{}") }));
}

function scanLocalData() {
  state.audit.accepted = 0;
  state.audit.vetoed = 0;
  loadBoundaries();
  loadConflicts();
  loadThreats();
  loadSigintSuite();
  loadMcpBridge();
  loadAnnotations();
  loadSeekerNodes();
  loadHighEntropyNodes();
  state.lastScan = Date.now();
}

function mcpRpcHandle(method: string, params: any) {
  switch (method) {
    case "mcp.getContext":
      return { mcpNodes: state.mcpNodes, liquidityHeatmap: state.liquidityHeatmap, seismicWindows: state.seismicWindows };
    case "mcp.getCases":
      return db.prepare("SELECT id, title, isolated_path as isolatedPath, created_at as createdAt FROM sovereign_cases ORDER BY created_at DESC").all();
    case "mcp.getValidationAudit":
      return { audit: state.audit, highEntropyNodes: state.highEntropyNodes };
    case "mcp.getCase": {
      const id = String(params?.id || state.activeCaseId);
      return {
        id,
        annotations: db.prepare("SELECT * FROM witness_annotations WHERE case_id = ? ORDER BY updated_at DESC").all(id),
        seekerNodes: db.prepare("SELECT * FROM seeker_nodes WHERE case_id = ? ORDER BY created_at DESC").all(id),
      };
    }
    default:
      throw new Error(`Unknown MCP method: ${method}`);
  }
}

function startLocalMcpSocket() {
  const sockPath = "/tmp/horus-mcp.sock";
  try { fs.unlinkSync(sockPath); } catch {}
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const req = JSON.parse(line);
          const result = mcpRpcHandle(req.method, req.params);
          socket.write(`${JSON.stringify({ jsonrpc: "2.0", id: req.id ?? null, result })}\n`);
        } catch (error: any) {
          socket.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: error?.message || "MCP error" } })}\n`);
        }
      }
    });
  });
  server.listen(sockPath, () => console.log(`HORUS MCP local socket ready: ${sockPath}`));
}

function investigateCoordinate(lat: number, lon: number) {
  const rows = readCsv(path.join(DATA_DIRS.threats, "deep_location_people.csv"));
  const candidates = rows.length > 1
    ? rows.slice(1).map((r) => ({ owner: r[0], associate: r[1], phone: r[2], propertyValue: r[3], lat: Number(r[4]), lon: Number(r[5]) }))
    : [];
  const nearby = candidates.filter((c) => Math.abs(c.lat - lat) < 1.2 && Math.abs(c.lon - lon) < 1.2);
  const id = `inv-${Date.now()}`;
  db.prepare("INSERT INTO investigation_results (id, case_id, lat, lon, source, payload) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, state.activeCaseId, lat, lon, "local-deep-location", JSON.stringify(nearby));
  state.investigations = [{ id, lat, lon, caseId: state.activeCaseId, records: nearby }, ...state.investigations].slice(0, 50);
  return { owners: nearby.length, associates: new Set(nearby.map((n) => n.associate)).size, resonancePoints: nearby.length, caseId: state.activeCaseId };
}

function emitState(io: Server) {
  [
    ["data:borders", state.borders],
    ["data:conflictZones", state.conflictZones],
    ["data:threatArcs", state.threatArcs],
    ["data:breaches", state.breaches],
    ["data:seismicFaults", state.seismicFaults],
    ["data:powerGrid", state.powerGrid],
    ["data:groundStations", state.groundStations],
    ["data:subseaCables", state.subseaCables],
    ["data:witnessAnnotations", state.annotations],
    ["data:rfNodes", state.rfNodes],
    ["data:vessels", state.vessels],
    ["data:cyberThreats", state.cyberThreats],
    ["data:wardriving", state.wardriving],
    ["data:resonanceLinks", state.resonanceLinks],
    ["data:ghostMarkers", state.ghostMarkers],
    ["data:seekerNodes", state.seekerNodes],
    ["data:mcpNodes", state.mcpNodes],
    ["data:liquidityHeatmap", state.liquidityHeatmap],
    ["data:seismicWindows", state.seismicWindows],
  ].forEach(([event, payload]) => io.emit(event as string, payload));
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
  app.use("/maps", express.static(path.join(__dirname, "maps")));

  app.get("/api/health", (_req, res) => res.json({ status: "field-of-reeds-ready", offline: true }));

  app.get("/api/sovereign/status", (_req, res) => res.json({
    dataDirs: DATA_DIRS,
    activeCaseId: state.activeCaseId,
    counts: {
      borders: state.borders.length,
      conflictZones: state.conflictZones.length,
      rfNodes: state.rfNodes.length,
      vessels: state.vessels.length,
      cyberThreats: state.cyberThreats.length,
      wardriving: state.wardriving.length,
      resonanceLinks: state.resonanceLinks.length,
      ghostMarkers: state.ghostMarkers.length,
      seekerNodes: state.seekerNodes.length,
      mcpNodes: state.mcpNodes.length,
      liquidityHeatmap: state.liquidityHeatmap.length,
      seismicWindows: state.seismicWindows.length,
      annotations: state.annotations.length,
      highEntropyNodes: state.highEntropyNodes.length,
    },
    validationAudit: state.audit,
    lastScan: state.lastScan,
    outboundNetworkBlocked: true,
  }));

  app.get("/api/mcp/context", (_req, res) => res.json({ mcpNodes: state.mcpNodes, liquidityHeatmap: state.liquidityHeatmap }));

  app.post("/api/mcp/rpc", (req, res) => {
    try {
      const id = req.body?.id ?? null;
      const method = String(req.body?.method || "");
      const params = req.body?.params;
      const result = mcpRpcHandle(method, params);
      res.json({ jsonrpc: "2.0", id, result });
    } catch (error: any) {
      res.status(400).json({ jsonrpc: "2.0", id: req.body?.id ?? null, error: { code: -32000, message: error?.message || "MCP error" } });
    }
  });

  app.get("/api/cases", (_req, res) => {
    const rows = db.prepare("SELECT * FROM sovereign_cases ORDER BY created_at DESC").all();
    res.json({ activeCaseId: state.activeCaseId, cases: rows });
  });

  app.post("/api/cases", (req, res) => {
    const title = String(req.body?.title || "New Case").trim();
    const id = `case-${Date.now()}`;
    const isolatedPath = path.join(CASE_ROOT, id);
    fs.mkdirSync(isolatedPath, { recursive: true });
    db.prepare("INSERT INTO sovereign_cases (id, title, isolated_path) VALUES (?, ?, ?)").run(id, title, isolatedPath);
    state.activeCaseId = id;
    scanLocalData();
    emitState(io);
    res.json({ success: true, id, title, isolatedPath });
  });

  app.post("/api/cases/activate", (req, res) => {
    const id = String(req.body?.id || "");
    const found = db.prepare("SELECT id, isolated_path FROM sovereign_cases WHERE id = ?").get(id) as any;
    if (!found) {
      res.status(404).json({ success: false, message: "Case not found" });
      return;
    }
    state.activeCaseId = id;
    fs.mkdirSync(found.isolated_path, { recursive: true });
    scanLocalData();
    emitState(io);
    res.json({ success: true, activeCaseId: id });
  });

  app.get("/api/witness/annotations", (_req, res) => res.json(state.annotations));
  app.get("/api/validation/high-entropy", (_req, res) => res.json({ activeCaseId: state.activeCaseId, nodes: state.highEntropyNodes }));
  app.get("/api/intel/resource-nodes", (_req, res) => {
    const rows = db.prepare("SELECT * FROM intel_resource_nodes WHERE case_id = ? ORDER BY created_at DESC LIMIT 2000").all(state.activeCaseId);
    res.json({ activeCaseId: state.activeCaseId, nodes: rows });
  });
}

  app.post("/api/witness/annotations", (req, res) => {
    const payload = req.body as Partial<WitnessAnnotation>;
    const id = payload.id ?? `note-${Date.now()}`;
    db.prepare(`
      INSERT INTO witness_annotations (id, case_id, lat, lon, note_markdown, status, akh_status, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        case_id=excluded.case_id,
        lat=excluded.lat,
        lon=excluded.lon,
        note_markdown=excluded.note_markdown,
        status=excluded.status,
        akh_status=excluded.akh_status,
        metadata=excluded.metadata,
        updated_at=CURRENT_TIMESTAMP
    `).run(
      id,
      state.activeCaseId,
      Number(payload.lat ?? 0),
      Number(payload.lon ?? 0),
      payload.noteMarkdown ?? "",
      payload.status ?? "NEUTRAL",
      Math.max(1, Math.min(5, Number(payload.akhStatus ?? 3))),
      JSON.stringify(payload.metadata ?? {}),
    );
    loadAnnotations();
    io.emit("data:witnessAnnotations", state.annotations);
    res.json({ success: true, id, caseId: state.activeCaseId });
  });

  app.post("/api/seeker/ingest", (req, res) => {
    const incoming = Array.isArray(req.body?.nodes) ? req.body.nodes : [];
    const normalized = incoming.map((n: any, i: number) => ({
      id: n.id ?? `seeker-${Date.now()}-${i}`,
      nodeType: n.nodeType ?? "footprint",
      lat: Number(n.lat),
      lon: Number(n.lon),
      confidence: Number(n.confidence ?? 0.5),
      verified: n.verified !== false,
      noisy: n.noisy === true,
      payload: n,
    })).filter((n: any) => Number.isFinite(n.lat) && Number.isFinite(n.lon));

    const passed = applyMaatFilter(normalized);
    const rejected = normalized.filter((n) => !passed.find((p) => p.id === n.id));
    const stmt = db.prepare("INSERT OR REPLACE INTO seeker_nodes (id, case_id, node_type, lat, lon, confidence, payload) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const n of passed) {
      stmt.run(n.id, state.activeCaseId, n.nodeType, n.lat, n.lon, n.confidence, JSON.stringify(n.payload));
    }

    const qstmt = db.prepare("INSERT OR REPLACE INTO high_entropy_nodes (id, case_id, source, reason, payload) VALUES (?, ?, ?, ?, ?)");
    for (const n of rejected) {
      const decision = maatValidationPipe(n);
      qstmt.run(n.id, state.activeCaseId, "seeker-ingest", decision.reason, JSON.stringify(n));
    }

    loadSeekerNodes();
    loadHighEntropyNodes();
    io.emit("data:seekerNodes", state.seekerNodes);
    res.json({ success: true, received: normalized.length, accepted: passed.length, vetoed: normalized.length - passed.length });
  });

  app.post("/api/sigint/investigate", (req, res) => {
    const { lat, lon } = req.body;
    const summary = investigateCoordinate(Number(lat), Number(lon));
    io.emit("data:ghostMarkers", state.ghostMarkers);
    res.json(summary);
  });

  io.on("connection", (socket) => {
    socket.on("bridge:pushNodes", (payload: any) => {
      const incoming = Array.isArray(payload?.nodes) ? payload.nodes : [];
      const normalized = incoming.map((n: any, i: number) => ({
        id: n.id ?? `bridge-${Date.now()}-${i}`,
        nodeType: n.nodeType ?? "bridge-node",
        lat: Number(n.lat),
        lon: Number(n.lon),
        confidence: Number(n.confidence ?? 0.6),
        verified: n.verified !== false,
        noisy: n.noisy === true,
        headers: n.headers ?? {},
        metadata: n.metadata ?? {},
        payload: n,
      })).filter((n: any) => Number.isFinite(n.lat) && Number.isFinite(n.lon));

      const passed = applyMaatFilter(normalized);
      const rejected = normalized.filter((n) => !passed.find((p) => p.id === n.id));

      const stmt = db.prepare("INSERT OR REPLACE INTO seeker_nodes (id, case_id, node_type, lat, lon, confidence, payload) VALUES (?, ?, ?, ?, ?, ?, ?)");
      const qstmt = db.prepare("INSERT OR REPLACE INTO high_entropy_nodes (id, case_id, source, reason, payload) VALUES (?, ?, ?, ?, ?)");

      for (const n of passed) {
        stmt.run(n.id, state.activeCaseId, n.nodeType, n.lat, n.lon, n.confidence, JSON.stringify(n.payload));
        persistIntelResourceNode("bridge", n);
      }
      for (const n of rejected) {
        const decision = gatekeeper.audit(n);
        qstmt.run(n.id, state.activeCaseId, "bridge-push", decision.reason, JSON.stringify(n));
      }

      loadSeekerNodes();
      loadHighEntropyNodes();
      io.emit("data:seekerNodes", state.seekerNodes);
      io.emit("data:highEntropyNodes", state.highEntropyNodes);
      socket.emit("bridge:ack", { received: normalized.length, accepted: passed.length, vetoed: rejected.length });
    });
    [
      ["data:borders", state.borders],
      ["data:conflictZones", state.conflictZones],
      ["data:threatArcs", state.threatArcs],
      ["data:breaches", state.breaches],
      ["data:seismicFaults", state.seismicFaults],
      ["data:powerGrid", state.powerGrid],
      ["data:groundStations", state.groundStations],
      ["data:subseaCables", state.subseaCables],
      ["data:witnessAnnotations", state.annotations],
      ["data:rfNodes", state.rfNodes],
      ["data:vessels", state.vessels],
      ["data:cyberThreats", state.cyberThreats],
      ["data:wardriving", state.wardriving],
      ["data:resonanceLinks", state.resonanceLinks],
      ["data:ghostMarkers", state.ghostMarkers],
      ["data:seekerNodes", state.seekerNodes],
      ["data:mcpNodes", state.mcpNodes],
      ["data:liquidityHeatmap", state.liquidityHeatmap],
      ["data:seismicWindows", state.seismicWindows],
      ["data:highEntropyNodes", state.highEntropyNodes],
    ].forEach(([event, payload]) => socket.emit(event as string, payload));
  });

  setInterval(() => {
    scanLocalData();
    emitState(io);
  }, 30000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`HORUS server running on http://localhost:${PORT}`));
  startLocalMcpSocket();
}

startServer();

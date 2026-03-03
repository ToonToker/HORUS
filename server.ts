import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import * as satellite from "satellite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new Database("worldview.db");

// Initialize DB
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

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/cases", (req, res) => {
    const cases = db.prepare("SELECT * FROM cases ORDER BY created_at DESC").all();
    res.json(cases);
  });

  app.post("/api/cases", (req, res) => {
    const { id, title, description } = req.body;
    db.prepare("INSERT INTO cases (id, title, description) VALUES (?, ?, ?)").run(id, title, description);
    res.json({ success: true });
  });

  app.get("/api/alerts", (req, res) => {
    const alerts = db.prepare("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50").all();
    res.json(alerts);
  });

  // WebSocket for real-time data
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Data State
  let aircraftData: any[] = [];
  let satelliteData: any[] = [];
  let earthquakeData: any[] = [];
  let satrecs: any[] = [];
  let useSimulatedAircraft = false;

  // Fetch OpenSky Data
  const fetchAircraft = async () => {
    try {
      // US Bounding Box to reduce payload
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("https://opensky-network.org/api/states/all?lamin=24.396308&lomin=-125.0&lamax=49.384358&lomax=-66.93457", { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'WorldView-App/1.0'
        }
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.states) {
          useSimulatedAircraft = false;
          aircraftData = data.states.map((s: any) => ({
            id: s[0],
            type: "aircraft",
            callsign: s[1] ? s[1].trim() : "UNKNOWN",
            lon: s[5],
            lat: s[6],
            alt: s[7] || s[13] || 0,
            speed: s[9],
            heading: s[10],
            ts: Date.now(),
          })).filter((a: any) => a.lat != null && a.lon != null);
        }
      } else {
        useSimulatedAircraft = true;
      }
    } catch (e: any) {
      if (e.name !== 'AbortError' && !e.message?.includes('aborted')) {
        console.error("Failed to fetch aircraft data, falling back to simulated data:", e.message);
      }
      useSimulatedAircraft = true;
    }
  };

  // Fetch USGS Earthquakes
  const fetchEarthquakes = async () => {
    try {
      const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson");
      if (res.ok) {
        const data = await res.json();
        if (data && data.features) {
          earthquakeData = data.features.map((f: any) => ({
            id: f.id,
            type: "earthquake",
            title: f.properties.title,
            mag: f.properties.mag,
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
            depth: f.geometry.coordinates[2],
            ts: f.properties.time,
          }));
        }
      }
    } catch (e) {
      console.error("Failed to fetch earthquake data", e);
    }
  };

  // Fetch CelesTrak TLEs
  const fetchSatellites = async () => {
    try {
      const res = await fetch("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle");
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        satrecs = [];
        // Parse TLEs (3 lines per sat)
        for (let i = 0; i < lines.length - 2; i += 3) {
          const name = lines[i].trim();
          const tle1 = lines[i + 1].trim();
          const tle2 = lines[i + 2].trim();
          if (name && tle1 && tle2) {
            try {
              const satrec = satellite.twoline2satrec(tle1, tle2);
              satrecs.push({ name, satrec });
            } catch (e) {
              // ignore invalid TLE
            }
          }
        }
        // Limit to first 500 satellites for performance
        satrecs = satrecs.slice(0, 500);
      }
    } catch (e) {
      console.error("Failed to fetch satellite data", e);
    }
  };

  // Initial Fetches
  fetchAircraft();
  fetchEarthquakes();
  fetchSatellites();

  // Polling Intervals
  setInterval(fetchAircraft, 15000); // 15s for OpenSky
  setInterval(fetchEarthquakes, 60000); // 1m for USGS
  setInterval(fetchSatellites, 3600000); // 1h for TLEs

  // Real-time Emission Loop
  setInterval(() => {
    const now = new Date();
    const nowTime = now.getTime();
    
    // Simulated Aircraft (Global distribution)
    if (useSimulatedAircraft) {
      aircraftData = Array.from({ length: 300 }).map((_, i) => {
        const t = nowTime / 20000 + i * 137.5; // Golden angle for distribution
        const lat = Math.sin(i) * 60; // Spread across latitudes
        const lon = (i * 137.5 + (nowTime / 10000)) % 360 - 180;
        const dLon = 1; // Moving east
        const dLat = Math.sin(t) * 0.1;
        const heading = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
        return {
          id: `flight-${i}`,
          type: "aircraft",
          callsign: `FLT${i}`,
          flightNum: `AA${1000 + i}`,
          lat: lat,
          lon: lon,
          alt: 30000 + Math.sin(nowTime / 5000 + i) * 5000,
          heading: heading,
          speed: 450 + Math.sin(nowTime / 2000 + i) * 50,
          origin: "JFK",
          dest: "LHR",
          aircraftType: "B777",
          ts: nowTime,
        };
      });
    }

    // Propagate satellites
    satelliteData = satrecs.map((s) => {
      try {
        const positionAndVelocity = satellite.propagate(s.satrec, now);
        const positionEci = positionAndVelocity.position;
        if (typeof positionEci !== 'boolean' && positionEci) {
          const gmst = satellite.gstime(now);
          const positionGd = satellite.eciToGeodetic(positionEci, gmst);
          return {
            id: s.name,
            type: "satellite",
            name: s.name,
            noradId: s.name.split(' ')[1] || Math.floor(Math.random() * 50000),
            owner: Math.random() > 0.5 ? "SpaceX" : "NRO",
            apogee: positionGd.height + 200,
            perigee: positionGd.height - 200,
            resolvedIps: `192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
            lon: satellite.degreesLong(positionGd.longitude),
            lat: satellite.degreesLat(positionGd.latitude),
            alt: positionGd.height * 1000, // km to m
            ts: now.getTime(),
          };
        }
      } catch (e) {
        return null;
      }
      return null;
    }).filter(Boolean);

    // Simulated Military Flights
    const militaryFlights = Array.from({ length: 50 }).map((_, i) => {
      const t = nowTime / 15000 + i * 73;
      const lat = Math.sin(i * 13) * 70;
      const lon = (i * 73 + (nowTime / 5000)) % 360 - 180;
      const dLon = Math.cos(t);
      const dLat = Math.sin(t);
      const heading = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
      return {
        id: `mil-${i}`,
        type: "militaryFlight",
        callsign: `VIPER${i}`,
        squawk: Math.floor(1000 + Math.random() * 6000).toString(),
        lat: lat,
        lon: lon,
        alt: 45000 + Math.sin(nowTime / 4000 + i) * 5000,
        heading: heading,
        speed: 800 + Math.sin(nowTime / 1000 + i) * 200,
        missionType: Math.random() > 0.5 ? "CAP" : "RECON",
        ts: nowTime,
      };
    });

    // Simulated Magnetosphere
    const magnetosphere = Array.from({ length: 100 }).map((_, i) => ({
      id: `mag-${i}`,
      type: "magnetosphere",
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      fluxDensity: 30000 + Math.random() * 30000,
      kpIndex: Math.floor(Math.random() * 9),
      lineOrientation: Math.random() * 360,
      solarWindSpeed: 300 + Math.random() * 500,
      ts: nowTime,
    }));

    // Simulated Weather Radar
    const weatherRadar = Array.from({ length: 200 }).map((_, i) => ({
      id: `wx-${i}`,
      type: "weatherRadar",
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      precipRate: Math.random() * 60, // dBZ
      windVelocity: Math.random() * 100,
      cellMovement: Math.random() * 360,
      stormTopHeight: Math.random() * 15000,
      ts: nowTime,
    }));

    // Simulated Street Traffic
    const streetTraffic = Array.from({ length: 300 }).map((_, i) => ({
      id: `traffic-${i}`,
      type: "streetTraffic",
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      flowSpeed: Math.random() * 120,
      speedLimit: 100,
      congestion: Math.random() * 100,
      incidentReports: Math.floor(Math.random() * 5),
      roadTemp: 10 + Math.random() * 30,
      ts: nowTime,
    }));

    // Simulated Bikeshare
    const bikeshare = Array.from({ length: 150 }).map((_, i) => ({
      id: `bike-${i}`,
      type: "bikeshare",
      stationName: `Station ${i}`,
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      bikesAvailable: Math.floor(Math.random() * 20),
      ebikes: Math.floor(Math.random() * 10),
      dockVacancy: Math.floor(Math.random() * 15),
      powerLevel: Math.floor(Math.random() * 100),
      ts: nowTime,
    }));

    // Simulated POIs
    const pois = Array.from({ length: 200 }).map((_, i) => ({
      id: `poi-${i}`,
      type: "poi",
      landmarkName: `Landmark ${i}`,
      category: "Historical",
      hours: "9AM - 5PM",
      wikipedia: "A significant historical landmark...",
      elevation: Math.random() * 2000,
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      ts: nowTime,
    }));

    // Simulated Internet Devices
    const internetDevices = Array.from({ length: 400 }).map((_, i) => ({
      id: `iot-${i}`,
      type: "internetDevice",
      deviceType: Math.random() > 0.5 ? "Server" : "Fridge",
      manufacturer: "CyberCorp",
      osVersion: "v2.1.4",
      uptime: `${Math.floor(Math.random() * 100)} days`,
      openPorts: "80, 443, 22",
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      ts: nowTime,
    }));

    // Simulated WiGLE WiFi
    const wigleWifi = Array.from({ length: 300 }).map((_, i) => ({
      id: `wifi-${i}`,
      type: "wigleWifi",
      ssid: `Network_${i}`,
      bssid: `00:14:22:01:23:${Math.floor(Math.random()*99)}`,
      encryption: Math.random() > 0.5 ? "WPA3" : "WPA2",
      channel: Math.floor(Math.random() * 11) + 1,
      signalStrength: -30 - Math.random() * 60,
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      ts: nowTime,
    }));

    // Simulated CCTV Mesh
    const cctvMesh = Array.from({ length: 250 }).map((_, i) => ({
      id: `cctv-${i}`,
      type: 'cctvMesh',
      cameraModel: `AXIS P${Math.floor(Math.random()*9000)}`,
      fov: `${Math.floor(Math.random()*120)}°`,
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      status: Math.random() > 0.2 ? 'Live' : 'Historical',
      ts: nowTime,
    }));

    // Simulated Snapchat Maps
    const snapchatMaps = Array.from({ length: 150 }).map((_, i) => ({
      id: `snap-${i}`,
      type: "snapchatMap",
      bitmojiDensity: Math.floor(Math.random() * 100),
      publicStory: "User story preview...",
      heatIndex: Math.random() * 100,
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      ts: nowTime,
    }));

    // Simulated Pokemon GO
    const pokemonGo = Array.from({ length: 200 }).map((_, i) => ({
      id: `pogo-${i}`,
      type: "pokemonGo",
      poiType: Math.random() > 0.5 ? "Gym" : "Pokéstop",
      teamControl: ["Valor", "Mystic", "Instinct"][Math.floor(Math.random() * 3)],
      raidTimer: `${Math.floor(Math.random() * 45)} mins`,
      lureStatus: Math.random() > 0.7 ? "Active" : "Inactive",
      lat: (i * 137.5) % 180 - 90,
      lon: (i * 137.5 * 2) % 360 - 180,
      ts: nowTime,
    }));

    io.emit("data:aircraft", aircraftData);
    io.emit("data:militaryFlights", militaryFlights);
    io.emit("data:satellites", satelliteData);
    io.emit("data:earthquakes", earthquakeData);
    io.emit("data:magnetosphere", magnetosphere);
    io.emit("data:weatherRadar", weatherRadar);
    io.emit("data:streetTraffic", streetTraffic);
    io.emit("data:bikeshare", bikeshare);
    io.emit("data:pois", pois);
    io.emit("data:internetDevices", internetDevices);
    io.emit("data:wigleWifi", wigleWifi);
    io.emit("data:cctvMesh", cctvMesh);
    io.emit("data:snapchatMaps", snapchatMaps);
    io.emit("data:pokemonGo", pokemonGo);
  }, 2000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

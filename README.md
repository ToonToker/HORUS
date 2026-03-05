# WORLDVIEW — Geospatial Intel Command Center

WORLDVIEW is a tactical geospatial dashboard built with **React + Vite + CesiumJS**.
It fuses live/simulated intelligence layers (aircraft, satellites, seismic, etc.) with a dark HUD-style command interface.

## Features

- Cesium globe visualization with tactical overlays
- Optional **Google Photorealistic 3D Tiles** base layer
- Real-time visual modes:
  - Normal
  - Night Vision (NVG)
  - Thermal (FLIR)
  - CRT tactical effects with adjustable shader controls
- Keyboard POI jumps (`Q`, `W`, `E`, `R`, `T`)
- Command palette focus (`Cmd/Ctrl + K`)
- WebSocket-fed live/simulated entity streams

---

## Prerequisites

Make sure you have the following installed:

- **Node.js 20+** (recommended)
- **npm 10+**
- (Optional) API key for Google Photorealistic 3D Tiles

Check versions:

```bash
node -v
npm -v
```

---

## Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd HORUS
```

2. Install dependencies:

```bash
npm install
```

3. Create a local environment file:

```bash
cp .env.example .env.local
```

4. Edit `.env.local` and set values:

```env
# Required by existing app template integrations
GEMINI_API_KEY="YOUR_GEMINI_KEY"
APP_URL="http://localhost:3000"

# Optional (enables Google Photorealistic 3D Tiles)
VITE_GOOGLE_3D_TILES_API_KEY="YOUR_GOOGLE_MAPS_3D_TILES_KEY"
```

> If `VITE_GOOGLE_3D_TILES_API_KEY` is omitted, the app still runs, but Google 3D photorealistic tiles are not loaded.

---

## Running Locally (Development)

Start the development server:

```bash
npm run dev
```

Then open:

- `http://localhost:3000`

---

## Production Build & Preview

Build:

```bash
npm run build
```

Preview production bundle:

```bash
npm run preview
```

---

## Type Checking / Linting

```bash
npm run lint
```

---

## Controls & UX Shortcuts

### Globe hotkeys

- `Q` → Washington DC
- `W` → Moscow
- `E` → Beijing
- `R` → Tel Aviv
- `T` → Kyiv

### Command palette

- `Cmd/Ctrl + K` focuses the command input
- Example commands:
  - `go to pentagon`
  - `go to burj khalifa`
  - `go to london bridge`

---

## Data Sources and Fallback Behavior

WORLDVIEW attempts to fetch from public sources such as:

- OpenSky Network (commercial aviation)
- CelesTrak (satellite TLE)
- USGS (earthquake feed)

If external APIs are unreachable (e.g., restricted network environments), the app falls back to simulated data for certain layers so the dashboard remains usable.

---

## Troubleshooting

### 1) Blank/low-detail globe
- Confirm Cesium assets are loading
- If using Google tiles, verify `VITE_GOOGLE_3D_TILES_API_KEY` is valid and enabled for the proper API/billing project

### 2) No live aircraft/satellite updates
- Check terminal logs for outbound network failures
- In restricted environments this is expected; simulated fallback should appear

### 3) Port already in use
- Stop the conflicting process or change local runtime config

### 4) TypeScript complains about `import.meta.env`
- Ensure `src/vite-env.d.ts` exists and `npm run lint` is run from project root

### 5) `npm audit` reports DOMPurify advisory via Cesium
- This repo pins transitive resolution with `"overrides": { "dompurify": "^3.3.1" }` in `package.json`
- If your local lockfile is stale, run:
  - `rm -rf node_modules package-lock.json`
  - `npm install`
- Then verify with `npm ls dompurify` (should resolve to `3.3.1` or newer)

---

## Project Scripts

- `npm run dev` — start local dev server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — TypeScript type-check (`tsc --noEmit`)
- `npm run clean` — remove `dist`

---

## Notes

This project currently uses a **React + Vite** stack with CesiumJS and Zustand, and includes a server process (`server.ts`) for WebSocket/API data orchestration.

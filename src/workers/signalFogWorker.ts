/// <reference lib="webworker" />

type SignalPoint = { id: string; lat: number; lon: number; density: number; ts?: number };

type Msg = { points: SignalPoint[] };

self.onmessage = (event: MessageEvent<Msg>) => {
  const byCell = new Map<string, SignalPoint>();
  for (const p of event.data.points || []) {
    const cellLat = Math.round(p.lat * 2) / 2;
    const cellLon = Math.round(p.lon * 2) / 2;
    const key = `${cellLat}:${cellLon}`;
    const ex = byCell.get(key);
    if (ex) ex.density += p.density;
    else byCell.set(key, { ...p, lat: cellLat, lon: cellLon });
  }
  postMessage({ fog: [...byCell.values()] });
};

export {};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useWorldViewStore } from '../store';

type Track = {
  id: string;
  lat?: number;
  lon?: number;
  from?: { lat: number; lon: number };
  to?: { lat: number; lon: number };
  intensity?: number;
  ts?: number;
  speed?: number;
  callsign?: string;
  name?: string;
  density?: number;
  status?: string;
};

const TILE = 256;
const ZOOM = 2;
const WORLD = TILE * (2 ** ZOOM);

function project(lat: number, lon: number) {
  const clamped = Math.max(-85, Math.min(85, lat));
  const x = ((lon + 180) / 360) * WORLD;
  const s = Math.sin((clamped * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD;
  return { x, y };
}

function unproject(x: number, y: number) {
  const lon = (x / WORLD) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / WORLD;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

const GlobeViewer = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const { layers, temporalHours, setPendingWitnessPoint, setSelectedEntity } = useWorldViewStore();

  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [conflicts, setConflicts] = useState<Track[]>([]);
  const [breaches, setBreaches] = useState<Track[]>([]);
  const [threatArcs, setThreatArcs] = useState<Track[]>([]);
  const [rfNodes, setRfNodes] = useState<Track[]>([]);
  const [vessels, setVessels] = useState<Track[]>([]);
  const [cyberThreats, setCyberThreats] = useState<Track[]>([]);
  const [wardriving, setWardriving] = useState<Track[]>([]);
  const [signalFog, setSignalFog] = useState<Track[]>([]);
  const [resonanceLinks, setResonanceLinks] = useState<Track[]>([]);
  const [ghostMarkers, setGhostMarkers] = useState<Track[]>([]);
  const [witnessAnnotations, setWitnessAnnotations] = useState<Track[]>([]);

  useEffect(() => {
    const center = project(20, 0);
    setOffset({ x: size.w / 2 - center.x, y: size.h / 2 - center.y });
  }, [size.w, size.h]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const socket = io();
    socket.on('data:conflictZones', setConflicts);
    socket.on('data:breaches', setBreaches);
    socket.on('data:threatArcs', setThreatArcs);
    socket.on('data:rfNodes', setRfNodes);
    socket.on('data:vessels', setVessels);
    socket.on('data:cyberThreats', setCyberThreats);
    socket.on('data:wardriving', setWardriving);
    socket.on('data:resonanceLinks', setResonanceLinks);
    socket.on('data:ghostMarkers', setGhostMarkers);
    socket.on('data:witnessAnnotations', setWitnessAnnotations);
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/signalFogWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => setSignalFog(e.data.fog || []);
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    workerRef.current?.postMessage({ points: wardriving.filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lon)) });
  }, [wardriving]);

  const cut = useMemo(() => Date.now() - temporalHours * 3600 * 1000, [temporalHours]);
  const recent = (arr: Track[]) => arr.filter((x) => !x.ts || x.ts >= cut);

  const tiles = useMemo(() => {
    const out: { x: number; y: number; tx: number; ty: number }[] = [];
    const startX = Math.floor((-offset.x) / TILE) - 1;
    const endX = Math.ceil((size.w - offset.x) / TILE) + 1;
    const startY = Math.floor((-offset.y) / TILE) - 1;
    const endY = Math.ceil((size.h - offset.y) / TILE) + 1;
    const n = 2 ** ZOOM;
    for (let tx = startX; tx <= endX; tx += 1) {
      for (let ty = startY; ty <= endY; ty += 1) {
        if (ty < 0 || ty >= n) continue;
        const wrapped = ((tx % n) + n) % n;
        out.push({ x: tx * TILE + offset.x, y: ty * TILE + offset.y, tx: wrapped, ty });
      }
    }
    return out;
  }, [offset.x, offset.y, size.h, size.w]);

  const toScreen = (lat?: number, lon?: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { x: -9999, y: -9999 };
    const p = project(lat as number, lon as number);
    return { x: p.x + offset.x, y: p.y + offset.y };
  };

  const onMapClick = (clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left - offset.x;
    const y = clientY - rect.top - offset.y;
    const ll = unproject(x, y);
    setPendingWitnessPoint({ lat: ll.lat, lon: ll.lon });
  };

  const marker = (d: Track, color: string, sizePx = 8, label?: string) => {
    const p = toScreen(d.lat, d.lon);
    return (
      <button
        key={d.id}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: p.x, top: p.y }}
        onClick={(e) => { e.stopPropagation(); setSelectedEntity(d); }}
      >
        <span style={{ width: sizePx, height: sizePx, background: color }} className="block rounded-full border border-black/40" />
        {label && <span className="text-[10px] text-[#00FF41] whitespace-nowrap block mt-0.5">{label}</span>}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className="w-full h-full relative overflow-hidden bg-[#02110b]"
      onMouseDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; }}
      onMouseMove={(e) => {
        if (!dragRef.current) return;
        setOffset({ x: dragRef.current.ox + (e.clientX - dragRef.current.x), y: dragRef.current.oy + (e.clientY - dragRef.current.y) });
      }}
      onMouseUp={() => { dragRef.current = null; }}
      onMouseLeave={() => { dragRef.current = null; }}
      onClick={(e) => onMapClick(e.clientX, e.clientY)}
    >
      <div className="absolute inset-0 pointer-events-none opacity-70" style={{ backgroundImage: 'linear-gradient(#0f5d3a55 1px, transparent 1px), linear-gradient(90deg, #0f5d3a55 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      {tiles.map((t) => (
        <img
          key={`${t.tx}-${t.ty}-${t.x}`}
          src={`/maps/tiles/${ZOOM}/${t.tx}/${t.ty}.svg`}
          className="absolute"
          style={{ left: t.x, top: t.y, width: TILE, height: TILE }}
          draggable={false}
        />
      ))}

      <svg className="absolute inset-0 pointer-events-none" width={size.w} height={size.h}>
        {layers.threatMap && threatArcs.map((a) => {
          const f = toScreen(a.from?.lat, a.from?.lon);
          const t = toScreen(a.to?.lat, a.to?.lon);
          return <line key={a.id} x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="#FF3131" strokeWidth="2" opacity="0.9" />;
        })}
        {layers.resonanceLinks && resonanceLinks.map((a) => {
          const f = toScreen(a.from?.lat, a.from?.lon);
          const t = toScreen(a.to?.lat, a.to?.lon);
          return <line key={a.id} x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="#FFD700" strokeWidth="1.5" opacity="0.9" />;
        })}
      </svg>

      {layers.conflictZones && recent(conflicts).map((d) => marker(d, '#FF3131', 7 + ((d.intensity ?? 1) * 2)))}
      {layers.breachLocator && breaches.map((d) => marker(d, '#FFD700', 8))}
      {layers.rfNodes && recent(rfNodes).map((d) => marker(d, '#00FFFF', 6, d.name))}
      {layers.maritime && recent(vessels).map((d) => marker(d, '#00bcd4', 7, `${d.callsign ?? 'VSL'} ${Math.round(d.speed ?? 0)}kt`))}
      {layers.cyberThreats && recent(cyberThreats).map((d) => marker(d, '#FF3131', 5 + (d.intensity ?? 1)))}
      {layers.signalFog && signalFog.map((d) => marker(d, '#00FF41', 4 + Math.min(10, Math.round((d.density ?? 1) / 2))))}
      {layers.ghostMarkers && ghostMarkers.map((d) => marker(d, '#dddddd', 6, d.name))}
      {layers.witnessAnnotations && witnessAnnotations.map((d) => marker(d, '#00FF41', 8, d.status))}

      <div className="absolute left-3 bottom-3 text-xs text-emerald-300 bg-black/70 border border-emerald-600/50 p-2 rounded">HORUS MAP ONLINE · Local tile core active (drag to pan).</div>
    </div>
  );
};

export default GlobeViewer;

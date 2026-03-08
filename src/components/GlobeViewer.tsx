import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, GeoJSON } from 'react-leaflet';
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
  nodeType?: string;
  kind?: string;
};

type BorderFeature = {
  id: string;
  geometry: any;
  properties?: Record<string, unknown>;
};

const GlobeViewer = () => {
  const { layers, temporalHours, setPendingWitnessPoint, setSelectedEntity } = useWorldViewStore();

  const [borders, setBorders] = useState<BorderFeature[]>([]);
  const [conflicts, setConflicts] = useState<Track[]>([]);
  const [breaches, setBreaches] = useState<Track[]>([]);
  const [threatArcs, setThreatArcs] = useState<Track[]>([]);
  const [rfNodes, setRfNodes] = useState<Track[]>([]);
  const [vessels, setVessels] = useState<Track[]>([]);
  const [cyberThreats, setCyberThreats] = useState<Track[]>([]);
  const [wardriving, setWardriving] = useState<Track[]>([]);
  const [resonanceLinks, setResonanceLinks] = useState<Track[]>([]);
  const [ghostMarkers, setGhostMarkers] = useState<Track[]>([]);
  const [witnessAnnotations, setWitnessAnnotations] = useState<Track[]>([]);
  const [seekerNodes, setSeekerNodes] = useState<Track[]>([]);
  const [mcpNodes, setMcpNodes] = useState<Track[]>([]);
  const [liquidityHeatmap, setLiquidityHeatmap] = useState<Track[]>([]);
  const [seismicWindows, setSeismicWindows] = useState<Track[]>([]);
  const [highEntropyNodes, setHighEntropyNodes] = useState<Track[]>([]);

  useEffect(() => {
    const socket = io();
    socket.on('data:borders', setBorders);
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
    socket.on('data:seekerNodes', setSeekerNodes);
    socket.on('data:mcpNodes', setMcpNodes);
    socket.on('data:liquidityHeatmap', setLiquidityHeatmap);
    socket.on('data:seismicWindows', setSeismicWindows);
    socket.on('data:highEntropyNodes', setHighEntropyNodes);
    return () => socket.disconnect();
  }, []);

  const cut = useMemo(() => Date.now() - temporalHours * 3600 * 1000, [temporalHours]);
  const recent = (arr: Track[]) => arr.filter((x) => !x.ts || x.ts >= cut);

  const mark = (arr: Track[], color: string, radius = 5, label?: (d: Track) => string) => arr
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon))
    .map((d) => (
      <CircleMarker
        key={d.id}
        center={[d.lat as number, d.lon as number]}
        radius={radius}
        pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 1 }}
        eventHandlers={{ click: () => setSelectedEntity(d) }}
      >
        {label && <Tooltip>{label(d)}</Tooltip>}
      </CircleMarker>
    ));

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#02110b]">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        style={{ height: '100%', width: '100%', background: '#02110b' }}
        whenReady={() => undefined}
        eventHandlers={{
          click: (e) => setPendingWitnessPoint({ lat: e.latlng.lat, lon: e.latlng.lng }),
        }}
      >
        <TileLayer
          url="/maps/tiles/{z}/{x}/{y}.png?tms=true"
          tms
          noWrap
          attribution="HORUS Offline MBTiles"
        />

        {layers.borders && (
          <GeoJSON
            data={{ type: 'FeatureCollection', features: borders.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: f.properties ?? {} })) }}
            style={{ color: '#00FF41', weight: 1, opacity: 0.6, fillOpacity: 0 }}
          />
        )}

        {layers.threatMap && threatArcs.map((a) => (
          (a.from && a.to) ? (
            <Polyline
              key={a.id}
              positions={[[a.from.lat, a.from.lon], [a.to.lat, a.to.lon]]}
              pathOptions={{ color: '#FF3131', weight: 2, opacity: 0.9 }}
            />
          ) : null
        ))}

        {layers.resonanceLinks && resonanceLinks.map((a) => (
          (a.from && a.to) ? (
            <Polyline
              key={a.id}
              positions={[[a.from.lat, a.from.lon], [a.to.lat, a.to.lon]]}
              pathOptions={{ color: '#FFD700', weight: 1.5, opacity: 0.9 }}
            />
          ) : null
        ))}

        {layers.conflictZones && mark(recent(conflicts), '#FF3131', 6)}
        {layers.breachLocator && mark(breaches, '#FFD700', 6)}
        {layers.rfNodes && mark(recent(rfNodes), '#00FFFF', 5, (d) => d.name ?? 'RF')}
        {layers.maritime && mark(recent(vessels), '#00bcd4', 5, (d) => `${d.callsign ?? 'VSL'} ${Math.round(d.speed ?? 0)}kt`)}
        {layers.cyberThreats && mark(recent(cyberThreats), '#FF3131', 5)}
        {layers.signalFog && mark(wardriving, '#00FF41', 4)}
        {layers.ghostMarkers && mark(ghostMarkers, '#dddddd', 5, (d) => d.name ?? 'Ghost')}
        {layers.witnessAnnotations && mark(witnessAnnotations, '#00FF41', 6, (d) => d.status ?? 'Witness')}
        {layers.seekerNodes && mark(seekerNodes, '#FFD700', 6, (d) => d.nodeType ?? 'SEEKER')}
        {layers.mcpNodes && mark(mcpNodes, '#ff8a00', 5, (d) => d.kind ?? 'MCP')}
        {layers.liquidityHeatmap && mark(recent(liquidityHeatmap), '#ff4d00', 5)}
        {layers.seismicWindows && mark(recent(seismicWindows), '#00e5ff', 5)}
        {layers.highEntropyNodes && mark(highEntropyNodes, '#ff00aa', 6, () => 'HIGH-ENTROPY')}
      </MapContainer>

      <div className="absolute left-3 bottom-3 z-[1000] text-xs text-emerald-300 bg-black/70 border border-emerald-600/50 p-2 rounded">HORUS MAP ONLINE · Local MBTiles core active.</div>
    </div>
  );
};

export default GlobeViewer;

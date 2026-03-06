import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Viewer, Entity } from 'resium';
import { ArcType, Cartesian2, Cartesian3, Color } from 'cesium';
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

const GlobeViewer = () => {
  const viewerRef = useRef<any>(null);
  const { layers, temporalHours } = useWorldViewStore();
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
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    viewer.scene.backgroundColor = Color.fromCssColorString('#02110b');
    viewer.scene.globe.baseColor = Color.fromCssColorString('#02110b');
    viewer.scene.globe.showGroundAtmosphere = false;
  }, []);

  const cut = useMemo(() => Date.now() - temporalHours * 3600 * 1000, [temporalHours]);
  const recent = (arr: Track[]) => arr.filter((x) => !x.ts || x.ts >= cut);

  return (
    <div className="w-full h-full relative">
      <Viewer
        ref={viewerRef}
        full
        baseLayerPicker={false}
        timeline={false}
        animation={false}
        geocoder={false}
        homeButton={false}
        sceneModePicker={false}
        navigationHelpButton={false}
        selectionIndicator={false}
        infoBox={false}
      >
        {layers.conflictZones && recent(conflicts).map((c) => (
          <Entity key={c.id} position={Cartesian3.fromDegrees(c.lon ?? 0, c.lat ?? 0)} point={{ pixelSize: 6 + ((c.intensity ?? 1) * 2), color: Color.RED.withAlpha(0.75) }} />
        ))}
        {layers.breachLocator && breaches.map((b) => (
          <Entity key={b.id} position={Cartesian3.fromDegrees(b.lon ?? 0, b.lat ?? 0)} point={{ pixelSize: 7, color: Color.fromCssColorString('#FFD700') }} />
        ))}
        {layers.threatMap && threatArcs.map((a) => (
          <Entity key={a.id} polyline={{ positions: Cartesian3.fromDegreesArray([a.from?.lon ?? 0, a.from?.lat ?? 0, a.to?.lon ?? 0, a.to?.lat ?? 0]), width: 2, material: Color.fromCssColorString('#FF3131'), arcType: ArcType.GEODESIC }} />
        ))}
        {layers.rfNodes && recent(rfNodes).map((r) => (
          <Entity key={r.id} position={Cartesian3.fromDegrees(r.lon ?? 0, r.lat ?? 0)} point={{ pixelSize: 5, color: Color.AQUA }} label={{ text: r.name ?? 'RF', fillColor: Color.AQUA, font: '10px monospace', pixelOffset: new Cartesian2(0, -12) }} />
        ))}
        {layers.maritime && recent(vessels).map((v) => (
          <Entity key={v.id} position={Cartesian3.fromDegrees(v.lon ?? 0, v.lat ?? 0)} point={{ pixelSize: 6, color: Color.CYAN }} label={{ text: `${v.callsign ?? 'VSL'} ${Math.round(v.speed ?? 0)}kt`, fillColor: Color.CYAN, font: '10px monospace', pixelOffset: new Cartesian2(0, -12) }} />
        ))}
        {layers.cyberThreats && recent(cyberThreats).map((c) => (
          <Entity key={c.id} position={Cartesian3.fromDegrees(c.lon ?? 0, c.lat ?? 0)} point={{ pixelSize: 4 + (c.intensity ?? 1), color: Color.fromCssColorString('#FF3131') }} />
        ))}
        {layers.signalFog && wardriving.map((w) => (
          <Entity key={w.id} position={Cartesian3.fromDegrees(w.lon ?? 0, w.lat ?? 0)} point={{ pixelSize: 4 + Math.min(8, (w.density ?? 1) / 2), color: Color.fromCssColorString('#00FF41').withAlpha(0.3) }} />
        ))}
        {layers.resonanceLinks && resonanceLinks.map((l) => (
          <Entity key={l.id} polyline={{ positions: Cartesian3.fromDegreesArray([l.from?.lon ?? 0, l.from?.lat ?? 0, l.to?.lon ?? 0, l.to?.lat ?? 0]), width: 1.5, material: Color.fromCssColorString('#FFD700') }} />
        ))}
        {layers.ghostMarkers && ghostMarkers.map((g) => (
          <Entity key={g.id} position={Cartesian3.fromDegrees(g.lon ?? 0, g.lat ?? 0)} point={{ pixelSize: 6, color: Color.WHITE.withAlpha(0.45) }} label={{ text: g.name ?? 'Ghost', fillColor: Color.WHITE, font: '10px monospace', pixelOffset: new Cartesian2(0, -10) }} />
        ))}
        {layers.witnessAnnotations && witnessAnnotations.map((n) => (
          <Entity key={n.id} position={Cartesian3.fromDegrees(n.lon ?? 0, n.lat ?? 0)} point={{ pixelSize: 8, color: Color.LIME }} label={{ text: n.status ?? 'NOTE', fillColor: Color.LIME, font: '12px monospace', pixelOffset: new Cartesian2(0, -18) }} />
        ))}
      </Viewer>
      <div className="absolute left-3 bottom-3 text-xs text-emerald-300 bg-black/70 border border-emerald-600/50 p-2 rounded">HORUS MAP ONLINE · Local layers active.</div>
    </div>
  );
};

export default GlobeViewer;

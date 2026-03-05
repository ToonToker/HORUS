import React, { useEffect, useRef, useState } from 'react';
import { Viewer, Entity } from 'resium';
import {
  ArcType,
  Cartesian3,
  Color,
  SingleTileImageryProvider,
  GeoJsonDataSource,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
} from 'cesium';
import { io } from 'socket.io-client';
import { useWorldViewStore } from '../store';

type Track = { id: string; lat?: number; lon?: number; from?: { lat: number; lon: number }; to?: { lat: number; lon: number }; intensity?: number; geometry?: any; properties?: any; type?: string };

const tacticalTileDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="100%" height="100%" fill="#02110b"/>
    <g stroke="#0f5d3a" stroke-width="1" opacity="0.35">
      ${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 32}" y1="0" x2="${i * 32}" y2="512"/>`).join('')}
      ${Array.from({ length: 16 }, (_, i) => `<line x1="0" y1="${i * 32}" x2="512" y2="${i * 32}"/>`).join('')}
    </g>
  </svg>`,
)}`;

const GlobeViewer = () => {
  const viewerRef = useRef<any>(null);
  const { layers, setSelectedEntity, setPendingWitnessPoint } = useWorldViewStore();
  const [borders, setBorders] = useState<Track[]>([]);
  const [conflicts, setConflicts] = useState<Track[]>([]);
  const [threatArcs, setThreatArcs] = useState<Track[]>([]);
  const [breaches, setBreaches] = useState<Track[]>([]);
  const [subseaCables, setSubseaCables] = useState<Track[]>([]);
  const [seismicFaults, setSeismicFaults] = useState<Track[]>([]);
  const [powerGrid, setPowerGrid] = useState<Track[]>([]);
  const [groundStations, setGroundStations] = useState<Track[]>([]);
  const [witnessAnnotations, setWitnessAnnotations] = useState<Track[]>([]);

  useEffect(() => {
    const socket = io();
    socket.on('data:borders', setBorders);
    socket.on('data:conflictZones', setConflicts);
    socket.on('data:threatArcs', setThreatArcs);
    socket.on('data:breaches', setBreaches);
    socket.on('data:subseaCables', setSubseaCables);
    socket.on('data:seismicFaults', setSeismicFaults);
    socket.on('data:powerGrid', setPowerGrid);
    socket.on('data:groundStations', setGroundStations);
    socket.on('data:witnessAnnotations', setWitnessAnnotations);
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.position);
      if (defined(picked) && picked?.id) {
        setSelectedEntity(picked.id.properties?.getValue?.() ?? picked.id);
      }
      const cartesian = viewer.camera.pickEllipsoid(movement.position);
      if (cartesian) {
        const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
        const lat = (cartographic.latitude * 180) / Math.PI;
        const lon = (cartographic.longitude * 180) / Math.PI;
        setPendingWitnessPoint({ lat, lon });
      }
    }, ScreenSpaceEventType.LEFT_CLICK);
    return () => handler.destroy();
  }, [setPendingWitnessPoint, setSelectedEntity]);

  const loadGeoCollection = async (items: Track[], color: Color) => {
    const geojson = {
      type: 'FeatureCollection',
      features: items.filter((x) => x.geometry).map((x) => ({ type: 'Feature', geometry: x.geometry, properties: x.properties || { id: x.id } })),
    };
    return GeoJsonDataSource.load(geojson, {
      stroke: color,
      fill: color.withAlpha(0.06),
      strokeWidth: 2,
      clampToGround: true,
    });
  };

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const ds: any[] = [];
    const run = async () => {
      if (layers.borders) ds.push(await viewer.dataSources.add(await loadGeoCollection(borders, Color.GOLD)));
      if (layers.subseaCables) ds.push(await viewer.dataSources.add(await loadGeoCollection(subseaCables, Color.CYAN)));
      if (layers.seismicFaults) ds.push(await viewer.dataSources.add(await loadGeoCollection(seismicFaults, Color.ORANGE)));
      if (layers.powerGrid) ds.push(await viewer.dataSources.add(await loadGeoCollection(powerGrid, Color.LIME)));
      if (layers.groundStations) ds.push(await viewer.dataSources.add(await loadGeoCollection(groundStations, Color.fromCssColorString('#FFD700'))));
    };
    run();
    return () => ds.forEach((d) => viewer.dataSources.remove(d, true));
  }, [borders, layers.borders, layers.groundStations, layers.powerGrid, layers.seismicFaults, layers.subseaCables, groundStations, powerGrid, seismicFaults, subseaCables]);

  return (
    <div className="w-full h-full relative">
      <Viewer
        ref={viewerRef}
        full
        terrainProvider={undefined}
        baseLayerPicker={false}
        timeline={false}
        animation={false}
        geocoder={false}
        homeButton={false}
        sceneModePicker={false}
        navigationHelpButton={false}
        imageryProvider={new SingleTileImageryProvider({ url: tacticalTileDataUrl })}
      >
        {layers.conflictZones && conflicts.map((c) => (
          <Entity
            key={c.id}
            position={Cartesian3.fromDegrees(c.lon ?? 0, c.lat ?? 0)}
            point={{ pixelSize: 6 + ((c.intensity ?? 1) * 2), color: Color.RED.withAlpha(0.7) }}
            properties={c}
          />
        ))}
        {layers.breachLocator && breaches.map((b) => (
          <Entity
            key={b.id}
            position={Cartesian3.fromDegrees(b.lon ?? 0, b.lat ?? 0)}
            point={{ pixelSize: 7, color: Color.fromCssColorString('#FFD700') }}
            properties={b}
          />
        ))}
        {layers.witnessAnnotations && witnessAnnotations.map((n) => (
          <Entity
            key={n.id}
            position={Cartesian3.fromDegrees(n.lon ?? 0, n.lat ?? 0)}
            point={{ pixelSize: 8, color: Color.LIME }}
            label={{ text: n.status ?? 'NOTE', fillColor: Color.LIME, font: '12px monospace', pixelOffset: { x: 0, y: -18 } as any }}
            properties={n}
          />
        ))}
        {layers.threatMap && threatArcs.map((a) => (
          <Entity
            key={a.id}
            polyline={{
              positions: Cartesian3.fromDegreesArray([a.from?.lon ?? 0, a.from?.lat ?? 0, a.to?.lon ?? 0, a.to?.lat ?? 0]),
              width: 2,
              material: Color.fromCssColorString('#FF3131'),
              arcType: ArcType.GEODESIC,
            }}
            properties={a}
          />
        ))}
      </Viewer>
      <div className="absolute left-3 bottom-3 text-xs text-emerald-300 bg-black/70 border border-emerald-600/50 p-2 rounded">
        DJED-STABILIZER ACTIVE · Hover/click vectors for metadata.
      </div>
    </div>
  );
};

export default GlobeViewer;

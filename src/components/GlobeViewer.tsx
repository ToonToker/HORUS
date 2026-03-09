import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ArcType,
  Cartesian3,
  Color,
  HeightReference,
  Ion,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
} from 'cesium';
import { useWorldViewStore } from '../store';

type Track = {
  id: string;
  lat?: number;
  lon?: number;
  from?: { lat: number; lon: number };
  to?: { lat: number; lon: number };
  ts?: number;
};

const LOCAL_TILE_URL = 'http://localhost:8000/tiles/{z}/{x}/{reverseY}.png';

const GlobeViewer = () => {
  const { layers, temporalHours, setPendingWitnessPoint, setSelectedEntity } = useWorldViewStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [datasets, setDatasets] = useState<Record<string, Track[]>>({});

  useEffect(() => {
    Ion.defaultAccessToken = '';
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      geocoder: false,
      baseLayerPicker: false,
      baseLayer: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: true,
    });

    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({
      url: LOCAL_TILE_URL,
      minimumLevel: 0,
      maximumLevel: 6,
    }));
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.backgroundColor = Color.fromCssColorString('#000500');
    viewerRef.current = viewer;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (!cartesian) return;
      const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
      const lat = CesiumMath.toDegrees(cartographic.latitude);
      const lon = CesiumMath.toDegrees(cartographic.longitude);
      setPendingWitnessPoint({ lat, lon });

      const picked = viewer.scene.pick(movement.position);
      if (picked?.id?.properties) {
        setSelectedEntity({
          id: picked.id.id,
          lat: Number(picked.id.properties.lat?.getValue?.() ?? lat),
          lon: Number(picked.id.properties.lon?.getValue?.() ?? lon),
          kind: picked.id.properties.kind?.getValue?.() ?? 'entity',
        });
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [setPendingWitnessPoint, setSelectedEntity]);

  useEffect(() => {
    const socket = io();
    const bind = (event: string) => socket.on(event, (data: Track[]) => setDatasets((prev) => ({ ...prev, [event]: data ?? [] })));
    [
      'data:conflictZones', 'data:breaches', 'data:threatArcs', 'data:rfNodes', 'data:vessels',
      'data:cyberThreats', 'data:wardriving', 'data:resonanceLinks', 'data:ghostMarkers',
      'data:witnessAnnotations', 'data:seekerNodes', 'data:mcpNodes', 'data:liquidityHeatmap',
      'data:seismicWindows', 'data:highEntropyNodes',
    ].forEach(bind);
    return () => socket.disconnect();
  }, []);

  const cut = useMemo(() => Date.now() - temporalHours * 3600 * 1000, [temporalHours]);
  const recent = (arr: Track[]) => arr.filter((x) => !x.ts || x.ts >= cut);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();
    const addPoints = (arr: Track[], color: Color, pixelSize: number, kind: string) => {
      arr.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon)).forEach((d) => {
        viewer.entities.add({
          id: d.id,
          position: Cartesian3.fromDegrees(d.lon as number, d.lat as number, 15000),
          point: { color, pixelSize, outlineColor: Color.BLACK, outlineWidth: 1, heightReference: HeightReference.NONE },
          properties: { ...d, kind, lat: d.lat, lon: d.lon },
        });
      });
    };

    const addVolumetricEdges = (arr: Track[], color: Color) => {
      arr.forEach((a) => {
        if (!a.from || !a.to) return;
        viewer.entities.add({
          id: `edge-${a.id}`,
          polyline: {
            positions: Cartesian3.fromDegreesArrayHeights([
              a.from.lon, a.from.lat, 12000,
              (a.from.lon + a.to.lon) / 2, (a.from.lat + a.to.lat) / 2, 300000,
              a.to.lon, a.to.lat, 12000,
            ]),
            width: 2,
            material: color.withAlpha(0.9),
            arcType: ArcType.NONE,
          },
        });
      });
    };

    if (layers.conflictZones) addPoints(recent(datasets['data:conflictZones'] ?? []), Color.RED, 8, 'conflict');
    if (layers.breachLocator) addPoints(datasets['data:breaches'] ?? [], Color.GOLD, 8, 'breach');
    if (layers.rfNodes) addPoints(recent(datasets['data:rfNodes'] ?? []), Color.CYAN, 6, 'rf');
    if (layers.maritime) addPoints(recent(datasets['data:vessels'] ?? []), Color.fromCssColorString('#00bcd4'), 6, 'maritime');
    if (layers.cyberThreats) addPoints(recent(datasets['data:cyberThreats'] ?? []), Color.fromCssColorString('#ff3131'), 6, 'shodan');
    if (layers.signalFog) addPoints(datasets['data:wardriving'] ?? [], Color.LIME, 5, 'signal');
    if (layers.ghostMarkers) addPoints(datasets['data:ghostMarkers'] ?? [], Color.WHITE, 6, 'ghost');
    if (layers.witnessAnnotations) addPoints(datasets['data:witnessAnnotations'] ?? [], Color.LIME, 8, 'witness');
    if (layers.seekerNodes) addPoints(datasets['data:seekerNodes'] ?? [], Color.GOLD, 8, 'osint');
    if (layers.mcpNodes) addPoints(datasets['data:mcpNodes'] ?? [], Color.ORANGE, 6, 'mcp');
    if (layers.liquidityHeatmap) addPoints(recent(datasets['data:liquidityHeatmap'] ?? []), Color.ORANGERED, 6, 'liquidity');
    if (layers.seismicWindows) addPoints(recent(datasets['data:seismicWindows'] ?? []), Color.fromCssColorString('#00e5ff'), 6, 'seismic');
    if (layers.highEntropyNodes) addPoints(datasets['data:highEntropyNodes'] ?? [], Color.MAGENTA, 8, 'entropy');
    if (layers.threatMap) addVolumetricEdges(datasets['data:threatArcs'] ?? [], Color.fromCssColorString('#ff3131'));
    if (layers.resonanceLinks) addVolumetricEdges(datasets['data:resonanceLinks'] ?? [], Color.GOLD);
  }, [datasets, layers, cut]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#02110b]">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute left-3 bottom-3 z-[1000] text-xs text-emerald-300 bg-black/70 border border-emerald-600/50 p-2 rounded">HORUS SIS ONLINE · Cesium offline canvas (localhost tile server only).</div>
    </div>
  );
};

export default GlobeViewer;

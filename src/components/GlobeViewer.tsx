import React, { useEffect, useMemo, useRef } from 'react';
import {
  ArcType,
  Cartesian3,
  Color,
  Entity,
  HeightReference,
  Ion,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
} from 'cesium';
import { SynapticTrack, useWorldViewStore } from '../store';

const LOCAL_TILE_URL = 'http://localhost:8000/tiles/{z}/{x}/{reverseY}.png';

type PointLayerSpec = {
  stream: keyof ReturnType<typeof useWorldViewStore.getState>['synapticFeed'];
  enabled: boolean;
  color: Color;
  pixelSize: number;
  kind: string;
  temporal?: boolean;
};

type EdgeLayerSpec = {
  stream: keyof ReturnType<typeof useWorldViewStore.getState>['synapticFeed'];
  enabled: boolean;
  color: Color;
};

const GlobeViewer = () => {
  const { layers, temporalHours, synapticFeed, setPendingWitnessPoint, setSelectedEntity } = useWorldViewStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const streamEntitiesRef = useRef<Map<string, Set<string>>>(new Map());

  const cut = useMemo(() => Date.now() - temporalHours * 3600 * 1000, [temporalHours]);
  const recent = (arr: SynapticTrack[]) => arr.filter((x) => !x.ts || x.ts >= cut);

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
      streamEntitiesRef.current.clear();
    };
  }, [setPendingWitnessPoint, setSelectedEntity]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const pointLayers: PointLayerSpec[] = [
      { stream: 'data:conflictZones', enabled: layers.conflictZones, color: Color.RED, pixelSize: 8, kind: 'conflict', temporal: true },
      { stream: 'data:breaches', enabled: layers.breachLocator, color: Color.GOLD, pixelSize: 8, kind: 'breach' },
      { stream: 'data:rfNodes', enabled: layers.rfNodes, color: Color.CYAN, pixelSize: 6, kind: 'rf', temporal: true },
      { stream: 'data:vessels', enabled: layers.maritime, color: Color.fromCssColorString('#00bcd4'), pixelSize: 6, kind: 'maritime', temporal: true },
      { stream: 'data:cyberThreats', enabled: layers.cyberThreats, color: Color.fromCssColorString('#ff3131'), pixelSize: 6, kind: 'shodan', temporal: true },
      { stream: 'data:wardriving', enabled: layers.signalFog, color: Color.LIME, pixelSize: 5, kind: 'signal' },
      { stream: 'data:ghostMarkers', enabled: layers.ghostMarkers, color: Color.WHITE, pixelSize: 6, kind: 'ghost' },
      { stream: 'data:witnessAnnotations', enabled: layers.witnessAnnotations, color: Color.LIME, pixelSize: 8, kind: 'witness' },
      { stream: 'data:seekerNodes', enabled: layers.seekerNodes, color: Color.GOLD, pixelSize: 8, kind: 'osint' },
      { stream: 'data:mcpNodes', enabled: layers.mcpNodes, color: Color.ORANGE, pixelSize: 6, kind: 'mcp' },
      { stream: 'data:liquidityHeatmap', enabled: layers.liquidityHeatmap, color: Color.ORANGERED, pixelSize: 6, kind: 'liquidity', temporal: true },
      { stream: 'data:seismicWindows', enabled: layers.seismicWindows, color: Color.fromCssColorString('#00e5ff'), pixelSize: 6, kind: 'seismic', temporal: true },
      { stream: 'data:highEntropyNodes', enabled: layers.highEntropyNodes, color: Color.MAGENTA, pixelSize: 8, kind: 'entropy' },
    ];



    const deriveCausalVectors = () => {
      const points: SynapticTrack[] = [
        ...synapticFeed['data:cyberThreats'],
        ...synapticFeed['data:seekerNodes'],
        ...synapticFeed['data:mcpNodes'],
      ].filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon));

      const byLink = new Map<string, SynapticTrack[]>();
      points.forEach((p) => {
        const ip = typeof p.ip === 'string' ? p.ip : undefined;
        const ts = typeof p.ts === 'number' ? String(Math.floor(p.ts / 60000)) : undefined;
        [ip, ts].filter(Boolean).forEach((k) => {
          const arr = byLink.get(k as string) ?? [];
          arr.push(p);
          byLink.set(k as string, arr);
        });
      });

      const vectors: Array<{ id: string; from: SynapticTrack; to: SynapticTrack }> = [];
      byLink.forEach((arr, key) => {
        if (arr.length < 2) return;
        for (let i = 1; i < arr.length; i += 1) {
          vectors.push({ id: `causal-${key}-${arr[0].id}-${arr[i].id}`, from: arr[0], to: arr[i] });
        }
      });
      return vectors.slice(0, 400);
    };

    const edgeLayers: EdgeLayerSpec[] = [
      { stream: 'data:threatArcs', enabled: layers.threatMap, color: Color.fromCssColorString('#ff3131') },
      { stream: 'data:resonanceLinks', enabled: layers.resonanceLinks, color: Color.GOLD },
    ];

    const reconcileSet = (streamName: string, nextIds: Set<string>) => {
      const previous = streamEntitiesRef.current.get(streamName) ?? new Set<string>();
      previous.forEach((id) => {
        if (!nextIds.has(id)) {
          viewer.entities.removeById(id);
        }
      });
      streamEntitiesRef.current.set(streamName, nextIds);
    };

    pointLayers.forEach((layer) => {
      const streamName = layer.stream;
      if (!layer.enabled) {
        reconcileSet(streamName, new Set());
        return;
      }

      const source = layer.temporal ? recent(synapticFeed[streamName]) : synapticFeed[streamName];
      const nextIds = new Set<string>();
      source.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon)).forEach((d) => {
        const id = `${streamName}:${d.id}`;
        nextIds.add(id);
        const entity = viewer.entities.getById(id) as Entity | undefined;
        const position = Cartesian3.fromDegrees(d.lon as number, d.lat as number, 15000);
        if (!entity) {
          viewer.entities.add({
            id,
            position,
            point: {
              color: layer.color,
              pixelSize: layer.pixelSize,
              outlineColor: Color.BLACK,
              outlineWidth: 1,
              heightReference: HeightReference.NONE,
            },
            properties: { ...d, kind: layer.kind, lat: d.lat, lon: d.lon },
          });
        } else {
          viewer.entities.removeById(id);
          viewer.entities.add({
            id,
            position,
            point: {
              color: layer.color,
              pixelSize: layer.pixelSize,
              outlineColor: Color.BLACK,
              outlineWidth: 1,
              heightReference: HeightReference.NONE,
            },
            properties: { ...d, kind: layer.kind, lat: d.lat, lon: d.lon },
          });
        }
      });
      reconcileSet(streamName, nextIds);
    });

    edgeLayers.forEach((layer) => {
      const streamName = layer.stream;
      if (!layer.enabled) {
        reconcileSet(streamName, new Set());
        return;
      }
      const nextIds = new Set<string>();
      synapticFeed[streamName].forEach((a) => {
        if (!a.from || !a.to) return;
        const id = `${streamName}:${a.id}`;
        nextIds.add(id);
        const entity = viewer.entities.getById(id) as Entity | undefined;
        const positions = Cartesian3.fromDegreesArrayHeights([
          a.from.lon, a.from.lat, 12000,
          (a.from.lon + a.to.lon) / 2, (a.from.lat + a.to.lat) / 2, 300000,
          a.to.lon, a.to.lat, 12000,
        ]);
        if (!entity) {
          viewer.entities.add({
            id,
            polyline: { positions, width: 2, material: layer.color.withAlpha(0.9), arcType: ArcType.NONE },
          });
        } else {
          viewer.entities.removeById(id);
          viewer.entities.add({
            id,
            polyline: { positions, width: 2, material: layer.color.withAlpha(0.9), arcType: ArcType.NONE },
          });
        }
      });
      reconcileSet(streamName, nextIds);
    });

    const causalNext = new Set<string>();
    deriveCausalVectors().forEach((v) => {
      const id = `data:causalVectors:${v.id}`;
      causalNext.add(id);
      const positions = Cartesian3.fromDegreesArrayHeights([
        v.from.lon as number, v.from.lat as number, 10000,
        ((v.from.lon as number) + (v.to.lon as number)) / 2, ((v.from.lat as number) + (v.to.lat as number)) / 2, 180000,
        v.to.lon as number, v.to.lat as number, 10000,
      ]);
      if (!viewer.entities.getById(id)) {
        viewer.entities.add({
          id,
          polyline: { positions, width: 1.5, material: Color.fromCssColorString('#FFD700').withAlpha(0.75), arcType: ArcType.NONE },
        });
      }
    });
    reconcileSet('data:causalVectors', causalNext);

  }, [synapticFeed, layers, cut]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#02110b]">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute left-3 bottom-3 z-[1000] text-xs text-emerald-300 bg-black/70 border border-emerald-600/50 p-2 rounded">HORUS SIS ONLINE · Differential Synaptic updates active.</div>
    </div>
  );
};

export default GlobeViewer;

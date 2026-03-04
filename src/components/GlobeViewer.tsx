import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Viewer, Entity, PointGraphics, PolylineGraphics, Cesium3DTileset, ImageryLayer, useCesium } from 'resium';
import { Cartesian3, Color, UrlTemplateImageryProvider, PointPrimitiveCollection, LabelCollection, ScreenSpaceEventHandler, ScreenSpaceEventType, PostProcessStage, PostProcessStageComposite } from 'cesium';
import React, { useEffect, useRef, useState } from 'react';
import { Viewer, Entity, PointGraphics, LabelGraphics, PolylineGraphics, Cesium3DTileset, ImageryLayer, useCesium } from 'resium';
import { Cartesian3, Color, createOsmBuildingsAsync, UrlTemplateImageryProvider, PointPrimitiveCollection, LabelCollection, ScreenSpaceEventHandler, ScreenSpaceEventType, PostProcessStage, PostProcessStageComposite } from 'cesium';
import { io } from 'socket.io-client';
import { useWorldViewStore } from '../store';

type Track = { id: string; lon: number; lat: number; alt?: number; callsign?: string; name?: string; mag?: number; type?: string; [k: string]: any };

interface PrimitiveLayerProps {
  data: Track[];
  show: boolean;
  idPrefix: string;
  color: Color | ((item: Track) => Color);
  pixelSize: number | ((item: Track, highAlt: boolean) => number);
  label?: string | ((item: Track) => string);
  highAlt: boolean;
  forceCluster: boolean;
}

const PrimitiveLayer = ({ data, show, idPrefix, color, pixelSize, label, highAlt, forceCluster }: PrimitiveLayerProps) => {
  const { viewer } = useCesium();
  const pointsRef = useRef<PointPrimitiveCollection | null>(null);
  const labelsRef = useRef<LabelCollection | null>(null);
  const primitiveMap = useRef<Map<string, any>>(new Map());
  const labelMap = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!viewer) return;
    const points = new PointPrimitiveCollection();
    const labels = new LabelCollection();
    pointsRef.current = viewer.scene.primitives.add(points);
    labelsRef.current = viewer.scene.primitives.add(labels);
    return () => {
      if (!viewer.isDestroyed()) {
        if (pointsRef.current) viewer.scene.primitives.remove(pointsRef.current);
        if (labelsRef.current) viewer.scene.primitives.remove(labelsRef.current);
      }
    };
  }, [viewer]);

  const drawData = useMemo(() => {
    if (!forceCluster && !highAlt) return data;
    const step = forceCluster ? 6 : 2;
    return data.filter((_, i) => i % step === 0);
  }, [data, forceCluster, highAlt]);

  useEffect(() => {
    if (!pointsRef.current || !labelsRef.current) return;
    pointsRef.current.show = show;
    labelsRef.current.show = show;
    if (!show) return;

    const currentIds = new Set<string>();
    drawData.forEach((item) => {
      const id = `${idPrefix}_${item.id}`;
      currentIds.add(id);
      const position = Cartesian3.fromDegrees(item.lon, item.lat, item.alt || 0);
      const c = typeof color === 'function' ? color(item) : color;
      const s = typeof pixelSize === 'function' ? pixelSize(item, highAlt) : pixelSize;

      if (primitiveMap.current.has(id)) {
        const p = primitiveMap.current.get(id);
        p.position = position;
        p.color = c;
        p.pixelSize = s;
      } else {
        const p = pointsRef.current!.add({ position, color: c, pixelSize: s, outlineColor: Color.BLACK, outlineWidth: 1, id: { ...item, _type: idPrefix } });
        primitiveMap.current.set(id, p);
      }

      const labelText = highAlt ? null : (typeof label === 'function' ? label(item) : (label ? (item as any)[label] : null));
      if (labelText) {
        if (labelMap.current.has(id)) {
          const l = labelMap.current.get(id);
          l.position = position;
          l.text = labelText;
          l.fillColor = c;
        } else {
          const l = labelsRef.current!.add({ position, text: labelText, font: '10px monospace', fillColor: c, pixelOffset: new Cartesian3(0, -15, 0), id: { ...item, _type: idPrefix } });
          labelMap.current.set(id, l);
        }
      }
    });

    for (const [id, p] of primitiveMap.current.entries()) {
      if (!currentIds.has(id)) {
        pointsRef.current.remove(p);
        primitiveMap.current.delete(id);
      }
    }
    for (const [id, l] of labelMap.current.entries()) {
      if (!currentIds.has(id) || highAlt) {
        labelsRef.current.remove(l);
        labelMap.current.delete(id);
      }
    }
  }, [show, drawData, idPrefix, color, pixelSize, label, highAlt]);

  return null;
};

const GlobeViewer = () => {
  const { layers, visualMode, crtEnabled, postFx, selectedEntity, setSelectedEntity, performance: perfState, setPerformance } = useWorldViewStore();
  const [aircraftData, setAircraftData] = useState<Track[]>([]);
  const [militaryFlightsData, setMilitaryFlightsData] = useState<Track[]>([]);
  const [satelliteData, setSatelliteData] = useState<Track[]>([]);
  const [earthquakeData, setEarthquakeData] = useState<Track[]>([]);
  const { layers, visualMode, crtEnabled, postFx, selectedEntity, setSelectedEntity } = useWorldViewStore();
  const [aircraftData, setAircraftData] = useState<any[]>([]);
  const [militaryFlightsData, setMilitaryFlightsData] = useState<any[]>([]);
  const [satelliteData, setSatelliteData] = useState<any[]>([]);
  const [earthquakeData, setEarthquakeData] = useState<any[]>([]);
  const [marineTrafficData, setMarineTrafficData] = useState<any[]>([]);
  const [submarineCablesData, setSubmarineCablesData] = useState<any[]>([]);
  const [wildfiresData, setWildfiresData] = useState<any[]>([]);
  const [newsHeatmapData, setNewsHeatmapData] = useState<any[]>([]);
  const [powerGridData, setPowerGridData] = useState<any[]>([]);
  const [dataCentersData, setDataCentersData] = useState<any[]>([]);
  const [cctvMeshData, setCctvMeshData] = useState<any[]>([]);
  const [magnetosphereData, setMagnetosphereData] = useState<any[]>([]);
  const [weatherRadarData, setWeatherRadarData] = useState<any[]>([]);
  const [streetTrafficData, setStreetTrafficData] = useState<any[]>([]);
  const [bikeshareData, setBikeshareData] = useState<any[]>([]);
  const [poisData, setPoisData] = useState<any[]>([]);
  const [internetDevicesData, setInternetDevicesData] = useState<any[]>([]);
  const [wigleWifiData, setWigleWifiData] = useState<any[]>([]);
  const [snapchatMapsData, setSnapchatMapsData] = useState<any[]>([]);
  const [pokemonGoData, setPokemonGoData] = useState<any[]>([]);
  
  const [osmBuildings, setOsmBuildings] = useState<any>(null);
  const [currentCoords, setCurrentCoords] = useState({ lat: 0, lon: 0, alt: 0 });
  const [weatherProvider, setWeatherProvider] = useState<any>(null);
  const [currentCoords, setCurrentCoords] = useState({ lat: 0, lon: 0, alt: 0 });
  const viewerRef = useRef<any>(null);
  const postFxRef = useRef<PostProcessStageComposite | null>(null);
  const historyRef = useRef<Record<string, number[]>>({});
  const postFxRef = useRef<PostProcessStageComposite | null>(null);

  const entityCount = aircraftData.length + militaryFlightsData.length + satelliteData.length + earthquakeData.length;
  const highAltitude = currentCoords.alt > 600000;
  const canLoad3dContext = perfState.context3dRequested && currentCoords.alt < 5000 && !perfState.forceFastMode && !!import.meta.env.VITE_GOOGLE_3D_TILES_API_KEY;

  useEffect(() => {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((res) => res.json())
      .then((data) => {
        if (data?.radar?.past?.length) {
          const latest = data.radar.past[data.radar.past.length - 1].path;
          setWeatherProvider(new UrlTemplateImageryProvider({ url: `https://tilecache.rainviewer.com${latest}/256/{z}/{x}/{y}/2/1_1.png`, credit: 'RainViewer' }));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const socket = io();
    const updateHistory = (data: Track[], type: string, maxLen = 18) => {
      data.forEach((item) => {
        const key = `${type}_${item.id}`;
        if (!historyRef.current[key]) historyRef.current[key] = [];
        historyRef.current[key].push(item.lon, item.lat, item.alt || 0);
        if (historyRef.current[key].length > maxLen * 3) historyRef.current[key].splice(0, historyRef.current[key].length - maxLen * 3);
      });
    };

    socket.on('data:aircraft', (data) => { updateHistory(data, 'ac', 15); setAircraftData(data); });
    socket.on('data:militaryFlights', (data) => { updateHistory(data, 'mil', 15); setMilitaryFlightsData(data); });
    socket.on('data:satellites', (data) => { updateHistory(data, 'sat', 25); setSatelliteData(data); });
    socket.on('data:earthquakes', setEarthquakeData);
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!viewerRef.current?.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;
    (window as any).__WORLDVIEW_VIEWER__ = viewer;
    (window as any).Cesium = { Cartesian3 };
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      (window as any).__WORLDVIEW_VIEWER__ = viewer;
      (window as any).Cesium = { Cartesian3 };

      createOsmBuildingsAsync().then((tileset) => {
        viewer.scene.primitives.add(tileset);
      });

    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;

    viewer.camera.changed.addEventListener(() => {
      const position = viewer.camera.positionCartographic;
      setCurrentCoords({ lat: (position.latitude * 180) / Math.PI, lon: (position.longitude * 180) / Math.PI, alt: position.height });
    });
  }, []);

  useEffect(() => {
    let frames = 0;
    let start = performance.now();
    let raf = 0;
    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - start >= 1000) {
        const fps = (frames * 1000) / (now - start);
        setPerformance({ fps, entityCount });
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [entityCount, setPerformance]);

  useEffect(() => {
    const mustFast = perfState.replayMode || perfState.fps < 30;
    const mustCluster = entityCount > 10000;
    if (mustFast !== perfState.forceFastMode || mustCluster !== perfState.forceClustering) {
      setPerformance({ forceFastMode: mustFast || perfState.forceFastMode, forceClustering: mustCluster || perfState.forceClustering, entityCount });
    }
  }, [entityCount, perfState.fps, perfState.replayMode]);

  useEffect(() => {
    if (!viewerRef.current?.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;
    const tactical = new PostProcessStage({
      name: 'worldview-tactical',
      fragmentShader: `uniform sampler2D colorTexture;in vec2 v_textureCoordinates;uniform float pixelation;uniform float chromaticAberration;uniform float noiseAmount;void main(){vec2 uv=v_textureCoordinates;vec2 p=vec2(max(pixelation,0.001));uv=floor(uv/p)*p;vec2 shift=vec2(chromaticAberration,0.0);float r=texture(colorTexture,uv+shift).r;float g=texture(colorTexture,uv).g;float b=texture(colorTexture,uv-shift).b;float scan=sin(uv.y*1600.0)*0.05;float grain=fract(sin(dot(uv*czm_frameNumber,vec2(12.9898,78.233)))*43758.5453);out_FragColor=vec4(vec3(r,g,b)+scan+((grain-0.5)*noiseAmount),1.0);}`,
      uniforms: { pixelation: postFx.pixelation, chromaticAberration: postFx.chromaticAberration, noiseAmount: postFx.noise },
    });
    const nvg = new PostProcessStage({
      name: 'worldview-nvg',
      fragmentShader: `uniform sampler2D colorTexture;in vec2 v_textureCoordinates;uniform float noiseAmount;void main(){vec3 base=texture(colorTexture,v_textureCoordinates).rgb;float l=dot(base,vec3(0.299,0.587,0.114));float grain=fract(sin(dot(v_textureCoordinates*czm_frameNumber,vec2(91.7,12.4)))*43758.5453);out_FragColor=vec4(vec3(0.04,0.95,0.2)*l*1.45+vec3((grain-0.5)*noiseAmount),1.0);}`,
      uniforms: { noiseAmount: postFx.noise },
    });
    const thermal = new PostProcessStage({
      name: 'worldview-thermal',
      fragmentShader: `uniform sampler2D colorTexture;in vec2 v_textureCoordinates;vec3 ramp(float t){return mix(vec3(0.0,0.0,0.25),vec3(0.0,1.0,1.0),smoothstep(0.0,0.35,t))+mix(vec3(0.0),vec3(1.0,0.95,0.0),smoothstep(0.35,0.7,t))+mix(vec3(0.0),vec3(1.0,0.25,0.0),smoothstep(0.7,1.0,t));}void main(){vec3 c=texture(colorTexture,v_textureCoordinates).rgb;float heat=dot(c,vec3(0.2126,0.7152,0.0722));out_FragColor=vec4(ramp(heat),1.0);}`,
    });
    const composite = new PostProcessStageComposite({ name: 'worldview-postfx', stages: [tactical, nvg, thermal], inputPreviousStageTexture: true, uniforms: {} });
    nvg.enabled = false;
    thermal.enabled = false;
    postFxRef.current = viewer.scene.postProcessStages.add(composite);
    return () => {
      if (postFxRef.current && !viewer.isDestroyed()) viewer.scene.postProcessStages.remove(postFxRef.current);
      postFxRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!postFxRef.current) return;
    const [tactical, nvg] = postFxRef.current.stages as PostProcessStage[];
    tactical.uniforms.pixelation = postFx.pixelation;
    tactical.uniforms.chromaticAberration = postFx.chromaticAberration;
    tactical.uniforms.noiseAmount = postFx.noise;
    nvg.uniforms.noiseAmount = postFx.noise;
  }, [postFx]);

  useEffect(() => {
    if (!viewerRef.current?.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;
    viewer.scene.backgroundColor = visualMode === 'night-vision' ? Color.fromCssColorString('#031205') : visualMode === 'thermal' ? Color.fromCssColorString('#220606') : Color.BLACK;
    viewer.scene.globe.baseColor = perfState.forceFastMode ? Color.fromCssColorString('#031421') : Color.fromCssColorString('#021629');
    if (postFxRef.current) {
      const [tactical, nvg, thermal] = postFxRef.current.stages as PostProcessStage[];
      tactical.enabled = crtEnabled;
      nvg.enabled = visualMode === 'night-vision';
      thermal.enabled = visualMode === 'thermal';
    }
  }, [visualMode, crtEnabled, perfState.forceFastMode]);
  useEffect(() => {
    if (!viewerRef.current?.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;

    const tacticalStage = new PostProcessStage({
      name: 'worldview-tactical',
      fragmentShader: `uniform sampler2D colorTexture;\n      in vec2 v_textureCoordinates;\n      uniform float pixelation;\n      uniform float chromaticAberration;\n      uniform float noiseAmount;\n      void main() {\n        vec2 uv = v_textureCoordinates;\n        vec2 p = vec2(max(pixelation, 0.001));\n        uv = floor(uv / p) * p;\n        vec2 shift = vec2(chromaticAberration, 0.0);\n        float r = texture(colorTexture, uv + shift).r;\n        float g = texture(colorTexture, uv).g;\n        float b = texture(colorTexture, uv - shift).b;\n        float scan = sin(uv.y * 1600.0) * 0.05;\n        float grain = fract(sin(dot(uv * czm_frameNumber, vec2(12.9898, 78.233))) * 43758.5453);\n        vec3 col = vec3(r, g, b) + scan + ((grain - 0.5) * noiseAmount);\n        out_FragColor = vec4(col, 1.0);\n      }`,
      uniforms: {
        pixelation: postFx.pixelation,
        chromaticAberration: postFx.chromaticAberration,
        noiseAmount: postFx.noise,
      },
    });

    const nvgStage = new PostProcessStage({
      name: 'worldview-nvg',
      fragmentShader: `uniform sampler2D colorTexture;\n      in vec2 v_textureCoordinates;\n      uniform float noiseAmount;\n      void main(){\n        vec4 base = texture(colorTexture, v_textureCoordinates);\n        float luma = dot(base.rgb, vec3(0.299,0.587,0.114));\n        float grain = fract(sin(dot(v_textureCoordinates * czm_frameNumber, vec2(91.7, 12.4))) * 43758.5453);\n        vec3 nvg = vec3(0.04, 0.95, 0.2) * luma * 1.45 + vec3((grain - 0.5) * noiseAmount);\n        out_FragColor = vec4(nvg, 1.0);\n      }`,
      uniforms: { noiseAmount: postFx.noise },
    });

    const thermalStage = new PostProcessStage({
      name: 'worldview-thermal',
      fragmentShader: `uniform sampler2D colorTexture;\n      in vec2 v_textureCoordinates;\n      vec3 ramp(float t){\n        return mix(vec3(0.0,0.0,0.25), vec3(0.0,1.0,1.0), smoothstep(0.0,0.35,t))\n             + mix(vec3(0.0), vec3(1.0,0.95,0.0), smoothstep(0.35,0.7,t))\n             + mix(vec3(0.0), vec3(1.0,0.25,0.0), smoothstep(0.7,1.0,t));\n      }\n      void main(){\n        vec3 c = texture(colorTexture, v_textureCoordinates).rgb;\n        float heat = dot(c, vec3(0.2126,0.7152,0.0722));\n        out_FragColor = vec4(ramp(heat), 1.0);\n      }`,
    });

    const composite = new PostProcessStageComposite({
      name: 'worldview-postfx',
      stages: [tacticalStage, nvgStage, thermalStage],
      inputPreviousStageTexture: true,
      uniforms: {},
    });

    nvgStage.enabled = false;
    thermalStage.enabled = false;

    postFxRef.current = viewer.scene.postProcessStages.add(composite);

    return () => {
      if (postFxRef.current && !viewer.isDestroyed()) {
        viewer.scene.postProcessStages.remove(postFxRef.current);
      }
      postFxRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!postFxRef.current) return;
    const [tactical, nvg] = postFxRef.current.stages as PostProcessStage[];
    tactical.uniforms.pixelation = postFx.pixelation;
    tactical.uniforms.chromaticAberration = postFx.chromaticAberration;
    tactical.uniforms.noiseAmount = postFx.noise;
    nvg.uniforms.noiseAmount = postFx.noise;
  }, [postFx]);

  // Apply visual modes
  useEffect(() => {
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      if (visualMode === 'night-vision') {
        viewer.scene.backgroundColor = Color.fromCssColorString('#031205');
        viewer.scene.globe.baseColor = Color.fromCssColorString('#031205');
      } else if (visualMode === 'thermal') {
        viewer.scene.backgroundColor = Color.fromCssColorString('#220606');
        viewer.scene.globe.baseColor = Color.fromCssColorString('#220606');
      } else {
        viewer.scene.backgroundColor = Color.BLACK;
        viewer.scene.globe.baseColor = Color.fromCssColorString('#021629');
      }

      if (postFxRef.current) {
        const [tactical, nvg, thermal] = postFxRef.current.stages as PostProcessStage[];
        tactical.enabled = crtEnabled;
        nvg.enabled = visualMode === 'night-vision';
        thermal.enabled = visualMode === 'thermal';
      }
    }
  }, [visualMode, crtEnabled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewerRef.current?.cesiumElement) return;
      const viewer = viewerRef.current.cesiumElement;
      const pois = {
        q: { lon: -77.0369, lat: 38.9072, alt: 2000 },
        w: { lon: 37.6173, lat: 55.7558, alt: 2000 },
        e: { lon: 116.4074, lat: 39.9042, alt: 2000 },
        r: { lon: 34.7818, lat: 32.0853, alt: 2000 },
        t: { lon: 30.5234, lat: 50.4501, alt: 2000 },
      } as Record<string, { lon: number; lat: number; alt: number }>;
      const poi = pois[e.key.toLowerCase()];
      if (poi) viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(poi.lon, poi.lat, poi.alt), duration: 2 });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!viewerRef.current?.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.position);
      if (picked?.id?._type) setSelectedEntity(picked.id);
      else if (!picked) setSelectedEntity(null);
    }, ScreenSpaceEventType.LEFT_CLICK);
    return () => handler.destroy();
  }, [setSelectedEntity]);

  return (
    <div className={`w-full h-full relative ${visualMode === 'night-vision' ? 'nvg-mode' : ''} ${visualMode === 'thermal' ? 'thermal-mode' : ''}`}>
      <Viewer full ref={viewerRef} timeline={false} animation={false} baseLayerPicker={false} geocoder={false} homeButton={false} infoBox={false} sceneModePicker={false} selectionIndicator={false} navigationHelpButton={false} navigationInstructionsInitiallyVisible={false}>
        {canLoad3dContext ? <Cesium3DTileset url={`https://tile.googleapis.com/v1/3dtiles/root.json?key=${import.meta.env.VITE_GOOGLE_3D_TILES_API_KEY}`} /> : null}
        {layers.aircraft && <PrimitiveLayer data={aircraftData} show idPrefix="ac" color={Color.ORANGE} pixelSize={(_, high) => (high ? 4 : 8)} label="callsign" highAlt={highAltitude} forceCluster={perfState.forceClustering} />}
        {layers.militaryFlights && <PrimitiveLayer data={militaryFlightsData} show idPrefix="mil" color={Color.fromCssColorString('#ff7a00')} pixelSize={(_, high) => (high ? 4 : 8)} label="callsign" highAlt={highAltitude} forceCluster={perfState.forceClustering} />}
        {layers.satellites && <PrimitiveLayer data={satelliteData} show idPrefix="sat" color={Color.fromCssColorString('#BC13FE')} pixelSize={(_, high) => (high ? 3 : 6)} label="name" highAlt={highAltitude} forceCluster={perfState.forceClustering} />}
        {layers.earthquakes && <PrimitiveLayer data={earthquakeData} show idPrefix="eq" color={Color.RED.withAlpha(0.8)} pixelSize={(eq, high) => (high ? 4 : Math.max(5, (eq.mag || 1) * 2))} label={(eq) => `M${(eq.mag || 0).toFixed(1)}`} highAlt={highAltitude} forceCluster={perfState.forceClustering} />}

        {selectedEntity ? (
          <Entity id={`selected_${selectedEntity.id}`} position={Cartesian3.fromDegrees(selectedEntity.lon, selectedEntity.lat, selectedEntity.alt || 0)}>
      <Viewer
        full
        ref={viewerRef}
        timeline={false}
        animation={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        selectionIndicator={false}
        navigationHelpButton={false}
        navigationInstructionsInitiallyVisible={false}
        onClick={(e, target) => {
          if (!target) {
            setSelectedEntity(null);
          }
        }}
      >
        {import.meta.env.VITE_GOOGLE_3D_TILES_API_KEY ? (
          <Cesium3DTileset url={`https://tile.googleapis.com/v1/3dtiles/root.json?key=${import.meta.env.VITE_GOOGLE_3D_TILES_API_KEY}`} />
        ) : null}

        <PrimitiveLayer data={aircraftData} show={layers.aircraft} idPrefix="ac" color={Color.ORANGE} pixelSize={8} label="callsign" />
        <PrimitiveLayer data={militaryFlightsData} show={layers.militaryFlights} idPrefix="mil" color={Color.fromCssColorString('#ff7a00')} pixelSize={8} label="callsign" />
        <PrimitiveLayer data={satelliteData} show={layers.satellites} idPrefix="sat" color={Color.fromCssColorString('#BC13FE')} pixelSize={6} label="name" />
        <PrimitiveLayer data={earthquakeData} show={layers.earthquakes} idPrefix="eq" color={Color.RED.withAlpha(0.7)} pixelSize={(eq) => Math.max(5, eq.mag * 3)} label={(eq) => `M${eq.mag.toFixed(1)}`} />
        <PrimitiveLayer data={marineTrafficData} show={layers.marineTraffic} idPrefix="ship" color={Color.BLUE} pixelSize={6} label="name" />
        <PrimitiveLayer data={dataCentersData} show={layers.dataCenters} idPrefix="dc" color={Color.PURPLE} pixelSize={12} label="name" />
        <PrimitiveLayer data={wildfiresData} show={layers.wildfires} idPrefix="fire" color={Color.ORANGERED.withAlpha(0.8)} pixelSize={(fire) => fire.intensity / 5} label={() => "FIRE"} />
        <PrimitiveLayer data={newsHeatmapData} show={layers.newsHeatmap} idPrefix="news" color={(news) => news.sentiment === 'positive' ? Color.GREEN.withAlpha(0.6) : Color.RED.withAlpha(0.6)} pixelSize={(news) => news.intensity * 2} label={() => "NEWS EVENT"} />
        <PrimitiveLayer data={powerGridData} show={layers.powerGrid} idPrefix="grid" color={(grid) => grid.status === 'stable' ? Color.LIME : Color.YELLOW} pixelSize={15} label={(grid) => `${grid.name} (${grid.status.toUpperCase()})`} />
        <PrimitiveLayer data={cctvMeshData} show={layers.cctvMesh} idPrefix="cctv" color={(cctv) => cctv.status === 'Live' ? Color.DODGERBLUE : Color.GRAY} pixelSize={5} />
        <PrimitiveLayer data={magnetosphereData} show={layers.magnetosphere} idPrefix="mag" color={Color.CYAN.withAlpha(0.5)} pixelSize={(mag) => mag.kpIndex * 2} />
        <PrimitiveLayer data={streetTrafficData} show={layers.streetTraffic} idPrefix="traffic" color={(t) => t.flowSpeed > 80 ? Color.GREEN : t.flowSpeed > 40 ? Color.YELLOW : Color.RED} pixelSize={6} />
        <PrimitiveLayer data={bikeshareData} show={layers.bikeshare} idPrefix="bike" color={Color.LIMEGREEN} pixelSize={5} />
        <PrimitiveLayer data={poisData} show={layers.pois} idPrefix="poi" color={Color.ROYALBLUE} pixelSize={6} />
        <PrimitiveLayer data={internetDevicesData} show={layers.internetDevices} idPrefix="device" color={Color.GOLD} pixelSize={4} />
        <PrimitiveLayer data={wigleWifiData} show={layers.wigleWifi} idPrefix="wifi" color={Color.MAGENTA.withAlpha(0.6)} pixelSize={(w) => Math.max(2, (100 + w.signalStrength) / 10)} />
        <PrimitiveLayer data={snapchatMapsData} show={layers.snapchatMaps} idPrefix="snap" color={Color.ORANGE.withAlpha(0.7)} pixelSize={(s) => s.heatIndex / 5} />
        <PrimitiveLayer data={pokemonGoData} show={layers.pokemonGo} idPrefix="pogo" color={Color.HOTPINK} pixelSize={6} />

        {/* Submarine Cables (Polylines) */}
        {layers.submarineCables &&
          submarineCablesData.map((cable) => {
            const positions = cable.positions.flatMap((p: any) => [p.lon, p.lat, 0]);
            return (
              <Entity
                key={cable.id}
                id={cable.id}
                name={cable.name}
              >
                <PolylineGraphics
                  positions={Cartesian3.fromDegreesArrayHeights(positions)}
                  width={2}
                  material={Color.CYAN.withAlpha(0.5)}
                />
              </Entity>
            );
          })}

        {/* Selected Entity Trail & Highlight */}
        {selectedEntity && (
          <Entity
            id={`selected_${selectedEntity.id}`}
            position={Cartesian3.fromDegrees(selectedEntity.lon, selectedEntity.lat, selectedEntity.alt || 0)}
          >
            <PointGraphics pixelSize={12} color={Color.TRANSPARENT} outlineColor={Color.WHITE} outlineWidth={2} />
            {(() => {
              const histKey = Object.keys(historyRef.current).find((k) => k.endsWith(`_${selectedEntity.id}`));
              const hist = histKey ? historyRef.current[histKey] : null;
              if (!hist || hist.length < 6) return null;
              return <PolylineGraphics positions={Cartesian3.fromDegreesArrayHeights(hist)} width={2} material={Color.WHITE.withAlpha(0.45)} />;
            })()}
          </Entity>
        ) : null}

        {layers.weatherRadar && weatherProvider ? <ImageryLayer imageryProvider={weatherProvider} alpha={0.5} /> : null}
      </Viewer>

      <div className="absolute top-4 right-4 bg-black/70 border border-green-900/50 p-2 text-[10px] uppercase tracking-widest text-green-400 rounded pointer-events-none z-10">
        <div>Mode: {perfState.forceFastMode ? 'FAST 2.5D' : 'ANALYST 3D'}</div>
        <div>FPS: {perfState.fps.toFixed(0)} | Entities: {entityCount}</div>
        <div>Clustering: {perfState.forceClustering ? 'ON' : 'AUTO/OFF'}</div>
        <div>Detection: {selectedEntity ? 'LOCKED' : 'SCANNING'}</div>
      </div>

        <div>Detection Mode: {selectedEntity ? 'LOCKED' : 'SCANNING'}</div>
        <div>Tracks: {aircraftData.length + satelliteData.length + militaryFlightsData.length}</div>
      </div>

      {/* Coordinate Display Overlay */}
      <div className="absolute bottom-4 left-4 bg-black/80 border border-green-900/50 p-2 text-xs font-mono text-green-500 rounded backdrop-blur-md pointer-events-none z-10">
        <div>LAT: {currentCoords.lat.toFixed(4)}°</div>
        <div>LON: {currentCoords.lon.toFixed(4)}°</div>
        <div>ALT: {(currentCoords.alt / 1000).toFixed(2)} km</div>
        <div>3D Context: {canLoad3dContext ? 'LOADED' : 'STANDBY'}</div>
      </div>
    </div>
  );
};

export default GlobeViewer;

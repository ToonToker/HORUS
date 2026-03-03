import React, { useEffect, useRef, useState } from 'react';
import { Viewer, Entity, PointGraphics, LabelGraphics, PolylineGraphics, Cesium3DTileset, ImageryLayer, useCesium } from 'resium';
import { Cartesian3, Color, createOsmBuildingsAsync, UrlTemplateImageryProvider, PointPrimitiveCollection, LabelCollection, ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium';
import { io } from 'socket.io-client';
import { useWorldViewStore } from '../store';

interface PrimitiveLayerProps {
  data: any[];
  show: boolean;
  idPrefix: string;
  color: Color | ((item: any) => Color);
  pixelSize: number | ((item: any) => number);
  label?: string | ((item: any) => string);
}

const PrimitiveLayer = ({ data, show, idPrefix, color, pixelSize, label }: PrimitiveLayerProps) => {
  const { viewer } = useCesium();
  const pointsRef = useRef<any>(null);
  const labelsRef = useRef<any>(null);
  const primitiveMap = useRef<Map<string, any>>(new Map());
  const labelMap = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!viewer) return;
    const points = new PointPrimitiveCollection();
    const labels = new LabelCollection();
    pointsRef.current = viewer.scene.primitives.add(points);
    labelsRef.current = viewer.scene.primitives.add(labels);

    return () => {
      if (!viewer.isDestroyed) {
        viewer.scene.primitives.remove(pointsRef.current);
        viewer.scene.primitives.remove(labelsRef.current);
      }
    };
  }, [viewer]);

  useEffect(() => {
    if (!pointsRef.current || !labelsRef.current) return;
    
    pointsRef.current.show = show;
    labelsRef.current.show = show;

    if (!show) return;

    const currentIds = new Set();

    data.forEach((item: any) => {
      const id = `${idPrefix}_${item.id}`;
      currentIds.add(id);
      const position = Cartesian3.fromDegrees(item.lon, item.lat, item.alt || 0);
      const c = typeof color === 'function' ? color(item) : color;
      const s = typeof pixelSize === 'function' ? pixelSize(item) : pixelSize;

      if (primitiveMap.current.has(id)) {
        const p = primitiveMap.current.get(id);
        p.position = position;
        p.color = c;
        p.pixelSize = s;
      } else {
        const p = pointsRef.current.add({
          position,
          color: c,
          pixelSize: s,
          outlineColor: Color.BLACK,
          outlineWidth: 1,
          id: { ...item, _type: idPrefix } // Store item for picking
        });
        primitiveMap.current.set(id, p);
      }

      const labelText = typeof label === 'function' ? label(item) : (label ? item[label] : null);
      if (labelText) {
         if (labelMap.current.has(id)) {
           const l = labelMap.current.get(id);
           l.position = position;
           l.text = labelText;
           l.fillColor = c;
         } else {
           const l = labelsRef.current.add({
             position,
             text: labelText,
             font: '10px monospace',
             fillColor: c,
             pixelOffset: new Cartesian3(0, -15, 0),
             id: { ...item, _type: idPrefix }
           });
           labelMap.current.set(id, l);
         }
      }
    });

    // Remove stale primitives
    for (const [id, p] of primitiveMap.current.entries()) {
      if (!currentIds.has(id)) {
        pointsRef.current.remove(p);
        primitiveMap.current.delete(id);
        if (labelMap.current.has(id)) {
          labelsRef.current.remove(labelMap.current.get(id));
          labelMap.current.delete(id);
        }
      }
    }
  }, [data, show, color, pixelSize, idPrefix, label]);

  return null;
};

const GlobeViewer = () => {
  const { layers, visualMode, crtEnabled, selectedEntity, setSelectedEntity } = useWorldViewStore();
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
  const viewerRef = useRef<any>(null);
  const historyRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
          const latest = data.radar.past[data.radar.past.length - 1].path;
          setWeatherProvider(new UrlTemplateImageryProvider({
            url: `https://tilecache.rainviewer.com${latest}/256/{z}/{x}/{y}/2/1_1.png`,
            credit: 'RainViewer'
          }));
        }
      })
      .catch(err => console.error("Failed to fetch weather radar", err));
  }, []);

  useEffect(() => {
    const socket = io();
    
    const updateHistory = (data: any[], type: string, maxLen: number = 20) => {
      data.forEach(item => {
        const key = `${type}_${item.id}`;
        if (!historyRef.current[key]) {
          historyRef.current[key] = [];
        }
        const hist = historyRef.current[key];
        
        // Avoid duplicate consecutive points
        if (hist.length >= 3) {
          const lastLon = hist[hist.length - 3];
          const lastLat = hist[hist.length - 2];
          const lastAlt = hist[hist.length - 1];
          if (lastLon === item.lon && lastLat === item.lat && lastAlt === (item.alt || 0)) {
            return;
          }
        }
        
        hist.push(item.lon, item.lat, item.alt || 0);
        if (hist.length > maxLen * 3) {
          hist.splice(0, hist.length - maxLen * 3);
        }
      });
    };

    socket.on('data:aircraft', (data) => {
      updateHistory(data, 'ac', 15);
      setAircraftData(data);
    });
    socket.on('data:militaryFlights', (data) => {
      updateHistory(data, 'mil', 20);
      setMilitaryFlightsData(data);
    });
    socket.on('data:satellites', (data) => {
      updateHistory(data, 'sat', 30);
      setSatelliteData(data);
    });
    socket.on('data:earthquakes', (data) => setEarthquakeData(data));
    socket.on('data:marineTraffic', (data) => setMarineTrafficData(data));
    socket.on('data:submarineCables', (data) => setSubmarineCablesData(data));
    socket.on('data:wildfires', (data) => setWildfiresData(data));
    socket.on('data:newsHeatmap', (data) => setNewsHeatmapData(data));
    socket.on('data:powerGrid', (data) => setPowerGridData(data));
    socket.on('data:dataCenters', (data) => setDataCentersData(data));
    socket.on('data:cctvMesh', (data) => setCctvMeshData(data));
    socket.on('data:magnetosphere', (data) => setMagnetosphereData(data));
    socket.on('data:weatherRadar', (data) => setWeatherRadarData(data));
    socket.on('data:streetTraffic', (data) => setStreetTrafficData(data));
    socket.on('data:bikeshare', (data) => setBikeshareData(data));
    socket.on('data:pois', (data) => setPoisData(data));
    socket.on('data:internetDevices', (data) => setInternetDevicesData(data));
    socket.on('data:wigleWifi', (data) => setWigleWifiData(data));
    socket.on('data:snapchatMaps', (data) => setSnapchatMapsData(data));
    socket.on('data:pokemonGo', (data) => setPokemonGoData(data));

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      createOsmBuildingsAsync().then((tileset) => {
        viewer.scene.primitives.add(tileset);
      });

      if (viewer.scene.postProcessStages) {
        viewer.scene.postProcessStages.bloom.enabled = true;
        viewer.scene.postProcessStages.bloom.uniforms.glowOnly = false;
        viewer.scene.postProcessStages.bloom.uniforms.contrast = 128;
        viewer.scene.postProcessStages.bloom.uniforms.brightness = -0.3;
        viewer.scene.postProcessStages.bloom.uniforms.delta = 1.0;
        viewer.scene.postProcessStages.bloom.uniforms.sigma = 2.0;
        viewer.scene.postProcessStages.bloom.uniforms.stepSize = 1.0;
      }

      viewer.camera.changed.addEventListener(() => {
        const position = viewer.camera.positionCartographic;
        setCurrentCoords({
          lat: (position.latitude * 180) / Math.PI,
          lon: (position.longitude * 180) / Math.PI,
          alt: position.height
        });
      });
    }
  }, []);

  // Apply visual modes
  useEffect(() => {
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      if (visualMode === 'night-vision') {
        viewer.scene.backgroundColor = Color.fromCssColorString('#0a2e0a');
        viewer.scene.globe.baseColor = Color.fromCssColorString('#0a2e0a');
      } else if (visualMode === 'thermal') {
        viewer.scene.backgroundColor = Color.fromCssColorString('#3a0a0a');
        viewer.scene.globe.baseColor = Color.fromCssColorString('#3a0a0a');
      } else {
        viewer.scene.backgroundColor = Color.BLACK;
        viewer.scene.globe.baseColor = Color.BLUE;
      }
    }
  }, [visualMode]);

  // Hotkeys for POI jumping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewerRef.current?.cesiumElement) return;
      const viewer = viewerRef.current.cesiumElement;
      
      const pois = {
        'q': { lon: -77.0369, lat: 38.9072, alt: 2000 }, // Washington DC
        'w': { lon: 37.6173, lat: 55.7558, alt: 2000 }, // Moscow
        'e': { lon: 116.4074, lat: 39.9042, alt: 2000 }, // Beijing
        'r': { lon: 34.7818, lat: 32.0853, alt: 2000 }, // Tel Aviv
        't': { lon: 30.5234, lat: 50.4501, alt: 2000 }, // Kyiv
      };

      const key = e.key.toLowerCase();
      if (pois[key as keyof typeof pois]) {
        const poi = pois[key as keyof typeof pois];
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(poi.lon, poi.lat, poi.alt),
          duration: 2.0
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Target Tracking
  useEffect(() => {
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      if (selectedEntity) {
        const entity = viewer.entities.getById(selectedEntity.id);
        if (entity && entity.position && viewer.trackedEntity !== entity) {
          viewer.trackedEntity = entity;
        } else if ((!entity || !entity.position) && viewer.trackedEntity !== undefined) {
          viewer.trackedEntity = undefined;
        }
      } else {
        if (viewer.trackedEntity !== undefined) {
          viewer.trackedEntity = undefined;
        }
      }
    }
  }, [selectedEntity, aircraftData, militaryFlightsData, satelliteData, earthquakeData, marineTrafficData, magnetosphereData, weatherRadarData, streetTrafficData, bikeshareData, poisData, internetDevicesData, wigleWifiData, snapchatMapsData, pokemonGoData]);

  // Setup click handler for primitives
  useEffect(() => {
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      
      handler.setInputAction((movement: any) => {
        const pickedObject = viewer.scene.pick(movement.position);
        if (pickedObject && pickedObject.id && pickedObject.id._type) {
          // It's our custom primitive
          setSelectedEntity(pickedObject.id);
        } else if (!pickedObject) {
          setSelectedEntity(null);
        }
      }, ScreenSpaceEventType.LEFT_CLICK);

      return () => {
        handler.destroy();
      };
    }
  }, [setSelectedEntity]);

  // Keep selectedEntity fresh
  useEffect(() => {
    if (selectedEntity) {
      let updatedEntity = null;
      switch (selectedEntity.type) {
        case 'aircraft': updatedEntity = aircraftData.find(e => e.id === selectedEntity.id); break;
        case 'militaryFlight': updatedEntity = militaryFlightsData.find(e => e.id === selectedEntity.id); break;
        case 'satellite': updatedEntity = satelliteData.find(e => e.id === selectedEntity.id); break;
        case 'earthquake': updatedEntity = earthquakeData.find(e => e.id === selectedEntity.id); break;
        case 'marineTraffic': updatedEntity = marineTrafficData.find(e => e.id === selectedEntity.id); break;
        case 'submarineCable': updatedEntity = submarineCablesData.find(e => e.id === selectedEntity.id); break;
        case 'wildfire': updatedEntity = wildfiresData.find(e => e.id === selectedEntity.id); break;
        case 'newsHeatmap': updatedEntity = newsHeatmapData.find(e => e.id === selectedEntity.id); break;
        case 'powerGrid': updatedEntity = powerGridData.find(e => e.id === selectedEntity.id); break;
        case 'dataCenter': updatedEntity = dataCentersData.find(e => e.id === selectedEntity.id); break;
        case 'cctvMesh': updatedEntity = cctvMeshData.find(e => e.id === selectedEntity.id); break;
        case 'magnetosphere': updatedEntity = magnetosphereData.find(e => e.id === selectedEntity.id); break;
        case 'weatherRadar': updatedEntity = weatherRadarData.find(e => e.id === selectedEntity.id); break;
        case 'streetTraffic': updatedEntity = streetTrafficData.find(e => e.id === selectedEntity.id); break;
        case 'bikeshare': updatedEntity = bikeshareData.find(e => e.id === selectedEntity.id); break;
        case 'poi': updatedEntity = poisData.find(e => e.id === selectedEntity.id); break;
        case 'internetDevice': updatedEntity = internetDevicesData.find(e => e.id === selectedEntity.id); break;
        case 'wigleWifi': updatedEntity = wigleWifiData.find(e => e.id === selectedEntity.id); break;
        case 'snapchatMap': updatedEntity = snapchatMapsData.find(e => e.id === selectedEntity.id); break;
        case 'pokemonGo': updatedEntity = pokemonGoData.find(e => e.id === selectedEntity.id); break;
      }
      if (updatedEntity && updatedEntity !== selectedEntity) {
        setSelectedEntity(updatedEntity);
      }
    }
  }, [selectedEntity, aircraftData, militaryFlightsData, satelliteData, earthquakeData, marineTrafficData, submarineCablesData, wildfiresData, newsHeatmapData, powerGridData, dataCentersData, cctvMeshData, magnetosphereData, weatherRadarData, streetTrafficData, bikeshareData, poisData, internetDevicesData, wigleWifiData, snapchatMapsData, pokemonGoData, setSelectedEntity]);

  return (
    <div className={`w-full h-full relative ${visualMode === 'night-vision' ? 'nvg-mode' : ''} ${visualMode === 'thermal' ? 'thermal-mode' : ''}`}>
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
        <PrimitiveLayer data={aircraftData} show={layers.aircraft} idPrefix="ac" color={Color.ORANGE} pixelSize={8} label="callsign" />
        <PrimitiveLayer data={militaryFlightsData} show={layers.militaryFlights} idPrefix="mil" color={Color.LIME} pixelSize={8} label="callsign" />
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
              const histKey = Object.keys(historyRef.current).find(k => k.endsWith(`_${selectedEntity.id}`));
              const hist = histKey ? historyRef.current[histKey] : null;
              if (hist && hist.length >= 6) {
                let trailColor = Color.WHITE.withAlpha(0.5);
                if (selectedEntity.type === 'aircraft') trailColor = Color.ORANGE.withAlpha(0.4);
                if (selectedEntity.type === 'militaryFlight') trailColor = Color.LIME.withAlpha(0.4);
                if (selectedEntity.type === 'satellite') trailColor = Color.fromCssColorString('#BC13FE').withAlpha(0.4);
                
                return (
                  <PolylineGraphics
                    positions={Cartesian3.fromDegreesArrayHeights(hist)}
                    width={2}
                    material={trailColor}
                  />
                );
              }
              return null;
            })()}
          </Entity>
        )}

        {layers.weatherRadar && weatherProvider && (
          <ImageryLayer imageryProvider={weatherProvider} alpha={0.6} />
        )}
      </Viewer>

      {/* Coordinate Display Overlay */}
      <div className="absolute bottom-4 left-4 bg-black/80 border border-green-900/50 p-2 text-xs font-mono text-green-500 rounded backdrop-blur-md pointer-events-none z-10">
        <div>LAT: {currentCoords.lat.toFixed(4)}°</div>
        <div>LON: {currentCoords.lon.toFixed(4)}°</div>
        <div>ALT: {(currentCoords.alt / 1000).toFixed(2)} km</div>
      </div>
    </div>
  );
};

export default GlobeViewer;

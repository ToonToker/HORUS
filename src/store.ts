import { create } from 'zustand';

interface WorldViewState {
  layers: {
    aircraft: boolean;
    militaryFlights: boolean;
    satellites: boolean;
    earthquakes: boolean;
    marineTraffic: boolean;
    submarineCables: boolean;
    weatherRadar: boolean;
    wildfires: boolean;
    newsHeatmap: boolean;
    powerGrid: boolean;
    dataCenters: boolean;
    cctvMesh: boolean;
    magnetosphere: boolean;
    streetTraffic: boolean;
    bikeshare: boolean;
    pois: boolean;
    internetDevices: boolean;
    wigleWifi: boolean;
    snapchatMaps: boolean;
    pokemonGo: boolean;
  };
  visualMode: 'normal' | 'night-vision' | 'thermal';
  crtEnabled: boolean;
  postFx: {
    pixelation: number;
    chromaticAberration: number;
    noise: number;
  };
  performance: {
    fps: number;
    entityCount: number;
    autoFastMode: boolean;
    autoClustering: boolean;
    manualFastMode: boolean;
    manualClustering: boolean;
    replayMode: boolean;
    context3dRequested: boolean;
  };
  currentTime: Date;
  selectedEntity: any | null;
  toggleLayer: (layer: keyof WorldViewState['layers']) => void;
  setVisualMode: (mode: WorldViewState['visualMode']) => void;
  toggleCrt: () => void;
  setPostFx: (key: keyof WorldViewState['postFx'], value: number) => void;
  setPerformance: (perf: Partial<WorldViewState['performance']>) => void;
  setCurrentTime: (time: Date) => void;
  setSelectedEntity: (entity: any) => void;
}

export const useWorldViewStore = create<WorldViewState>((set) => ({
  layers: {
    aircraft: true,
    militaryFlights: true,
    satellites: true,
    earthquakes: true,
    marineTraffic: false,
    submarineCables: false,
    weatherRadar: false,
    wildfires: false,
    newsHeatmap: false,
    powerGrid: false,
    dataCenters: false,
    cctvMesh: false,
    magnetosphere: false,
    streetTraffic: false,
    bikeshare: false,
    pois: true,
    internetDevices: false,
    wigleWifi: false,
    snapchatMaps: false,
    pokemonGo: false,
  },
  visualMode: 'normal',
  crtEnabled: true,
  postFx: {
    pixelation: 0.16,
    chromaticAberration: 0.002,
    noise: 0.08,
  },
  performance: {
    fps: 60,
    entityCount: 0,
    autoFastMode: false,
    autoClustering: false,
    manualFastMode: true,
    manualClustering: false,
    replayMode: false,
    context3dRequested: false,
  },
  currentTime: new Date(),
  selectedEntity: null,
  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),
  setVisualMode: (mode) => set({ visualMode: mode }),
  toggleCrt: () => set((state) => ({ crtEnabled: !state.crtEnabled })),
  setPostFx: (key, value) =>
    set((state) => ({ postFx: { ...state.postFx, [key]: value } })),
  setPerformance: (perf) =>
    set((state) => ({ performance: { ...state.performance, ...perf } })),
  setCurrentTime: (time) => set({ currentTime: time }),
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
}));

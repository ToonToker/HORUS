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
    bloom: number;
  };
  currentTime: Date;
  selectedEntity: any | null;
  toggleLayer: (layer: keyof WorldViewState['layers']) => void;
  setVisualMode: (mode: WorldViewState['visualMode']) => void;
  toggleCrt: () => void;
  setPostFx: (key: keyof WorldViewState['postFx'], value: number) => void;
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
    pixelation: 0.18,
    chromaticAberration: 0.003,
    noise: 0.08,
    bloom: 1,
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
  setCurrentTime: (time) => set({ currentTime: time }),
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
}));

import { create } from 'zustand';

export type WitnessStatus = 'ACTIVE' | 'COMPROMISED' | 'NEUTRAL';

type SovereignSettings = {
  scrapingFrequencySec: number;
  torEnabled: boolean;
  dataPaths: {
    wigleCsv: string;
    breachDump: string;
    boundaries: string;
  };
  sourceUrls: {
    radio: string;
    ais: string;
  };
};

interface WorldViewState {
  layers: {
    borders: boolean;
    conflictZones: boolean;
    threatMap: boolean;
    breachLocator: boolean;
    subseaCables: boolean;
    seismicFaults: boolean;
    powerGrid: boolean;
    groundStations: boolean;
    witnessAnnotations: boolean;
    rfNodes: boolean;
    maritime: boolean;
    cyberThreats: boolean;
    signalFog: boolean;
    resonanceLinks: boolean;
    ghostMarkers: boolean;
  };
  selectedEntity: any | null;
  pendingWitnessPoint: { lat: number; lon: number } | null;
  temporalHours: number;
  settingsOpen: boolean;
  settings: SovereignSettings;
  toggleLayer: (layer: keyof WorldViewState['layers']) => void;
  setSelectedEntity: (entity: any | null) => void;
  setPendingWitnessPoint: (point: { lat: number; lon: number } | null) => void;
  setTemporalHours: (hours: number) => void;
  setSettingsOpen: (open: boolean) => void;
  patchSettings: (patch: Partial<SovereignSettings>) => void;
  patchDataPaths: (patch: Partial<SovereignSettings['dataPaths']>) => void;
  patchSourceUrls: (patch: Partial<SovereignSettings['sourceUrls']>) => void;
}

const defaultSettings: SovereignSettings = {
  scrapingFrequencySec: 30,
  torEnabled: false,
  dataPaths: {
    wigleCsv: 'data/threats/wigle_cells.csv',
    breachDump: 'data/threats/breaches.csv',
    boundaries: 'data/boundaries',
  },
  sourceUrls: {
    radio: 'archive://radio/raw',
    ais: 'archive://ais/raw',
  },
};

export const useWorldViewStore = create<WorldViewState>((set) => ({
  layers: {
    borders: true,
    conflictZones: true,
    threatMap: true,
    breachLocator: true,
    subseaCables: false,
    seismicFaults: false,
    powerGrid: false,
    groundStations: false,
    witnessAnnotations: true,
    rfNodes: true,
    maritime: true,
    cyberThreats: true,
    signalFog: false,
    resonanceLinks: true,
    ghostMarkers: true,
  },
  selectedEntity: null,
  pendingWitnessPoint: null,
  temporalHours: 24,
  settingsOpen: false,
  settings: defaultSettings,
  toggleLayer: (layer) => set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setPendingWitnessPoint: (pendingWitnessPoint) => set({ pendingWitnessPoint }),
  setTemporalHours: (temporalHours) => set({ temporalHours }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  patchSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
  patchDataPaths: (patch) => set((state) => ({ settings: { ...state.settings, dataPaths: { ...state.settings.dataPaths, ...patch } } })),
  patchSourceUrls: (patch) => set((state) => ({ settings: { ...state.settings, sourceUrls: { ...state.settings.sourceUrls, ...patch } } })),
}));

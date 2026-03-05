import { create } from 'zustand';

export type WitnessStatus = 'ACTIVE' | 'COMPROMISED' | 'NEUTRAL';

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
  toggleLayer: (layer: keyof WorldViewState['layers']) => void;
  setSelectedEntity: (entity: any | null) => void;
  setPendingWitnessPoint: (point: { lat: number; lon: number } | null) => void;
  setTemporalHours: (hours: number) => void;
}

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
  toggleLayer: (layer) => set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setPendingWitnessPoint: (pendingWitnessPoint) => set({ pendingWitnessPoint }),
  setTemporalHours: (temporalHours) => set({ temporalHours }),
}));

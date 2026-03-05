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
  };
  selectedEntity: any | null;
  pendingWitnessPoint: { lat: number; lon: number } | null;
  toggleLayer: (layer: keyof WorldViewState['layers']) => void;
  setSelectedEntity: (entity: any | null) => void;
  setPendingWitnessPoint: (point: { lat: number; lon: number } | null) => void;
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
  },
  selectedEntity: null,
  pendingWitnessPoint: null,
  toggleLayer: (layer) => set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setPendingWitnessPoint: (pendingWitnessPoint) => set({ pendingWitnessPoint }),
}));

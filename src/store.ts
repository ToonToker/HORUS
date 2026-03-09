import { create } from 'zustand';

export type WitnessStatus = 'ACTIVE' | 'COMPROMISED' | 'NEUTRAL';

export type SynapticTrack = {
  id: string;
  lat?: number;
  lon?: number;
  from?: { lat: number; lon: number };
  to?: { lat: number; lon: number };
  ts?: number;
  [key: string]: unknown;
};

export type StreamKey =
  | 'data:conflictZones'
  | 'data:breaches'
  | 'data:threatArcs'
  | 'data:rfNodes'
  | 'data:vessels'
  | 'data:cyberThreats'
  | 'data:wardriving'
  | 'data:resonanceLinks'
  | 'data:ghostMarkers'
  | 'data:witnessAnnotations'
  | 'data:seekerNodes'
  | 'data:mcpNodes'
  | 'data:liquidityHeatmap'
  | 'data:seismicWindows'
  | 'data:highEntropyNodes';

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

export type LayerKey = keyof WorldViewState['layers'];

export type LayerSetting = {
  targetDorks: string;
  scraperDepth: number;
  dbPath: string;
};

const STREAM_KEYS: StreamKey[] = [
  'data:conflictZones', 'data:breaches', 'data:threatArcs', 'data:rfNodes', 'data:vessels',
  'data:cyberThreats', 'data:wardriving', 'data:resonanceLinks', 'data:ghostMarkers',
  'data:witnessAnnotations', 'data:seekerNodes', 'data:mcpNodes', 'data:liquidityHeatmap',
  'data:seismicWindows', 'data:highEntropyNodes',
];

type SynapticFeed = Record<StreamKey, SynapticTrack[]>;

const emptySynapticFeed = (): SynapticFeed => Object.fromEntries(STREAM_KEYS.map((k) => [k, []])) as SynapticFeed;

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
    seekerNodes: boolean;
    mcpNodes: boolean;
    liquidityHeatmap: boolean;
    seismicWindows: boolean;
    highEntropyNodes: boolean;
  };
  selectedEntity: any | null;
  pendingWitnessPoint: { lat: number; lon: number } | null;
  temporalHours: number;
  settingsOpen: boolean;
  settings: SovereignSettings;
  layerSettingsModal: LayerKey | null;
  layerSettings: Record<string, LayerSetting>;
  synapticFeed: SynapticFeed;
  streamIngressLog: string[];
  toggleLayer: (layer: LayerKey) => void;
  setSelectedEntity: (entity: any | null) => void;
  setPendingWitnessPoint: (point: { lat: number; lon: number } | null) => void;
  setTemporalHours: (hours: number) => void;
  setSettingsOpen: (open: boolean) => void;
  patchSettings: (patch: Partial<SovereignSettings>) => void;
  patchDataPaths: (patch: Partial<SovereignSettings['dataPaths']>) => void;
  patchSourceUrls: (patch: Partial<SovereignSettings['sourceUrls']>) => void;
  setLayerSettingsModal: (layer: LayerKey | null) => void;
  patchLayerSetting: (layer: LayerKey, patch: Partial<LayerSetting>) => void;
  setStreamBatch: (stream: StreamKey, payload: SynapticTrack[]) => void;
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

const defaultLayerSetting: LayerSetting = {
  targetDorks: '',
  scraperDepth: 2,
  dbPath: 'horus.db',
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
    seekerNodes: true,
    mcpNodes: true,
    liquidityHeatmap: true,
    seismicWindows: true,
    highEntropyNodes: true,
  },
  selectedEntity: null,
  pendingWitnessPoint: null,
  temporalHours: 24,
  settingsOpen: false,
  settings: defaultSettings,
  layerSettingsModal: null,
  synapticFeed: emptySynapticFeed(),
  streamIngressLog: [],
  layerSettings: {
    maritime: { ...defaultLayerSetting, targetDorks: 'ais cargo tanker' },
    cyberThreats: { ...defaultLayerSetting, targetDorks: 'shodan net:10.0.0.0/8', dbPath: 'data/threats/shodan_scrape.csv' },
    seekerNodes: { ...defaultLayerSetting, targetDorks: 'wallet pivots', dbPath: 'cases/default-case' },
    liquidityHeatmap: { ...defaultLayerSetting, targetDorks: 'liquidity clusters', dbPath: 'data/mcp/lob_context.json' },
  },
  toggleLayer: (layer) => set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setPendingWitnessPoint: (pendingWitnessPoint) => set({ pendingWitnessPoint }),
  setTemporalHours: (temporalHours) => set({ temporalHours }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  patchSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
  patchDataPaths: (patch) => set((state) => ({ settings: { ...state.settings, dataPaths: { ...state.settings.dataPaths, ...patch } } })),
  patchSourceUrls: (patch) => set((state) => ({ settings: { ...state.settings, sourceUrls: { ...state.settings.sourceUrls, ...patch } } })),
  setLayerSettingsModal: (layerSettingsModal) => set({ layerSettingsModal }),
  patchLayerSetting: (layer, patch) => set((state) => ({
    layerSettings: {
      ...state.layerSettings,
      [layer]: { ...(state.layerSettings[layer] ?? defaultLayerSetting), ...patch },
    },
  })),
  setStreamBatch: (stream, payload) => set((state) => ({
    synapticFeed: { ...state.synapticFeed, [stream]: payload },
    streamIngressLog: [`${new Date().toISOString()} ${stream} ${payload.length}`, ...state.streamIngressLog].slice(0, 30),
  })),
}));

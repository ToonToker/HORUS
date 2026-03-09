import React, { useEffect, useMemo, useState } from 'react';
import { LayerKey, StreamKey, useWorldViewStore, WitnessStatus } from '../store';
import { LayerItem } from './LayerItem';
import SettingsModal from './SettingsModal';

type LayerControl = { key: LayerKey; label: string; hasGear?: boolean; stream?: StreamKey };

const LAYER_CONTROLS: LayerControl[] = [
  { key: 'cyberThreats', label: 'Shodan', hasGear: true, stream: 'data:cyberThreats' },
  { key: 'liquidityHeatmap', label: 'Liquidity', hasGear: true, stream: 'data:liquidityHeatmap' },
  { key: 'seekerNodes', label: 'OSINT', hasGear: true, stream: 'data:seekerNodes' },
  { key: 'maritime', label: 'AIS/ADSB', hasGear: true, stream: 'data:vessels' },
  { key: 'threatMap', label: 'Threat Arcs', stream: 'data:threatArcs' },
  { key: 'resonanceLinks', label: 'Resonance Links', stream: 'data:resonanceLinks' },
  { key: 'witnessAnnotations', label: 'Witness Notes', stream: 'data:witnessAnnotations' },
  { key: 'mcpNodes', label: 'MCP Nodes', stream: 'data:mcpNodes' },
  { key: 'highEntropyNodes', label: 'High Entropy', stream: 'data:highEntropyNodes' },
  { key: 'borders', label: 'Borders' },
];

const Sidebar = () => {
  const {
    layers,
    toggleLayer,
    pendingWitnessPoint,
    selectedEntity,
    layerSettings,
    layerSettingsModal,
    setLayerSettingsModal,
    patchLayerSetting,
    streamIngressLog,
    synapticFeed,
  } = useWorldViewStore();
  const [noteMarkdown, setNoteMarkdown] = useState('');
  const [status, setStatus] = useState<WitnessStatus>('NEUTRAL');
  const [akhStatus, setAkhStatus] = useState(3);
  const [investigationSummary, setInvestigationSummary] = useState('');
  const [cases, setCases] = useState<any[]>([]);
  const [activeCaseId, setActiveCaseId] = useState('default-case');
  const [newCaseTitle, setNewCaseTitle] = useState('');

  const refreshCases = async () => {
    const res = await fetch('/api/cases');
    const json = await res.json();
    setCases(json.cases ?? []);
    setActiveCaseId(json.activeCaseId ?? 'default-case');
  };

  useEffect(() => { refreshCases(); }, []);

  const saveWitness = async () => {
    if (!pendingWitnessPoint) return;
    await fetch('/api/witness/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pendingWitnessPoint.lat, lon: pendingWitnessPoint.lon, noteMarkdown, status, akhStatus, metadata: { source: 'Sovereign Witness Sidebar' } }),
    });
    setNoteMarkdown('');
  };

  const runDeepScrape = async () => {
    const source = selectedEntity && Number.isFinite(selectedEntity.lat) ? { lat: selectedEntity.lat, lon: selectedEntity.lon } : pendingWitnessPoint;
    if (!source) return;
    const res = await fetch('/api/sigint/investigate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(source),
    });
    const json = await res.json();
    setInvestigationSummary(`Owners ${json.owners ?? 0} · Associates ${json.associates ?? 0} · Resonance ${json.resonancePoints ?? 0} · Case ${json.caseId ?? 'n/a'}`);
  };

  const ingestSeekerNode = async () => {
    if (!pendingWitnessPoint) return;
    await fetch('/api/seeker/ingest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: [{ nodeType: 'wallet-footprint', lat: pendingWitnessPoint.lat, lon: pendingWitnessPoint.lon, confidence: 0.82, verified: true, noisy: false, wallet: '0xAkhNode' }] }),
    });
  };

  const createCase = async () => {
    if (!newCaseTitle.trim()) return;
    await fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newCaseTitle }) });
    setNewCaseTitle('');
    await refreshCases();
  };

  const activateCase = async (id: string) => {
    await fetch('/api/cases/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await refreshCases();
  };

  const modalSettings = layerSettingsModal ? layerSettings[layerSettingsModal] : null;

  const layerModels = useMemo(() => LAYER_CONTROLS.map((layer) => {
    const count = layer.stream ? (synapticFeed[layer.stream]?.length ?? 0) : 0;
    const active = layers[layer.key];
    return {
      id: layer.key,
      name: layer.label,
      active,
      status: active ? (count > 0 ? 'LIVE' : 'IDLE') : 'OFFLINE' as const,
      hasGear: layer.hasGear,
    };
  }), [layers, synapticFeed]);

  const saveLayerSettings = async (patch: any) => {
    if (!layerSettingsModal) return;
    patchLayerSetting(layerSettingsModal, patch);
    await fetch('/api/mcp/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'config_update',
        params: {
          layer: layerSettingsModal,
          config: patch,
          source: 'SIS-LayerSettings-Modal',
        },
      }),
    });
    setLayerSettingsModal(null);
  };

  return (
    <aside className="w-84 h-full bg-[#000500] text-[#00FF41] border-r border-[#00FF41]/30 p-4 overflow-y-auto font-mono">
      <h2 className="text-sm tracking-[0.2em] text-[#FFD700] mb-3">SOVEREIGN WITNESS</h2>

      <div className="border border-[#FFD700]/35 rounded p-3 mb-4 text-xs">
        <div className="text-[#FFD700] mb-2">Case Isolation</div>
        <div className="mb-2">Active: {activeCaseId}</div>
        <div className="flex gap-2 mb-2">
          <input className="flex-1 bg-black border border-[#00FF41]/30 p-1" value={newCaseTitle} onChange={(e) => setNewCaseTitle(e.target.value)} placeholder="New case title" />
          <button className="px-2 border border-[#FFD700]/50 text-[#FFD700]" onClick={createCase}>Create</button>
        </div>
        <div className="space-y-1 max-h-24 overflow-auto">
          {cases.map((c) => (
            <button key={c.id} className="w-full text-left border border-[#00FF41]/20 px-2 py-1 hover:bg-[#00FF41]/10" onClick={() => activateCase(c.id)}>
              {c.title} ({c.id})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {layerModels.map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            onToggle={(id) => toggleLayer(id)}
            onOpenSettings={(id) => setLayerSettingsModal(id)}
          />
        ))}
      </div>

      <div className="mt-6 border border-[#FFD700]/40 rounded p-3">
        <h3 className="text-xs text-[#FFD700] mb-2">Metadata Injection</h3>
        <div className="text-[11px] mb-2">Target: {pendingWitnessPoint ? `${pendingWitnessPoint.lat.toFixed(4)}, ${pendingWitnessPoint.lon.toFixed(4)}` : 'click globe'}</div>
        <textarea className="w-full h-24 bg-black border border-[#00FF41]/30 p-2 text-xs" value={noteMarkdown} onChange={(e) => setNoteMarkdown(e.target.value)} placeholder="Sovereign Witness note" />
        <select className="w-full mt-2 bg-black border border-[#00FF41]/30 p-1" value={status} onChange={(e) => setStatus(e.target.value as WitnessStatus)}>
          <option value="ACTIVE">Active</option>
          <option value="COMPROMISED">Compromised</option>
          <option value="NEUTRAL">Neutral</option>
        </select>
        <label className="block mt-2 text-xs">Akh-Status {akhStatus}</label>
        <input type="range" min={1} max={5} value={akhStatus} onChange={(e) => setAkhStatus(Number(e.target.value))} className="w-full" />
        <button className="w-full mt-3 bg-[#FFD700] text-black py-1 font-bold" onClick={saveWitness}>Save Local Annotation</button>
        <button className="w-full mt-2 border border-[#FFD700] text-[#FFD700] py-1 font-bold" onClick={runDeepScrape}>OSINT-SCRAPE THIS NODE</button>
        <button className="w-full mt-2 border border-[#00FF41] text-[#00FF41] py-1" onClick={ingestSeekerNode}>Inject Seeker Node</button>
        {investigationSummary && <div className="mt-2 text-[11px] text-[#FFD700]">{investigationSummary}</div>}
      </div>

      <div className="mt-4 border border-[#00FF41]/30 rounded p-2 text-[10px] max-h-28 overflow-auto">
        <div className="text-[#FFD700] mb-1">Synaptic Event Stream</div>
        {streamIngressLog.length === 0 ? <div className="opacity-60">Awaiting ingress…</div> : streamIngressLog.slice(0, 8).map((line) => <div key={line}>{line}</div>)}
      </div>

      <SettingsModal
        layerId={layerSettingsModal}
        settings={modalSettings ?? null}
        onClose={() => setLayerSettingsModal(null)}
        onSave={saveLayerSettings}
      />
    </aside>
  );
};

export default Sidebar;

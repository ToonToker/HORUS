import React, { useEffect, useState } from 'react';
import { LayerKey, useWorldViewStore, WitnessStatus } from '../store';
import LayerControlRow from './layers/LayerControlRow';

type LayerControl = { key: LayerKey; label: string; group: string; hasGear?: boolean };

const LAYER_CONTROLS: LayerControl[] = [
  { key: 'cyberThreats', label: 'Shodan', group: 'SIGINT', hasGear: true },
  { key: 'liquidityHeatmap', label: 'Liquidity', group: 'Economics', hasGear: true },
  { key: 'seekerNodes', label: 'OSINT', group: 'OSINT', hasGear: true },
  { key: 'maritime', label: 'AIS/ADSB', group: 'Transport', hasGear: true },
  { key: 'threatMap', label: 'Threat Arcs', group: 'Core' },
  { key: 'resonanceLinks', label: 'Resonance Links', group: 'Core' },
  { key: 'witnessAnnotations', label: 'Witness Notes', group: 'Core' },
  { key: 'mcpNodes', label: 'MCP Nodes', group: 'Core' },
  { key: 'highEntropyNodes', label: 'High Entropy', group: 'Core' },
  { key: 'borders', label: 'Borders', group: 'Base' },
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: pendingWitnessPoint.lat,
        lon: pendingWitnessPoint.lon,
        noteMarkdown,
        status,
        akhStatus,
        metadata: { source: 'Sovereign Witness Sidebar' },
      }),
    });
    setNoteMarkdown('');
  };

  const runDeepScrape = async () => {
    const source = selectedEntity && Number.isFinite(selectedEntity.lat) ? { lat: selectedEntity.lat, lon: selectedEntity.lon } : pendingWitnessPoint;
    if (!source) return;
    const res = await fetch('/api/sigint/investigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source),
    });
    const json = await res.json();
    setInvestigationSummary(`Owners ${json.owners ?? 0} · Associates ${json.associates ?? 0} · Resonance ${json.resonancePoints ?? 0} · Case ${json.caseId ?? 'n/a'}`);
  };

  const ingestSeekerNode = async () => {
    if (!pendingWitnessPoint) return;
    await fetch('/api/seeker/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: [{
          nodeType: 'wallet-footprint',
          lat: pendingWitnessPoint.lat,
          lon: pendingWitnessPoint.lon,
          confidence: 0.82,
          verified: true,
          noisy: false,
          wallet: '0xAkhNode',
        }],
      }),
    });
  };

  const createCase = async () => {
    if (!newCaseTitle.trim()) return;
    await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newCaseTitle }),
    });
    setNewCaseTitle('');
    await refreshCases();
  };

  const activateCase = async (id: string) => {
    await fetch('/api/cases/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await refreshCases();
  };

  const modalSettings = layerSettingsModal ? layerSettings[layerSettingsModal] : null;

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
        {LAYER_CONTROLS.map((layer) => (
          <LayerControlRow
            key={layer.key}
            layerKey={layer.key}
            label={layer.label}
            checked={layers[layer.key]}
            hasGear={layer.hasGear}
            onToggle={() => toggleLayer(layer.key)}
            onOpenSettings={() => setLayerSettingsModal(layer.key)}
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

      {layerSettingsModal && modalSettings && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-20">
          <div className="w-[560px] max-w-[95vw] bg-[#000500] border border-[#FFD700]/40 rounded p-4 text-[#00FF41] font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[#FFD700] tracking-[0.2em]">{layerSettingsModal} SETTINGS</h3>
              <button className="border border-[#00FF41]/30 px-2 py-1" onClick={() => setLayerSettingsModal(null)}>Close</button>
            </div>
            <label className="block mb-2">Target Dorks
              <input className="w-full bg-black border border-[#00FF41]/30 p-1 mt-1" value={modalSettings.targetDorks} onChange={(e) => patchLayerSetting(layerSettingsModal, { targetDorks: e.target.value })} />
            </label>
            <label className="block mb-2">Scraper Depth: {modalSettings.scraperDepth}
              <input type="range" min={1} max={10} className="w-full" value={modalSettings.scraperDepth} onChange={(e) => patchLayerSetting(layerSettingsModal, { scraperDepth: Number(e.target.value) })} />
            </label>
            <label className="block">DB Path
              <input className="w-full bg-black border border-[#00FF41]/30 p-1 mt-1" value={modalSettings.dbPath} onChange={(e) => patchLayerSetting(layerSettingsModal, { dbPath: e.target.value })} />
            </label>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;

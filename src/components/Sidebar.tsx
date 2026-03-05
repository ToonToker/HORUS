import React, { useState } from 'react';
import { useWorldViewStore, WitnessStatus } from '../store';

const Sidebar = () => {
  const { layers, toggleLayer, pendingWitnessPoint } = useWorldViewStore();
  const [noteMarkdown, setNoteMarkdown] = useState('');
  const [status, setStatus] = useState<WitnessStatus>('NEUTRAL');
  const [akhStatus, setAkhStatus] = useState(3);

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

  const LayerRow = ({ keyName }: { keyName: keyof typeof layers }) => (
    <div className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
      <span className="capitalize text-sm tracking-wide">{keyName.replace(/([A-Z])/g, ' $1').trim()}</span>
      <button onClick={() => toggleLayer(keyName)} className="text-green-600 hover:text-green-400">
        {layers[keyName] ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  );

  return (
    <aside className="w-80 h-full bg-[#000500] text-[#00FF41] border-r border-[#00FF41]/30 p-4 overflow-y-auto font-mono">
      <h2 className="text-sm tracking-[0.2em] text-[#FFD700] mb-3">SOVEREIGN WITNESS</h2>
      <div className="space-y-2 text-xs">
        {Object.keys(layers).map((key) => (
          <label key={key} className="flex items-center justify-between border border-[#00FF41]/20 px-2 py-1 rounded">
            <span>{key}</span>
            <input type="checkbox" checked={layers[key as keyof typeof layers]} onChange={() => toggleLayer(key as keyof typeof layers)} />
          </label>
        ))}
      </div>

      <div className="mt-6 border border-[#FFD700]/40 rounded p-3">
        <h3 className="text-xs text-[#FFD700] mb-2">Metadata Injection</h3>
        <div className="text-[11px] mb-2">Target: {pendingWitnessPoint ? `${pendingWitnessPoint.lat.toFixed(4)}, ${pendingWitnessPoint.lon.toFixed(4)}` : 'click map'}</div>
        <textarea className="w-full h-24 bg-black border border-[#00FF41]/30 p-2 text-xs" value={noteMarkdown} onChange={(e) => setNoteMarkdown(e.target.value)} placeholder="Markdown note" />
        <select className="w-full mt-2 bg-black border border-[#00FF41]/30 p-1" value={status} onChange={(e) => setStatus(e.target.value as WitnessStatus)}>
          <option value="ACTIVE">Active</option>
          <option value="COMPROMISED">Compromised</option>
          <option value="NEUTRAL">Neutral</option>
        </select>
        <label className="block mt-2 text-xs">Akh-Status {akhStatus}</label>
        <input type="range" min={1} max={5} value={akhStatus} onChange={(e) => setAkhStatus(Number(e.target.value))} className="w-full" />
        <button className="w-full mt-3 bg-[#FFD700] text-black py-1 font-bold" onClick={saveWitness}>Save Local Annotation</button>
      </div>
    </aside>
  );
};

export default Sidebar;

import React, { useState } from 'react';
import { useWorldViewStore } from '../store';

const DetailsPanel = () => {
  const { selectedEntity } = useWorldViewStore();
  const [result, setResult] = useState<string>('');

  const runMarkerOsint = async () => {
    if (!selectedEntity || !Number.isFinite(selectedEntity.lat) || !Number.isFinite(selectedEntity.lon)) return;
    const res = await fetch('/api/sigint/investigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: selectedEntity.lat, lon: selectedEntity.lon }),
    });
    const json = await res.json();
    setResult(`OSINT-SCRAPE complete · owners=${json.owners ?? 0} associates=${json.associates ?? 0}`);
  };

  return (
    <aside className="w-80 h-full bg-[#000500] border-l border-[#00FF41]/30 p-4 text-[#00FF41] font-mono overflow-y-auto">
      <h3 className="text-xs tracking-[0.2em] text-[#FFD700] mb-3">TARGET INTEL</h3>
      {selectedEntity ? (
        <>
          {selectedEntity.kind === 'edge' || selectedEntity.kind === 'causal-vector' ? (
            <div className="mb-2 text-[11px]">
              <div className="text-[#FFD700] mb-1">EDGE CHAIN</div>
              <pre className="text-[11px] whitespace-pre-wrap break-words">{JSON.stringify({ from: selectedEntity.from, to: selectedEntity.to, sourceStream: selectedEntity.sourceStream }, null, 2)}</pre>
            </div>
          ) : null}
          <pre className="text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(selectedEntity, null, 2)}</pre>
          <button className="mt-3 w-full border border-[#FFD700]/60 text-[#FFD700] py-1" onClick={runMarkerOsint}>OSINT-SCRAPE THIS NODE</button>
          {result && <div className="text-[11px] mt-2 text-[#FFD700]">{result}</div>}
        </>
      ) : (
        <div className="text-xs opacity-70">Select a node, arc, or marker to inspect.</div>
      )}
    </aside>
  );
};

export default DetailsPanel;

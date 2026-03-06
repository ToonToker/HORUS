import React from 'react';
import { useWorldViewStore } from '../store';

const DetailsPanel = () => {
  const { selectedEntity } = useWorldViewStore();

  return (
    <aside className="w-72 h-full bg-[#000500] border-l border-[#00FF41]/30 p-4 text-[#00FF41] font-mono overflow-y-auto">
      <h3 className="text-xs tracking-[0.2em] text-[#FFD700] mb-3">TARGET INTEL</h3>
      {selectedEntity ? (
        <pre className="text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(selectedEntity, null, 2)}</pre>
      ) : (
        <div className="text-xs opacity-70">Select a border, arc, breach, or witness marker.</div>
      )}
    </aside>
  );
};

export default DetailsPanel;

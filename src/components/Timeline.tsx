import React from 'react';
import { useWorldViewStore } from '../store';

const Timeline = () => {
  const { temporalHours, setTemporalHours } = useWorldViewStore();

  return (
    <div className="h-14 bg-[#000500] border-t border-[#00FF41]/30 px-4 flex items-center justify-between text-xs font-mono text-[#00FF41] gap-6">
      <span>Case Isolation: Local Workspace</span>
      <div className="flex-1 max-w-md">
        <div className="flex justify-between text-[10px] mb-1"><span>1h</span><span>72h Seismic Window</span></div>
        <input type="range" min={1} max={72} value={temporalHours} onChange={(e) => setTemporalHours(Number(e.target.value))} className="w-full" />
      </div>
      <span>Temporal Filter: Last {temporalHours}h</span>
    </div>
  );
};

export default Timeline;

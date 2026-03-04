import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';
import { useWorldViewStore } from '../store';

const Timeline = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(100);
  const { setPerformance } = useWorldViewStore();

  const setReplay = (replayMode: boolean) => {
    setPerformance({ replayMode });
  };

  return (
    <div className="h-16 bg-black/80 border-t border-green-900/50 flex items-center px-6 text-green-500 font-mono backdrop-blur-md hud-glow">
      <div className="flex items-center gap-4 border-r border-green-900/50 pr-6">
        <button className="text-green-700 hover:text-green-400" onClick={() => { setProgress(0); setReplay(true); }}>
          <SkipBack size={20} />
        </button>
        <button
          className="text-green-400 hover:text-green-300 bg-green-900/30 p-2 rounded-full border border-green-500/50"
          onClick={() => {
            const next = !isPlaying;
            setIsPlaying(next);
            setReplay(next || progress < 100);
          }}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button className="text-green-700 hover:text-green-400" onClick={() => { setProgress(100); setReplay(false); setIsPlaying(false); }}>
          <SkipForward size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 relative">
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-green-700 mb-1">
          <span>-60m</span>
          <span>Now</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => {
            const next = Number(e.target.value);
            setProgress(next);
            setReplay(next < 100);
          }}
          className="w-full accent-green-500"
        />
      </div>

      <div className="flex items-center gap-4 border-l border-green-900/50 pl-6 text-xs uppercase tracking-widest">
        <div className="flex items-center gap-2 text-green-600">
          <Clock size={14} />
          <span>{progress < 100 ? 'Replay' : 'Live'}</span>
        </div>
        <select className="bg-black border border-green-900/50 rounded px-2 py-1 text-green-500 focus:outline-none focus:border-green-500">
          <option>1x</option>
          <option>2x</option>
          <option>5x</option>
          <option>10x</option>
        </select>
      </div>
    </div>
  );
};

export default Timeline;

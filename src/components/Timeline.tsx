import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';

const Timeline = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(100);

  return (
    <div className="h-16 bg-black/80 border-t border-green-900/50 flex items-center px-6 text-green-500 font-mono backdrop-blur-md">
      <div className="flex items-center gap-4 border-r border-green-900/50 pr-6">
        <button className="text-green-700 hover:text-green-400">
          <SkipBack size={20} />
        </button>
        <button
          className="text-green-400 hover:text-green-300 bg-green-900/30 p-2 rounded-full border border-green-500/50"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button className="text-green-700 hover:text-green-400">
          <SkipForward size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 relative">
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-green-700 mb-1">
          <span>-60m</span>
          <span>Now</span>
        </div>
        <div className="h-1 bg-green-900/30 rounded relative cursor-pointer group">
          <div
            className="absolute top-0 left-0 h-full bg-green-500 rounded"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-green-400 rounded-full border-2 border-black opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 border-l border-green-900/50 pl-6 text-xs uppercase tracking-widest">
        <div className="flex items-center gap-2 text-green-600">
          <Clock size={14} />
          <span>Live</span>
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

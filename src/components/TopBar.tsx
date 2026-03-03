import React, { useState } from 'react';
import { Search, Clock, Map, Crosshair } from 'lucide-react';

const TopBar = () => {
  const [query, setQuery] = useState('');

  return (
    <div className="h-14 bg-black/80 border-b border-green-900/50 flex items-center justify-between px-6 text-green-500 font-mono backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-green-400 font-bold tracking-widest text-xl">
          <Crosshair size={24} className="text-green-500" />
          WORLDVIEW
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-green-700 bg-green-900/20 px-2 py-1 rounded border border-green-900/50">
          OSINT Command Center
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-green-700" />
        </div>
        <input
          type="text"
          className="w-full bg-black border border-green-900/50 rounded py-1.5 pl-10 pr-4 text-sm text-green-400 placeholder-green-800 focus:outline-none focus:border-green-500 transition-colors"
          placeholder="find aircraft callsign AAL123..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2 hover:text-green-300 cursor-pointer">
          <Clock size={16} />
          <span>{new Date().toISOString().split('T')[1].split('.')[0]} UTC</span>
        </div>
        <div className="flex items-center gap-2 hover:text-green-300 cursor-pointer">
          <Map size={16} />
          <span className="uppercase tracking-wider">Basemap</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Clock, Map, Crosshair } from 'lucide-react';

const CITIES: Record<string, [number, number, number]> = {
  pentagon: [-77.0559, 38.8719, 1800],
  'burj khalifa': [55.2744, 25.1972, 1400],
  'london bridge': [-0.0877, 51.5079, 1200],
};

const TopBar = () => {
  const [query, setQuery] = useState('');
  const utcTime = useMemo(() => new Date().toISOString().split('T')[1].split('.')[0], []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = document.getElementById('command-palette') as HTMLInputElement | null;
        el?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const executeCommand = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    const target = cmd.replace(/^go to\s+/, '');
    const match = CITIES[target];
    if (!match) return;
    const viewer = (window as any).__WORLDVIEW_VIEWER__;
    if (!viewer) return;
    viewer.camera.flyTo({ destination: (window as any).Cesium.Cartesian3.fromDegrees(match[0], match[1], match[2]), duration: 2.2 });
  };

  return (
    <div className="h-14 bg-black/80 border-b border-green-900/50 flex items-center justify-between px-6 text-green-500 font-mono backdrop-blur-md hud-glow">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-green-400 font-bold tracking-widest text-xl">
          <Crosshair size={24} className="text-green-500" />
          WORLDVIEW
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-green-700" />
        </div>
        <input
          id="command-palette"
          type="text"
          className="w-full bg-black border border-green-900/50 rounded py-1.5 pl-10 pr-4 text-sm text-green-400 placeholder-green-800 focus:outline-none focus:border-green-500 transition-colors"
          placeholder="⌘/Ctrl+K — go to Pentagon / Burj Khalifa / London Bridge"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              executeCommand(query);
            }
          }}
        />
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Clock size={16} />
          <span>{utcTime} UTC</span>
        </div>
        <div className="flex items-center gap-2">
          <Map size={16} />
          <span className="uppercase tracking-wider">Google 3D Tiles</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;

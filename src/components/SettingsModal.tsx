import React, { useMemo, useState } from 'react';
import { LayerKey, LayerSetting } from '../store';

type Props = {
  layerId: LayerKey | null;
  settings: LayerSetting | null;
  onClose: () => void;
  onSave: (patch: Partial<LayerSetting>) => Promise<void> | void;
};

const SettingsModal = ({ layerId, settings, onClose, onSave }: Props) => {
  const [working, setWorking] = useState<LayerSetting>(settings ?? { targetDorks: '', scraperDepth: 2, dbPath: 'horus.db' });

  React.useEffect(() => {
    if (settings) setWorking(settings);
  }, [settings]);

  const hint = useMemo(() => {
    switch (layerId) {
      case 'cyberThreats':
        return 'Port filters / dork query for Shodan-strip scraper';
      case 'liquidityHeatmap':
        return 'Target wallet/contract hints for liquidity node extraction';
      case 'seekerNodes':
        return 'OSINT dorks and pivot depth';
      case 'maritime':
        return 'AIS bounding and tactical filter depth';
      default:
        return 'General layer settings';
    }
  }, [layerId]);

  if (!layerId || !settings) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-end">
      <div className="w-[460px] h-full bg-black border-l border-cyan-900 shadow-2xl p-6 font-mono text-[#00FF41] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Configuration: {layerId}</h3>
          <button onClick={onClose} className="border border-[#00FF41]/40 px-2 py-1 text-xs">Close</button>
        </div>

        <p className="text-xs text-[#FFD700] mb-4">{hint}</p>

        <label className="block mb-3 text-xs">Target Dorks / Query
          <input className="w-full bg-black border border-[#00FF41]/30 p-2 mt-1" value={working.targetDorks} onChange={(e) => setWorking({ ...working, targetDorks: e.target.value })} />
        </label>

        <label className="block mb-3 text-xs">Scraper Depth: {working.scraperDepth}
          <input type="range" min={1} max={12} className="w-full" value={working.scraperDepth} onChange={(e) => setWorking({ ...working, scraperDepth: Number(e.target.value) })} />
        </label>

        <label className="block mb-3 text-xs">Database / Cache Path
          <input className="w-full bg-black border border-[#00FF41]/30 p-2 mt-1" value={working.dbPath} onChange={(e) => setWorking({ ...working, dbPath: e.target.value })} />
        </label>

        <button
          onClick={() => onSave(working)}
          className="mt-4 bg-cyan-700 hover:bg-cyan-600 px-4 py-2 rounded text-black font-bold"
        >
          Sync with HORUS Kernel
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;

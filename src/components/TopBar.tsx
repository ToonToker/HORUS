import React, { useEffect, useMemo, useState } from 'react';
import { useWorldViewStore } from '../store';

const TopBar = () => {
  const [status, setStatus] = useState<any>(null);
  const {
    settingsOpen,
    setSettingsOpen,
    settings,
    patchSettings,
    patchDataPaths,
    patchSourceUrls,
  } = useWorldViewStore();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/sovereign/status');
        setStatus(await res.json());
      } catch {
        setStatus(null);
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const live = useMemo(() => {
    const c = status?.counts;
    if (!c) return false;
    return (c.rfNodes ?? 0) + (c.vessels ?? 0) + (c.cyberThreats ?? 0) > 0;
  }, [status]);

  return (
    <>
      <header className="h-12 bg-[#000500] border-b border-[#00FF41]/30 px-4 flex items-center justify-between font-mono text-[#00FF41]">
        <div className="text-sm tracking-[0.2em] text-[#FFD700]">PROJECT HORUS · SOVEREIGN GEOSPATIAL ENGINE</div>
        <div className="flex items-center gap-4">
          <div className="text-xs">{live ? 'LIVE IN THE FIELD OF REEDS' : 'OFFLINE LOCK'} · CASE {status?.activeCaseId ?? 'n/a'} · BORDERS {status?.counts?.borders ?? 0}</div>
          <button
            className="text-[#FFD700] border border-[#FFD700]/60 rounded px-2 py-1 text-xs hover:bg-[#FFD700]/10"
            onClick={() => setSettingsOpen(!settingsOpen)}
            title="Sovereign Control Panel"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-20">
          <div className="w-[680px] max-w-[95vw] bg-[#000500] border border-[#00FF41]/40 rounded p-4 text-[#00FF41] font-mono">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[#FFD700] tracking-[0.2em]">SOVEREIGN CONTROL PANEL</h3>
              <button className="text-xs border border-[#00FF41]/40 px-2 py-1" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>

            <label className="text-xs block mb-1">Scraping Frequency: {settings.scrapingFrequencySec}s</label>
            <input
              type="range"
              min={5}
              max={300}
              step={5}
              value={settings.scrapingFrequencySec}
              onChange={(e) => patchSettings({ scrapingFrequencySec: Number(e.target.value) })}
              className="w-full mb-3"
            />

            <label className="flex items-center justify-between text-xs border border-[#00FF41]/20 p-2 rounded mb-3">
              <span>Proxy/TOR Routing</span>
              <input
                type="checkbox"
                checked={settings.torEnabled}
                onChange={(e) => patchSettings({ torEnabled: e.target.checked })}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="block">WiGle CSV Path
                <input className="w-full bg-black border border-[#00FF41]/30 p-1 mt-1" value={settings.dataPaths.wigleCsv} onChange={(e) => patchDataPaths({ wigleCsv: e.target.value })} />
              </label>
              <label className="block">Breach Dump Path
                <input className="w-full bg-black border border-[#00FF41]/30 p-1 mt-1" value={settings.dataPaths.breachDump} onChange={(e) => patchDataPaths({ breachDump: e.target.value })} />
              </label>
              <label className="block col-span-2">Boundaries Path
                <input className="w-full bg-black border border-[#00FF41]/30 p-1 mt-1" value={settings.dataPaths.boundaries} onChange={(e) => patchDataPaths({ boundaries: e.target.value })} />
              </label>
              <label className="block">Radio Source URL
                <input className="w-full bg-black border border-[#00FF41]/30 p-1 mt-1" value={settings.sourceUrls.radio} onChange={(e) => patchSourceUrls({ radio: e.target.value })} />
              </label>
              <label className="block">AIS Source URL
                <input className="w-full bg-black border border-[#00FF41]/30 p-1 mt-1" value={settings.sourceUrls.ais} onChange={(e) => patchSourceUrls({ ais: e.target.value })} />
              </label>
            </div>

            <div className="text-[11px] text-[#FFD700] mt-3">Changes apply through UI only; no manual file edits required.</div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;

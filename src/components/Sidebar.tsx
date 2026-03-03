import React, { useState } from 'react';
import { useWorldViewStore } from '../store';
import { Layers, Briefcase, Bell, Settings, Eye, EyeOff, Monitor, Thermometer, Moon } from 'lucide-react';

const Sidebar = () => {
  const { layers, toggleLayer, visualMode, setVisualMode, crtEnabled, toggleCrt } = useWorldViewStore();
  const [activeTab, setActiveTab] = useState<'layers' | 'cases' | 'alerts'>('layers');

  return (
    <div className="w-80 h-full bg-black/80 border-r border-green-900/50 text-green-500 font-mono flex flex-col backdrop-blur-md">
      <div className="flex border-b border-green-900/50">
        <button
          className={`flex-1 py-3 flex justify-center items-center gap-2 ${activeTab === 'layers' ? 'bg-green-900/30 border-b-2 border-green-500' : 'hover:bg-green-900/10'}`}
          onClick={() => setActiveTab('layers')}
        >
          <Layers size={16} /> Layers
        </button>
        <button
          className={`flex-1 py-3 flex justify-center items-center gap-2 ${activeTab === 'cases' ? 'bg-green-900/30 border-b-2 border-green-500' : 'hover:bg-green-900/10'}`}
          onClick={() => setActiveTab('cases')}
        >
          <Briefcase size={16} /> Cases
        </button>
        <button
          className={`flex-1 py-3 flex justify-center items-center gap-2 ${activeTab === 'alerts' ? 'bg-green-900/30 border-b-2 border-green-500' : 'hover:bg-green-900/10'}`}
          onClick={() => setActiveTab('alerts')}
        >
          <Bell size={16} /> Alerts
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'layers' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3 border-b border-green-900/50 pb-1">Aviation</h3>
              <div className="space-y-1">
                {['aircraft', 'militaryFlights'].map((key) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
                    <span className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <button onClick={() => toggleLayer(key as keyof typeof layers)} className="text-green-600 hover:text-green-400">
                      {layers[key as keyof typeof layers] ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3 border-b border-green-900/50 pb-1">Space</h3>
              <div className="space-y-1">
                {['satellites'].map((key) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
                    <span className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <button onClick={() => toggleLayer(key as keyof typeof layers)} className="text-green-600 hover:text-green-400">
                      {layers[key as keyof typeof layers] ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3 border-b border-green-900/50 pb-1">Earth & Environment</h3>
              <div className="space-y-1">
                {['earthquakes', 'magnetosphere', 'weatherRadar', 'wildfires'].map((key) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
                    <span className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <button onClick={() => toggleLayer(key as keyof typeof layers)} className="text-green-600 hover:text-green-400">
                      {layers[key as keyof typeof layers] ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3 border-b border-green-900/50 pb-1">Urban Grid</h3>
              <div className="space-y-1">
                {['streetTraffic', 'bikeshare', 'pois'].map((key) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
                    <span className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <button onClick={() => toggleLayer(key as keyof typeof layers)} className="text-green-600 hover:text-green-400">
                      {layers[key as keyof typeof layers] ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3 border-b border-green-900/50 pb-1">Digital Mesh</h3>
              <div className="space-y-1">
                {['internetDevices', 'wigleWifi', 'cctvMesh', 'dataCenters', 'submarineCables'].map((key) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
                    <span className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <button onClick={() => toggleLayer(key as keyof typeof layers)} className="text-green-600 hover:text-green-400">
                      {layers[key as keyof typeof layers] ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3 border-b border-green-900/50 pb-1">Social & Gamified</h3>
              <div className="space-y-1">
                {['snapchatMaps', 'pokemonGo'].map((key) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
                    <span className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <button onClick={() => toggleLayer(key as keyof typeof layers)} className="text-green-600 hover:text-green-400">
                      {layers[key as keyof typeof layers] ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3 border-b border-green-900/50 pb-1">Infrastructure & Intel</h3>
              <div className="space-y-1">
                {['marineTraffic', 'powerGrid', 'newsHeatmap'].map((key) => (
                  <div key={key} className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
                    <span className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <button onClick={() => toggleLayer(key as keyof typeof layers)} className="text-green-600 hover:text-green-400">
                      {layers[key as keyof typeof layers] ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mt-6 mb-2 border-b border-green-900/50 pb-1">Visual Modes</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setVisualMode('normal')}
                className={`p-2 rounded flex flex-col items-center gap-1 ${visualMode === 'normal' ? 'bg-green-900/50 border border-green-500' : 'bg-black border border-green-900/50 hover:bg-green-900/20'}`}
              >
                <Eye size={16} />
                <span className="text-[10px] uppercase">Normal</span>
              </button>
              <button
                onClick={() => setVisualMode('night-vision')}
                className={`p-2 rounded flex flex-col items-center gap-1 ${visualMode === 'night-vision' ? 'bg-green-900/50 border border-green-500' : 'bg-black border border-green-900/50 hover:bg-green-900/20'}`}
              >
                <Moon size={16} />
                <span className="text-[10px] uppercase">NVG</span>
              </button>
              <button
                onClick={() => setVisualMode('thermal')}
                className={`p-2 rounded flex flex-col items-center gap-1 ${visualMode === 'thermal' ? 'bg-green-900/50 border border-green-500' : 'bg-black border border-green-900/50 hover:bg-green-900/20'}`}
              >
                <Thermometer size={16} />
                <span className="text-[10px] uppercase">Thermal</span>
              </button>
            </div>

            <div className="mt-4">
              <button
                onClick={toggleCrt}
                className={`w-full p-2 rounded flex items-center justify-center gap-2 ${crtEnabled ? 'bg-green-900/50 border border-green-500' : 'bg-black border border-green-900/50 hover:bg-green-900/20'}`}
              >
                <Monitor size={16} />
                <span className="text-xs uppercase tracking-wider">CRT Scanlines {crtEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'cases' && (
          <div className="space-y-4">
            <button className="w-full py-2 bg-green-900/30 border border-green-500/50 hover:bg-green-900/50 text-sm uppercase tracking-wider rounded">
              + New Case
            </button>
            <div className="text-xs text-green-700 text-center py-8">No active cases</div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <button className="w-full py-2 bg-green-900/30 border border-green-500/50 hover:bg-green-900/50 text-sm uppercase tracking-wider rounded">
              + Add Geofence
            </button>
            <div className="text-xs text-green-700 text-center py-8">No active alerts</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;

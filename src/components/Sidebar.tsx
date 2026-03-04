import React, { useState } from 'react';
import { useWorldViewStore } from '../store';
import { Layers, Briefcase, Bell, Eye, EyeOff, Monitor, Thermometer, Moon, Zap, Boxes } from 'lucide-react';

const Sidebar = () => {
  const { layers, toggleLayer, visualMode, setVisualMode, crtEnabled, toggleCrt, postFx, setPostFx, performance, setPerformance } = useWorldViewStore();
  const [activeTab, setActiveTab] = useState<'layers' | 'cases' | 'alerts'>('layers');

  const LayerRow = ({ keyName }: { keyName: keyof typeof layers }) => (
    <div className="flex items-center justify-between p-2 hover:bg-green-900/20 rounded border border-transparent hover:border-green-900/50 transition-colors">
      <span className="capitalize text-sm tracking-wide">{keyName.replace(/([A-Z])/g, ' $1').trim()}</span>
      <button onClick={() => toggleLayer(keyName)} className="text-green-600 hover:text-green-400">
        {layers[keyName] ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  );

  return (
    <div className="w-80 h-full bg-black/80 border-r border-green-900/50 text-green-500 font-mono flex flex-col backdrop-blur-md hud-glow">
      <div className="flex border-b border-green-900/50">
        {[{ key: 'layers', icon: Layers, label: 'Layers' }, { key: 'cases', icon: Briefcase, label: 'Cases' }, { key: 'alerts', icon: Bell, label: 'Alerts' }].map((tab) => (
          <button key={tab.key} className={`flex-1 py-3 flex justify-center items-center gap-2 ${activeTab === tab.key ? 'bg-green-900/30 border-b-2 border-green-500' : 'hover:bg-green-900/10'}`} onClick={() => setActiveTab(tab.key as 'layers' | 'cases' | 'alerts')}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'layers' && (
          <div className="space-y-6">
            <div><h3 className="panel-h">Aviation</h3><LayerRow keyName="aircraft" /><LayerRow keyName="militaryFlights" /></div>
            <div><h3 className="panel-h">Space</h3><LayerRow keyName="satellites" /></div>
            <div><h3 className="panel-h">Earth</h3><LayerRow keyName="earthquakes" /></div>

            <h3 className="panel-h">Performance Governor</h3>
            <div className="space-y-2 border border-green-900/40 rounded p-3 bg-black/40 text-xs">
              <div className="flex justify-between"><span className="text-green-700">FPS</span><span>{performance.fps.toFixed(0)}</span></div>
              <div className="flex justify-between"><span className="text-green-700">Entities</span><span>{performance.entityCount}</span></div>
              <button className={`w-full p-2 border rounded flex items-center justify-center gap-2 ${performance.manualFastMode ? 'border-green-500 bg-green-900/30' : 'border-green-900/50'}`} onClick={() => setPerformance({ manualFastMode: !performance.manualFastMode })}><Zap size={14} /> Fast Mode (Manual)</button>
              <button className={`w-full p-2 border rounded flex items-center justify-center gap-2 ${performance.manualClustering ? 'border-green-500 bg-green-900/30' : 'border-green-900/50'}`} onClick={() => setPerformance({ manualClustering: !performance.manualClustering })}><Boxes size={14} /> Cluster Entities (Manual)</button>
              <button className={`w-full p-2 border rounded ${performance.context3dRequested ? 'border-green-500 bg-green-900/30' : 'border-green-900/50'}`} onClick={() => setPerformance({ context3dRequested: !performance.context3dRequested })}>Load 3D Context</button>
              <div className="text-[10px] text-green-700">Auto Fast: {performance.autoFastMode ? 'ON' : 'OFF'} | Auto Cluster: {performance.autoClustering ? 'ON' : 'OFF'}</div>
            </div>

            <h3 className="panel-h">Visual Modes</h3>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setVisualMode('normal')} className={`mode-btn ${visualMode === 'normal' ? 'mode-btn-active' : ''}`}><Eye size={16} /><span className="text-[10px] uppercase">Normal</span></button>
              <button onClick={() => setVisualMode('night-vision')} className={`mode-btn ${visualMode === 'night-vision' ? 'mode-btn-active' : ''}`}><Moon size={16} /><span className="text-[10px] uppercase">NVG</span></button>
              <button onClick={() => setVisualMode('thermal')} className={`mode-btn ${visualMode === 'thermal' ? 'mode-btn-active' : ''}`}><Thermometer size={16} /><span className="text-[10px] uppercase">FLIR</span></button>
            </div>

            <button onClick={toggleCrt} className={`w-full p-2 rounded flex items-center justify-center gap-2 border ${crtEnabled ? 'bg-green-900/40 border-green-500' : 'bg-black border-green-900/50 hover:bg-green-900/20'}`}>
              <Monitor size={16} /><span className="text-xs uppercase tracking-wider">CRT {crtEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <div className="space-y-2 border border-green-900/40 rounded p-3 bg-black/40">
              <div className="text-[11px] uppercase text-green-700 tracking-widest">Shader Controls</div>
              <label className="text-xs block">Pixelation {postFx.pixelation.toFixed(2)}</label>
              <input type="range" min="0" max="0.4" step="0.01" value={postFx.pixelation} onChange={(e) => setPostFx('pixelation', Number(e.target.value))} className="w-full" />
              <label className="text-xs block">Chromatic {postFx.chromaticAberration.toFixed(3)}</label>
              <input type="range" min="0" max="0.01" step="0.001" value={postFx.chromaticAberration} onChange={(e) => setPostFx('chromaticAberration', Number(e.target.value))} className="w-full" />
              <label className="text-xs block">Noise {postFx.noise.toFixed(2)}</label>
              <input type="range" min="0" max="0.25" step="0.01" value={postFx.noise} onChange={(e) => setPostFx('noise', Number(e.target.value))} className="w-full" />
            </div>
          </div>
        )}
        {activeTab === 'cases' && <div className="text-xs text-green-700 text-center py-8">No active cases</div>}
        {activeTab === 'alerts' && <div className="text-xs text-green-700 text-center py-8">No active alerts</div>}
      </div>
    </div>
  );
};

export default Sidebar;

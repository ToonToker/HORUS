import React from 'react';
import WorldviewCanvas from './components/WorldviewCanvas';
import OSINTDash from './components/OSINTDash';
import TopBar from './components/TopBar';
import DetailsPanel from './components/DetailsPanel';
import Timeline from './components/Timeline';
import SynapticStream from './components/SynapticStream';

export default function App() {
  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#000500] text-[#00FF41] font-mono">
      <SynapticStream />
      <TopBar />
      <div className="flex-1 flex relative overflow-hidden">
        <OSINTDash />
        <div className="flex-1 relative">
          <WorldviewCanvas />
        </div>
        <DetailsPanel />
      </div>
      <Timeline />
    </div>
  );
}

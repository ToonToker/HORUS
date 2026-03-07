import React from 'react';
import GlobeViewer from './components/GlobeViewer';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import DetailsPanel from './components/DetailsPanel';
import Timeline from './components/Timeline';

export default function App() {
  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#000500] text-[#00FF41] font-mono">
      <TopBar />
      <div className="flex-1 flex relative overflow-hidden">
        <Sidebar />
        <div className="flex-1 relative">
          <GlobeViewer />
        </div>
        <DetailsPanel />
      </div>
      <Timeline />
    </div>
  );
}

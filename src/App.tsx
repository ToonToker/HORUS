import React from 'react';
import GlobeViewer from './components/GlobeViewer';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import DetailsPanel from './components/DetailsPanel';
import Timeline from './components/Timeline';
import { useWorldViewStore } from './store';

export default function App() {
  const { crtEnabled } = useWorldViewStore();

  return (
    <div className={`w-screen h-screen overflow-hidden flex flex-col bg-black text-green-500 font-mono ${crtEnabled ? 'crt-scanlines' : ''}`}>
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

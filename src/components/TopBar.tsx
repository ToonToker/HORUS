import React, { useEffect, useState } from 'react';

const TopBar = () => {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/sovereign/status');
      setStatus(await res.json());
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="h-12 bg-[#000500] border-b border-[#00FF41]/30 px-4 flex items-center justify-between font-mono text-[#00FF41]">
      <div className="text-sm tracking-[0.3em] text-[#FFD700]">PROJECT HORUS · SOVEREIGN GEOSPATIAL ENGINE</div>
      <div className="text-xs">OFFLINE {status?.outboundNetworkBlocked ? 'LOCKED' : 'UNKNOWN'} · BORDERS {status?.counts?.borders ?? 0}</div>
    </header>
  );
};

export default TopBar;

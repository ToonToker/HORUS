import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { StreamKey, SynapticTrack, useWorldViewStore } from '../store';

const STREAM_KEYS: StreamKey[] = [
  'data:conflictZones', 'data:breaches', 'data:threatArcs', 'data:rfNodes', 'data:vessels',
  'data:cyberThreats', 'data:wardriving', 'data:resonanceLinks', 'data:ghostMarkers',
  'data:witnessAnnotations', 'data:seekerNodes', 'data:mcpNodes', 'data:liquidityHeatmap',
  'data:seismicWindows', 'data:highEntropyNodes',
];

const SynapticStream = () => {
  const setStreamBatch = useWorldViewStore((s) => s.setStreamBatch);

  useEffect(() => {
    const socket = io();
    STREAM_KEYS.forEach((stream) => {
      socket.on(stream, (payload: SynapticTrack[]) => setStreamBatch(stream, payload ?? []));
    });
    return () => socket.disconnect();
  }, [setStreamBatch]);

  return null;
};

export default SynapticStream;

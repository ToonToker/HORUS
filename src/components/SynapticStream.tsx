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
  const appendStreamItem = useWorldViewStore((s) => s.appendStreamItem);

  useEffect(() => {
    const socket = io();
    STREAM_KEYS.forEach((stream) => {
      socket.on(stream, (payload: SynapticTrack[]) => setStreamBatch(stream, payload ?? []));
    });

    const source = new EventSource('http://localhost:8000/api/kernel/events');
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.node) {
          appendStreamItem('data:seekerNodes', data.node as SynapticTrack);
        }
        if (Array.isArray(data?.edges)) {
          data.edges.forEach((e: any) => {
            const edge: SynapticTrack = {
              id: e.edge_id,
              from: { lat: Number(e?.source?.lat ?? data?.node?.lat ?? 0), lon: Number(e?.source?.lon ?? data?.node?.lon ?? 0) },
              to: { lat: Number(e?.target?.lat ?? data?.node?.lat ?? 0), lon: Number(e?.target?.lon ?? data?.node?.lon ?? 0) },
              relationship: e.relationship,
              ts: Date.now(),
            };
            appendStreamItem('data:resonanceLinks', edge);
          });
        }
      } catch {
        // ignore malformed SSE payloads
      }
    };

    return () => {
      source.close();
      socket.disconnect();
    };
  }, [setStreamBatch, appendStreamItem]);

  return null;
};

export default SynapticStream;

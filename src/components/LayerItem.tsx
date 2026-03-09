import React from 'react';
import { Settings } from 'lucide-react';
import { LayerKey } from '../store';

type LayerItemModel = {
  id: LayerKey;
  name: string;
  active: boolean;
  status: 'LIVE' | 'IDLE' | 'OFFLINE';
};

type Props = {
  layer: LayerItemModel;
  onToggle: (id: LayerKey) => void;
  onOpenSettings: (id: LayerKey) => void;
};

const StatusIndicator = ({ status }: { status: LayerItemModel['status'] }) => {
  const classes = status === 'LIVE'
    ? 'bg-[#00FF41]'
    : status === 'IDLE'
      ? 'bg-[#FFD700]'
      : 'bg-[#555]';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${classes}`} title={status} />;
};

export const LayerItem: React.FC<Props> = ({ layer, onToggle, onOpenSettings }) => (
  <div className="layer-item flex items-center justify-between p-2 border border-[#00FF41]/20 rounded hover:bg-[#00FF41]/5 transition">
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={layer.active}
        onChange={() => onToggle(layer.id)}
        className="w-4 h-4 rounded border-gray-600 bg-gray-700"
      />
      <span className="text-sm font-medium text-gray-300">{layer.name}</span>
    </div>

    <div className="flex items-center gap-2">
      <button
        onClick={() => onOpenSettings(layer.id)}
        className="p-1 text-gray-500 hover:text-cyan-400 transition-colors"
        title={`Configure ${layer.name}`}
        type="button"
      >
        <Settings size={16} />
      </button>
      <StatusIndicator status={layer.status} />
    </div>
  </div>
);

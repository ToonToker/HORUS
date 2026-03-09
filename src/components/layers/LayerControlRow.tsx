import React from 'react';
import { Settings } from 'lucide-react';
import { LayerKey } from '../../store';

type Props = {
  layerKey: LayerKey;
  label: string;
  checked: boolean;
  hasGear?: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
};

const LayerControlRow: React.FC<Props> = ({ layerKey, label, checked, hasGear, onToggle, onOpenSettings }) => (
  <label className="flex items-center justify-between border border-[#00FF41]/20 px-2 py-1 rounded gap-2" data-layer={layerKey}>
    <span>{label}</span>
    <span className="flex items-center gap-2">
      {hasGear && (
        <button type="button" title={`${label} settings`} onClick={onOpenSettings}>
          <Settings size={14} className="text-[#FFD700]" />
        </button>
      )}
      <input type="checkbox" checked={checked} onChange={onToggle} />
    </span>
  </label>
);

export default LayerControlRow;

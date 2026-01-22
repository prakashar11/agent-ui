/**
 * Add Node Modal - Modal for adding a new node to the graph
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { NODE_COLORS } from '../types';
import { NODE_TYPES } from '../constants';

export interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, nodeType: string) => void;
}

export function AddNodeModal({ isOpen, onClose, onAdd }: AddNodeModalProps) {
  const [name, setName] = useState('');
  const [nodeType, setNodeType] = useState('Asset');

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim(), nodeType);
      setName('');
      setNodeType('Asset');
      onClose();
    }
  };

  const handleClose = () => {
    setName('');
    setNodeType('Asset');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-green-400" />
            Add New Node
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Select a node type and enter a name for the new node.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Node Type */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">Node Type</label>
            <div className="grid grid-cols-3 gap-2">
              {NODE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setNodeType(type.value)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    nodeType === type.value
                      ? 'bg-neutral-700 text-white ring-1 ring-white/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="truncate">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Node Name */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${nodeType.toLowerCase()} name...`}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleClose}
            className="flex-1 py-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 py-2 text-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg transition-colors"
          >
            Add Node
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddNodeModal;

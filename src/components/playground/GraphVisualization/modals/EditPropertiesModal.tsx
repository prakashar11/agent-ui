/**
 * Edit Node Properties Modal - Modal for editing node properties
 */

import React, { useState, useEffect } from 'react';
import { Save, X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { NODE_COLORS, type CustomNode, type CustomNodeData } from '../types';

export interface EditPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, properties: Record<string, unknown>) => void;
  node: CustomNode | null;
}

export function EditPropertiesModal({ isOpen, onClose, onSave, node }: EditPropertiesModalProps) {
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Initialize properties when node changes
  useEffect(() => {
    if (node) {
      const nodeData = node.data as CustomNodeData;
      const props: Record<string, string> = {};
      if (nodeData.properties) {
        Object.entries(nodeData.properties).forEach(([key, value]) => {
          props[key] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
        });
      }
      setProperties(props);
    }
  }, [node]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNewKey('');
      setNewValue('');
    }
  }, [isOpen]);

  if (!node) return null;

  const nodeData = node.data as CustomNodeData;
  const color = NODE_COLORS[nodeData.nodeType] || NODE_COLORS.default;

  const handlePropertyChange = (key: string, value: string) => {
    setProperties(prev => ({ ...prev, [key]: value }));
  };

  const handleRemoveProperty = (key: string) => {
    setProperties(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleAddProperty = () => {
    if (newKey.trim()) {
      setProperties(prev => ({ ...prev, [newKey.trim()]: newValue }));
      setNewKey('');
      setNewValue('');
    }
  };

  const handleSave = () => {
    // Convert string values back to appropriate types
    const typedProperties: Record<string, unknown> = {};
    Object.entries(properties).forEach(([key, value]) => {
      // Try to parse as JSON for arrays/objects
      try {
        if (value.startsWith('[') || value.startsWith('{')) {
          typedProperties[key] = JSON.parse(value);
        } else if (value.includes(',') && !value.includes(':')) {
          // Treat comma-separated values as arrays
          typedProperties[key] = value.split(',').map(v => v.trim());
        } else if (!isNaN(Number(value)) && value !== '') {
          typedProperties[key] = Number(value);
        } else if (value === 'true') {
          typedProperties[key] = true;
        } else if (value === 'false') {
          typedProperties[key] = false;
        } else {
          typedProperties[key] = value;
        }
      } catch {
        typedProperties[key] = value;
      }
    });

    onSave(node.id, typedProperties);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px] max-h-[80vh] bg-neutral-900 border-neutral-700 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            Edit Properties
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            {nodeData.label} - {nodeData.nodeType}
          </DialogDescription>
        </DialogHeader>

        {/* Properties List */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
          {Object.entries(properties).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <div className="flex-1">
                <label className="block text-xs text-neutral-500 mb-1">{key}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handlePropertyChange(key, e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => handleRemoveProperty(key)}
                className="mt-6 p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-600/10 rounded transition-colors"
                title="Remove property"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {Object.keys(properties).length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-4">No properties defined</p>
          )}
        </div>

        {/* Add New Property */}
        <div className="border-t border-neutral-700 pt-4 mb-4">
          <p className="text-xs text-neutral-400 uppercase mb-2">Add New Property</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Property name"
              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProperty()}
            />
            <button
              onClick={handleAddProperty}
              disabled={!newKey.trim()}
              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Properties
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EditPropertiesModal;

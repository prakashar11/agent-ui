/**
 * Add Relationship Modal - Modal for adding a relationship between nodes
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { NODE_COLORS, EDGE_COLORS, type CustomNode, type CustomNodeData } from '../types';
import { RELATIONSHIP_TYPES } from '../constants';

export interface AddRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (sourceId: string, targetId: string, relType: string) => void;
  nodes: CustomNode[];
  selectedNodeId?: string;
}

export function AddRelationshipModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  nodes, 
  selectedNodeId 
}: AddRelationshipModalProps) {
  const [sourceId, setSourceId] = useState(selectedNodeId || '');
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState('CONNECTED_TO');
  const [searchSource, setSearchSource] = useState('');
  const [searchTarget, setSearchTarget] = useState('');

  useEffect(() => {
    if (selectedNodeId) {
      setSourceId(selectedNodeId);
    }
  }, [selectedNodeId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchSource('');
      setSearchTarget('');
    }
  }, [isOpen]);

  const filteredSourceNodes = useMemo(() => {
    return nodes.filter(n => {
      const data = n.data as CustomNodeData;
      return data.label.toLowerCase().includes(searchSource.toLowerCase()) ||
             data.nodeType.toLowerCase().includes(searchSource.toLowerCase());
    });
  }, [nodes, searchSource]);

  const filteredTargetNodes = useMemo(() => {
    return nodes.filter(n => {
      const data = n.data as CustomNodeData;
      return n.id !== sourceId && (
        data.label.toLowerCase().includes(searchTarget.toLowerCase()) ||
        data.nodeType.toLowerCase().includes(searchTarget.toLowerCase())
      );
    });
  }, [nodes, sourceId, searchTarget]);

  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    return node ? (node.data as CustomNodeData).label : '';
  };

  const handleSubmit = () => {
    if (sourceId && targetId && relType) {
      onAdd(sourceId, targetId, relType);
      setSourceId('');
      setTargetId('');
      setRelType('CONNECTED_TO');
      onClose();
    }
  };

  const handleClose = () => {
    setSourceId('');
    setTargetId('');
    setRelType('CONNECTED_TO');
    setSearchSource('');
    setSearchTarget('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[500px] max-h-[80vh] bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-blue-400" />
            Add Relationship
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Connect two nodes with a relationship type.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Source Node */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">From Node</label>
            <input
              type="text"
              value={searchSource}
              onChange={(e) => setSearchSource(e.target.value)}
              placeholder="Search source node..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 mb-2"
            />
            <div className="max-h-32 overflow-y-auto space-y-1 bg-neutral-800/50 rounded-lg p-2">
              {filteredSourceNodes.slice(0, 10).map(node => {
                const data = node.data as CustomNodeData;
                return (
                  <button
                    key={node.id}
                    onClick={() => setSourceId(node.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm ${
                      sourceId === node.id ? 'bg-blue-600 text-white' : 'hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS[data.nodeType] || NODE_COLORS.default }} />
                    <span className="truncate">{data.label}</span>
                    <span className="text-xs text-neutral-500 ml-auto">{data.nodeType}</span>
                  </button>
                );
              })}
              {filteredSourceNodes.length === 0 && (
                <div className="text-xs text-neutral-500 text-center py-2">No nodes found</div>
              )}
            </div>
          </div>

          {/* Relationship Type */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">Relationship</label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {RELATIONSHIP_TYPES.map(rel => (
                <button
                  key={rel.value}
                  onClick={() => setRelType(rel.value)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                    relType === rel.value
                      ? 'bg-neutral-700 text-white ring-1 ring-white/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rel.color }} />
                  {rel.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Node */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">To Node</label>
            <input
              type="text"
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              placeholder="Search target node..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 mb-2"
            />
            <div className="max-h-32 overflow-y-auto space-y-1 bg-neutral-800/50 rounded-lg p-2">
              {filteredTargetNodes.slice(0, 10).map(node => {
                const data = node.data as CustomNodeData;
                return (
                  <button
                    key={node.id}
                    onClick={() => setTargetId(node.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm ${
                      targetId === node.id ? 'bg-green-600 text-white' : 'hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS[data.nodeType] || NODE_COLORS.default }} />
                    <span className="truncate">{data.label}</span>
                    <span className="text-xs text-neutral-500 ml-auto">{data.nodeType}</span>
                  </button>
                );
              })}
              {filteredTargetNodes.length === 0 && (
                <div className="text-xs text-neutral-500 text-center py-2">No nodes found</div>
              )}
            </div>
          </div>

          {/* Preview */}
          {sourceId && targetId && (
            <div className="bg-neutral-800 rounded-lg p-3 text-center">
              <span className="text-blue-400">{getNodeLabel(sourceId)}</span>
              <span className="text-neutral-500 mx-2">→</span>
              <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: EDGE_COLORS[relType], color: 'white' }}>
                {relType.replace(/_/g, ' ')}
              </span>
              <span className="text-neutral-500 mx-2">→</span>
              <span className="text-green-400">{getNodeLabel(targetId)}</span>
            </div>
          )}
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
            disabled={!sourceId || !targetId}
            className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg transition-colors"
          >
            Add Relationship
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddRelationshipModal;

/**
 * Edit Relationship Modal - Modal for editing an existing relationship
 */

import React, { useState, useEffect } from 'react';
import { Pencil, Save } from 'lucide-react';
import type { Edge } from '@xyflow/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { EDGE_COLORS } from '../types';
import { RELATIONSHIP_TYPES, HANDLE_POSITIONS } from '../constants';

export interface EditRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (edgeId: string, newRelType: string, sourceHandle?: string, targetHandle?: string) => void;
  edge: Edge | null;
  sourceNodeName?: string;
  targetNodeName?: string;
}

export function EditRelationshipModal({ 
  isOpen, 
  onClose, 
  onSave, 
  edge, 
  sourceNodeName, 
  targetNodeName 
}: EditRelationshipModalProps) {
  const [relType, setRelType] = useState('');
  const [sourceHandle, setSourceHandle] = useState('bottom');
  const [targetHandle, setTargetHandle] = useState('top');
  
  // Track original values to show what's changing
  const [originalSourceHandle, setOriginalSourceHandle] = useState('bottom');
  const [originalTargetHandle, setOriginalTargetHandle] = useState('top');
  const [originalRelType, setOriginalRelType] = useState('');

  // Initialize with current values when edge changes
  useEffect(() => {
    if (edge) {
      // Get the original relationship type from edge data or label
      const currentType = (edge.data as { relationType?: string })?.relationType || 
        (typeof edge.label === 'string' ? edge.label.replace(/ /g, '_') : 'CONNECTED_TO');
      setRelType(currentType);
      setOriginalRelType(currentType);
      
      // Get current handle positions
      const srcHandle = edge.sourceHandle?.replace('source-', '') || 'bottom';
      const tgtHandle = edge.targetHandle?.replace('target-', '') || 'top';
      setSourceHandle(srcHandle);
      setTargetHandle(tgtHandle);
      setOriginalSourceHandle(srcHandle);
      setOriginalTargetHandle(tgtHandle);
    }
  }, [edge]);

  if (!edge) return null;

  const handleSubmit = () => {
    if (relType) {
      onSave(edge.id, relType, `source-${sourceHandle}`, `target-${targetHandle}`);
      onClose();
    }
  };
  
  // Check if anything has changed
  const hasSourceHandleChanged = sourceHandle !== originalSourceHandle;
  const hasTargetHandleChanged = targetHandle !== originalTargetHandle;
  const hasRelTypeChanged = relType !== originalRelType;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[440px] bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Pencil className="w-5 h-5 text-blue-400" />
            Edit Relationship
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            <span className="text-blue-400">{sourceNodeName || 'Source'}</span>
            {' → '}
            <span className="text-green-400">{targetNodeName || 'Target'}</span>
          </DialogDescription>
        </DialogHeader>
        
        {/* Relationship Type */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-400 uppercase mb-2">Relationship Type</label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {RELATIONSHIP_TYPES.map(rel => (
              <button
                key={rel.value}
                onClick={() => setRelType(rel.value)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
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

        {/* Connection Points */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          {/* Source Handle */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">
              Source Exit Point
            </label>
            <div className="flex gap-1">
              {HANDLE_POSITIONS.map(pos => (
                <button
                  key={pos.value}
                  onClick={() => setSourceHandle(pos.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    sourceHandle === pos.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title={pos.label}
                >
                  <span className="text-sm">{pos.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Handle */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">
              Target Entry Point
            </label>
            <div className="flex gap-1">
              {HANDLE_POSITIONS.map(pos => (
                <button
                  key={pos.value}
                  onClick={() => setTargetHandle(pos.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    targetHandle === pos.value
                      ? 'bg-green-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title={pos.label}
                >
                  <span className="text-sm">{pos.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visual Preview with Actual Node Names */}
        <div className="bg-neutral-800 rounded-lg p-4 mb-4">
          <p className="text-[10px] text-neutral-500 uppercase text-center mb-3">Connection Preview</p>
          
          <div className="flex items-center justify-center gap-3">
            {/* Source Node - with all 4 handle positions shown */}
            <div className="relative">
              <div className={`w-24 h-14 bg-blue-600/20 border-2 rounded-lg flex flex-col items-center justify-center ${
                hasSourceHandleChanged ? 'border-blue-400' : 'border-blue-600/50'
              }`}>
                <span className="text-[8px] text-blue-400 uppercase">Source</span>
                <span className="text-[10px] text-blue-300 font-medium truncate px-1 max-w-full">
                  {sourceNodeName || 'Node'}
                </span>
              </div>
              
              {/* All 4 handle positions for source */}
              {/* Top */}
              <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                sourceHandle === 'top' 
                  ? 'bg-blue-500 border-blue-300 scale-110' 
                  : originalSourceHandle === 'top'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalSourceHandle === 'top' && sourceHandle !== 'top' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Bottom */}
              <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                sourceHandle === 'bottom' 
                  ? 'bg-blue-500 border-blue-300 scale-110' 
                  : originalSourceHandle === 'bottom'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalSourceHandle === 'bottom' && sourceHandle !== 'bottom' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Left */}
              <div className={`absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                sourceHandle === 'left' 
                  ? 'bg-blue-500 border-blue-300 scale-110' 
                  : originalSourceHandle === 'left'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalSourceHandle === 'left' && sourceHandle !== 'left' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Right */}
              <div className={`absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                sourceHandle === 'right' 
                  ? 'bg-blue-500 border-blue-300 scale-110' 
                  : originalSourceHandle === 'right'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalSourceHandle === 'right' && sourceHandle !== 'right' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
            </div>
            
            {/* Arrow with relationship label */}
            <div className="flex flex-col items-center gap-1">
              <div className={`px-2 py-1 rounded text-[9px] font-medium whitespace-nowrap transition-all ${
                hasRelTypeChanged ? 'ring-2 ring-white/30' : ''
              }`}
                   style={{ backgroundColor: EDGE_COLORS[relType] || EDGE_COLORS.default, color: 'white' }}>
                {relType.replace(/_/g, ' ')}
              </div>
              <div className="flex items-center">
                <div className="w-6 h-0.5 bg-neutral-500" />
                <div className="w-0 h-0 border-l-4 border-l-neutral-500 border-y-[6px] border-y-transparent" />
              </div>
            </div>

            {/* Target Node - with all 4 handle positions shown */}
            <div className="relative">
              <div className={`w-24 h-14 bg-green-600/20 border-2 rounded-lg flex flex-col items-center justify-center ${
                hasTargetHandleChanged ? 'border-green-400' : 'border-green-600/50'
              }`}>
                <span className="text-[8px] text-green-400 uppercase">Target</span>
                <span className="text-[10px] text-green-300 font-medium truncate px-1 max-w-full">
                  {targetNodeName || 'Node'}
                </span>
              </div>
              
              {/* All 4 handle positions for target */}
              {/* Top */}
              <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                targetHandle === 'top' 
                  ? 'bg-green-500 border-green-300 scale-110' 
                  : originalTargetHandle === 'top'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalTargetHandle === 'top' && targetHandle !== 'top' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Bottom */}
              <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                targetHandle === 'bottom' 
                  ? 'bg-green-500 border-green-300 scale-110' 
                  : originalTargetHandle === 'bottom'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalTargetHandle === 'bottom' && targetHandle !== 'bottom' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Left */}
              <div className={`absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                targetHandle === 'left' 
                  ? 'bg-green-500 border-green-300 scale-110' 
                  : originalTargetHandle === 'left'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalTargetHandle === 'left' && targetHandle !== 'left' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Right */}
              <div className={`absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                targetHandle === 'right' 
                  ? 'bg-green-500 border-green-300 scale-110' 
                  : originalTargetHandle === 'right'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalTargetHandle === 'right' && targetHandle !== 'right' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Legend and status */}
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center justify-center gap-4 text-[9px]">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> Current selection
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-neutral-600 border border-neutral-400" /> Original
              </span>
            </div>
            {(hasSourceHandleChanged || hasTargetHandleChanged) && (
              <p className="text-[10px] text-amber-400 text-center">
                ⚡ Exit: {originalSourceHandle} → {sourceHandle} | Entry: {originalTargetHandle} → {targetHandle}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EditRelationshipModal;

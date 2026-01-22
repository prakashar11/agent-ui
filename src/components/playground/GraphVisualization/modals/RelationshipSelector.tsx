/**
 * Relationship Selector - Modal for selecting relationship type when connecting nodes
 */

import React from 'react';
import type { Connection } from '@xyflow/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RELATIONSHIP_TYPES } from '../constants';

export interface RelationshipSelectorProps {
  isOpen: boolean;
  connection: Connection | null;
  onSelect: (relType: string) => void;
  onCancel: () => void;
  sourceNodeName?: string;
  targetNodeName?: string;
}

export function RelationshipSelector({ 
  isOpen, 
  connection, 
  onSelect, 
  onCancel,
  sourceNodeName,
  targetNodeName,
}: RelationshipSelectorProps) {
  if (!connection) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-xs bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="text-white">Select Relationship Type</DialogTitle>
          <DialogDescription className="text-neutral-400">
            <span className="text-blue-400">{sourceNodeName}</span>
            {' → '}
            <span className="text-green-400">{targetNodeName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
          {RELATIONSHIP_TYPES.map((rel) => (
            <button
              key={rel.value}
              onClick={() => onSelect(rel.value)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: rel.color }}
              />
              <span className="text-sm text-white">{rel.label}</span>
            </button>
          ))}
        </div>
        
        <button
          onClick={onCancel}
          className="mt-4 w-full py-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}

export default RelationshipSelector;

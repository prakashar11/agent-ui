/**
 * Attack Path Panel - Shows discovered attack paths
 */

import React from 'react';
import { motion } from 'framer-motion';
import { X, Activity } from 'lucide-react';
import type { AttackPathStep } from '../types';

export interface AttackPathPanelProps {
  paths: AttackPathStep[][];
  threatId: string;
  targetAssetId: string;
  loading: boolean;
  onSelectNode: (nodeId: string) => void;
  onClose: () => void;
}

export function AttackPathPanel({ paths, loading, onSelectNode, onClose }: AttackPathPanelProps) {
  const getStepColor = (type: string) => {
    switch (type) {
      case 'threat': return 'bg-red-500';
      case 'attack': return 'bg-yellow-500';
      case 'category': return 'bg-purple-500';
      case 'asset': return 'bg-blue-500';
      default: return 'bg-neutral-500';
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[600px] max-h-80 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-xl overflow-hidden z-10"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Attack Paths</span>
            <span className="text-xs text-neutral-400">({paths.length} found)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin w-6 h-6 border-2 border-neutral-600 border-t-yellow-400 rounded-full" />
          </div>
        ) : paths.length === 0 ? (
          <div className="text-center py-6 text-neutral-500 text-sm">
            No attack paths found between selected threat and asset.
          </div>
        ) : (
          <div className="space-y-3 max-h-52 overflow-y-auto">
            {paths.map((path, pathIndex) => (
              <div key={pathIndex} className="bg-neutral-800/50 rounded-lg p-3">
                <div className="text-xs text-neutral-400 mb-2">Path {pathIndex + 1}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  {path.map((step, stepIndex) => (
                    <React.Fragment key={step.step}>
                      <button
                        onClick={() => onSelectNode(step.node_id)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs transition-colors"
                      >
                        <div className={`w-2 h-2 rounded-full ${getStepColor(step.type)}`} />
                        <span className="text-white">{step.name || step.node_id}</span>
                        <span className="text-neutral-500 capitalize">({step.type})</span>
                      </button>
                      {stepIndex < path.length - 1 && (
                        <span className="text-neutral-500 text-xs px-1">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default AttackPathPanel;

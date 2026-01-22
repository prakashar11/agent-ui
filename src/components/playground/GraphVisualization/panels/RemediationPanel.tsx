/**
 * Remediation Priorities Panel - Shows prioritized remediation recommendations
 */

import React from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle, Shield, Target, Zap, Activity } from 'lucide-react';
import type { RemediationRecommendation } from '../types';

export interface RemediationPanelProps {
  recommendations: RemediationRecommendation[];
  loading: boolean;
  onSelectTarget: (targetId: string) => void;
  onClose: () => void;
}

export function RemediationPanel({ recommendations, loading, onSelectTarget, onClose }: RemediationPanelProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'patch': return <Zap className="w-3 h-3" />;
      case 'control': return <Shield className="w-3 h-3" />;
      case 'architecture': return <Activity className="w-3 h-3" />;
      default: return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'patch': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'control': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'architecture': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-red-400';
      default: return 'text-neutral-400';
    }
  };

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      className="absolute left-0 top-0 h-full w-96 bg-neutral-900/95 backdrop-blur-sm border-r border-neutral-700 overflow-y-auto z-10"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Remediation Priorities</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-neutral-600 border-t-amber-400 rounded-full" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-sm">
            No remediation recommendations available.
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700/50"
              >
                {/* Priority Badge & Type */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-white">
                      {rec.priority_rank}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 border ${getTypeColor(rec.remediation_type)}`}>
                      {getTypeIcon(rec.remediation_type)}
                      {rec.remediation_type}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400">
                    Score: <span className="text-white font-medium">{Math.round(rec.priority_score)}</span>
                  </div>
                </div>

                {/* Target */}
                <div className="mb-2">
                  <div className="text-xs text-neutral-500 uppercase">Target</div>
                  <div className="text-sm text-white font-medium">{rec.target.name}</div>
                  <div className="text-xs text-neutral-400">{rec.target.type}</div>
                </div>

                {/* Action */}
                <div className="mb-2">
                  <div className="text-xs text-neutral-500 uppercase">Action</div>
                  <div className="text-sm text-neutral-200">{rec.action}</div>
                </div>

                {/* Rationale */}
                <div className="mb-3">
                  <div className="text-xs text-neutral-500 uppercase">Rationale</div>
                  <div className="text-xs text-neutral-400">{rec.rationale}</div>
                </div>

                {/* Impact & Effort */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {rec.impact.affected_assets.length > 0 && (
                      <span className="text-neutral-400">
                        <span className="text-blue-400">{rec.impact.affected_assets.length}</span> assets
                      </span>
                    )}
                    {rec.impact.mitigated_vulnerabilities.length > 0 && (
                      <span className="text-neutral-400">
                        <span className="text-orange-400">{rec.impact.mitigated_vulnerabilities.length}</span> vulns
                      </span>
                    )}
                  </div>
                  <span className={`${getEffortColor(rec.effort_level)} capitalize`}>
                    {rec.effort_level} effort
                  </span>
                </div>

                {/* Navigate Button */}
                {rec.target.id && (
                  <button
                    onClick={() => onSelectTarget(rec.target.id)}
                    className="w-full mt-3 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Target className="w-3 h-3" />
                    Focus Target in Graph
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default RemediationPanel;

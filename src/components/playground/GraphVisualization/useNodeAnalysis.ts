/**
 * Custom hook for node-specific analysis operations
 * 
 * Handles:
 * - CVE Analysis for Vulnerability nodes
 * - (Future) Vulnerability Scanning for Asset nodes
 * - (Future) Threat Intelligence enrichment for Threat nodes
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { CustomNode, CustomNodeData } from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface AnalysisStatus {
  nodeId: string;
  type: 'cve' | 'vulnerability-scan' | 'threat-intel';
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  startedAt: Date;
  message?: string;
}

export interface UseNodeAnalysisOptions {
  endpoint?: string;
  onRefresh: () => void;
}

export interface UseNodeAnalysisReturn {
  // State
  cveAnalysisInProgress: Set<string>;
  // Handlers
  runCVEAnalysis: (node: CustomNode) => void;
  // Future handlers
  // runVulnerabilityScan: (node: CustomNode) => void;
  // runThreatIntelEnrichment: (node: CustomNode) => void;
  // Utilities
  isAnalysisInProgress: (nodeId: string, type?: 'cve' | 'vulnerability-scan' | 'threat-intel') => boolean;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useNodeAnalysis({ endpoint, onRefresh }: UseNodeAnalysisOptions): UseNodeAnalysisReturn {
  // Track CVE analyses in progress (Set of node IDs)
  const [cveAnalysisInProgress, setCveAnalysisInProgress] = useState<Set<string>>(new Set());
  
  // Future: Track other analysis types
  // const [vulnScanInProgress, setVulnScanInProgress] = useState<Set<string>>(new Set());
  // const [threatIntelInProgress, setThreatIntelInProgress] = useState<Set<string>>(new Set());

  // =========================================================================
  // CVE ANALYSIS (for Vulnerability nodes)
  // =========================================================================
  
  const runCVEAnalysis = useCallback((node: CustomNode) => {
    if (!node) return;
    
    const nodeData = node.data as CustomNodeData;
    if (nodeData.nodeType !== 'Vulnerability') {
      toast.error('Invalid Node Type', { 
        description: 'CVE Analysis can only be run on Vulnerability nodes' 
      });
      return;
    }
    
    const cveId = nodeData.label;
    const nodeId = node.id;
    
    if (!cveId || !cveId.startsWith('CVE-')) {
      toast.error('Invalid CVE ID', { 
        description: 'Node name must be a valid CVE ID (e.g., CVE-2024-1234)' 
      });
      return;
    }
    
    // Mark this node as having analysis in progress
    setCveAnalysisInProgress(prev => new Set(prev).add(nodeId));
    
    // Show toast that analysis is starting
    toast.info(`Starting CVE Analysis: ${cveId}`, {
      description: 'Analysis running in background. Graph will refresh when done.',
      duration: 5000,
    });
    
    // Start CVE analysis in background
    const baseUrl = endpoint || 'http://localhost:7777';
    
    fetch(`${baseUrl}/v1/asset-graph/cve-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        cve_id: cveId,
        node_id: nodeId,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        // Remove from in-progress set on failure
        setCveAnalysisInProgress(prev => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        toast.error(`CVE Analysis Failed: ${cveId}`, {
          description: 'Could not start analysis. Check server logs.',
          duration: 5000,
        });
        return;
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        setCveAnalysisInProgress(prev => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      // Process SSE stream for final result only
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Only show toast for final result
              if (data.status === 'success') {
                // Remove from in-progress set on success
                setCveAnalysisInProgress(prev => {
                  const next = new Set(prev);
                  next.delete(nodeId);
                  return next;
                });
                const severity = data.summary?.severity?.toUpperCase() || 'Unknown';
                const exploitCount = data.summary?.exploit_count || 0;
                toast.success(`CVE Analysis Complete: ${cveId}`, {
                  description: `Severity: ${severity} | Exploits: ${exploitCount} found`,
                  duration: 8000,
                });
                onRefresh();
              } else if (data.status === 'error') {
                // Remove from in-progress set on error
                setCveAnalysisInProgress(prev => {
                  const next = new Set(prev);
                  next.delete(nodeId);
                  return next;
                });
                toast.error(`CVE Analysis Failed: ${cveId}`, {
                  description: data.error || 'Analysis encountered an error',
                  duration: 8000,
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }).catch((err) => {
      // Remove from in-progress set on exception
      setCveAnalysisInProgress(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      toast.error(`CVE Analysis Failed: ${cveId}`, {
        description: String(err),
        duration: 8000,
      });
    });
  }, [endpoint, onRefresh]);

  // =========================================================================
  // VULNERABILITY SCANNING (for Asset nodes) - Future Implementation
  // =========================================================================
  
  // const runVulnerabilityScan = useCallback((node: CustomNode) => {
  //   // TODO: Implement vulnerability scanning for Asset nodes
  //   // This would trigger a scan to find vulnerabilities associated with an asset
  // }, [endpoint, onRefresh]);

  // =========================================================================
  // THREAT INTEL ENRICHMENT (for Threat nodes) - Future Implementation
  // =========================================================================
  
  // const runThreatIntelEnrichment = useCallback((node: CustomNode) => {
  //   // TODO: Implement threat intelligence enrichment for Threat nodes
  //   // This would fetch additional context about threats from external sources
  // }, [endpoint, onRefresh]);

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================
  
  const isAnalysisInProgress = useCallback((
    nodeId: string, 
    type?: 'cve' | 'vulnerability-scan' | 'threat-intel'
  ): boolean => {
    if (!type || type === 'cve') {
      if (cveAnalysisInProgress.has(nodeId)) return true;
    }
    // Future: Check other analysis types
    // if (!type || type === 'vulnerability-scan') {
    //   if (vulnScanInProgress.has(nodeId)) return true;
    // }
    // if (!type || type === 'threat-intel') {
    //   if (threatIntelInProgress.has(nodeId)) return true;
    // }
    return false;
  }, [cveAnalysisInProgress]);

  return {
    cveAnalysisInProgress,
    runCVEAnalysis,
    isAnalysisInProgress,
  };
}

export default useNodeAnalysis;

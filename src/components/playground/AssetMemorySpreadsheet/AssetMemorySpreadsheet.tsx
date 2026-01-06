'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Edit3,
  Save,
  XCircle,
  Filter,
  Maximize2,
  Minimize2,
  Table2,
  AlertCircle,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APIRoutes } from '@/api/routes';
import {
  Asset,
  AssetListResponse,
  AssetStatsResponse,
  AssetMemorySpreadsheetProps,
  SortConfig,
  ColumnDef,
  SPREADSHEET_COLUMNS,
  CRITICALITY_COLORS,
  ENVIRONMENT_COLORS,
} from './types';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const getCriticalityBadgeClass = (criticality: string): string => {
  return CRITICALITY_COLORS[criticality.toLowerCase()] || CRITICALITY_COLORS.informational;
};

const getEnvironmentBadgeClass = (environment: string): string => {
  return ENVIRONMENT_COLORS[environment.toLowerCase()] || ENVIRONMENT_COLORS.unknown;
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface EditableCellProps {
  value: string | number | string[];
  column: ColumnDef;
  isEditing: boolean;
  onSave: (value: string | number | string[]) => void;
  onCancel: () => void;
  onEdit: () => void;
  options?: string[];
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  column,
  isEditing,
  onSave,
  onCancel,
  onEdit,
  options,
}) => {
  const [editValue, setEditValue] = useState<string>(
    Array.isArray(value) ? value.join(', ') : String(value ?? '')
  );

  useEffect(() => {
    setEditValue(Array.isArray(value) ? value.join(', ') : String(value ?? ''));
  }, [value, isEditing]);

  const handleSave = () => {
    let processedValue: string | number | string[] = editValue;
    if (column.type === 'array') {
      processedValue = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (column.type === 'number') {
      processedValue = parseFloat(editValue) || 0;
    }
    onSave(processedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!column.editable) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        {column.type === 'number' ? (
          <span className="font-mono">{typeof value === 'number' ? value.toFixed(2) : value}</span>
        ) : Array.isArray(value) ? (
          value.join(', ') || '-'
        ) : (
          String(value ?? '-')
        )}
      </div>
    );
  }

  if (isEditing) {
    if (column.type === 'select' && options) {
      return (
        <div className="flex items-center gap-1 px-1">
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-background border border-primary/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button onClick={handleSave} className="p-1 hover:bg-primary/20 rounded">
            <Check className="h-3 w-3 text-green-400" />
          </button>
          <button onClick={onCancel} className="p-1 hover:bg-destructive/20 rounded">
            <XCircle className="h-3 w-3 text-destructive" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 px-1">
        <input
          type={column.type === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-background border border-primary/50 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
          autoFocus
          placeholder={column.type === 'array' ? 'comma, separated, values' : ''}
        />
        <button onClick={handleSave} className="p-1 hover:bg-primary/20 rounded flex-shrink-0">
          <Check className="h-3 w-3 text-green-400" />
        </button>
        <button onClick={onCancel} className="p-1 hover:bg-destructive/20 rounded flex-shrink-0">
          <XCircle className="h-3 w-3 text-destructive" />
        </button>
      </div>
    );
  }

  // Display mode with badges for special columns
  const displayValue = Array.isArray(value) ? value.join(', ') : String(value ?? '-');

  if (column.key === 'criticality') {
    return (
      <div
        className="px-3 py-2 cursor-pointer hover:bg-muted/50 rounded"
        onClick={onEdit}
        title="Click to edit"
      >
        <span
          className={cn(
            'inline-flex px-2 py-0.5 rounded text-xs font-medium border',
            getCriticalityBadgeClass(String(value))
          )}
        >
          {displayValue}
        </span>
      </div>
    );
  }

  if (column.key === 'environment') {
    return (
      <div
        className="px-3 py-2 cursor-pointer hover:bg-muted/50 rounded"
        onClick={onEdit}
        title="Click to edit"
      >
        <span
          className={cn(
            'inline-flex px-2 py-0.5 rounded text-xs font-medium',
            getEnvironmentBadgeClass(String(value))
          )}
        >
          {displayValue}
        </span>
      </div>
    );
  }

  return (
    <div
      className="px-3 py-2 cursor-pointer hover:bg-muted/50 rounded text-sm truncate"
      onClick={onEdit}
      title={displayValue}
    >
      {displayValue || <span className="text-muted-foreground/50">-</span>}
    </div>
  );
};

// =============================================================================
// CREATE ASSET MODAL
// =============================================================================

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Partial<Asset>) => Promise<void>;
  assetTypes: string[];
  criticalities: string[];
  environments: string[];
}

const CreateAssetModal: React.FC<CreateAssetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  assetTypes,
  criticalities,
  environments,
}) => {
  const [formData, setFormData] = useState<Partial<Asset>>({
    hostname: '',
    name: '',
    asset_type: 'unknown',
    criticality: 'medium',
    environment: 'unknown',
    ip_addresses: [],
    tags: [],
    technologies: [],
    owner: '',
    business_unit: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [techInput, setTechInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hostname) return;

    setSaving(true);
    try {
      await onSave({
        ...formData,
        ip_addresses: ipInput.split(',').map((s) => s.trim()).filter(Boolean),
        tags: tagsInput.split(',').map((s) => s.trim()).filter(Boolean),
        technologies: techInput.split(',').map((s) => s.trim()).filter(Boolean),
      });
      onClose();
      // Reset form
      setFormData({
        hostname: '',
        name: '',
        asset_type: 'unknown',
        criticality: 'medium',
        environment: 'unknown',
        ip_addresses: [],
        tags: [],
        technologies: [],
        owner: '',
        business_unit: '',
        description: '',
      });
      setIpInput('');
      setTagsInput('');
      setTechInput('');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-2xl bg-background border border-border rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Create New Asset</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Hostname <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.hostname || ''}
                onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., web-server-01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Friendly name"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Asset Type</label>
              <select
                value={formData.asset_type || 'unknown'}
                onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {assetTypes.map((type) => (
                  <option key={type} value={type} className="bg-background text-foreground">
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Criticality</label>
              <select
                value={formData.criticality || 'medium'}
                onChange={(e) => setFormData({ ...formData, criticality: e.target.value })}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {criticalities.map((crit) => (
                  <option key={crit} value={crit} className="bg-background text-foreground">
                    {crit}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Environment</label>
              <select
                value={formData.environment || 'unknown'}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {environments.map((env) => (
                  <option key={env} value={env} className="bg-background text-foreground">
                    {env}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Owner</label>
              <input
                type="text"
                value={formData.owner || ''}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Team or person"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Business Unit</label>
              <input
                type="text"
                value={formData.business_unit || ''}
                onChange={(e) => setFormData({ ...formData, business_unit: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Department"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">IP Addresses</label>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Comma-separated: 192.168.1.1, 10.0.0.1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Comma-separated: web, critical, pci"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Technologies</label>
            <input
              type="text"
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Comma-separated: nginx, python, postgres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Asset description..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.hostname}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Asset
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const AssetMemorySpreadsheet: React.FC<AssetMemorySpreadsheetProps> = ({
  isOpen,
  onClose,
  endpoint,
}) => {
  // State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAssets, setTotalAssets] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  const [editingCell, setEditingCell] = useState<{ assetId: string; columnKey: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<AssetStatsResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ asset_type: '', criticality: '', environment: '' });

  // Metadata options with fallback defaults
  const DEFAULT_ASSET_TYPES = ['web_server', 'database', 'application_server', 'api_server', 'file_server', 'firewall', 'load_balancer', 'container', 'cloud_instance', 'workstation', 'network_device', 'unknown'];
  const DEFAULT_CRITICALITIES = ['critical', 'high', 'medium', 'low', 'informational'];
  const DEFAULT_ENVIRONMENTS = ['production', 'staging', 'development', 'testing', 'qa', 'sandbox', 'unknown'];

  const [assetTypes, setAssetTypes] = useState<string[]>(DEFAULT_ASSET_TYPES);
  const [criticalities, setCriticalities] = useState<string[]>(DEFAULT_CRITICALITIES);
  const [environments, setEnvironments] = useState<string[]>(DEFAULT_ENVIRONMENTS);

  // Import state
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================================================
  // API CALLS
  // ==========================================================================

  const fetchAssets = useCallback(async () => {
    if (!endpoint) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (searchQuery) params.append('search', searchQuery);
      if (filters.asset_type) params.append('asset_type', filters.asset_type);
      if (filters.criticality) params.append('criticality', filters.criticality);
      if (filters.environment) params.append('environment', filters.environment);

      const response = await fetch(`${APIRoutes.AssetMemoryList(endpoint)}?${params}`);
      
      // Handle response - even if not ok, try to parse and show empty state
      if (response.ok) {
        const data: AssetListResponse = await response.json();
        setAssets(data.assets || []);
        setTotalAssets(data.total || 0);
        setTotalPages(data.total_pages || 0);
      } else {
        // Server returned error - just show empty state, don't show error
        setAssets([]);
        setTotalAssets(0);
        setTotalPages(0);
      }
    } catch (err) {
      // Network error - show empty state, not error message
      console.error('Failed to fetch assets:', err);
      setAssets([]);
      setTotalAssets(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, searchQuery, filters]);

  const fetchStats = useCallback(async () => {
    if (!endpoint) return;

    try {
      const response = await fetch(APIRoutes.AssetMemoryStats(endpoint));
      if (response.ok) {
        const data: AssetStatsResponse = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [endpoint]);

  const fetchMetadata = useCallback(async () => {
    if (!endpoint) return;

    try {
      const [typesRes, critRes, envRes] = await Promise.all([
        fetch(APIRoutes.AssetMemoryMetadataTypes(endpoint)),
        fetch(APIRoutes.AssetMemoryMetadataCriticalities(endpoint)),
        fetch(APIRoutes.AssetMemoryMetadataEnvironments(endpoint)),
      ]);

      if (typesRes.ok) {
        const data = await typesRes.json();
        setAssetTypes(data.asset_types || []);
      }
      if (critRes.ok) {
        const data = await critRes.json();
        setCriticalities(data.criticalities?.map((c: { value: string }) => c.value) || []);
      }
      if (envRes.ok) {
        const data = await envRes.json();
        setEnvironments(data.environments || []);
      }
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  }, [endpoint]);

  const createAsset = async (asset: Partial<Asset>) => {
    if (!endpoint) return;

    const response = await fetch(APIRoutes.AssetMemoryCreate(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asset),
    });

    if (!response.ok) throw new Error('Failed to create asset');
    await fetchAssets();
    await fetchStats();
  };

  const updateAsset = async (assetId: string, updates: Partial<Asset>) => {
    if (!endpoint) return;

    const response = await fetch(
      APIRoutes.AssetMemoryUpdate(endpoint, assetId),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) throw new Error('Failed to update asset');
    await fetchAssets();
  };

  const deleteAssets = async (assetIds: string[]) => {
    if (!endpoint || assetIds.length === 0) return;

    if (assetIds.length === 1) {
      const response = await fetch(
        APIRoutes.AssetMemoryDelete(endpoint, assetIds[0]),
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete asset');
    } else {
      const response = await fetch(APIRoutes.AssetMemoryBulkDelete(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_ids: assetIds }),
      });
      if (!response.ok) throw new Error('Failed to delete assets');
    }

    setSelectedAssets(new Set());
    await fetchAssets();
    await fetchStats();
  };

  const exportAssets = async (format: 'json' | 'csv') => {
    if (!endpoint) return;

    const response = await fetch(
      `${APIRoutes.AssetMemoryExport(endpoint)}?format=${format}`
    );

    if (!response.ok) throw new Error('Failed to export assets');

    if (format === 'csv') {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'assets_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'assets_export.json';
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !endpoint) return;

    setImporting(true);
    try {
      const text = await file.text();
      let assetsToImport: Partial<Asset>[] = [];

      if (file.name.endsWith('.json')) {
        // Parse JSON
        const parsed = JSON.parse(text);
        assetsToImport = Array.isArray(parsed) ? parsed : parsed.assets || [];
      } else if (file.name.endsWith('.csv')) {
        // Parse CSV
        const lines = text.split('\n').filter((line) => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV file must have a header row and at least one data row');
        }
        
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
          const asset: Record<string, string | string[]> = {};
          
          headers.forEach((header, idx) => {
            const value = values[idx] || '';
            // Handle array fields
            if (['ip_addresses', 'tags', 'technologies'].includes(header)) {
              asset[header] = value.split(/[;|]/).map((v) => v.trim()).filter(Boolean);
            } else {
              asset[header] = value;
            }
          });
          
          if (asset.hostname || asset.name) {
            assetsToImport.push(asset as Partial<Asset>);
          }
        }
      } else {
        throw new Error('Unsupported file format. Please use CSV or JSON files.');
      }

      if (assetsToImport.length === 0) {
        throw new Error('No valid assets found in the file');
      }

      // Bulk create the assets
      const response = await fetch(APIRoutes.AssetMemoryBulkCreate(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: assetsToImport }),
      });

      if (!response.ok) throw new Error('Failed to import assets');

      const result = await response.json();
      console.log(`Imported ${result.created_count} assets`);
      
      await fetchAssets();
      await fetchStats();
    } catch (err) {
      console.error('Import error:', err);
      alert(err instanceof Error ? err.message : 'Failed to import assets');
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useEffect(() => {
    if (isOpen) {
      fetchAssets();
      fetchStats();
      fetchMetadata();
    }
  }, [isOpen, fetchAssets, fetchStats, fetchMetadata]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (editingCell) {
          setEditingCell(null);
        } else if (showCreateModal) {
          setShowCreateModal(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingCell, showCreateModal, onClose]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleSort = (key: keyof Asset) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key
          ? current.direction === 'asc'
            ? 'desc'
            : current.direction === 'desc'
              ? null
              : 'asc'
          : 'asc',
    }));
  };

  const handleSelectAll = () => {
    if (selectedAssets.size === assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map((a) => a.asset_id)));
    }
  };

  const handleSelectAsset = (assetId: string) => {
    setSelectedAssets((current) => {
      const newSet = new Set(current);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const handleCellEdit = (assetId: string, columnKey: string) => {
    setEditingCell({ assetId, columnKey });
  };

  const handleCellSave = async (assetId: string, columnKey: string, value: string | number | string[]) => {
    await updateAsset(assetId, { [columnKey]: value });
    setEditingCell(null);
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  // ==========================================================================
  // SORTED ASSETS
  // ==========================================================================

  const sortedAssets = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return assets;

    return [...assets].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof Asset];
      const bVal = b[sortConfig.key as keyof Asset];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const aStr = Array.isArray(aVal) ? aVal.join(',') : String(aVal);
      const bStr = Array.isArray(bVal) ? bVal.join(',') : String(bVal);

      const comparison = aStr.localeCompare(bStr, undefined, { numeric: true });
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [assets, sortConfig]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'relative z-10 flex flex-col bg-background border border-border rounded-xl shadow-2xl',
            isFullscreen ? 'w-screen h-screen rounded-none' : 'w-[95vw] h-[90vh] max-w-7xl'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Table2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Asset Memory Spreadsheet</h2>
                <p className="text-sm text-muted-foreground">
                  {totalAssets} asset{totalAssets !== 1 ? 's' : ''} in memory
                  {stats?.asset_stats?.cached_at && (
                    <span className="ml-2 text-xs">
                      • Last updated: {formatTimestamp(stats.asset_stats.cached_at)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search assets..."
                  className="pl-9 pr-4 py-2 w-64 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                  showFilters
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-border hover:bg-muted'
                )}
              >
                <Filter className="h-4 w-4" />
                <span className="text-sm">Filters</span>
              </button>

              {/* Refresh */}
              <button
                onClick={() => {
                  fetchAssets();
                  fetchStats();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                <span className="text-sm">Refresh</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Bulk Delete */}
              {selectedAssets.size > 0 && (
                <button
                  onClick={() => deleteAssets(Array.from(selectedAssets))}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm">Delete ({selectedAssets.size})</span>
                </button>
              )}

              {/* Import */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileImport}
                className="hidden"
              />
              <button
                onClick={handleImportClick}
                disabled={importing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                title="Import assets from CSV or JSON"
              >
                <Upload className={cn('h-4 w-4', importing && 'animate-pulse')} />
                <span className="text-sm">{importing ? 'Importing...' : 'Import'}</span>
              </button>

              {/* Export */}
              <div className="flex items-center">
                <button
                  onClick={() => exportAssets('csv')}
                  className="flex items-center gap-2 px-3 py-2 rounded-l-lg border border-border bg-background hover:bg-muted transition-colors"
                  title="Export to CSV"
                >
                  <Download className="h-4 w-4" />
                  <span className="text-sm">CSV</span>
                </button>
                <button
                  onClick={() => exportAssets('json')}
                  className="flex items-center gap-2 px-3 py-2 rounded-r-lg border border-l-0 border-border bg-background hover:bg-muted transition-colors"
                  title="Export to JSON"
                >
                  <span className="text-sm">JSON</span>
                </button>
              </div>

              {/* Create */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Add Asset</span>
              </button>
            </div>
          </div>

          {/* Filters Row */}
          {showFilters && (
            <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Type:</label>
                <select
                  value={filters.asset_type}
                  onChange={(e) => {
                    setFilters({ ...filters, asset_type: e.target.value });
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-background border border-border rounded text-sm"
                >
                  <option value="">All</option>
                  {assetTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Criticality:</label>
                <select
                  value={filters.criticality}
                  onChange={(e) => {
                    setFilters({ ...filters, criticality: e.target.value });
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-background border border-border rounded text-sm"
                >
                  <option value="">All</option>
                  {criticalities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Environment:</label>
                <select
                  value={filters.environment}
                  onChange={(e) => {
                    setFilters({ ...filters, environment: e.target.value });
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-background border border-border rounded text-sm"
                >
                  <option value="">All</option>
                  {environments.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  setFilters({ asset_type: '', criticality: '', environment: '' });
                  setPage(1);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-destructive">{error}</p>
                <button
                  onClick={fetchAssets}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                >
                  Retry
                </button>
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <Table2 className="h-16 w-16 opacity-50" />
                <p className="text-lg">No assets found</p>
                <p className="text-sm">Create your first asset using the &ldquo;Add Asset&rdquo; button</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Asset
                </button>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left border-b border-border w-12">
                      <input
                        type="checkbox"
                        checked={selectedAssets.size === assets.length && assets.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-border"
                      />
                    </th>
                    {SPREADSHEET_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border cursor-pointer hover:bg-muted/70 transition-colors"
                        style={{ minWidth: col.width }}
                        onClick={() => handleSort(col.key)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortConfig.key === col.key && (
                            <span>
                              {sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : sortConfig.direction === 'desc' ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : null}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAssets.map((asset, idx) => (
                    <tr
                      key={asset.asset_id}
                      className={cn(
                        'border-b border-border/50 hover:bg-muted/30 transition-colors',
                        selectedAssets.has(asset.asset_id) && 'bg-primary/5',
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedAssets.has(asset.asset_id)}
                          onChange={() => handleSelectAsset(asset.asset_id)}
                          className="rounded border-border"
                        />
                      </td>
                      {SPREADSHEET_COLUMNS.map((col) => (
                        <td key={col.key} className="border-r border-border/30 last:border-r-0">
                          <EditableCell
                            value={asset[col.key] as string | number | string[]}
                            column={col}
                            isEditing={
                              editingCell?.assetId === asset.asset_id &&
                              editingCell?.columnKey === col.key
                            }
                            onSave={(value) => handleCellSave(asset.asset_id, col.key, value)}
                            onCancel={handleCellCancel}
                            onEdit={() => handleCellEdit(asset.asset_id, col.key)}
                            options={
                              col.key === 'asset_type'
                                ? assetTypes
                                : col.key === 'criticality'
                                  ? criticalities
                                  : col.key === 'environment'
                                    ? environments
                                    : undefined
                            }
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <button
                          onClick={() => deleteAssets([asset.asset_id])}
                          className="p-1.5 hover:bg-destructive/20 rounded transition-colors"
                          title="Delete asset"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/30">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalAssets)} of{' '}
                {totalAssets} assets
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Stats Bar */}
          {stats && (
            <div className="flex items-center gap-6 px-6 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {Object.entries(stats.asset_stats.criticality_distribution || {}).map(([key, count]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      key === 'critical'
                        ? 'bg-red-500'
                        : key === 'high'
                          ? 'bg-orange-500'
                          : key === 'medium'
                            ? 'bg-yellow-500'
                            : key === 'low'
                              ? 'bg-green-500'
                              : 'bg-gray-500'
                    )}
                  />
                  <span className="capitalize">{key}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Create Asset Modal */}
        <CreateAssetModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={createAsset}
          assetTypes={assetTypes}
          criticalities={criticalities}
          environments={environments}
        />
      </div>
    </AnimatePresence>
  );

  // Render in portal
  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
};


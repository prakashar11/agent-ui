'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
  Shield,
  AlertCircle,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  FileText,
  CloudUpload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APIRoutes } from '@/api/routes';
import { parseCSV, mapCSVHeaders } from '../utils';
import {
  HygieneEssential,
  HygieneEssentialListResponse,
  HygieneEssentialsSpreadsheetProps,
  SortConfig,
  ColumnDef,
  SPREADSHEET_COLUMNS,
  MATURITY_COLORS,
  CONTROL_TYPE_COLORS,
  CSV_FIELD_MAPPINGS,
} from './types';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const getMaturityBadgeClass = (maturity: string): string => {
  return MATURITY_COLORS[maturity.toLowerCase()] || MATURITY_COLORS.basic;
};

const getControlTypeBadgeClass = (controlType: string): string => {
  return CONTROL_TYPE_COLORS[controlType.toLowerCase()] || CONTROL_TYPE_COLORS.unknown;
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface EditableCellProps {
  value: string;
  column: ColumnDef;
  isEditing: boolean;
  onSave: (value: string) => void;
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
  const [editValue, setEditValue] = useState<string>(String(value ?? ''));

  useEffect(() => {
    setEditValue(String(value ?? ''));
  }, [value, isEditing]);

  const handleSave = () => {
    onSave(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (isEditing) {
    if (column.type === 'select' && options) {
      return (
        <div className="flex items-center gap-1">
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 bg-background text-foreground border border-primary rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          >
            {options.map((opt) => (
              <option key={opt} value={opt} className="bg-background text-foreground">
                {opt}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            className="p-1 text-green-400 hover:bg-green-500/20 rounded"
          >
            <Save className="h-3 w-3" />
          </button>
          <button
            onClick={onCancel}
            className="p-1 text-muted-foreground hover:bg-muted rounded"
          >
            <XCircle className="h-3 w-3" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 bg-muted border border-primary rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-400 hover:bg-green-500/20 rounded"
        >
          <Save className="h-3 w-3" />
        </button>
        <button
          onClick={onCancel}
          className="p-1 text-muted-foreground hover:bg-muted rounded"
        >
          <XCircle className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Render badge for maturity level
  if (column.key === 'maturity_level') {
    return (
      <button
        onClick={onEdit}
        className={cn(
          'px-2 py-0.5 text-xs font-medium rounded border capitalize',
          getMaturityBadgeClass(String(value))
        )}
      >
        {String(value)}
      </button>
    );
  }

  // Render badge for control type
  if (column.key === 'control_type') {
    return (
      <button
        onClick={onEdit}
        className={cn(
          'px-2 py-0.5 text-xs font-medium rounded capitalize',
          getControlTypeBadgeClass(String(value))
        )}
      >
        {String(value)}
      </button>
    );
  }

  // Default text display
  return (
    <button
      onClick={onEdit}
      className="text-left w-full truncate hover:text-primary transition-colors"
      title={String(value)}
    >
      {String(value) || '-'}
    </button>
  );
};

// =============================================================================
// CREATE ESSENTIAL MODAL
// =============================================================================

interface CreateEssentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (essential: Partial<HygieneEssential>) => Promise<void>;
  categories: string[];
  maturityLevels: string[];
  controlTypes: string[];
}

const CreateEssentialModal: React.FC<CreateEssentialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  maturityLevels,
  controlTypes,
}) => {
  const [formData, setFormData] = useState<Partial<HygieneEssential>>({
    name: '',
    category: '',
    maturity_level: 'basic',
    control_type: 'unknown',
    source: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category) return;

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
      // Reset form
      setFormData({
        name: '',
        category: '',
        maturity_level: 'basic',
        control_type: 'unknown',
        source: '',
        description: '',
      });
      setShowCustomCategory(false);
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
        className="relative z-10 w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Add Hygiene Essential</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Hygiene Essential Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Enable TLS 1.3"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">
                Asset Category <span className="text-destructive">*</span>
              </label>
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomCategory(!showCustomCategory);
                    setFormData({ ...formData, category: '' });
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {showCustomCategory ? '← Select from list' : '+ Add custom'}
                </button>
              )}
            </div>
            {showCustomCategory || categories.length === 0 ? (
              <input
                type="text"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Web Server, Database, Linux"
                required
              />
            ) : (
              <select
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                required
              >
                <option value="" className="bg-background text-muted-foreground">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-background text-foreground">
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Maturity Level</label>
              <select
                value={formData.maturity_level || 'basic'}
                onChange={(e) => setFormData({ ...formData, maturity_level: e.target.value })}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {maturityLevels.map((level) => (
                  <option key={level} value={level} className="bg-background text-foreground capitalize">
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Control Type</label>
              <select
                value={formData.control_type || 'unknown'}
                onChange={(e) => setFormData({ ...formData, control_type: e.target.value })}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {controlTypes.map((type) => (
                  <option key={type} value={type} className="bg-background text-foreground capitalize">
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <input
              type="text"
              value={formData.source || ''}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., CIS, NIST, Custom"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px] resize-none"
              placeholder="Describe the hygiene essential..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name || !formData.category}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Essential
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

export const HygieneEssentialsSpreadsheet: React.FC<HygieneEssentialsSpreadsheetProps> = ({
  isOpen,
  onClose,
  endpoint,
}) => {
  // State
  const [essentials, setEssentials] = useState<HygieneEssential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  const [editingCell, setEditingCell] = useState<{ id: string; columnKey: string } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pending imports (staged but not yet saved to backend)
  const [pendingImports, setPendingImports] = useState<HygieneEssential[]>([]);
  const [savingImports, setSavingImports] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const maturityLevels = ['basic', 'intermediate', 'advanced'];
  const controlTypes = ['preventive', 'detective', 'corrective', 'unknown'];

  // Get base URL from endpoint
  const baseUrl = useMemo(() => {
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${url.host}`;
    } catch {
      return '';
    }
  }, [endpoint]);

  // Fetch essentials
  const fetchEssentials = useCallback(async () => {
    if (!baseUrl) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      params.append('limit', '500');

      const response = await fetch(`${baseUrl}/v1/asset-graph/hygiene-essentials?${params}`);
      if (!response.ok) throw new Error('Failed to fetch hygiene essentials');

      const data: HygieneEssentialListResponse = await response.json();
      setEssentials(data.essentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, categoryFilter]);

  // Fetch categories from both hygiene essentials and asset graph
  const fetchCategories = useCallback(async () => {
    if (!baseUrl) return;

    try {
      const allCategories = new Set<string>();
      
      // Fetch from hygiene essentials categories
      try {
        const hygieneResponse = await fetch(`${baseUrl}/v1/asset-graph/hygiene-essentials/categories`);
        if (hygieneResponse.ok) {
          const data = await hygieneResponse.json();
          data.categories.forEach((c: { name: string }) => allCategories.add(c.name));
        }
      } catch {
        // Ignore
      }

      // Fetch asset categories from asset graph
      try {
        const graphResponse = await fetch(`${baseUrl}/v1/asset-graph/search?q=&node_type=AssetCategory&limit=100`);
        if (graphResponse.ok) {
          const data = await graphResponse.json();
          data.results.forEach((node: { name: string }) => allCategories.add(node.name));
        }
      } catch {
        // Ignore
      }

      // Add common default categories if none found
      if (allCategories.size === 0) {
        ['Web Server', 'Database', 'Linux', 'Windows', 'Network Device', 'Cloud Infrastructure', 'Container', 'API Gateway'].forEach(c => allCategories.add(c));
      }

      setCategories(Array.from(allCategories).sort());
    } catch {
      // Ignore errors
    }
  }, [baseUrl]);

  useEffect(() => {
    if (isOpen) {
      fetchEssentials();
      fetchCategories();
    }
  }, [isOpen, fetchEssentials, fetchCategories]);

  // Create essential
  const createEssential = async (essential: Partial<HygieneEssential>) => {
    try {
      const response = await fetch(`${baseUrl}/v1/asset-graph/hygiene-essentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(essential),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMsg = errorData.detail || response.statusText || 'Failed to create';
        toast.error(`Create failed: ${errorMsg}`);
        setError(`Failed to create hygiene essential: ${errorMsg}`);
        return;
      }
      
      toast.success('Hygiene essential created');
      await fetchEssentials();
      await fetchCategories();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      toast.error(`Create failed: ${errorMsg}`);
      setError(`Failed to create hygiene essential: ${errorMsg}`);
    }
  };

  // Update essential
  const updateEssential = async (id: string, updates: Partial<HygieneEssential>) => {
    try {
      const response = await fetch(`${baseUrl}/v1/asset-graph/hygiene-essentials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: updates }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMsg = errorData.detail || response.statusText || 'Failed to update';
        toast.error(`Update failed: ${errorMsg}`);
        setError(`Failed to update hygiene essential: ${errorMsg}`);
        return;
      }
      
      toast.success('Hygiene essential updated');
      await fetchEssentials();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      toast.error(`Update failed: ${errorMsg}`);
      setError(`Failed to update hygiene essential: ${errorMsg}`);
    }
  };

  // Delete essentials
  const deleteEssentials = async (ids: string[]) => {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const response = await fetch(`${baseUrl}/v1/asset-graph/hygiene-essentials/${id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          successCount++;
        } else {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          errorCount++;
          errors.push(`${id}: ${errorData.detail || response.statusText}`);
        }
      } catch (err) {
        errorCount++;
        errors.push(`${id}: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    }

    setSelectedIds(new Set());
    await fetchEssentials();

    if (successCount > 0 && errorCount === 0) {
      toast.success(`Deleted ${successCount} hygiene essential(s)`);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`Deleted ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
    } else if (errorCount > 0) {
      toast.error(`Failed to delete: ${errors.join('; ')}`);
      setError(`Delete failed: ${errors.join('; ')}`);
    }
  };

  // Export
  const exportEssentials = async (format: 'json' | 'csv') => {
    // Check if there are essentials to export
    if (essentials.length === 0) {
      toast.info('No essentials to export', {
        description: 'Add some hygiene essentials first before exporting.',
      });
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/v1/asset-graph/hygiene-essentials/export?format=${format}`);
      
      if (!response.ok) {
        toast.error('Export failed', {
          description: 'Failed to export hygiene essentials. Please try again.',
        });
        return;
      }

      const data = await response.json();

      if (format === 'csv') {
        const headers = data.headers.join(',');
        const rows = data.rows.map((row: Record<string, string>) =>
          data.headers.map((h: string) => `"${(row[h] || '').replace(/"/g, '""')}"`).join(',')
        );
        const csvContent = [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hygiene_essentials.csv';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(data.essentials, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hygiene_essentials.json';
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success('Export complete', {
        description: `Hygiene essentials exported as ${format.toUpperCase()} successfully.`,
      });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed', {
        description: 'An unexpected error occurred during export.',
      });
    }
  };

  // Import handler
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    toast.info(`Reading ${file.name}...`);

    try {
      const text = await file.text();
      let essentialsData: Array<Record<string, string>> = [];
      let skippedRows = 0;
      let totalRows = 0;

      // Debug: Log raw file content (first 500 chars)
      console.log('CSV Import - Raw text (first 500 chars):', text.substring(0, 500));
      console.log('CSV Import - Contains \\r\\n:', text.includes('\r\n'));
      console.log('CSV Import - Contains \\n:', text.includes('\n'));
      console.log('CSV Import - Contains quotes:', text.includes('"'));
      
      // Debug: Find and log multi-line quoted fields in raw text
      const multiLineQuotedPattern = /"[^"]*[\n\r][^"]*"/g;
      const multiLineMatches = text.match(multiLineQuotedPattern);
      if (multiLineMatches) {
        console.log(`📋 Found ${multiLineMatches.length} multi-line quoted fields in raw CSV:`);
        multiLineMatches.forEach((match, idx) => {
          console.log(`  ${idx + 1}: "${match.substring(0, 60).replace(/[\n\r]/g, '\\n')}..." (${match.length} chars)`);
        });
      } else {
        console.log('📋 No multi-line quoted fields detected in raw file - check if file has standard line endings');
        // Additional check: show characters around first quote
        const firstQuoteIdx = text.indexOf('"');
        if (firstQuoteIdx > -1) {
          const snippet = text.substring(firstQuoteIdx, firstQuoteIdx + 100);
          console.log('First quoted section:', snippet.replace(/[\n\r]/g, '\\n'));
        }
      }

      if (file.name.endsWith('.json')) {
        const json = JSON.parse(text);
        const rawData = Array.isArray(json) ? json : json.essentials || [];
        // Filter out rows with empty essentials/name
        essentialsData = rawData.filter((row: Record<string, string>) => {
          totalRows++;
          if (!row.name?.trim() && !row.essentials?.trim()) {
            skippedRows++;
            return false;
          }
          return true;
        });
      } else if (file.name.endsWith('.csv')) {
        // Use shared RFC 4180 compliant CSV parser
        const parseResult = parseCSV(text, { debug: true });
        const allRows = parseResult.rows;
        
        if (allRows.length < 2) throw new Error('CSV file is empty or has no data rows');

        const headers = allRows[0].map((h) => h.toLowerCase());
        toast.info(`Found ${allRows.length - 1} rows, parsing...`);

        // Map CSV headers using shared utility
        const headerMap = mapCSVHeaders(headers, CSV_FIELD_MAPPINGS);

        // Track previous category for inheritance
        let previousCategory = '';

        for (let i = 1; i < allRows.length; i++) {
          totalRows++;
          const values = allRows[i];
          const row: Record<string, string> = {};

          values.forEach((value, idx) => {
            const field = headerMap[idx];
            if (field && value) {
              row[field] = value;
            }
          });

          // Skip rows with empty essential/name
          const essentialName = row.name?.trim();
          if (!essentialName) {
            skippedRows++;
            continue;
          }

          // Inherit category from previous row if empty
          let category = row.category?.trim();
          if (!category) {
            category = previousCategory || 'General';
          } else {
            previousCategory = category; // Update for next row
          }
          row.category = category;

          essentialsData.push(row);
        }

        console.log(`Parsed ${essentialsData.length} valid rows, skipped ${skippedRows} empty rows`);
        console.log('Header mapping:', headerMap);
        console.log('Headers from CSV:', headers);
        console.log('First 5 essentials data after mapping:');
        essentialsData.slice(0, 5).forEach((row, idx) => {
          console.log(`  ${idx}: category="${row.category}", name="${row.name?.substring(0, 40).replace(/\n/g, '\\n')}...", maturity="${row.maturity_level}"`);
        });
        
        // Check for any essentials with newlines in name (verify multi-line preserved)
        const multiLineEssentials = essentialsData.filter(e => e.name?.includes('\n'));
        if (multiLineEssentials.length > 0) {
          console.log(`✅ Multi-line essentials found: ${multiLineEssentials.length}`);
          multiLineEssentials.forEach((e, idx) => {
            console.log(`  ${idx}: "${e.name?.substring(0, 60).replace(/\n/g, '\\n')}..."`);
          });
        } else {
          console.log('⚠️ No multi-line essentials found in imported data');
        }
      }

      if (essentialsData.length === 0) {
        toast.error('No valid hygiene essentials found in file');
        throw new Error(
          'No valid hygiene essentials found. Rows must have an "essentials" (name) value. Empty essentials are skipped.'
        );
      }

      // Convert to HygieneEssential format for staging
      const importedEssentials: HygieneEssential[] = essentialsData.map((row, idx) => ({
        id: `pending_${Date.now()}_${idx}`,
        name: row.name || row.essentials || '',
        category: row.category || 'General',
        categories: [row.category || 'General'],
        maturity_level: row.maturity_level || 'basic',
        control_type: row.control_type || 'unknown',
        description: row.description || '',
        source: row.source || '',
        status: 'pending',
      }));

      // Stage the imports (don't save to backend yet)
      setPendingImports(importedEssentials);
      
      const message = skippedRows > 0 
        ? `Loaded ${importedEssentials.length} essentials (skipped ${skippedRows} empty rows). Click "Save to Backend" to persist.`
        : `Loaded ${importedEssentials.length} essentials. Click "Save to Backend" to persist.`;
      
      toast.success(message, { duration: 5000 });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      event.target.value = '';
    }
  };

  // Save pending imports to backend
  const savePendingImports = async () => {
    if (pendingImports.length === 0) return;

    setSavingImports(true);
    toast.info(`Saving ${pendingImports.length} essentials to backend...`);

    try {
      const essentialsData = pendingImports.map(e => ({
        name: e.name,
        category: e.category,
        maturity_level: e.maturity_level,
        control_type: e.control_type,
        description: e.description,
        source: e.source,
      }));

      const response = await fetch(`${baseUrl}/v1/asset-graph/hygiene-essentials/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essentials: essentialsData }),
      });

      if (!response.ok) throw new Error('Save failed');

      const result = await response.json();
      
      toast.success(`Saved ${result.imported} of ${result.total} hygiene essentials to backend`);
      
      // Clear pending imports and refresh
      setPendingImports([]);
      await fetchEssentials();
      await fetchCategories();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Save failed';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSavingImports(false);
    }
  };

  // Update a pending import
  const updatePendingImport = (id: string, field: keyof HygieneEssential, value: string) => {
    setPendingImports(prev => 
      prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Delete a pending import
  const deletePendingImport = (id: string) => {
    setPendingImports(prev => prev.filter(item => item.id !== id));
    toast.info('Removed from pending imports');
  };

  // Clear all pending imports
  const clearPendingImports = () => {
    setPendingImports([]);
    toast.info('Cleared all pending imports');
  };

  // Cleanup garbage categories
  const cleanupGarbageCategories = async () => {
    toast.info('Cleaning up garbage categories...');
    try {
      const response = await fetch(`${baseUrl}/v1/asset-graph/cleanup-categories`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Cleanup failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      toast.success(`Cleanup: Deleted ${result.deleted_count} garbage categories, kept ${result.kept_count} valid`);
      return result;
    } catch (error) {
      console.error('Error cleaning up categories:', error);
      toast.error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Clear all hygiene essentials from the backend (for cleanup)
  const [clearingAll, setClearingAll] = useState(false);
  const clearAllEssentials = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL hygiene essentials from the database. This cannot be undone.\n\nContinue?')) {
      return;
    }
    
    setClearingAll(true);
    toast.info('Clearing all hygiene essentials...');
    
    try {
      const response = await fetch(`${baseUrl}/v1/asset-graph/hygiene-essentials/clear-all`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to clear: ${response.statusText}`);
      }
      
      const result = await response.json();
      toast.success(`Deleted ${result.deleted_controls} essentials and ${result.deleted_categories} categories`);
      
      // Also cleanup any remaining garbage categories
      await cleanupGarbageCategories();
      
      // Refresh data
      setEssentials([]);
      setCategories([]);
      fetchEssentials();
      fetchCategories();
    } catch (error) {
      console.error('Error clearing essentials:', error);
      toast.error(`Failed to clear: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setClearingAll(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingCell) {
          setEditingCell(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingCell, onClose]);

  // Sort handler
  const handleSort = (key: keyof HygieneEssential) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: null, direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredEssentials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEssentials.map((e) => e.id)));
    }
  };

  const handleSelectEssential = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Cell edit handlers
  const handleCellEdit = (id: string, columnKey: string) => {
    setEditingCell({ id, columnKey });
  };

  const handleCellSave = async (id: string, columnKey: string, value: string) => {
    setEditingCell(null);
    await updateEssential(id, { [columnKey]: value });
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  // Filter and sort essentials
  const filteredEssentials = useMemo(() => {
    let result = [...essentials];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.category.toLowerCase().includes(query) ||
          e.source.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = String(a[sortConfig.key as keyof HygieneEssential] || '');
        const bVal = String(b[sortConfig.key as keyof HygieneEssential] || '');
        const comparison = aVal.localeCompare(bVal);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [essentials, searchQuery, sortConfig]);

  // Pagination
  const paginatedEssentials = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEssentials.slice(start, start + pageSize);
  }, [filteredEssentials, page, pageSize]);

  const totalPages = Math.ceil(filteredEssentials.length / pageSize);

  // Resize state
  const [modalSize, setModalSize] = useState({ width: 1200, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Resize direction state
  const [resizeDirection, setResizeDirection] = useState<'top' | 'bottom' | null>(null);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'top' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: modalSize.width,
      height: modalSize.height,
    };
  }, [modalSize]);

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;
      
      // For top resize, we invert the Y delta
      const heightDelta = resizeDirection === 'top' ? -deltaY : deltaY;
      
      setModalSize({
        width: Math.max(600, Math.min(window.innerWidth - 40, resizeStartRef.current.width + deltaX)),
        height: Math.max(400, Math.min(window.innerHeight - 40, resizeStartRef.current.height + heightDelta)),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDirection]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={isMaximized ? undefined : { width: modalSize.width, height: modalSize.height }}
        className={cn(
          'relative z-10 flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden',
          isMaximized && 'w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]'
        )}
      >
        {/* Top-Right Resize Handle - only visible when not maximized */}
        {!isMaximized && (
          <div
            onMouseDown={(e) => handleResizeStart(e, 'top')}
            className="absolute top-0 right-0 w-6 h-6 cursor-ne-resize flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors z-20"
            title="Drag to resize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="rotate-90">
              <path d="M9 4V9H4L9 4Z" />
              <path d="M9 0V3H6L9 0Z" />
            </svg>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/10">
              <Shield className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Hygiene Essentials</h2>
              <p className="text-xs text-muted-foreground">
                {filteredEssentials.length} essentials • {categories.length} categories
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar - responsive with flex-wrap */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
          {/* Search and Filter - left side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search essentials..."
                className="pl-9 pr-4 py-2 w-40 sm:w-52 lg:w-64 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer appearance-none"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Spacer - pushes buttons to the right */}
          <div className="flex-1 min-w-0" />

          {/* Action buttons - wrap to new row if needed */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Add Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Essential</span>
              <span className="sm:hidden">Add</span>
            </button>

            {/* Import */}
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors whitespace-nowrap"
              title="Import from CSV"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileImport}
              className="hidden"
            />

            {/* Save to Backend - shows when there are pending imports */}
            {pendingImports.length > 0 && (
              <button
                onClick={savePendingImports}
                disabled={savingImports}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                title="Save imported essentials to backend"
              >
                {savingImports ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Save ({pendingImports.length})</span>
                <span className="sm:hidden">{pendingImports.length}</span>
              </button>
            )}

            {/* Clear Pending - shows when there are pending imports */}
            {pendingImports.length > 0 && (
              <button
                onClick={clearPendingImports}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors whitespace-nowrap"
                title="Clear pending imports"
              >
                <XCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            {/* Export */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors whitespace-nowrap">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <div className="absolute right-0 top-full mt-1 min-w-[140px] bg-zinc-900 border-2 border-zinc-700 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <button
                  onClick={() => exportEssentials('csv')}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800 w-full text-left text-sm whitespace-nowrap text-zinc-100"
                >
                  <FileText className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => exportEssentials('json')}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800 w-full text-left text-sm whitespace-nowrap text-zinc-100"
                >
                  <FileText className="h-4 w-4" />
                  Export JSON
                </button>
              </div>
            </div>

            {/* Delete Selected */}
            {selectedIds.size > 0 && (
              <button
                onClick={() => deleteEssentials(Array.from(selectedIds))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-sm hover:bg-destructive/90 transition-colors whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Delete ({selectedIds.size})</span>
                <span className="sm:hidden">{selectedIds.size}</span>
              </button>
            )}

            {/* Cleanup garbage categories */}
            <button
              onClick={async () => {
                try {
                  await cleanupGarbageCategories();
                  fetchCategories();
                } catch (e) {
                  // Error already toasted
                }
              }}
              disabled={clearingAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 rounded-lg text-sm transition-colors whitespace-nowrap"
              title="Clean up garbage categories from bad imports"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Cleanup</span>
            </button>

            {/* Clear All - Danger zone */}
            <button
              onClick={clearAllEssentials}
              disabled={clearingAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-lg text-sm transition-colors whitespace-nowrap"
              title="Clear all hygiene essentials (use to clean up bad data)"
            >
              {clearingAll ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Clear All</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchEssentials}
              disabled={loading}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-destructive/20 rounded">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Pending Imports Section */}
        {pendingImports.length > 0 && (
          <div className="border-b border-border">
            <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2 text-blue-400 text-sm">
              <CloudUpload className="h-4 w-4" />
              <span className="font-medium">{pendingImports.length} pending imports</span>
              <span className="text-muted-foreground">- Edit below, then click "Save to Backend" to persist</span>
            </div>
            <div className="max-h-[300px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-blue-500/5 backdrop-blur-sm z-10">
                  <tr>
                    <th className="w-10 px-3 py-2 text-left text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </th>
                    {SPREADSHEET_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        style={{ width: col.width, minWidth: col.width }}
                        className="px-3 py-2 text-left font-medium text-muted-foreground"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingImports.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-blue-500/5">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => deletePendingImport(item.id)}
                          className="p-1 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                      {SPREADSHEET_COLUMNS.map((col) => (
                        <td key={col.key} className="px-3 py-2">
                          {col.type === 'select' ? (
                            <select
                              value={(item[col.key] as string) || ''}
                              onChange={(e) => updatePendingImport(item.id, col.key, e.target.value)}
                              className="w-full px-2 py-1 bg-background text-foreground border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {col.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={(item[col.key] as string) || ''}
                              onChange={(e) => updatePendingImport(item.id, col.key, e.target.value)}
                              className="w-full px-2 py-1 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={col.label}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr>
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredEssentials.length && filteredEssentials.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-border"
                  />
                </th>
                {SPREADSHEET_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width, minWidth: col.width }}
                    className="px-3 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortConfig.key === col.key && (
                        sortConfig.direction === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && essentials.length === 0 ? (
                <tr>
                  <td colSpan={SPREADSHEET_COLUMNS.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading hygiene essentials...
                  </td>
                </tr>
              ) : paginatedEssentials.length === 0 ? (
                <tr>
                  <td colSpan={SPREADSHEET_COLUMNS.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No hygiene essentials found</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-2 text-primary hover:underline"
                    >
                      Add your first essential
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedEssentials.map((essential) => (
                  <tr
                    key={essential.id}
                    className={cn(
                      'border-b border-border/50 hover:bg-muted/50 transition-colors',
                      selectedIds.has(essential.id) && 'bg-primary/5'
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(essential.id)}
                        onChange={() => handleSelectEssential(essential.id)}
                        className="w-4 h-4 rounded border-border"
                      />
                    </td>
                    {SPREADSHEET_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        style={{ width: col.width, minWidth: col.width }}
                        className="px-3 py-2"
                      >
                        <EditableCell
                          value={String(essential[col.key] || '')}
                          column={col}
                          isEditing={
                            editingCell?.id === essential.id &&
                            editingCell?.columnKey === col.key &&
                            col.editable
                          }
                          onEdit={() => col.editable && handleCellEdit(essential.id, col.key)}
                          onSave={(value) => handleCellSave(essential.id, col.key, value)}
                          onCancel={handleCellCancel}
                          options={col.options}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with pagination - responsive */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border bg-muted/30">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            Showing {Math.min((page - 1) * pageSize + 1, filteredEssentials.length)} -{' '}
            {Math.min(page * pageSize, filteredEssentials.length)} of {filteredEssentials.length}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm whitespace-nowrap">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span>CSV Format: asset_category, essentials, maturity_level, source</span>
          </div>
        </div>

        {/* Bottom-Right Resize Handle - only visible when not maximized */}
        {!isMaximized && (
          <div
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors z-20"
            title="Drag to resize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M9 4V9H4L9 4Z" />
              <path d="M9 0V3H6L9 0Z" />
            </svg>
          </div>
        )}
      </motion.div>

      {/* Create Modal */}
      <CreateEssentialModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={createEssential}
        categories={categories}
        maturityLevels={maturityLevels}
        controlTypes={controlTypes}
      />
    </div>
  );

  // Render in portal
  if (typeof window !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
};

// Types for Bug Bounty Intelligence Ingestion Carousel

export interface BugBountyIngestRequest {
  urls: string[]
  predefined_url_ids?: string[]
  add_to_predefined?: boolean
  days_past: number
  max_concurrent_extraction: number
  methodology_type: string
  analysis_depth: string
  auto_integrate: boolean
  force_refresh: boolean
  cache_ttl_hours: number
}

export interface PredefinedUrl {
  id: string
  url: string
  name: string
  description?: string
  created_at: string
  last_used?: string
}

export interface BugBountyIngestResponse {
  success: boolean
  message: string
  job_id: string
  stats: Record<string, unknown>
}

export interface BugBountyIngestionJobStatus {
  job_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  created_at: string
  started_at?: string
  completed_at?: string
  error?: string
  stats?: BugBountyIngestionStats
}

export interface BugBountyIngestionStats {
  urls_processed: number
  urls_succeeded: number
  urls_failed: number
  urls_cached: number
  tips_extracted: number
  techniques_found: number
  attack_vectors_found: number
  tools_found: number
  errors: string[]
}

// Methodology type options
export const METHODOLOGY_TYPE_OPTIONS = [
  { value: 'auto-detect', label: 'Auto-detect', icon: '🔍' },
  { value: 'reconnaissance', label: 'Reconnaissance', icon: '🔎' },
  { value: 'authentication', label: 'Authentication', icon: '🔐' },
  { value: 'web_application', label: 'Web Application', icon: '🌐' },
  { value: 'api_security', label: 'API Security', icon: '🔌' },
  { value: 'cloud_enumeration', label: 'Cloud Enumeration', icon: '☁️' },
  { value: 'account_takeover', label: 'Account Takeover', icon: '👤' },
  { value: 'infrastructure', label: 'Infrastructure', icon: '🏗️' },
  { value: 'advanced_techniques', label: 'Advanced Techniques', icon: '⚡' },
] as const

// Analysis depth options
export const ANALYSIS_DEPTH_OPTIONS = [
  { value: 'quick', label: 'Quick (Tips Only)', icon: '⚡' },
  { value: 'standard', label: 'Standard (Tips + Techniques)', icon: '📊' },
  { value: 'deep', label: 'Deep (Full Analysis)', icon: '🔬' },
] as const

// Status configuration for display
export const JOB_STATUS_CONFIG: Record<
  BugBountyIngestionJobStatus['status'],
  { label: string; color: string; bgColor: string; icon: string }
> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    icon: '⏳',
  },
  running: {
    label: 'Running',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
    icon: '🔄',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    icon: '✅',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
    icon: '❌',
  },
}

// Default ingestion request values
export const DEFAULT_BUG_BOUNTY_INGEST_REQUEST: BugBountyIngestRequest = {
  urls: [],
  days_past: 7,
  max_concurrent_extraction: 3,
  methodology_type: 'auto-detect',
  analysis_depth: 'deep',
  auto_integrate: false,
  force_refresh: false,
  cache_ttl_hours: 168, // 1 week
}

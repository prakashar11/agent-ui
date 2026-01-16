// Types for Threat Intel Ingestion Carousel

export interface IngestRequest {
  days_past: number
  max_articles_per_feed: number
  max_concurrent_sanitization: number
  max_concurrent_analysis: number
  analyze_threats: boolean
  store_in_graph: boolean
  rss_categories: string[]
  force_refresh: boolean
  cache_ttl_hours: number
}

export interface IngestResponse {
  success: boolean
  message: string
  job_id: string
  stats: Record<string, unknown>
}

export interface IngestionJobStatus {
  job_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  created_at: string
  started_at?: string
  completed_at?: string
  error?: string
  stats?: IngestionStats
}

export interface IngestionStats {
  feeds_processed: number
  feeds_failed: number
  articles_fetched: number
  articles_enriched: number
  articles_sanitized: number
  articles_analyzed: number
  articles_threat_relevant: number
  articles_stored_vector: number
  articles_stored_graph: number
  errors: string[]
}

export interface RSSFeedsResponse {
  feeds: {
    news: { count: number; urls: string[] }
    threat_intel: { count: number; urls: string[] }
    cyber_crime: { count: number; urls: string[] }
    ai_security: { count: number; urls: string[] }
  }
  total: number
}

export interface AssetCategoriesResponse {
  categories: string[]
  count: number
}

// RSS Category options for the form
export const RSS_CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Feeds', icon: '📡' },
  { value: 'news', label: 'Security News', icon: '📰' },
  { value: 'threat_intel', label: 'Threat Intelligence', icon: '🛡️' },
  { value: 'cyber_crime', label: 'Cyber Crime', icon: '🚨' },
  { value: 'ai_security', label: 'AI Security', icon: '🤖' },
] as const

// Status configuration for display
export const JOB_STATUS_CONFIG: Record<
  IngestionJobStatus['status'],
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
export const DEFAULT_INGEST_REQUEST: IngestRequest = {
  days_past: 2,
  max_articles_per_feed: 20,
  max_concurrent_sanitization: 5,
  max_concurrent_analysis: 3,
  analyze_threats: true,
  store_in_graph: true,
  rss_categories: ['all'],
  force_refresh: false,
  cache_ttl_hours: 24,
}

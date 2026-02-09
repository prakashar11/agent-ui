// Types for Unified Intelligence Ingestion Carousel
// Supports both Threat Intel and Bug Bounty ingestion

export type IngestionType = 'threat_intel' | 'bug_bounty'

// Threat Intel Types
export interface ThreatIntelIngestRequest {
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

// Bug Bounty Types
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
  use_rss_feeds?: boolean
  max_articles_per_rss_feed?: number
}

// Unified request type
export type IngestionRequest = ThreatIntelIngestRequest | BugBountyIngestRequest

// Predefined URL (for bug bounty)
export interface PredefinedUrl {
  id: string
  url: string
  name: string
  description?: string
  created_at: string
  last_used?: string
}

// Job Status (unified)
export interface IngestionJobStatus {
  job_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  created_at: string
  started_at?: string
  completed_at?: string
  error?: string
  stats?: IngestionStats | BugBountyIngestionStats
  ingestion_type?: IngestionType // Track which type this job is
}

// Threat Intel Stats
export interface IngestionStats {
  feeds_processed: number
  feeds_failed: number
  /** Feed URLs from which articles were fetched (all, not just threat-relevant) */
  rss_feeds_with_articles?: string[]
  articles_fetched: number
  articles_enriched: number
  articles_sanitized: number
  articles_analyzed: number
  articles_threat_relevant: number
  articles_stored_vector: number
  articles_stored_graph: number
  errors: string[]
}

// Bug Bounty Stats
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

// RSS Feeds Response (for threat intel)
export interface RSSFeedsResponse {
  feeds: {
    news: { count: number; urls: string[] }
    threat_intel: { count: number; urls: string[] }
    cyber_crime: { count: number; urls: string[] }
    ai_security: { count: number; urls: string[] }
    bug_bounty?: { count: number; urls: string[] }
  }
  total: number
}

// RSS Category options (for threat intel only - bug bounty has its own RSS feed handling)
export const RSS_CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Feeds', icon: '📡' },
  { value: 'news', label: 'Security News', icon: '📰' },
  { value: 'threat_intel', label: 'Threat Intelligence', icon: '🛡️' },
  { value: 'cyber_crime', label: 'Cyber Crime', icon: '🚨' },
  { value: 'ai_security', label: 'AI Security', icon: '🤖' },
] as const

// Methodology type options (for bug bounty)
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

// Analysis depth options (for bug bounty)
export const ANALYSIS_DEPTH_OPTIONS = [
  { value: 'quick', label: 'Quick (Tips Only)', icon: '⚡' },
  { value: 'standard', label: 'Standard (Tips + Techniques)', icon: '📊' },
  { value: 'deep', label: 'Deep (Full Analysis)', icon: '🔬' },
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
export const DEFAULT_THREAT_INTEL_INGEST_REQUEST: ThreatIntelIngestRequest = {
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

export const DEFAULT_BUG_BOUNTY_INGEST_REQUEST: BugBountyIngestRequest = {
  urls: [],
  days_past: 7,
  max_concurrent_extraction: 3,
  methodology_type: 'auto-detect',
  analysis_depth: 'deep',
  auto_integrate: false,
  force_refresh: false,
  cache_ttl_hours: 168, // 1 week
  use_rss_feeds: false,
  max_articles_per_rss_feed: 20,
}

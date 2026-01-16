'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselDots,
} from '@/components/ui/carousel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { APIRoutes } from '@/api/routes'
import { toast } from 'sonner'
import {
  Play,
  RefreshCw,
  Shield,
  Rss,
  Database,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Settings2,
  Zap,
  Trash2,
} from 'lucide-react'
import {
  IngestRequest,
  IngestionJobStatus,
  IngestionStats,
  RSSFeedsResponse,
  RSS_CATEGORY_OPTIONS,
  JOB_STATUS_CONFIG,
  DEFAULT_INGEST_REQUEST,
} from './types'

interface ThreatIntelIngestionCarouselProps {
  isOpen: boolean
  onClose: () => void
  endpoint: string
}

export const ThreatIntelIngestionCarousel: React.FC<ThreatIntelIngestionCarouselProps> = ({
  isOpen,
  onClose,
  endpoint,
}) => {
  // Jobs state
  const [jobs, setJobs] = useState<IngestionJobStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [feeds, setFeeds] = useState<RSSFeedsResponse | null>(null)

  // Form state
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [formData, setFormData] = useState<IngestRequest>(DEFAULT_INGEST_REQUEST)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Polling state for running jobs
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch jobs list
  const fetchJobs = useCallback(async () => {
    if (!endpoint) return

    setLoading(true)
    try {
      const response = await fetch(APIRoutes.ThreatIntelIngestionJobs(endpoint))
      if (!response.ok) throw new Error('Failed to fetch jobs')

      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Error fetching ingestion jobs:', error)
      toast.error('Failed to load ingestion jobs', { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  // Fetch RSS feeds info
  const fetchFeeds = useCallback(async () => {
    if (!endpoint) return

    try {
      const response = await fetch(APIRoutes.ThreatIntelFeeds(endpoint))
      if (!response.ok) throw new Error('Failed to fetch feeds')

      const data = await response.json()
      setFeeds(data)
    } catch (error) {
      console.error('Error fetching RSS feeds:', error)
    }
  }, [endpoint])

  // Delete a specific job
  const deleteJob = useCallback(async (jobId: string) => {
    if (!endpoint) return

    try {
      const response = await fetch(APIRoutes.ThreatIntelIngestionDeleteJob(endpoint, jobId), {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to delete job')
      }

      toast.success('Job deleted', { duration: 2000 })
      setJobs(prev => prev.filter(j => j.job_id !== jobId))
    } catch (error) {
      console.error('Error deleting job:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete job', { duration: 3000 })
    }
  }, [endpoint])

  // Clear all completed jobs
  const clearCompletedJobs = useCallback(async () => {
    if (!endpoint) return

    try {
      const response = await fetch(APIRoutes.ThreatIntelIngestionClearJobs(endpoint), {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to clear jobs')

      const data = await response.json()
      toast.success(data.message || 'Completed jobs cleared', { duration: 2000 })
      fetchJobs()
    } catch (error) {
      console.error('Error clearing jobs:', error)
      toast.error('Failed to clear jobs', { duration: 3000 })
    }
  }, [endpoint, fetchJobs])

  // Poll for running job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    if (!endpoint) return null

    try {
      const response = await fetch(APIRoutes.ThreatIntelIngestionStatus(endpoint, jobId))
      
      // Handle expected error cases gracefully (job deleted, not found, etc.)
      if (!response.ok) {
        if (response.status === 404) {
          // Job was deleted or doesn't exist - return null to remove from tracking
          return null
        }
        // Log unexpected errors but don't throw
        console.warn(`Job status fetch returned ${response.status} for ${jobId}`)
        return null
      }

      return await response.json()
    } catch (error) {
      // Network errors - log as warning, not error
      console.warn('Error polling job status:', error)
      return null
    }
  }, [endpoint])

  // Start polling for running jobs
  const startPolling = useCallback(() => {
    if (pollingRef.current) return

    pollingRef.current = setInterval(async () => {
      const runningJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending')
      
      if (runningJobs.length === 0) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        return
      }

      // Poll each running job
      const updatedJobs = await Promise.all(
        jobs.map(async (job) => {
          if (job.status === 'running' || job.status === 'pending') {
            const updated = await pollJobStatus(job.job_id)
            if (updated) {
              return { ...job, ...updated }
            }
          }
          return job
        })
      )

      setJobs(updatedJobs)

      // Check if any job just completed
      const justCompleted = updatedJobs.filter(
        (j, i) => 
          (j.status === 'completed' || j.status === 'failed') &&
          (jobs[i]?.status === 'running' || jobs[i]?.status === 'pending')
      )

      justCompleted.forEach(job => {
        if (job.status === 'completed') {
          toast.success(`Ingestion job completed: ${job.stats?.articles_stored_vector || 0} articles stored`, { duration: 4000 })
        } else if (job.status === 'failed') {
          toast.error(`Ingestion job failed: ${job.error || 'Unknown error'}`, { duration: 4000 })
        }
      })
    }, 3000) // Poll every 3 seconds
  }, [jobs, pollJobStatus])

  // Effect to manage polling
  useEffect(() => {
    const hasRunningJobs = jobs.some(j => j.status === 'running' || j.status === 'pending')
    
    if (hasRunningJobs && isOpen) {
      startPolling()
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [jobs, isOpen, startPolling])

  // Initial data fetch
  useEffect(() => {
    if (isOpen) {
      fetchJobs()
      fetchFeeds()
    }
  }, [isOpen, fetchJobs, fetchFeeds])

  // Trigger ingestion
  const handleStartIngestion = async (sync: boolean = false) => {
    setIsSubmitting(true)
    try {
      const url = sync 
        ? APIRoutes.ThreatIntelIngestionSync(endpoint)
        : APIRoutes.ThreatIntelIngestion(endpoint)

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to start ingestion')

      const data = await response.json()
      
      if (sync) {
        toast.success(`Ingestion completed: ${data.stats?.articles_stored_vector || 0} articles stored`, { duration: 4000 })
      } else {
        toast.success('Ingestion job started', { duration: 2000 })
      }

      setShowConfigDialog(false)
      fetchJobs()
    } catch (error) {
      console.error('Error starting ingestion:', error)
      toast.error('Failed to start ingestion', { duration: 3000 })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick start with defaults
  const handleQuickStart = async () => {
    setFormData(DEFAULT_INGEST_REQUEST)
    await handleStartIngestion(false)
  }

  // Graph maintenance state
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [orphanedNodes, setOrphanedNodes] = useState<{
    summary: { orphaned_threats: number; orphaned_attacks: number; orphaned_indicators: number; total_orphaned: number };
    orphaned_nodes: { threats: any[]; attacks: any[]; indicators: any[] };
  } | null>(null)
  const [isLoadingOrphans, setIsLoadingOrphans] = useState(false)
  const [isCleaningOrphans, setIsCleaningOrphans] = useState(false)

  // Find orphaned nodes
  const findOrphanedNodes = useCallback(async () => {
    if (!endpoint) return

    setIsLoadingOrphans(true)
    try {
      const response = await fetch(APIRoutes.ThreatIntelOrphanedNodes(endpoint))
      if (!response.ok) throw new Error('Failed to find orphaned nodes')

      const data = await response.json()
      setOrphanedNodes(data)
    } catch (error) {
      console.error('Error finding orphaned nodes:', error)
      toast.error('Failed to find orphaned nodes', { duration: 3000 })
    } finally {
      setIsLoadingOrphans(false)
    }
  }, [endpoint])

  // Cleanup orphaned nodes
  const cleanupOrphanedNodes = useCallback(async (dryRun: boolean = false) => {
    if (!endpoint) return

    setIsCleaningOrphans(true)
    try {
      const response = await fetch(
        APIRoutes.ThreatIntelCleanupOrphanedNodes(endpoint, { dryRun }),
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Failed to cleanup orphaned nodes')

      const data = await response.json()
      
      if (dryRun) {
        toast.info(`Would delete ${data.summary.total_deleted} orphaned nodes`, { duration: 4000 })
      } else {
        toast.success(`Deleted ${data.summary.total_deleted} orphaned nodes`, { duration: 4000 })
        // Refresh the orphaned nodes list
        await findOrphanedNodes()
      }
    } catch (error) {
      console.error('Error cleaning up orphaned nodes:', error)
      toast.error('Failed to cleanup orphaned nodes', { duration: 3000 })
    } finally {
      setIsCleaningOrphans(false)
    }
  }, [endpoint, findOrphanedNodes])

  // Load orphans when maintenance dialog opens
  useEffect(() => {
    if (showMaintenanceDialog) {
      findOrphanedNodes()
    }
  }, [showMaintenanceDialog, findOrphanedNodes])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return null
    const start = new Date(startedAt)
    const end = completedAt ? new Date(completedAt) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffSecs = Math.floor((diffMs % 60000) / 1000)
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`
    }
    return `${diffSecs}s`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  Threat Intel Ingestion
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Fetch, analyze, and store threat intelligence from RSS feeds
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 mr-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchJobs}
                  disabled={loading}
                  className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfigDialog(true)}
                  className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Settings2 className="h-4 w-4 mr-1" />
                  Configure
                </Button>
                <Button
                  size="sm"
                  onClick={handleQuickStart}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-1" />
                  )}
                  Quick Start
                </Button>
                {jobs.some(j => j.status === 'completed' || j.status === 'failed') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCompletedJobs}
                    className="border-zinc-600 text-zinc-100 hover:bg-red-600/20 hover:text-red-400 hover:border-red-600/50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear Done
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMaintenanceDialog(true)}
                  className="border-zinc-600 text-zinc-100 hover:bg-amber-600/20 hover:text-amber-400 hover:border-amber-600/50"
                >
                  <Database className="h-4 w-4 mr-1" />
                  Maintenance
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Stats Bar */}
          {feeds && (
            <div className="px-6 py-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Rss className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Total Feeds:</span>
                  <span className="font-medium text-foreground">{feeds.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">News:</span>
                  <span className="font-medium text-foreground">{feeds.feeds.news.count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Threat Intel:</span>
                  <span className="font-medium text-foreground">{feeds.feeds.threat_intel.count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Cyber Crime:</span>
                  <span className="font-medium text-foreground">{feeds.feeds.cyber_crime.count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">AI Security:</span>
                  <span className="font-medium text-foreground">{feeds.feeds.ai_security.count}</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Shield className="h-16 w-16 text-zinc-500 mb-4" />
                <h3 className="text-lg font-medium text-zinc-100 mb-2">
                  No ingestion jobs yet
                </h3>
                <p className="text-sm text-zinc-400 mb-4">
                  Start your first threat intelligence ingestion to populate the database
                </p>
                <Button 
                  onClick={() => setShowConfigDialog(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Start Ingestion
                </Button>
              </div>
            ) : jobs.length <= 3 ? (
              // Grid view for 3 or fewer jobs
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {jobs.map((job, index) => (
                    <JobCard
                      key={job.job_id}
                      job={job}
                      index={index}
                      formatDate={formatDate}
                      formatDuration={formatDuration}
                      onDelete={deleteJob}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              // Carousel for more than 3 jobs
              <Carousel
                opts={{ align: 'start', loop: false }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {jobs.map((job, index) => (
                    <CarouselItem
                      key={job.job_id}
                      className="pl-4 md:basis-1/2 lg:basis-1/3"
                    >
                      <JobCard
                        job={job}
                        index={index}
                        formatDate={formatDate}
                        formatDuration={formatDuration}
                        onDelete={deleteJob}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="-left-4" />
                <CarouselNext className="-right-4" />
                <CarouselDots className="mt-4" />
              </Carousel>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Configuration Dialog */}
      <Dialog
        open={showConfigDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowConfigDialog(false)
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Configure Ingestion</DialogTitle>
            <DialogDescription>
              Customize the threat intelligence ingestion parameters
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
            {/* RSS Categories */}
            <div>
              <label className="text-sm font-medium mb-2 block text-zinc-100">RSS Feed Categories</label>
              <div className="grid grid-cols-2 gap-2">
                {RSS_CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (option.value === 'all') {
                        setFormData({ ...formData, rss_categories: ['all'] })
                      } else {
                        const current = formData.rss_categories.filter(c => c !== 'all')
                        const isSelected = current.includes(option.value)
                        const newCategories = isSelected
                          ? current.filter(c => c !== option.value)
                          : [...current, option.value]
                        setFormData({ 
                          ...formData, 
                          rss_categories: newCategories.length > 0 ? newCategories : ['all']
                        })
                      }
                    }}
                    className={cn(
                      'px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2',
                      formData.rss_categories.includes(option.value) ||
                      (formData.rss_categories.includes('all') && option.value === 'all')
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    )}
                  >
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Days Past & Max Articles */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block text-zinc-100">Days Past</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.days_past}
                  onChange={(e) => setFormData({ ...formData, days_past: parseInt(e.target.value) || 2 })}
                  className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <span className="text-xs text-zinc-400">1-30 days</span>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-zinc-100">Max Articles/Feed</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.max_articles_per_feed}
                  onChange={(e) => setFormData({ ...formData, max_articles_per_feed: parseInt(e.target.value) || 20 })}
                  className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <span className="text-xs text-zinc-400">1-100 articles</span>
              </div>
            </div>

            {/* Concurrency Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block text-zinc-100">Sanitization Workers</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.max_concurrent_sanitization}
                  onChange={(e) => setFormData({ ...formData, max_concurrent_sanitization: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-zinc-100">Analysis Workers</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.max_concurrent_analysis}
                  onChange={(e) => setFormData({ ...formData, max_concurrent_analysis: parseInt(e.target.value) || 3 })}
                  className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.analyze_threats}
                  onChange={(e) => setFormData({ ...formData, analyze_threats: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-zinc-100">Analyze articles with LLM for threat relevance</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.store_in_graph}
                  onChange={(e) => setFormData({ ...formData, store_in_graph: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-zinc-100">Store threat intel in asset graph database</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.force_refresh}
                  onChange={(e) => setFormData({ ...formData, force_refresh: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-zinc-100">Force refresh (ignore cache)</span>
              </label>
            </div>

            {/* Cache TTL */}
            <div>
              <label className="text-sm font-medium mb-1 block text-zinc-100">Cache TTL (hours)</label>
              <input
                type="number"
                min={0}
                max={168}
                value={formData.cache_ttl_hours}
                onChange={(e) => setFormData({ ...formData, cache_ttl_hours: parseFloat(e.target.value) || 24 })}
                className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <span className="text-xs text-zinc-400">0 = no caching, max 168 hours (1 week)</span>
            </div>

          </div>

          {/* Actions - Fixed at bottom */}
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t border-zinc-700 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowConfigDialog(false)}
              className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleStartIngestion(true)}
              disabled={isSubmitting}
              className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Clock className="h-4 w-4 mr-1" />}
              Run Sync
            </Button>
            <Button 
              onClick={() => handleStartIngestion(false)}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Start Async
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Graph Maintenance Dialog */}
      <Dialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-500" />
              Graph Maintenance
            </DialogTitle>
            <DialogDescription>
              Find and remove orphaned nodes from the asset graph
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
            {/* Orphaned Nodes Summary */}
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-zinc-100">Orphaned Nodes</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={findOrphanedNodes}
                  disabled={isLoadingOrphans}
                  className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {isLoadingOrphans ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Scan
                </Button>
              </div>

              {isLoadingOrphans ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                </div>
              ) : orphanedNodes ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-md bg-zinc-900/50 p-3 text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {orphanedNodes.summary.orphaned_threats}
                      </div>
                      <div className="text-xs text-zinc-500">Orphan Threats</div>
                    </div>
                    <div className="rounded-md bg-zinc-900/50 p-3 text-center">
                      <div className="text-2xl font-bold text-amber-400">
                        {orphanedNodes.summary.orphaned_attacks}
                      </div>
                      <div className="text-xs text-zinc-500">Orphan Attacks</div>
                    </div>
                    <div className="rounded-md bg-zinc-900/50 p-3 text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {orphanedNodes.summary.orphaned_indicators}
                      </div>
                      <div className="text-xs text-zinc-500">Orphan Indicators</div>
                    </div>
                  </div>

                  {orphanedNodes.summary.total_orphaned > 0 && (
                    <div className="pt-2 border-t border-zinc-700">
                      <div className="text-sm text-zinc-400 mb-2">
                        Total: <span className="font-semibold text-zinc-100">{orphanedNodes.summary.total_orphaned}</span> orphaned nodes without asset category relationships
                      </div>
                      
                      {/* Preview of orphaned nodes */}
                      {orphanedNodes.orphaned_nodes.threats.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                            Show orphaned threats ({orphanedNodes.orphaned_nodes.threats.length})
                          </summary>
                          <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto text-xs">
                            {orphanedNodes.orphaned_nodes.threats.slice(0, 10).map((t: any) => (
                              <li key={t.id} className="text-zinc-400 truncate">
                                • {t.name}
                              </li>
                            ))}
                            {orphanedNodes.orphaned_nodes.threats.length > 10 && (
                              <li className="text-zinc-500 italic">
                                ... and {orphanedNodes.orphaned_nodes.threats.length - 10} more
                              </li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}

                  {orphanedNodes.summary.total_orphaned === 0 && (
                    <div className="flex items-center gap-2 text-emerald-500 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      No orphaned nodes found - graph is clean!
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-zinc-500 text-center py-4">
                  Click &quot;Scan&quot; to find orphaned nodes
                </div>
              )}
            </div>

            {/* Explanation */}
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <h4 className="text-sm font-medium text-zinc-100 mb-2">What are orphaned nodes?</h4>
              <ul className="text-xs text-zinc-400 space-y-1">
                <li>• <span className="text-red-400">Threats</span> without APPLIES_TO_CATEGORY relationship</li>
                <li>• <span className="text-amber-400">Attacks</span> not connected to any Threat via USES_ATTACK</li>
                <li>• <span className="text-blue-400">Indicators</span> not connected to any Threat via HAS_INDICATOR</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t border-zinc-700 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowMaintenanceDialog(false)}
              className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => cleanupOrphanedNodes(true)}
              disabled={isCleaningOrphans || !orphanedNodes || orphanedNodes.summary.total_orphaned === 0}
              className="border-zinc-600 text-zinc-100 hover:bg-amber-600/20 hover:text-amber-400"
            >
              {isCleaningOrphans ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
              Dry Run
            </Button>
            <Button 
              onClick={() => cleanupOrphanedNodes(false)}
              disabled={isCleaningOrphans || !orphanedNodes || orphanedNodes.summary.total_orphaned === 0}
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              {isCleaningOrphans ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete Orphans
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// Job Card Component
interface JobCardProps {
  job: IngestionJobStatus
  index: number
  formatDate: (dateStr?: string) => string | null
  formatDuration: (startedAt?: string, completedAt?: string) => string | null
  onDelete: (jobId: string) => void
}

const JobCard: React.FC<JobCardProps> = ({
  job,
  index,
  formatDate,
  formatDuration,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false)
  const statusConfig = JOB_STATUS_CONFIG[job.status]
  const stats = job.stats
  const canDelete = job.status !== 'running' && job.status !== 'pending'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="relative group"
    >
      <div
        className={cn(
          'h-full rounded-xl border p-4 transition-all duration-200',
          'bg-card hover:shadow-lg hover:border-primary/30'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn('text-lg')}>{statusConfig.icon}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', statusConfig.bgColor, statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {job.status === 'running' && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(job.job_id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                title="Delete job"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Job ID */}
        <h3 className="font-mono text-xs text-muted-foreground mb-2 truncate">
          {job.job_id}
        </h3>

        {/* Progress Bar (for running jobs) */}
        {job.status === 'running' && job.progress !== undefined && (
          <div className="mb-3">
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 mt-1">{job.progress}% complete</span>
          </div>
        )}

        {/* Stats Summary */}
        {stats && (
          <div className="space-y-1.5 text-xs mb-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Rss className="h-3 w-3" /> Feeds:
              </span>
              <span className="font-medium">
                {stats.feeds_processed}
                {stats.feeds_failed > 0 && (
                  <span className="text-red-400 ml-1">({stats.feeds_failed} failed)</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3" /> Stored:
              </span>
              <span className="font-medium text-emerald-400">{stats.articles_stored_vector}</span>
            </div>
            {stats.articles_threat_relevant !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Threat Relevant:
                </span>
                <span className="font-medium text-amber-400">{stats.articles_threat_relevant}</span>
              </div>
            )}
          </div>
        )}

        {/* Expandable Details */}
        {stats && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 py-1"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Less details' : 'More details'}
          </button>
        )}

        {expanded && stats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-700 mt-2 pt-2 space-y-1 text-xs"
          >
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fetched:</span>
              <span>{stats.articles_fetched}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Enriched:</span>
              <span>{stats.articles_enriched}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sanitized:</span>
              <span>{stats.articles_sanitized}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Analyzed:</span>
              <span>{stats.articles_analyzed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Graph Synced:</span>
              <span>{stats.articles_stored_graph}</span>
            </div>
            {stats.errors && stats.errors.length > 0 && (
              <div className="mt-2 p-2 bg-red-500/10 rounded text-red-400">
                <span className="font-medium">{stats.errors.length} error(s)</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Timestamps */}
        <div className="mt-3 pt-3 border-t border-zinc-700 text-[10px] text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{formatDate(job.created_at)}</span>
          </div>
          {job.started_at && (
            <div className="flex justify-between">
              <span>Duration:</span>
              <span>{formatDuration(job.started_at, job.completed_at)}</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {job.error && (
          <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400 truncate">
            {job.error}
          </div>
        )}
      </div>
    </motion.div>
  )
}

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { APIRoutes } from '@/api/routes'
import { toast } from 'sonner'
import {
  Play,
  RefreshCw,
  Shield,
  Bug,
  Rss,
  Database,
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
  StopCircle,
  Plus,
  X,
  Edit2,
  Save,
  List,
  Settings,
  Check,
  Globe,
} from 'lucide-react'
import {
  IngestionType,
  ThreatIntelIngestRequest,
  BugBountyIngestRequest,
  IngestionJobStatus,
  IngestionStats,
  BugBountyIngestionStats,
  PredefinedUrl,
  RSSFeedsResponse,
  RSS_CATEGORY_OPTIONS,
  METHODOLOGY_TYPE_OPTIONS,
  ANALYSIS_DEPTH_OPTIONS,
  JOB_STATUS_CONFIG,
  DEFAULT_THREAT_INTEL_INGEST_REQUEST,
  DEFAULT_BUG_BOUNTY_INGEST_REQUEST,
} from './types'

interface IntelligenceIngestionCarouselProps {
  isOpen: boolean
  onClose: () => void
  endpoint: string
  defaultType?: IngestionType
}

export const IntelligenceIngestionCarousel: React.FC<IntelligenceIngestionCarouselProps> = ({
  isOpen,
  onClose,
  endpoint,
  defaultType = 'threat_intel',
}) => {
  // Ingestion type state (main tab)
  const [ingestionType, setIngestionType] = useState<IngestionType>(defaultType)
  
  // Main tab state: 'threat_intel' | 'bug_bounty' | 'maintenance'
  const [mainTab, setMainTab] = useState<'threat_intel' | 'bug_bounty' | 'maintenance'>(
    defaultType === 'threat_intel' ? 'threat_intel' : 'bug_bounty'
  )
  
  // Jobs state
  const [jobs, setJobs] = useState<IngestionJobStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [feeds, setFeeds] = useState<RSSFeedsResponse | null>(null)
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'threat_intel' | 'bug_bounty'>('all')

  // Form state
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [showQuickStartConfirm, setShowQuickStartConfirm] = useState(false)
  const [quickStartConfig, setQuickStartConfig] = useState<{
    type: 'threat_intel' | 'bug_bounty'
    config: ThreatIntelIngestRequest | BugBountyIngestRequest
    selectedUrls?: PredefinedUrl[]
  } | null>(null)
  const [threatIntelFormData, setThreatIntelFormData] = useState<ThreatIntelIngestRequest>(
    DEFAULT_THREAT_INTEL_INGEST_REQUEST
  )
  const [bugBountyFormData, setBugBountyFormData] = useState<BugBountyIngestRequest>(
    DEFAULT_BUG_BOUNTY_INGEST_REQUEST
  )
  const [submittingMode, setSubmittingMode] = useState<'sync' | 'async' | null>(null)
  
  // Bug bounty specific state
  const [urlInput, setUrlInput] = useState('')
  const [predefinedUrls, setPredefinedUrls] = useState<PredefinedUrl[]>([])
  const [loadingPredefinedUrls, setLoadingPredefinedUrls] = useState(false)
  const [selectedPredefinedUrlIds, setSelectedPredefinedUrlIds] = useState<string[]>([])
  const [addToPredefined, setAddToPredefined] = useState(false)
  
  // Tab state (for bug bounty)
  const [activeTab, setActiveTab] = useState<'urls' | 'settings'>('urls')
  
  // Edit state for predefined URLs
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null)
  const [editUrlName, setEditUrlName] = useState('')
  const [editUrlDescription, setEditUrlDescription] = useState('')

  // Graph maintenance state (for threat intel)
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [orphanedNodes, setOrphanedNodes] = useState<{
    summary: { orphaned_threats: number; orphaned_attacks: number; orphaned_indicators: number; total_orphaned: number };
    orphaned_nodes: { threats: any[]; attacks: any[]; indicators: any[] };
  } | null>(null)
  const [isLoadingOrphans, setIsLoadingOrphans] = useState(false)
  const [isCleaningOrphans, setIsCleaningOrphans] = useState(false)

  // Polling state for running jobs
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch jobs list (unified for both types - fetch all when needed)
  const fetchJobs = useCallback(async () => {
    if (!endpoint) return

    setLoading(true)
    try {
      // Fetch both types of jobs
      const [threatIntelResponse, bugBountyResponse] = await Promise.all([
        fetch(APIRoutes.ThreatIntelIngestionJobs(endpoint)),
        fetch(APIRoutes.BugBountyIngestionJobs(endpoint)),
      ])

      const allJobs: IngestionJobStatus[] = []
      
      if (threatIntelResponse.ok) {
        const threatIntelData = await threatIntelResponse.json()
        const threatIntelJobs = (threatIntelData.jobs || [])
          .filter((job: IngestionJobStatus) => 
            (job.job_id?.startsWith('ingest_') || job.job_id?.startsWith('ingest_sync_')) &&
            !job.job_id?.startsWith('bug_bounty_ingest_')
          )
          .map((job: IngestionJobStatus) => ({
            ...job,
            ingestion_type: 'threat_intel' as IngestionType,
          }))
        allJobs.push(...threatIntelJobs)
      }

      if (bugBountyResponse.ok) {
        const bugBountyData = await bugBountyResponse.json()
        const bugBountyJobs = (bugBountyData.jobs || [])
          .filter((job: IngestionJobStatus) => 
            job.job_id?.startsWith('bug_bounty_ingest_')
          )
          .map((job: IngestionJobStatus) => ({
            ...job,
            ingestion_type: 'bug_bounty' as IngestionType,
          }))
        allJobs.push(...bugBountyJobs)
      }
      
      setJobs(allJobs)
    } catch (error) {
      console.warn('Error fetching ingestion jobs:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  // Fetch RSS feeds info (for threat intel)
  const fetchFeeds = useCallback(async () => {
    if (!endpoint) return

    try {
      const response = await fetch(APIRoutes.ThreatIntelFeeds(endpoint))
      if (!response.ok) {
        console.warn('Failed to fetch feeds:', response.status, response.statusText)
        return
      }

      const data = await response.json()
      setFeeds(data)
    } catch (error) {
      console.warn('Error fetching RSS feeds:', error)
    }
  }, [endpoint])

  // Fetch predefined URLs (for bug bounty)
  const fetchPredefinedUrls = useCallback(async () => {
    if (!endpoint) return

    setLoadingPredefinedUrls(true)
    try {
      const response = await fetch(APIRoutes.BugBountyPredefinedUrls(endpoint))
      if (!response.ok) {
        console.warn('Failed to fetch predefined URLs:', response.status, response.statusText)
        return
      }

      const data = await response.json()
      setPredefinedUrls(data.urls || [])
    } catch (error) {
      console.warn('Error fetching predefined URLs:', error)
    } finally {
      setLoadingPredefinedUrls(false)
    }
  }, [endpoint])

  // Delete a specific job
  const deleteJob = useCallback(async (jobId: string) => {
    if (!endpoint) return

    try {
      // Determine job type from job_id
      const isBugBounty = jobId?.startsWith('bug_bounty_ingest_')
      const deleteUrl = isBugBounty
        ? APIRoutes.BugBountyIngestionDeleteJob(endpoint, jobId)
        : APIRoutes.ThreatIntelIngestionDeleteJob(endpoint, jobId)
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const message = data.detail || 'Failed to delete job'
        console.warn('Failed to delete job:', response.status, message)
        toast.error(message, { duration: 3000 })
        return
      }

      toast.success('Job deleted', { duration: 2000 })
      setJobs(prev => prev.filter(j => j.job_id !== jobId))
    } catch (error) {
      console.warn('Error deleting job:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    }
  }, [endpoint])

  // Stop/cancel a running or pending job (marks as failed "Stopped by user" in backend)
  const stopJob = useCallback(async (jobId: string) => {
    if (!endpoint) return

    try {
      const isBugBounty = jobId?.startsWith('bug_bounty_ingest_')
      const cancelUrl = isBugBounty
        ? APIRoutes.BugBountyIngestionCancelJob(endpoint, jobId)
        : APIRoutes.ThreatIntelIngestionCancelJob(endpoint, jobId)

      const response = await fetch(cancelUrl, { method: 'POST' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const message = data.detail || 'Failed to stop job'
        toast.error(message, { duration: 3000 })
        return
      }

      const data = await response.json()
      toast.success('Job stopped', { duration: 2000 })
      setJobs(prev =>
        prev.map(j =>
          j.job_id === jobId
            ? {
                ...j,
                status: data.status ?? 'failed',
                completed_at: data.completed_at,
                error: data.error,
              }
            : j
        )
      )
    } catch (error) {
      console.warn('Error stopping job:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    }
  }, [endpoint])

  // Clear all completed jobs (for current tab type)
  const clearCompletedJobs = useCallback(async () => {
    if (!endpoint) return

    try {
      // Clear based on current main tab
      const clearUrl = mainTab === 'threat_intel'
        ? APIRoutes.ThreatIntelIngestionClearJobs(endpoint)
        : APIRoutes.BugBountyIngestionClearJobs(endpoint)
      
      const response = await fetch(clearUrl, {
        method: 'DELETE',
      })
      if (!response.ok) {
        console.warn('Failed to clear jobs:', response.status, response.statusText)
        toast.error('Failed to clear jobs', { duration: 3000 })
        return
      }

      const data = await response.json()
      toast.success(data.message || 'Completed jobs cleared', { duration: 2000 })
      fetchJobs()
    } catch (error) {
      console.warn('Error clearing jobs:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    }
  }, [endpoint, mainTab, fetchJobs])

  // Poll for running job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    if (!endpoint) return null

    try {
      // Determine job type from job_id
      const isBugBounty = jobId?.startsWith('bug_bounty_ingest_')
      const statusUrl = isBugBounty
        ? APIRoutes.BugBountyIngestionStatus(endpoint, jobId)
        : APIRoutes.ThreatIntelIngestionStatus(endpoint, jobId)
      
      const response = await fetch(statusUrl)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        console.warn(`Job status fetch returned ${response.status} for ${jobId}`)
        return null
      }

      const data = await response.json()
      return { 
        ...data, 
        ingestion_type: isBugBounty ? 'bug_bounty' : 'threat_intel' as IngestionType
      }
    } catch (error) {
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

      // Poll all jobs (not just filtered ones)
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

      const justCompleted = updatedJobs.filter(
        (j, i) => 
          (j.status === 'completed' || j.status === 'failed') &&
          (jobs[i]?.status === 'running' || jobs[i]?.status === 'pending')
      )

      justCompleted.forEach(job => {
        if (job.status === 'completed') {
          const jobType = job.ingestion_type || (job.job_id?.startsWith('bug_bounty_ingest_') ? 'bug_bounty' : 'threat_intel')
          if (jobType === 'threat_intel') {
            const stats = job.stats as IngestionStats
            toast.success(`Ingestion job completed: ${stats?.articles_stored_vector || 0} articles stored`, { duration: 4000 })
          } else {
            const stats = job.stats as BugBountyIngestionStats
            toast.success(`Ingestion job completed: ${stats?.urls_succeeded || 0} URLs processed`, { duration: 4000 })
          }
        } else if (job.status === 'failed') {
          toast.error(`Ingestion job failed: ${job.error || 'Unknown error'}`, { duration: 4000 })
        }
      })
    }, 3000)
  }, [jobs, pollJobStatus, ingestionType])

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

  // Initial data fetch - fetch all data when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchJobs() // Fetches all jobs (both types)
      fetchFeeds() // Fetch RSS feeds (for threat intel tab)
      fetchPredefinedUrls() // Fetch predefined URLs (for bug bounty tab)
    }
  }, [isOpen, fetchJobs, fetchFeeds, fetchPredefinedUrls])

  // Bug bounty URL management functions
  const addUrlToPredefined = useCallback(async (url: string, name?: string, description?: string) => {
    if (!endpoint || !url.trim()) return

    try {
      const response = await fetch(
        APIRoutes.BugBountyPredefinedUrlCreate(endpoint),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url.trim(),
            name: name || url.trim(),
            description: description || '',
          }),
        }
      )
      if (!response.ok) {
        toast.error('Failed to add URL to predefined list', { duration: 3000 })
        return
      }

      toast.success('URL added to predefined list', { duration: 2000 })
      fetchPredefinedUrls()
    } catch (error) {
      console.warn('Error adding URL to predefined list:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    }
  }, [endpoint, fetchPredefinedUrls])

  const updatePredefinedUrl = useCallback(async (urlId: string, name?: string, description?: string, url?: string) => {
    if (!endpoint) return

    try {
      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (url !== undefined) updateData.url = url

      const response = await fetch(
        APIRoutes.BugBountyPredefinedUrlUpdate(endpoint, urlId),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        }
      )
      if (!response.ok) {
        toast.error('Failed to update URL', { duration: 3000 })
        return false
      }

      toast.success('URL updated successfully', { duration: 2000 })
      fetchPredefinedUrls()
      setEditingUrlId(null)
      setEditUrlName('')
      setEditUrlDescription('')
      return true
    } catch (error) {
      console.warn('Error updating predefined URL:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
      return false
    }
  }, [endpoint, fetchPredefinedUrls])

  const deletePredefinedUrl = useCallback(async (urlId: string) => {
    if (!endpoint) return

    if (!confirm('Are you sure you want to delete this predefined URL?')) {
      return
    }

    try {
      const response = await fetch(
        APIRoutes.BugBountyPredefinedUrl(endpoint, urlId),
        {
          method: 'DELETE',
        }
      )
      if (!response.ok) {
        toast.error('Failed to delete URL', { duration: 3000 })
        return
      }

      toast.success('URL deleted successfully', { duration: 2000 })
      fetchPredefinedUrls()
      setSelectedPredefinedUrlIds(selectedPredefinedUrlIds.filter(id => id !== urlId))
    } catch (error) {
      console.warn('Error deleting predefined URL:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    }
  }, [endpoint, fetchPredefinedUrls, selectedPredefinedUrlIds])

  const startEditingUrl = (predefinedUrl: PredefinedUrl) => {
    setEditingUrlId(predefinedUrl.id)
    setEditUrlName(predefinedUrl.name)
    setEditUrlDescription(predefinedUrl.description || '')
  }

  const cancelEditing = () => {
    setEditingUrlId(null)
    setEditUrlName('')
    setEditUrlDescription('')
  }

  // Add URL to list
  const addUrl = () => {
    if (urlInput.trim() && !bugBountyFormData.urls.includes(urlInput.trim())) {
      setBugBountyFormData({ ...bugBountyFormData, urls: [...bugBountyFormData.urls, urlInput.trim()] })
      setUrlInput('')
    }
  }

  // Remove URL from list
  const removeUrl = (url: string) => {
    setBugBountyFormData({ ...bugBountyFormData, urls: bugBountyFormData.urls.filter((u) => u !== url) })
    const matchingPredefinedUrl = predefinedUrls.find(pu => pu.url === url)
    if (matchingPredefinedUrl && selectedPredefinedUrlIds.includes(matchingPredefinedUrl.id)) {
      setSelectedPredefinedUrlIds(selectedPredefinedUrlIds.filter(id => id !== matchingPredefinedUrl.id))
    }
  }

  // Trigger ingestion
  const handleStartIngestion = async (sync: boolean = false) => {
    setSubmittingMode(sync ? 'sync' : 'async')
    try {
      let url: string
      let requestData: ThreatIntelIngestRequest | BugBountyIngestRequest

      // Use mainTab to determine which type of ingestion to start
      const currentType = mainTab === 'threat_intel' ? 'threat_intel' : 'bug_bounty'
      
      if (currentType === 'threat_intel') {
        url = sync 
          ? APIRoutes.ThreatIntelIngestionSync(endpoint)
          : APIRoutes.ThreatIntelIngestion(endpoint)
        requestData = threatIntelFormData
      } else {
        url = sync
          ? APIRoutes.BugBountyIngestionSync(endpoint)
          : APIRoutes.BugBountyIngestion(endpoint)
        
        const hasUrls = bugBountyFormData.urls.length > 0 || selectedPredefinedUrlIds.length > 0
        if (!hasUrls && !bugBountyFormData.use_rss_feeds) {
          toast.error('Please add at least one URL, select a predefined URL, or enable RSS feeds', { duration: 3000 })
          setSubmittingMode(null)
          return
        }

        requestData = {
          ...bugBountyFormData,
          predefined_url_ids: selectedPredefinedUrlIds.length > 0 ? selectedPredefinedUrlIds : undefined,
          urls: selectedPredefinedUrlIds.length > 0 
            ? bugBountyFormData.urls.filter(url => {
                return !predefinedUrls.some(pu => pu.id && selectedPredefinedUrlIds.includes(pu.id) && pu.url === url)
              })
            : bugBountyFormData.urls,
          add_to_predefined: addToPredefined,
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        console.warn('Failed to start ingestion:', response.status, response.statusText)
        toast.error('Failed to start ingestion', { duration: 3000 })
        return
      }

      const data = await response.json()
      
      if (sync) {
        if (currentType === 'threat_intel') {
          const stats = data.stats as IngestionStats
          toast.success(`Ingestion completed: ${stats?.articles_stored_vector || 0} articles stored`, { duration: 4000 })
        } else {
          const stats = data.stats as BugBountyIngestionStats
          toast.success(`Ingestion completed: ${stats?.urls_succeeded || 0} URLs processed`, { duration: 4000 })
        }
      } else {
        toast.success('Ingestion job started', { duration: 2000 })
      }

      setShowConfigDialog(false)
      fetchJobs()
      
      if (currentType === 'bug_bounty' && addToPredefined && bugBountyFormData.urls.length > 0) {
        for (const url of bugBountyFormData.urls) {
          await addUrlToPredefined(url)
        }
      }
    } catch (error) {
      console.warn('Error starting ingestion:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    } finally {
      setSubmittingMode(null)
    }
  }

  // Quick start with defaults - show confirmation dialog first
  const handleQuickStart = () => {
    if (mainTab === 'threat_intel') {
      const config = DEFAULT_THREAT_INTEL_INGEST_REQUEST
      setQuickStartConfig({
        type: 'threat_intel',
        config,
      })
      setShowQuickStartConfirm(true)
    } else if (mainTab === 'bug_bounty') {
      // Determine which URLs to use
      let urlsToUse: PredefinedUrl[] = []
      let manualUrls: string[] = []
      
      if (selectedPredefinedUrlIds.length > 0) {
        // Use already selected predefined URLs
        urlsToUse = predefinedUrls.filter(pu => selectedPredefinedUrlIds.includes(pu.id))
      } else if (bugBountyFormData.urls.length > 0) {
        // Use URLs from form data (manual URLs)
        manualUrls = [...bugBountyFormData.urls]
      } else if (predefinedUrls.length > 0) {
        // Auto-select first predefined URL
        urlsToUse = [predefinedUrls[0]]
      } else {
        toast.error('No predefined URLs available. Please add URLs manually or configure predefined URLs first.', { duration: 3000 })
        setShowConfigDialog(true)
        return
      }
      
      const config = { 
        ...DEFAULT_BUG_BOUNTY_INGEST_REQUEST,
        urls: manualUrls, // Preserve manual URLs if any
      }
      setQuickStartConfig({
        type: 'bug_bounty',
        config,
        selectedUrls: urlsToUse,
      })
      setShowQuickStartConfirm(true)
    }
  }

  // Confirm and start quick start job
  const confirmQuickStart = async () => {
    if (!quickStartConfig) return
    
    setShowQuickStartConfirm(false)
    
    if (quickStartConfig.type === 'threat_intel') {
      setThreatIntelFormData(quickStartConfig.config as ThreatIntelIngestRequest)
      await handleStartIngestion(false)
    } else if (quickStartConfig.type === 'bug_bounty') {
      const config = quickStartConfig.config as BugBountyIngestRequest
      setBugBountyFormData(config)
      
      // Set selected predefined URLs if any
      if (quickStartConfig.selectedUrls && quickStartConfig.selectedUrls.length > 0) {
        setSelectedPredefinedUrlIds(quickStartConfig.selectedUrls.map(u => u.id))
      } else {
        // Clear selected predefined URLs if none
        setSelectedPredefinedUrlIds([])
      }
      
      await handleStartIngestion(false)
    }
    
    setQuickStartConfig(null)
  }

  // Graph maintenance functions (for threat intel)
  const findOrphanedNodes = useCallback(async () => {
    if (!endpoint) return

    setIsLoadingOrphans(true)
    try {
      const response = await fetch(APIRoutes.ThreatIntelOrphanedNodes(endpoint))
      if (!response.ok) {
        console.warn('Failed to find orphaned nodes:', response.status, response.statusText)
        toast.error('Failed to find orphaned nodes', { duration: 3000 })
        return
      }

      const data = await response.json()
      setOrphanedNodes(data)
    } catch (error) {
      console.warn('Error finding orphaned nodes:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    } finally {
      setIsLoadingOrphans(false)
    }
  }, [endpoint])

  const cleanupOrphanedNodes = useCallback(async (dryRun: boolean = false) => {
    if (!endpoint) return

    setIsCleaningOrphans(true)
    try {
      const response = await fetch(
        APIRoutes.ThreatIntelCleanupOrphanedNodes(endpoint, { dryRun }),
        { method: 'DELETE' }
      )
      if (!response.ok) {
        console.warn('Failed to cleanup orphaned nodes:', response.status, response.statusText)
        toast.error('Failed to cleanup orphaned nodes', { duration: 3000 })
        return
      }

      const data = await response.json()
      
      if (dryRun) {
        toast.info(`Would delete ${data.summary.total_deleted} orphaned nodes`, { duration: 4000 })
      } else {
        toast.success(`Deleted ${data.summary.total_deleted} orphaned nodes`, { duration: 4000 })
        await findOrphanedNodes()
      }
    } catch (error) {
      console.warn('Error cleaning up orphaned nodes:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    } finally {
      setIsCleaningOrphans(false)
    }
  }, [endpoint, findOrphanedNodes])

  // Auto-scan when switching to maintenance tab
  useEffect(() => {
    if (mainTab === 'maintenance' && !orphanedNodes && !isLoadingOrphans) {
      findOrphanedNodes()
    }
  }, [mainTab, orphanedNodes, isLoadingOrphans, findOrphanedNodes])

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

  // Get theme colors based on main tab
  const isThreatIntel = mainTab === 'threat_intel'
  const themeColors = isThreatIntel 
    ? {
        primaryColor: 'emerald',
        primaryClasses: {
          text: 'text-emerald-500',
          text400: 'text-emerald-400',
          bg: 'bg-emerald-600',
          bgHover: 'hover:bg-emerald-700',
          bg500: 'bg-emerald-500',
        },
        gradient: 'from-emerald-500/10 via-teal-500/10 to-cyan-500/10',
        icon: Shield,
      }
    : {
        primaryColor: 'purple',
        primaryClasses: {
          text: 'text-purple-500',
          text400: 'text-purple-400',
          bg: 'bg-purple-600',
          bgHover: 'hover:bg-purple-700',
          bg500: 'bg-purple-500',
        },
        gradient: 'from-purple-500/10 via-pink-500/10 to-orange-500/10',
        icon: Bug,
      }

  const Icon = themeColors.icon

  // Filter jobs based on status and type filters
  const filteredJobs = React.useMemo(() => {
    return jobs.filter((job) => {
      // Filter by status
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false
      }
      
      // Filter by type
      if (typeFilter !== 'all') {
        const jobType = job.ingestion_type || 
          (job.job_id?.startsWith('bug_bounty_ingest_') ? 'bug_bounty' : 'threat_intel')
        if (jobType !== typeFilter) {
          return false
        }
      }
      
      return true
    })
  }, [jobs, statusFilter, typeFilter])

  // Update ingestionType and typeFilter when mainTab changes
  useEffect(() => {
    if (mainTab === 'threat_intel') {
      setIngestionType('threat_intel')
      setTypeFilter('threat_intel')
    } else if (mainTab === 'bug_bounty') {
      setIngestionType('bug_bounty')
      setTypeFilter('bug_bounty')
    } else if (mainTab === 'maintenance') {
      // For maintenance tab, show all types
      setTypeFilter('all')
    }
  }, [mainTab])

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
                  Intelligence Ingestion
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Fetch, analyze, and store intelligence from RSS feeds and websites
                </DialogDescription>
              </div>
              {/* Action Buttons - Grouped logically */}
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
                {mainTab !== 'maintenance' && (
                  <>
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
                      disabled={submittingMode !== null}
                      className={cn(
                        mainTab === 'threat_intel' 
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-purple-600 hover:bg-purple-700',
                        'text-white border-0'
                      )}
                    >
                      {submittingMode !== null ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1" />
                      )}
                      Quick Start
                    </Button>
                  </>
                )}
                {mainTab !== 'maintenance' && filteredJobs.some(j => j.status === 'completed' || j.status === 'failed') && (
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
              </div>
            </div>
          </DialogHeader>

          {/* Main Tab Navigation */}
          <div className="flex border-b border-zinc-700 bg-zinc-900/50">
            <button
              type="button"
              onClick={() => {
                setMainTab('threat_intel')
                setIngestionType('threat_intel')
                setTypeFilter('threat_intel')
              }}
              className={cn(
                'flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2',
                mainTab === 'threat_intel'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-600'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-4 w-4" />
                Threat Intel
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setMainTab('bug_bounty')
                setIngestionType('bug_bounty')
                setTypeFilter('bug_bounty')
              }}
              className={cn(
                'flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2',
                mainTab === 'bug_bounty'
                  ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-600'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Bug className="h-4 w-4" />
                Bug Bounty
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setMainTab('maintenance')
                setTypeFilter('all') // Show all types in maintenance view
                // Auto-scan when switching to maintenance tab
                if (!orphanedNodes && !isLoadingOrphans) {
                  findOrphanedNodes()
                }
              }}
              className={cn(
                'flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2',
                mainTab === 'maintenance'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-600'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Database className="h-4 w-4" />
                Maintenance
              </div>
            </button>
          </div>

          {/* Stats Bar (for threat intel tab) */}
          {mainTab === 'threat_intel' && feeds && (
            <div className="px-6 py-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Rss className={cn('h-4 w-4', themeColors.primaryClasses.text)} />
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
                {feeds.feeds.bug_bounty && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Bug Bounty:</span>
                    <span className="font-medium text-foreground">{feeds.feeds.bug_bounty.count}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Predefined URLs Section (for bug bounty tab) */}
          {mainTab === 'bug_bounty' && predefinedUrls.length > 0 && (
            <div className="px-6 py-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-purple-400" />
                  Predefined URLs
                </h3>
                <span className="text-xs text-zinc-400">
                  {predefinedUrls.length} {predefinedUrls.length === 1 ? 'URL' : 'URLs'} available
                </span>
              </div>
              {selectedPredefinedUrlIds.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-zinc-400 font-medium mb-1">
                    Selected for Quick Start ({selectedPredefinedUrlIds.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {predefinedUrls
                      .filter(pu => selectedPredefinedUrlIds.includes(pu.id))
                      .map((predefinedUrl) => (
                        <div
                          key={predefinedUrl.id}
                          className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-300 flex items-center gap-1.5"
                        >
                          <Check className="h-3 w-3" />
                          <span className="font-medium">{predefinedUrl.name}</span>
                          <span className="text-purple-400/70 truncate max-w-[200px]">
                            ({predefinedUrl.url})
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Maintenance Tab Content */}
            {mainTab === 'maintenance' ? (
              <div className="space-y-4">
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

                <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                  <h4 className="text-sm font-medium text-zinc-100 mb-2">What are orphaned nodes?</h4>
                  <ul className="text-xs text-zinc-400 space-y-1">
                    <li>• <span className="text-red-400">Threats</span> without APPLIES_TO_CATEGORY relationship</li>
                    <li>• <span className="text-amber-400">Attacks</span> not connected to any Threat via USES_ATTACK</li>
                    <li>• <span className="text-blue-400">Indicators</span> not connected to any Threat via HAS_INDICATOR</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-2 pt-4">
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
              </div>
            ) : (
              <>
            {/* Filter Bar */}
            {jobs.length > 0 && (
              <div className="mb-4 flex items-center justify-between gap-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-medium">Filter tasks:</span>
                  
                  {/* Status Filter */}
                  <div className="flex items-center gap-1">
                    {(['all', 'pending', 'running', 'completed', 'failed'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={cn(
                          'px-2 py-1 text-xs rounded transition-colors',
                          statusFilter === status
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        )}
                      >
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  {/* Type Filter */}
                  <div className="flex items-center gap-1 ml-2 pl-2 border-l border-zinc-600">
                    {(['all', 'threat_intel', 'bug_bounty'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={cn(
                          'px-2 py-1 text-xs rounded transition-colors flex items-center gap-1',
                          typeFilter === type
                            ? type === 'threat_intel' 
                              ? 'bg-emerald-600 text-white'
                              : type === 'bug_bounty'
                              ? 'bg-purple-600 text-white'
                              : 'bg-zinc-600 text-white'
                            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        )}
                      >
                        {type === 'all' && 'All Types'}
                        {type === 'threat_intel' && (
                          <>
                            <Shield className="h-3 w-3" />
                            Threat Intel
                          </>
                        )}
                        {type === 'bug_bounty' && (
                          <>
                            <Bug className="h-3 w-3" />
                            Bug Bounty
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Filtered Count */}
                <div className="text-xs text-zinc-400">
                  Showing {filteredJobs.length} of {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Icon className={`h-16 w-16 text-zinc-500 mb-4`} />
                <h3 className="text-lg font-medium text-zinc-100 mb-2">
                  {jobs.length > 0 ? 'No jobs match the current filters' : 'No ingestion jobs yet'}
                </h3>
                <p className="text-sm text-zinc-400 mb-4">
                  {jobs.length > 0 
                    ? 'Try adjusting the status or type filters above'
                    : mainTab === 'threat_intel'
                    ? 'Start your first threat intelligence ingestion to populate the database'
                    : predefinedUrls.length > 0
                    ? 'Select a predefined URL above or start a new ingestion'
                    : 'Start your first bug bounty intelligence ingestion to extract tips and techniques'}
                </p>
                {jobs.length === 0 && (
                  <Button 
                    onClick={() => setShowConfigDialog(true)}
                    className={cn(themeColors.primaryClasses.bg, themeColors.primaryClasses.bgHover, 'text-white border-0')}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start Ingestion
                  </Button>
                )}
                {jobs.length > 0 && (
                  <Button 
                    onClick={() => {
                      setStatusFilter('all')
                      setTypeFilter('all')
                    }}
                    variant="outline"
                    className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : filteredJobs.length <= 3 ? (
              // Grid view for 3 or fewer jobs
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredJobs.map((job, index) => (
                    <JobCard
                      key={job.job_id}
                      job={job}
                      index={index}
                      formatDate={formatDate}
                      formatDuration={formatDuration}
                      onDelete={deleteJob}
                      onStop={stopJob}
                      ingestionType={job.ingestion_type || ingestionType}
                      themeColors={themeColors}
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
                  {filteredJobs.map((job, index) => (
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
                        onStop={stopJob}
                        ingestionType={job.ingestion_type || ingestionType}
                        themeColors={themeColors}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="-left-4" />
                <CarouselNext className="-right-4" />
                <CarouselDots className="mt-4" />
              </Carousel>
            )}
              </>
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
              if (mainTab === 'bug_bounty') {
                setSelectedPredefinedUrlIds([])
              }
            } else {
              if (mainTab === 'bug_bounty' && selectedPredefinedUrlIds.length > 0) {
              const urlsFromPredefined = predefinedUrls
                .filter(pu => selectedPredefinedUrlIds.includes(pu.id))
                .map(pu => pu.url)
                .filter(url => !bugBountyFormData.urls.includes(url))
              
              if (urlsFromPredefined.length > 0) {
                setBugBountyFormData({ ...bugBountyFormData, urls: [...bugBountyFormData.urls, ...urlsFromPredefined] })
              }
            }
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              Configure {mainTab === 'threat_intel' ? 'Article' : 'Bug Bounty'} Ingestion
            </DialogTitle>
            <DialogDescription>
              {mainTab === 'threat_intel'
                ? 'Customize article ingestion parameters'
                : 'Manage URLs and customize extraction parameters'}
            </DialogDescription>
          </DialogHeader>

          {/* Tab Navigation (for bug bounty) */}
          {mainTab === 'bug_bounty' && (
            <div className="flex border-b border-zinc-700 mt-4">
              <button
                type="button"
                onClick={() => setActiveTab('urls')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2',
                  activeTab === 'urls'
                    ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                    : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-600'
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <List className="h-4 w-4" />
                  URLs
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2',
                  activeTab === 'settings'
                    ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                    : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-600'
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </div>
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
            {mainTab === 'threat_intel' ? (
              /* Threat Intel Configuration */
              <>
                {/* RSS Categories */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-zinc-100">RSS Feed Categories</label>
                  <TooltipProvider delayDuration={300}>
                    <div className="grid grid-cols-2 gap-2">
                      {RSS_CATEGORY_OPTIONS.map((option) => {
                        const categoryUrls: string[] =
                          feeds && option.value !== 'all'
                            ? (feeds.feeds[option.value as 'news' | 'threat_intel' | 'cyber_crime' | 'ai_security']?.urls ?? [])
                            : feeds
                              ? [...new Set([
                                  ...(feeds.feeds.news?.urls ?? []),
                                  ...(feeds.feeds.threat_intel?.urls ?? []),
                                  ...(feeds.feeds.cyber_crime?.urls ?? []),
                                  ...(feeds.feeds.ai_security?.urls ?? []),
                                  ...(feeds.feeds.bug_bounty?.urls ?? []),
                                ])]
                              : []
                        return (
                          <Tooltip key={option.value}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => {
                                  if (option.value === 'all') {
                                    setThreatIntelFormData({ ...threatIntelFormData, rss_categories: ['all'] })
                                  } else {
                                    const current = threatIntelFormData.rss_categories.filter(c => c !== 'all')
                                    const isSelected = current.includes(option.value)
                                    const newCategories = isSelected
                                      ? current.filter(c => c !== option.value)
                                      : [...current, option.value]
                                    setThreatIntelFormData({
                                      ...threatIntelFormData,
                                      rss_categories: newCategories.length > 0 ? newCategories : ['all'],
                                    })
                                  }
                                }}
                                className={cn(
                                  'px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2',
                                  threatIntelFormData.rss_categories.includes(option.value) ||
                                    (threatIntelFormData.rss_categories.includes('all') && option.value === 'all')
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                )}
                              >
                                <span>{option.icon}</span>
                                <span>{option.label}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="max-w-md max-h-64 overflow-auto text-left whitespace-pre-wrap break-all font-sans text-sm font-normal leading-relaxed"
                            >
                              {categoryUrls.length === 0 ? (
                                'Loading feed URLs…'
                              ) : (
                                <>
                                  <span className="font-medium block mb-1.5 text-sm">{option.label} ({categoryUrls.length} feed{categoryUrls.length !== 1 ? 's' : ''})</span>
                                  <div className="space-y-1 font-sans text-sm text-zinc-300 leading-relaxed">
                                    {categoryUrls.map((url) => (
                                      <a
                                        key={url}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block hover:text-white hover:underline break-all"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {url}
                                      </a>
                                    ))}
                                  </div>
                                </>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </TooltipProvider>
                </div>

                {/* Days Past & Max Articles */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block text-zinc-100">Days Past</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={threatIntelFormData.days_past}
                      onChange={(e) => setThreatIntelFormData({ ...threatIntelFormData, days_past: parseInt(e.target.value) || 2 })}
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
                      value={threatIntelFormData.max_articles_per_feed}
                      onChange={(e) => setThreatIntelFormData({ ...threatIntelFormData, max_articles_per_feed: parseInt(e.target.value) || 20 })}
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
                      value={threatIntelFormData.max_concurrent_sanitization}
                      onChange={(e) => setThreatIntelFormData({ ...threatIntelFormData, max_concurrent_sanitization: parseInt(e.target.value) || 5 })}
                      className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block text-zinc-100">Analysis Workers</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={threatIntelFormData.max_concurrent_analysis}
                      onChange={(e) => setThreatIntelFormData({ ...threatIntelFormData, max_concurrent_analysis: parseInt(e.target.value) || 3 })}
                      className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Toggle Options */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={threatIntelFormData.categorize_with_summary}
                      onChange={(e) => setThreatIntelFormData({ ...threatIntelFormData, categorize_with_summary: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-zinc-100">Categorize articles with LLM (threat / cybercrime / news)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer" title="When enabled, syncs to asset graph when threat_details are available. Graph is also updated by the agent during intelligent extraction.">
                    <input
                      type="checkbox"
                      checked={threatIntelFormData.store_in_graph}
                      onChange={(e) => setThreatIntelFormData({ ...threatIntelFormData, store_in_graph: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-zinc-100">Store threat intel in asset graph database</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={threatIntelFormData.force_refresh}
                      onChange={(e) => setThreatIntelFormData({ ...threatIntelFormData, force_refresh: e.target.checked })}
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
                    value={threatIntelFormData.cache_ttl_hours}
                    onChange={(e) => setThreatIntelFormData({ ...threatIntelFormData, cache_ttl_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <span className="text-xs text-zinc-400">0 = no caching, max 168 hours (1 week)</span>
                </div>
              </>
            ) : activeTab === 'urls' ? (
              /* Bug Bounty URLs Tab */
              <div className="space-y-4">
                {/* Predefined URLs Management */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium block text-zinc-100 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-purple-400" />
                      Predefined URLs
                    </label>
                    {predefinedUrls.length > 0 && (
                      <span className="text-xs text-zinc-400">
                        {predefinedUrls.length} {predefinedUrls.length === 1 ? 'URL' : 'URLs'}
                      </span>
                    )}
                  </div>
                  {loadingPredefinedUrls ? (
                    <div className="flex items-center justify-center py-8 border border-zinc-600 rounded-md bg-zinc-800/50">
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                      <span className="text-xs text-zinc-400">Loading predefined URLs...</span>
                    </div>
                  ) : predefinedUrls.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto space-y-2 border border-zinc-600 rounded-md p-2 bg-zinc-800/50">
                      {predefinedUrls.map((predefinedUrl) => (
                        <div
                          key={predefinedUrl.id}
                          className="p-3 rounded border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-700/30 transition-colors"
                        >
                          {editingUrlId === predefinedUrl.id ? (
                            /* Edit Mode */
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editUrlName}
                                onChange={(e) => setEditUrlName(e.target.value)}
                                placeholder="URL Name"
                                className="w-full px-2 py-1 text-xs rounded border border-zinc-600 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              <input
                                type="text"
                                value={predefinedUrl.url}
                                disabled
                                className="w-full px-2 py-1 text-xs rounded border border-zinc-600 bg-zinc-900/50 text-zinc-400"
                              />
                              <textarea
                                value={editUrlDescription}
                                onChange={(e) => setEditUrlDescription(e.target.value)}
                                placeholder="Description (optional)"
                                rows={2}
                                className="w-full px-2 py-1 text-xs rounded border border-zinc-600 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updatePredefinedUrl(predefinedUrl.id, editUrlName, editUrlDescription)}
                                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7"
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 text-xs h-7"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* View Mode */
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedPredefinedUrlIds.includes(predefinedUrl.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPredefinedUrlIds([...selectedPredefinedUrlIds, predefinedUrl.id])
                                    if (!bugBountyFormData.urls.includes(predefinedUrl.url)) {
                                      setBugBountyFormData({ ...bugBountyFormData, urls: [...bugBountyFormData.urls, predefinedUrl.url] })
                                    }
                                  } else {
                                    setSelectedPredefinedUrlIds(selectedPredefinedUrlIds.filter(id => id !== predefinedUrl.id))
                                    setBugBountyFormData({ ...bugBountyFormData, urls: bugBountyFormData.urls.filter(url => url !== predefinedUrl.url) })
                                  }
                                }}
                                className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-zinc-100">
                                  {predefinedUrl.name}
                                </div>
                                <div className="text-xs text-zinc-400 truncate mt-0.5">
                                  {predefinedUrl.url}
                                </div>
                                {predefinedUrl.description && (
                                  <div className="text-xs text-zinc-500 mt-1">
                                    {predefinedUrl.description}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => startEditingUrl(predefinedUrl)}
                                  className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-blue-400 transition-colors"
                                  title="Edit URL"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deletePredefinedUrl(predefinedUrl.id)}
                                  className="p-1.5 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-400 transition-colors"
                                  title="Delete URL"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-zinc-600 rounded-md p-4 bg-zinc-800/30 text-center">
                      <Globe className="h-6 w-6 text-zinc-500 mx-auto mb-2" />
                      <p className="text-xs text-zinc-400 mb-2">No predefined URLs yet</p>
                      <p className="text-xs text-zinc-500">Add URLs below to get started</p>
                    </div>
                  )}
                </div>

                {/* Add New URL */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-zinc-100">
                    Add New URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addUrl()
                        }
                      }}
                      placeholder="https://example.com/article"
                      className="flex-1 px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <Button
                      type="button"
                      onClick={addUrl}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {bugBountyFormData.urls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {bugBountyFormData.urls.map((url) => (
                        <div
                          key={url}
                          className="flex items-center justify-between px-3 py-2 bg-zinc-800 rounded-md"
                        >
                          <span className="text-xs text-zinc-300 truncate flex-1">{url}</span>
                          <button
                            onClick={() => removeUrl(url)}
                            className="ml-2 p-1 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-400"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-2 mt-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addToPredefined}
                      onChange={(e) => setAddToPredefined(e.target.checked)}
                      className="h-3 w-3 rounded border-zinc-600 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Save new URLs to predefined list</span>
                  </label>
                </div>

                {/* RSS Feeds Option */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bugBountyFormData.use_rss_feeds || false}
                      onChange={(e) => setBugBountyFormData({ ...bugBountyFormData, use_rss_feeds: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-zinc-100">
                      Process bug bounty RSS feeds (extract articles from past days)
                    </span>
                  </label>
                  {bugBountyFormData.use_rss_feeds && (
                    <div className="mt-2">
                      <label className="text-xs text-zinc-400 mb-1 block">Max Articles per RSS Feed</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={bugBountyFormData.max_articles_per_rss_feed || 20}
                        onChange={(e) => setBugBountyFormData({ ...bugBountyFormData, max_articles_per_rss_feed: parseInt(e.target.value) || 20 })}
                        className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Bug Bounty Settings Tab */
              <div className="space-y-4">
                {/* Days Past */}
                <div>
                  <label className="text-sm font-medium mb-1 block text-zinc-100">
                    Days Past
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={bugBountyFormData.days_past}
                    onChange={(e) =>
                      setBugBountyFormData({ ...bugBountyFormData, days_past: parseInt(e.target.value) || 7 })
                    }
                    className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <span className="text-xs text-zinc-400">1-30 days</span>
                </div>

                {/* Methodology Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-zinc-100">
                    Methodology Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {METHODOLOGY_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setBugBountyFormData({ ...bugBountyFormData, methodology_type: option.value })
                        }
                        className={cn(
                          'px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2',
                          bugBountyFormData.methodology_type === option.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        )}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Analysis Depth */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-zinc-100">
                    Analysis Depth
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {ANALYSIS_DEPTH_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setBugBountyFormData({ ...bugBountyFormData, analysis_depth: option.value })
                        }
                        className={cn(
                          'px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2',
                          bugBountyFormData.analysis_depth === option.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        )}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Concurrency */}
                <div>
                  <label className="text-sm font-medium mb-1 block text-zinc-100">
                    Concurrent Extractions
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={bugBountyFormData.max_concurrent_extraction}
                    onChange={(e) =>
                      setBugBountyFormData({
                        ...bugBountyFormData,
                        max_concurrent_extraction: parseInt(e.target.value) || 3,
                      })
                    }
                    className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                {/* Toggle Options */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bugBountyFormData.auto_integrate}
                      onChange={(e) =>
                        setBugBountyFormData({ ...bugBountyFormData, auto_integrate: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-zinc-100">
                      Auto-integrate findings into playbook
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bugBountyFormData.force_refresh}
                      onChange={(e) =>
                        setBugBountyFormData({ ...bugBountyFormData, force_refresh: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-zinc-100">
                      Force refresh (ignore cache)
                    </span>
                  </label>
                </div>

                {/* Cache TTL */}
                <div>
                  <label className="text-sm font-medium mb-1 block text-zinc-100">
                    Cache TTL (hours)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={720}
                    value={bugBountyFormData.cache_ttl_hours}
                    onChange={(e) =>
                      setBugBountyFormData({
                        ...bugBountyFormData,
                        cache_ttl_hours: parseFloat(e.target.value) || 168,
                      })
                    }
                    className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <span className="text-xs text-zinc-400">
                    0 = no caching, max 720 hours (30 days)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Dialog Footer */}
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
              disabled={submittingMode !== null}
              className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
            >
              {submittingMode === 'sync' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Clock className="h-4 w-4 mr-1" />}
              Run Sync
            </Button>
            <Button
              onClick={() => handleStartIngestion(false)}
              disabled={submittingMode !== null}
              className={cn(themeColors.primaryClasses.bg, themeColors.primaryClasses.bgHover, 'text-white border-0')}
            >
              {submittingMode === 'async' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Start Async
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Start Confirmation Dialog */}
      <Dialog open={showQuickStartConfirm} onOpenChange={setShowQuickStartConfirm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-400" />
              Quick Start Configuration
            </DialogTitle>
            <DialogDescription>
              Review the settings that will be used for this ingestion job. These are default settings optimized for quick ingestion.
            </DialogDescription>
          </DialogHeader>

          {quickStartConfig && (
            <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
              {quickStartConfig.type === 'threat_intel' ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                  <h4 className="text-sm font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    Article Ingestion Settings
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">RSS Categories:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as ThreatIntelIngestRequest).rss_categories.join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Days Past:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as ThreatIntelIngestRequest).days_past} days
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Max Articles per Feed:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as ThreatIntelIngestRequest).max_articles_per_feed}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Sanitization Workers:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as ThreatIntelIngestRequest).max_concurrent_sanitization}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Analysis Workers:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as ThreatIntelIngestRequest).max_concurrent_analysis}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Analyze Threats:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as ThreatIntelIngestRequest).categorize_with_summary ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Store in Graph:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as ThreatIntelIngestRequest).store_in_graph ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Cache TTL:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as ThreatIntelIngestRequest).cache_ttl_hours}h
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-xs text-emerald-300">
                    <strong>Note:</strong> This will process all RSS feeds from the selected categories using default settings optimized for quick ingestion.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                  <h4 className="text-sm font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                    <Bug className="h-4 w-4 text-purple-400" />
                    Bug Bounty Settings
                  </h4>
                  <div className="space-y-2 text-sm">
                    {((quickStartConfig?.selectedUrls && quickStartConfig.selectedUrls.length > 0) || 
                      ((quickStartConfig.config as BugBountyIngestRequest).urls && (quickStartConfig.config as BugBountyIngestRequest).urls.length > 0)) && (
                      <div className="mb-3">
                        <span className="text-zinc-400 block mb-2">
                          URLs to Process (
                          {(quickStartConfig?.selectedUrls?.length || 0) + ((quickStartConfig.config as BugBountyIngestRequest).urls?.length || 0)}
                          ):
                        </span>
                        <div className="space-y-1">
                          {quickStartConfig?.selectedUrls?.map((url) => (
                            <div key={url.id} className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs">
                              <div className="font-medium text-purple-300">{url.name}</div>
                              <div className="text-purple-400/70 truncate">{url.url}</div>
                            </div>
                          ))}
                          {(quickStartConfig.config as BugBountyIngestRequest).urls?.map((url, idx) => (
                            <div key={idx} className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs">
                              <div className="font-medium text-purple-300">Manual URL</div>
                              <div className="text-purple-400/70 truncate">{url}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Days Past:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as BugBountyIngestRequest).days_past} days
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Methodology Type:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as BugBountyIngestRequest).methodology_type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Analysis Depth:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as BugBountyIngestRequest).analysis_depth}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Concurrent Extractions:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as BugBountyIngestRequest).max_concurrent_extraction}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Auto-integrate:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as BugBountyIngestRequest).auto_integrate ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Use RSS Feeds:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as BugBountyIngestRequest).use_rss_feeds ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {(quickStartConfig.config as BugBountyIngestRequest).use_rss_feeds && (
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Max Articles per RSS Feed:</span>
                        <span className="text-zinc-100 font-medium">
                          {(quickStartConfig.config as BugBountyIngestRequest).max_articles_per_rss_feed}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Cache TTL:</span>
                      <span className="text-zinc-100 font-medium">
                        {(quickStartConfig.config as BugBountyIngestRequest).cache_ttl_hours}h
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
                  <p className="text-xs text-purple-300">
                    <strong>Note:</strong> {
                      quickStartConfig?.selectedUrls && quickStartConfig.selectedUrls.length > 0
                        ? `This will process ${quickStartConfig.selectedUrls.length} predefined URL(s) using default settings optimized for quick ingestion.`
                        : (quickStartConfig.config as BugBountyIngestRequest).urls && (quickStartConfig.config as BugBountyIngestRequest).urls.length > 0
                        ? `This will process ${(quickStartConfig.config as BugBountyIngestRequest).urls.length} manual URL(s) using default settings optimized for quick ingestion.`
                        : 'This will use default settings. If no URLs are selected, the first predefined URL will be used automatically.'
                    }
                  </p>
                </div>
              </div>
              )}
            </div>
          )}

          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t border-zinc-700 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowQuickStartConfirm(false)
                setQuickStartConfig(null)
              }}
              className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmQuickStart}
              disabled={submittingMode !== null || !quickStartConfig}
              className={cn(
                quickStartConfig?.type === 'threat_intel'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-purple-600 hover:bg-purple-700',
                'text-white border-0'
              )}
            >
              {submittingMode === 'async' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1" />
                  Start Job
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Graph Maintenance Dialog (kept for backward compatibility, but content is now inline) */}
      {false && showMaintenanceDialog && (
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
                          {orphanedNodes!.summary.orphaned_threats}
                        </div>
                        <div className="text-xs text-zinc-500">Orphan Threats</div>
                      </div>
                      <div className="rounded-md bg-zinc-900/50 p-3 text-center">
                        <div className="text-2xl font-bold text-amber-400">
                          {orphanedNodes!.summary.orphaned_attacks}
                        </div>
                        <div className="text-xs text-zinc-500">Orphan Attacks</div>
                      </div>
                      <div className="rounded-md bg-zinc-900/50 p-3 text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {orphanedNodes!.summary.orphaned_indicators}
                        </div>
                        <div className="text-xs text-zinc-500">Orphan Indicators</div>
                      </div>
                    </div>

                    {orphanedNodes!.summary.total_orphaned > 0 && (
                      <div className="pt-2 border-t border-zinc-700">
                        <div className="text-sm text-zinc-400 mb-2">
                          Total: <span className="font-semibold text-zinc-100">{orphanedNodes!.summary.total_orphaned}</span> orphaned nodes without asset category relationships
                        </div>
                      </div>
                    )}

                    {orphanedNodes!.summary.total_orphaned === 0 && (
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
                disabled={isCleaningOrphans || !orphanedNodes || orphanedNodes!.summary.total_orphaned === 0}
                className="border-zinc-600 text-zinc-100 hover:bg-amber-600/20 hover:text-amber-400"
              >
                {isCleaningOrphans ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
                Dry Run
              </Button>
              <Button
                onClick={() => cleanupOrphanedNodes(false)}
                disabled={isCleaningOrphans || !orphanedNodes || orphanedNodes!.summary.total_orphaned === 0}
                className="bg-red-600 hover:bg-red-700 text-white border-0"
              >
                {isCleaningOrphans ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete Orphans
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
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
  onStop: (jobId: string) => void
  ingestionType: IngestionType
  themeColors: { 
    primaryColor: string
    primaryClasses: {
      text: string
      text400: string
      bg: string
      bgHover: string
      bg500: string
    }
    icon: any 
  }
}

const JobCard: React.FC<JobCardProps> = ({
  job,
  index,
  formatDate,
  formatDuration,
  onDelete,
  onStop,
  ingestionType,
  themeColors,
}) => {
  const [expanded, setExpanded] = useState(false)
  const statusConfig = JOB_STATUS_CONFIG[job.status]
  const stats = job.stats
  const canDelete = job.status !== 'running' && job.status !== 'pending'
  const canStop = job.status === 'running' || job.status === 'pending'

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
            {canStop && (
              <button
                onClick={() => onStop(job.job_id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-500/20 text-zinc-500 hover:text-amber-400"
                title="Stop job"
              >
                <StopCircle className="h-3.5 w-3.5" />
              </button>
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
                className={cn('h-full', themeColors.primaryClasses.bg500, 'transition-all duration-300')}
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 mt-1">{job.progress}% complete</span>
          </div>
        )}

        {/* Stats Summary */}
        {stats && (
          <div className="space-y-1.5 text-xs mb-3">
            {ingestionType === 'threat_intel' ? (
              <>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between cursor-default">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Rss className="h-3 w-3" /> Feeds:
                        </span>
                        <span className="font-medium">
                          {(stats as IngestionStats).feeds_processed}
                          {(stats as IngestionStats).feeds_failed > 0 && (
                            <span className="text-red-400 ml-1">({(stats as IngestionStats).feeds_failed} failed)</span>
                          )}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-md max-h-64 overflow-auto text-left font-sans text-sm font-normal leading-relaxed"
                    >
                      {(stats as IngestionStats).rss_feeds_with_articles?.length ? (
                        <>
                          <span className="font-medium block mb-1.5">RSS feeds processed ({(stats as IngestionStats).rss_feeds_with_articles?.length})</span>
                          <div className="space-y-1 text-zinc-300 break-all">
                            {(stats as IngestionStats).rss_feeds_with_articles?.map((url) => (
                              <div key={url} className="text-xs">{url}</div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <span>No feed URLs available</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {((stats as IngestionStats).articles_threat !== undefined || (stats as IngestionStats).articles_cybercrime !== undefined || (stats as IngestionStats).articles_news !== undefined) && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1 shrink-0">
                      Categories:
                    </span>
                    <span className="text-right text-xs font-medium flex gap-2 flex-wrap justify-end">
                      <span className="text-amber-400">threat: {(stats as IngestionStats).articles_threat ?? 0}</span>
                      <span className="text-orange-400">cybercrime: {(stats as IngestionStats).articles_cybercrime ?? 0}</span>
                      <span className="text-sky-400">news: {(stats as IngestionStats).articles_news ?? 0}</span>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" /> URLs:
                  </span>
                  <span className="font-medium">
                    {(stats as BugBountyIngestionStats).urls_succeeded}
                    {(stats as BugBountyIngestionStats).urls_failed > 0 && (
                      <span className="text-red-400 ml-1">({(stats as BugBountyIngestionStats).urls_failed} failed)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Bug className="h-3 w-3" /> Tips:
                  </span>
                  <span className="font-medium text-purple-400">{(stats as BugBountyIngestionStats).tips_extracted}</span>
                </div>
                {(stats as BugBountyIngestionStats).attack_vectors_found !== undefined && (stats as BugBountyIngestionStats).attack_vectors_found > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Attack Vectors:
                    </span>
                    <span className="font-medium text-amber-400">
                      {(stats as BugBountyIngestionStats).attack_vectors_found}
                    </span>
                  </div>
                )}
              </>
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
            {ingestionType === 'threat_intel' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fetched:</span>
                  <span>{(stats as IngestionStats).articles_fetched}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Enriched:</span>
                  <span>{(stats as IngestionStats).articles_enriched}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sanitized:</span>
                  <span>{(stats as IngestionStats).articles_sanitized}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Analyzed:</span>
                  <span>{(stats as IngestionStats).articles_analyzed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Graph Synced:</span>
                  <span>{(stats as IngestionStats).articles_stored_graph}</span>
                </div>
                {/* {((stats as IngestionStats).articles_threat !== undefined || (stats as IngestionStats).articles_cybercrime !== undefined || (stats as IngestionStats).articles_news !== undefined) && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Threat:</span>
                      <span className="text-amber-400">{(stats as IngestionStats).articles_threat ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cybercrime:</span>
                      <span className="text-orange-400">{(stats as IngestionStats).articles_cybercrime ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">News:</span>
                      <span className="text-sky-400">{(stats as IngestionStats).articles_news ?? 0}</span>
                    </div>
                  </>
                )} */}
                {/* <div className="flex justify-between">
                  <span className="text-muted-foreground">Feeds processed:</span>
                  <span>{(stats as IngestionStats).rss_feeds_with_articles?.length ?? 0}</span>
                </div> */}
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processed:</span>
                  <span>{(stats as BugBountyIngestionStats).urls_processed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cached:</span>
                  <span>{(stats as BugBountyIngestionStats).urls_cached}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Techniques:</span>
                  <span>{(stats as BugBountyIngestionStats).techniques_found}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tools:</span>
                  <span>{(stats as BugBountyIngestionStats).tools_found}</span>
                </div>
              </>
            )}
            {((stats as IngestionStats).errors || (stats as BugBountyIngestionStats).errors)?.length > 0 && (
              <div className="mt-2 p-2 bg-red-500/10 rounded text-red-400">
                <span className="font-medium">
                  {((stats as IngestionStats).errors || (stats as BugBountyIngestionStats).errors)?.length} error(s)
                </span>
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


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
  Bug,
  Globe,
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
  Plus,
  X,
  Edit2,
  Save,
  List,
  Settings,
} from 'lucide-react'
import {
  BugBountyIngestRequest,
  BugBountyIngestionJobStatus,
  BugBountyIngestionStats,
  PredefinedUrl,
  METHODOLOGY_TYPE_OPTIONS,
  ANALYSIS_DEPTH_OPTIONS,
  JOB_STATUS_CONFIG,
  DEFAULT_BUG_BOUNTY_INGEST_REQUEST,
} from './types'

interface BugBountyIngestionCarouselProps {
  isOpen: boolean
  onClose: () => void
  endpoint: string
}

export const BugBountyIngestionCarousel: React.FC<BugBountyIngestionCarouselProps> = ({
  isOpen,
  onClose,
  endpoint,
}) => {
  // Jobs state
  const [jobs, setJobs] = useState<BugBountyIngestionJobStatus[]>([])
  const [loading, setLoading] = useState(false)

  // Form state
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [formData, setFormData] = useState<BugBountyIngestRequest>(
    DEFAULT_BUG_BOUNTY_INGEST_REQUEST
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  
  // Predefined URLs state
  const [predefinedUrls, setPredefinedUrls] = useState<PredefinedUrl[]>([])
  const [loadingPredefinedUrls, setLoadingPredefinedUrls] = useState(false)
  const [selectedPredefinedUrlIds, setSelectedPredefinedUrlIds] = useState<string[]>([])
  const [addToPredefined, setAddToPredefined] = useState(false)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'urls' | 'settings'>('urls')
  
  // Edit state for predefined URLs
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null)
  const [editUrlName, setEditUrlName] = useState('')
  const [editUrlDescription, setEditUrlDescription] = useState('')

  // Polling state for running jobs
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch jobs list
  const fetchJobs = useCallback(async () => {
    if (!endpoint) return

    setLoading(true)
    try {
      const response = await fetch(APIRoutes.BugBountyIngestionJobs(endpoint))
      if (!response.ok) {
        console.warn('Failed to fetch jobs:', response.status, response.statusText)
        toast.error('Failed to load ingestion jobs', { duration: 3000 })
        return
      }

      const data = await response.json()
      const allJobs = data.jobs || []
      
      // Client-side filter as safeguard: only show bug bounty jobs
      // Job IDs should start with "bug_bounty_ingest_"
      const bugBountyJobs = allJobs.filter((job: BugBountyIngestionJobStatus) =>
        job.job_id?.startsWith('bug_bounty_ingest_')
      )
      
      if (bugBountyJobs.length !== allJobs.length) {
        console.warn(
          `Bug bounty carousel: Filtered out ${allJobs.length - bugBountyJobs.length} non-bug-bounty jobs`
        )
      }
      
      setJobs(bugBountyJobs)
    } catch (error) {
      console.warn('Error fetching ingestion jobs:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  // Delete a specific job
  const deleteJob = useCallback(async (jobId: string) => {
    if (!endpoint) return

    try {
      const response = await fetch(
        APIRoutes.BugBountyIngestionDeleteJob(endpoint, jobId),
        {
          method: 'DELETE',
        }
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const message = data.detail || 'Failed to delete job'
        console.warn('Failed to delete job:', response.status, message)
        toast.error(message, { duration: 3000 })
        return
      }

      toast.success('Job deleted', { duration: 2000 })
      setJobs((prev) => prev.filter((j) => j.job_id !== jobId))
    } catch (error) {
      console.warn('Error deleting job:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    }
  }, [endpoint])

  // Clear all completed jobs
  const clearCompletedJobs = useCallback(async () => {
    if (!endpoint) return

    try {
      const response = await fetch(APIRoutes.BugBountyIngestionClearJobs(endpoint), {
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
  }, [endpoint, fetchJobs])

  // Poll for running job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    if (!endpoint) return null

    try {
      const response = await fetch(APIRoutes.BugBountyIngestionStatus(endpoint, jobId))

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        console.warn(`Job status fetch returned ${response.status} for ${jobId}`)
        return null
      }

      return await response.json()
    } catch (error) {
      console.warn('Error polling job status:', error)
      return null
    }
  }, [endpoint])

  // Start polling for running jobs
  const startPolling = useCallback(() => {
    if (pollingRef.current) return

    pollingRef.current = setInterval(async () => {
      const runningJobs = jobs.filter(
        (j) => j.status === 'running' || j.status === 'pending'
      )

      if (runningJobs.length === 0) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        return
      }

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

      justCompleted.forEach((job) => {
        if (job.status === 'completed') {
          toast.success(
            `Ingestion job completed: ${job.stats?.urls_succeeded || 0} URLs processed`,
            { duration: 4000 }
          )
        } else if (job.status === 'failed') {
          toast.error(`Ingestion job failed: ${job.error || 'Unknown error'}`, {
            duration: 4000,
          })
        }
      })
    }, 3000)
  }, [jobs, pollJobStatus])

  // Effect to manage polling
  useEffect(() => {
    const hasRunningJobs = jobs.some(
      (j) => j.status === 'running' || j.status === 'pending'
    )

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

  // Fetch predefined URLs
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

  // Add URL to predefined list
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

  // Update predefined URL
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

  // Delete predefined URL
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
      // Also remove from selected IDs if it was selected
      setSelectedPredefinedUrlIds(selectedPredefinedUrlIds.filter(id => id !== urlId))
    } catch (error) {
      console.warn('Error deleting predefined URL:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    }
  }, [endpoint, fetchPredefinedUrls, selectedPredefinedUrlIds])

  // Start editing a predefined URL
  const startEditingUrl = (predefinedUrl: PredefinedUrl) => {
    setEditingUrlId(predefinedUrl.id)
    setEditUrlName(predefinedUrl.name)
    setEditUrlDescription(predefinedUrl.description || '')
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingUrlId(null)
    setEditUrlName('')
    setEditUrlDescription('')
  }

  // Initial data fetch
  useEffect(() => {
    if (isOpen) {
      fetchJobs()
      fetchPredefinedUrls()
    }
  }, [isOpen, fetchJobs, fetchPredefinedUrls])

  // Add URL to list
  const addUrl = () => {
    if (urlInput.trim() && !formData.urls.includes(urlInput.trim())) {
      setFormData({ ...formData, urls: [...formData.urls, urlInput.trim()] })
      setUrlInput('')
    }
  }

  // Remove URL from list
  const removeUrl = (url: string) => {
    setFormData({ ...formData, urls: formData.urls.filter((u) => u !== url) })
    // Also uncheck the corresponding predefined URL if it matches
    const matchingPredefinedUrl = predefinedUrls.find(pu => pu.url === url)
    if (matchingPredefinedUrl && selectedPredefinedUrlIds.includes(matchingPredefinedUrl.id)) {
      setSelectedPredefinedUrlIds(selectedPredefinedUrlIds.filter(id => id !== matchingPredefinedUrl.id))
    }
  }

  // Trigger ingestion
  const handleStartIngestion = async (sync: boolean = false) => {
    // Combine URLs from both sources: direct URLs and predefined URLs
    // If predefined URLs are selected, use their IDs; otherwise use the URL strings
    const hasUrls = formData.urls.length > 0 || selectedPredefinedUrlIds.length > 0
    
    if (!hasUrls) {
      toast.error('Please add at least one URL or select a predefined URL', { duration: 3000 })
      return
    }

    setIsSubmitting(true)
    try {
      const url = sync
        ? APIRoutes.BugBountyIngestionSync(endpoint)
        : APIRoutes.BugBountyIngestion(endpoint)

      // Prepare request with predefined URLs and add_to_predefined flag
      // If predefined URLs are selected, prefer using their IDs for better tracking
      // Otherwise, use the direct URLs from the form
      const requestData: BugBountyIngestRequest = {
        ...formData,
        // Use predefined_url_ids if any are selected, otherwise use the URLs array
        predefined_url_ids: selectedPredefinedUrlIds.length > 0 ? selectedPredefinedUrlIds : undefined,
        // Only include direct URLs if no predefined URLs are selected, or if there are additional URLs
        urls: selectedPredefinedUrlIds.length > 0 
          ? formData.urls.filter(url => {
              // Filter out URLs that match predefined URLs (to avoid duplicates)
              return !predefinedUrls.some(pu => pu.id && selectedPredefinedUrlIds.includes(pu.id) && pu.url === url)
            })
          : formData.urls,
        add_to_predefined: addToPredefined,
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
        toast.success(
          `Ingestion completed: ${data.stats?.urls_succeeded || 0} URLs processed`,
          { duration: 4000 }
        )
      } else {
        toast.success('Ingestion job started', { duration: 2000 })
      }

      setShowConfigDialog(false)
      fetchJobs()
      if (addToPredefined && formData.urls.length > 0) {
        // Add URLs to predefined list if requested
        for (const url of formData.urls) {
          await addUrlToPredefined(url)
        }
      }
    } catch (error) {
      console.warn('Error starting ingestion:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick start with defaults
  const handleQuickStart = async () => {
    if (formData.urls.length === 0 && selectedPredefinedUrlIds.length === 0) {
      toast.error('Please add at least one URL or select a predefined URL first', { duration: 3000 })
      setShowConfigDialog(true)
      return
    }
    setFormData(DEFAULT_BUG_BOUNTY_INGEST_REQUEST)
    await handleStartIngestion(false)
  }

  // Quick extract for a single predefined URL
  const handleQuickExtract = useCallback(async (urlId: string) => {
    if (!endpoint) return

    setIsSubmitting(true)
    try {
      const url = APIRoutes.BugBountyIngestion(endpoint)

      // Use default settings with just the selected predefined URL
      const requestData: BugBountyIngestRequest = {
        ...DEFAULT_BUG_BOUNTY_INGEST_REQUEST,
        urls: [],
        predefined_url_ids: [urlId],
        add_to_predefined: false,
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        console.warn('Failed to start extraction:', response.status, response.statusText)
        toast.error('Failed to start extraction', { duration: 3000 })
        return
      }

      const data = await response.json()
      toast.success('Extraction job started', { duration: 2000 })
      fetchJobs()
    } catch (error) {
      console.warn('Error starting extraction:', error)
      toast.error('Unable to connect to server', { duration: 3000 })
    } finally {
      setIsSubmitting(false)
    }
  }, [endpoint, fetchJobs])

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
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Bug className="h-5 w-5 text-purple-500" />
                  Bug Bounty Intelligence Ingestion
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Extract bug bounty intelligence from websites and articles
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
                  <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
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
                  className="bg-purple-600 hover:bg-purple-700 text-white border-0"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-1" />
                  )}
                  Quick Start
                </Button>
                {jobs.some((j) => j.status === 'completed' || j.status === 'failed') && (
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

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Predefined URLs Section */}
            {predefinedUrls.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-purple-400" />
                    Predefined URLs
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {predefinedUrls.length} {predefinedUrls.length === 1 ? 'URL' : 'URLs'} available
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {predefinedUrls.slice(0, 6).map((predefinedUrl) => (
                    <div
                      key={predefinedUrl.id}
                      className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="text-xs font-medium text-zinc-100 truncate">
                          {predefinedUrl.name}
                        </div>
                        <div className="text-xs text-zinc-400 truncate mt-0.5">
                          {predefinedUrl.url}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleQuickExtract(predefinedUrl.id)}
                        disabled={isSubmitting}
                        className="bg-purple-600 hover:bg-purple-700 text-white border-0 flex-shrink-0"
                        title={`Extract intelligence from ${predefinedUrl.name}`}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                {predefinedUrls.length > 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfigDialog(true)}
                    className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                  >
                    View All {predefinedUrls.length} URLs
                  </Button>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Bug className="h-16 w-16 text-zinc-500 mb-4" />
                <h3 className="text-lg font-medium text-zinc-100 mb-2">
                  No ingestion jobs yet
                </h3>
                <p className="text-sm text-zinc-400 mb-4">
                  {predefinedUrls.length > 0
                    ? 'Select a predefined URL above or start a new ingestion'
                    : 'Start your first bug bounty intelligence ingestion to extract tips and techniques'}
                </p>
                <Button
                  onClick={() => setShowConfigDialog(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white border-0"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Start Ingestion
                </Button>
              </div>
            ) : (
              <>
                {/* Jobs Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      <Database className="h-4 w-4 text-blue-400" />
                      Ingestion Jobs
                    </h3>
                    <span className="text-xs text-zinc-400">
                      {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
                    </span>
                  </div>
                </div>

                {jobs.length <= 3 ? (
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
                  <Carousel opts={{ align: 'start', loop: false }} className="w-full">
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
            // Reset selections when dialog closes
            setSelectedPredefinedUrlIds([])
          } else {
            // When dialog opens, sync predefined URLs to the URL field
            if (selectedPredefinedUrlIds.length > 0) {
              const urlsFromPredefined = predefinedUrls
                .filter(pu => selectedPredefinedUrlIds.includes(pu.id))
                .map(pu => pu.url)
                .filter(url => !formData.urls.includes(url))
              
              if (urlsFromPredefined.length > 0) {
                setFormData({ ...formData, urls: [...formData.urls, ...urlsFromPredefined] })
              }
            }
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Configure Bug Bounty Ingestion</DialogTitle>
            <DialogDescription>
              Manage URLs and customize extraction parameters
            </DialogDescription>
          </DialogHeader>

          {/* Tab Navigation */}
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

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
            {activeTab === 'urls' ? (
              /* URLs Tab - CRUD Operations */
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
                                    if (!formData.urls.includes(predefinedUrl.url)) {
                                      setFormData({ ...formData, urls: [...formData.urls, predefinedUrl.url] })
                                    }
                                  } else {
                                    setSelectedPredefinedUrlIds(selectedPredefinedUrlIds.filter(id => id !== predefinedUrl.id))
                                    setFormData({ ...formData, urls: formData.urls.filter(url => url !== predefinedUrl.url) })
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
                      <p className="text-xs text-zinc-500">
                        Add URLs below to get started
                      </p>
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
                  {formData.urls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.urls.map((url) => (
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
              </div>
            ) : (
              /* Settings Tab */
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
                    value={formData.days_past}
                    onChange={(e) =>
                      setFormData({ ...formData, days_past: parseInt(e.target.value) || 7 })
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
                          setFormData({ ...formData, methodology_type: option.value })
                        }
                        className={cn(
                          'px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2',
                          formData.methodology_type === option.value
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
                          setFormData({ ...formData, analysis_depth: option.value })
                        }
                        className={cn(
                          'px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2',
                          formData.analysis_depth === option.value
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
                    value={formData.max_concurrent_extraction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
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
                      checked={formData.auto_integrate}
                      onChange={(e) =>
                        setFormData({ ...formData, auto_integrate: e.target.checked })
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
                      checked={formData.force_refresh}
                      onChange={(e) =>
                        setFormData({ ...formData, force_refresh: e.target.checked })
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
                    value={formData.cache_ttl_hours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
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
              disabled={isSubmitting}
              className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 mr-1" />
              )}
              Run Sync
            </Button>
            <Button
              onClick={() => handleStartIngestion(false)}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white border-0"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Start Async
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </Dialog>
    </>
  )
}

// Job Card Component
interface JobCardProps {
  job: BugBountyIngestionJobStatus
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
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                statusConfig.bgColor,
                statusConfig.color
              )}
            >
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

        {/* Progress Bar */}
        {job.status === 'running' && job.progress !== undefined && (
          <div className="mb-3">
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
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
                <Globe className="h-3 w-3" /> URLs:
              </span>
              <span className="font-medium">
                {stats.urls_succeeded}
                {stats.urls_failed > 0 && (
                  <span className="text-red-400 ml-1">({stats.urls_failed} failed)</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Bug className="h-3 w-3" /> Tips:
              </span>
              <span className="font-medium text-purple-400">{stats.tips_extracted}</span>
            </div>
            {stats.attack_vectors_found !== undefined && stats.attack_vectors_found > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Attack Vectors:
                </span>
                <span className="font-medium text-amber-400">
                  {stats.attack_vectors_found}
                </span>
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
              <span className="text-muted-foreground">Processed:</span>
              <span>{stats.urls_processed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cached:</span>
              <span>{stats.urls_cached}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Techniques:</span>
              <span>{stats.techniques_found}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tools:</span>
              <span>{stats.tools_found}</span>
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

'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  Plus,
  X,
  Calendar,
  User,
  Server,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Shield,
  Key,
  Bug,
  Search,
  FileText,
  Settings,
  ClipboardCheck,
  Siren,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react'
import {
  WorkflowTask,
  WorkflowTaskFormData,
  WorkflowTaskType,
  WorkflowStatus,
  WorkflowPriority,
  WorkflowDashboardStats,
  TASK_TYPE_OPTIONS,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
} from './types'

// Task type icons mapping
const TASK_TYPE_ICONS: Record<WorkflowTaskType, React.ReactNode> = {
  hygiene_review: <Shield className="h-4 w-4" />,
  access_review: <Key className="h-4 w-4" />,
  patching: <Bug className="h-4 w-4" />,
  threat_review: <AlertTriangle className="h-4 w-4" />,
  ioc_review: <Search className="h-4 w-4" />,
  vulnerability_remediation: <Settings className="h-4 w-4" />,
  configuration_audit: <FileText className="h-4 w-4" />,
  compliance_check: <ClipboardCheck className="h-4 w-4" />,
  incident_response: <Siren className="h-4 w-4" />,
  custom: <Pencil className="h-4 w-4" />,
}

interface WorkflowCarouselProps {
  isOpen: boolean
  onClose: () => void
  endpoint: string
}

// Asset picker type
interface AssetOption {
  id: string
  name: string
  asset_type: string
  criticality: string
  environment?: string
}

export const WorkflowCarousel: React.FC<WorkflowCarouselProps> = ({
  isOpen,
  onClose,
  endpoint,
}) => {
  const [tasks, setTasks] = useState<WorkflowTask[]>([])
  const [stats, setStats] = useState<WorkflowDashboardStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<WorkflowTask | null>(null)
  const [filter, setFilter] = useState<WorkflowStatus | 'all'>('all')

  // Asset picker state
  const [availableAssets, setAvailableAssets] = useState<AssetOption[]>([])
  const [assetSearchQuery, setAssetSearchQuery] = useState('')
  const [showAssetDropdown, setShowAssetDropdown] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)

  // Form state
  const [formData, setFormData] = useState<WorkflowTaskFormData>({
    title: '',
    description: '',
    task_type: 'hygiene_review',
    status: 'pending',
    priority: 'medium',
  })

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!endpoint) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.append('status', filter)
      }
      params.append('limit', '50')

      const response = await fetch(
        `${APIRoutes.WorkflowTasksList(endpoint)}?${params.toString()}`
      )
      if (!response.ok) throw new Error('Failed to fetch tasks')

      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Error fetching workflow tasks:', error)
      toast.error('Failed to load workflow tasks', { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }, [endpoint, filter])

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    if (!endpoint) return

    try {
      const response = await fetch(APIRoutes.WorkflowDashboard(endpoint))
      if (!response.ok) throw new Error('Failed to fetch stats')

      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching workflow stats:', error)
    }
  }, [endpoint])

  // Fetch assets for picker
  const fetchAssets = useCallback(async (search?: string) => {
    if (!endpoint) return

    setLoadingAssets(true)
    try {
      const response = await fetch(APIRoutes.WorkflowAssetsPicker(endpoint, search))
      
      // Handle non-ok responses gracefully (e.g., no assets in database)
      if (!response.ok) {
        // Just set empty array - this is expected when no assets exist yet
        setAvailableAssets([])
        return
      }

      const data = await response.json()
      setAvailableAssets(data.assets || [])
    } catch (error) {
      // Network errors or other issues - fail silently with empty array
      // User can still manually type an asset name
      setAvailableAssets([])
    } finally {
      setLoadingAssets(false)
    }
  }, [endpoint])

  useEffect(() => {
    if (isOpen) {
      fetchTasks()
      fetchStats()
      fetchAssets() // Fetch assets on open
    }
  }, [isOpen, fetchTasks, fetchStats, fetchAssets])

  // Create task
  const handleCreateTask = async () => {
    if (!formData.title.trim()) {
      toast.error('Task title is required', { duration: 3000 })
      return
    }

    try {
      const response = await fetch(APIRoutes.WorkflowTaskCreate(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create task')

      const data = await response.json()
      toast.success('Task created', { duration: 2000 })
      setShowCreateDialog(false)
      resetForm()
      fetchTasks()
      fetchStats()
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task', { duration: 3000 })
    }
  }

  // Update task
  const handleUpdateTask = async () => {
    if (!editingTask) return

    try {
      const response = await fetch(
        APIRoutes.WorkflowTaskUpdate(endpoint, editingTask.id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      )

      if (!response.ok) throw new Error('Failed to update task')

      toast.success('Task updated', { duration: 2000 })
      setEditingTask(null)
      resetForm()
      fetchTasks()
      fetchStats()
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task', { duration: 3000 })
    }
  }

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const response = await fetch(
        APIRoutes.WorkflowTaskDelete(endpoint, taskId),
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error('Failed to delete task')

      toast.success('Task deleted', { duration: 2000 })
      fetchTasks()
      fetchStats()
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task', { duration: 3000 })
    }
  }

  // Complete task
  const handleCompleteTask = async (taskId: string) => {
    try {
      const response = await fetch(
        APIRoutes.WorkflowTaskComplete(endpoint, taskId),
        { method: 'POST' }
      )

      if (!response.ok) throw new Error('Failed to complete task')

      toast.success('Task completed', { duration: 2000 })
      fetchTasks()
      fetchStats()
    } catch (error) {
      console.error('Error completing task:', error)
      toast.error('Failed to complete task', { duration: 3000 })
    }
  }

  // Update task status
  const handleUpdateStatus = async (taskId: string, newStatus: WorkflowStatus) => {
    try {
      const response = await fetch(
        APIRoutes.WorkflowTaskUpdate(endpoint, taskId),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      )

      if (!response.ok) throw new Error('Failed to update status')

      toast.success('Status updated', { duration: 2000 })
      fetchTasks()
      fetchStats()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status', { duration: 3000 })
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      task_type: 'hygiene_review',
      status: 'pending',
      priority: 'medium',
    })
  }

  const openEditDialog = (task: WorkflowTask) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      status: task.status,
      priority: task.priority,
      asset_id: task.asset_id,
      asset_name: task.asset_name,
      assignee: task.assignee,
      due_date: task.due_date,
    })
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Workflow Tasks
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Manage asset-centric security workflow tasks
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 mr-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchTasks()
                    fetchStats()
                  }}
                  disabled={loading}
                  className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    resetForm()
                    setShowCreateDialog(true)
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Task
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Stats Bar */}
          {stats && (
            <div className="px-6 py-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium text-foreground">{stats.total_tasks}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-medium text-foreground">{stats.by_status?.pending || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">In Progress:</span>
                  <span className="font-medium text-foreground">{stats.by_status?.in_progress || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="font-medium text-foreground">{stats.by_status?.completed || 0}</span>
                </div>
                {stats.overdue_count > 0 && (
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{stats.overdue_count} overdue</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="px-6 py-2 border-b border-zinc-700">
            <div className="flex items-center gap-1">
              {(['all', 'pending', 'in_progress', 'completed', 'blocked'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-colors font-medium',
                    filter === status
                      ? 'bg-indigo-600 text-white'
                      : 'text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  )}
                >
                  {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <ClipboardCheck className="h-16 w-16 text-zinc-500 mb-4" />
                <h3 className="text-lg font-medium text-zinc-100 mb-2">
                  No tasks found
                </h3>
                <p className="text-sm text-zinc-400 mb-4">
                  {filter === 'all'
                    ? 'Create your first workflow task to get started'
                    : `No ${filter.replace('_', ' ')} tasks`}
                </p>
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Task
                </Button>
              </div>
            ) : tasks.length <= 3 ? (
              // Grid view for 3 or fewer tasks
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {tasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      index={index}
                      onEdit={openEditDialog}
                      onDelete={handleDeleteTask}
                      onComplete={handleCompleteTask}
                      onStatusChange={handleUpdateStatus}
                      formatDate={formatDate}
                      isOverdue={isOverdue}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              // Carousel for more than 3 tasks
              <Carousel
                opts={{ align: 'start', loop: false }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {tasks.map((task, index) => (
                    <CarouselItem
                      key={task.id}
                      className="pl-4 md:basis-1/2 lg:basis-1/3"
                    >
                      <TaskCard
                        task={task}
                        index={index}
                        onEdit={openEditDialog}
                        onDelete={handleDeleteTask}
                        onComplete={handleCompleteTask}
                        onStatusChange={handleUpdateStatus}
                        formatDate={formatDate}
                        isOverdue={isOverdue}
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog || !!editingTask}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingTask(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? 'Edit Task' : 'Create New Task'}
            </DialogTitle>
            <DialogDescription>
              {editingTask
                ? 'Update the workflow task details'
                : 'Create a new asset-centric workflow task'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Title */}
            <div>
              <label className="text-sm font-medium mb-1 block text-zinc-100">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
                className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1 block text-zinc-100">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter task description"
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Task Type */}
            <div>
              <label className="text-sm font-medium mb-1 block text-zinc-100">Task Type</label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value as WorkflowTaskType })}
                className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {TASK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority & Status Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block text-zinc-100">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as WorkflowPriority })}
                  className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="critical">🔴 Critical</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-zinc-100">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as WorkflowStatus })}
                  className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Asset & Assignee Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="text-sm font-medium mb-1 block text-zinc-100">
                  Asset Name
                  <span className="text-xs text-zinc-400 ml-2">(select or type)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={assetSearchQuery || formData.asset_name || ''}
                    onChange={(e) => {
                      setAssetSearchQuery(e.target.value)
                      setShowAssetDropdown(true)
                      // Also update formData for manual entry
                      setFormData({ ...formData, asset_name: e.target.value, asset_id: undefined })
                      // Debounce search
                      const searchTerm = e.target.value
                      if (searchTerm.length >= 1) {
                        fetchAssets(searchTerm)
                      }
                    }}
                    onFocus={() => {
                      setShowAssetDropdown(true)
                      if (!assetSearchQuery && availableAssets.length === 0) {
                        fetchAssets()
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding to allow click on dropdown items
                      setTimeout(() => {
                        setShowAssetDropdown(false)
                        // Keep the manually typed value
                        if (assetSearchQuery && !formData.asset_id) {
                          setFormData({ ...formData, asset_name: assetSearchQuery })
                        }
                        setAssetSearchQuery('')
                      }, 200)
                    }}
                    placeholder="Search or type asset name..."
                    className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {loadingAssets && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <RefreshCw className="h-4 w-4 animate-spin text-zinc-400" />
                    </div>
                  )}
                  <Server className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" style={{ display: loadingAssets ? 'none' : 'block' }} />
                </div>
                {/* Asset dropdown */}
                {showAssetDropdown && (
                  <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md border border-zinc-600 bg-zinc-800 shadow-lg">
                    {availableAssets.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-zinc-400">
                        {loadingAssets ? (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Loading assets...
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-zinc-300">No assets in database</p>
                            <p className="text-xs">You can type an asset name manually, or add assets via the Asset Management category.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      availableAssets
                        .filter(asset => 
                          !assetSearchQuery || 
                          asset.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                          asset.asset_type.toLowerCase().includes(assetSearchQuery.toLowerCase())
                        )
                        .slice(0, 10)
                        .map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => {
                              setFormData({ 
                                ...formData, 
                                asset_id: asset.id,
                                asset_name: asset.name 
                              })
                              setAssetSearchQuery('')
                              setShowAssetDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-zinc-700 flex items-center justify-between group"
                          >
                            <div>
                              <span className="text-sm text-zinc-100">{asset.name}</span>
                              <span className="text-xs text-zinc-400 ml-2">({asset.asset_type})</span>
                            </div>
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded',
                              asset.criticality === 'critical' && 'bg-red-500/20 text-red-400',
                              asset.criticality === 'high' && 'bg-orange-500/20 text-orange-400',
                              asset.criticality === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                              asset.criticality === 'low' && 'bg-green-500/20 text-green-400',
                            )}>
                              {asset.criticality}
                            </span>
                          </button>
                        ))
                    )}
                  </div>
                )}
                {/* Selected asset display */}
                {formData.asset_name && !showAssetDropdown && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Selected:</span>
                    <span className="text-xs text-indigo-400 font-medium">{formData.asset_name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, asset_id: undefined, asset_name: undefined })
                        setAssetSearchQuery('')
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-zinc-100">Assignee</label>
                <input
                  type="text"
                  value={formData.assignee || ''}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  placeholder="e.g., security@company.com"
                  className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-sm font-medium mb-1 block text-zinc-100">Due Date</label>
              <input
                type="date"
                value={formData.due_date?.split('T')[0] || ''}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="w-full px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  setEditingTask(null)
                  resetForm()
                }}
                className="border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white"
              >
                Cancel
              </Button>
              <Button 
                onClick={editingTask ? handleUpdateTask : handleCreateTask}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
              >
                {editingTask ? 'Update Task' : 'Create Task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// Task Card Component
interface TaskCardProps {
  task: WorkflowTask
  index: number
  onEdit: (task: WorkflowTask) => void
  onDelete: (taskId: string) => void
  onComplete: (taskId: string) => void
  onStatusChange: (taskId: string, status: WorkflowStatus) => void
  formatDate: (dateStr?: string) => string | null
  isOverdue: (dueDate?: string) => boolean
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  index,
  onEdit,
  onDelete,
  onComplete,
  onStatusChange,
  formatDate,
  isOverdue,
}) => {
  const [showActions, setShowActions] = useState(false)
  const statusConfig = STATUS_CONFIG[task.status]
  const priorityConfig = PRIORITY_CONFIG[task.priority]
  const taskTypeOption = TASK_TYPE_OPTIONS.find((t) => t.value === task.task_type)
  const overdue = isOverdue(task.due_date) && task.status !== 'completed' && task.status !== 'cancelled'

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
          'bg-card hover:shadow-lg hover:border-primary/30',
          overdue && 'border-red-300 dark:border-red-800'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-lg', priorityConfig.bgColor)}>
              {TASK_TYPE_ICONS[task.task_type]}
            </div>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', statusConfig.bgColor, statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                <button
                  onClick={() => {
                    onEdit(task)
                    setShowActions(false)
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                {task.status !== 'completed' && (
                  <button
                    onClick={() => {
                      onComplete(task.id)
                      setShowActions(false)
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 text-green-600"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Complete
                  </button>
                )}
                <button
                  onClick={() => {
                    onDelete(task.id)
                    setShowActions(false)
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="font-semibold text-sm mb-1 line-clamp-2">{task.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {task.description}
        </p>

        {/* Task Type Badge */}
        <div className="mb-3">
          <span className="text-xs bg-muted px-2 py-0.5 rounded">
            {taskTypeOption?.icon} {taskTypeOption?.label || task.task_type}
          </span>
        </div>

        {/* Meta Info */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {task.asset_name && (
            <div className="flex items-center gap-1.5">
              <Server className="h-3 w-3" />
              <span className="truncate">{task.asset_name}</span>
            </div>
          )}
          {task.assignee && (
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              <span className="truncate">{task.assignee}</span>
            </div>
          )}
          {task.due_date && (
            <div className={cn('flex items-center gap-1.5', overdue && 'text-red-600 font-medium')}>
              <Calendar className="h-3 w-3" />
              <span>
                {overdue && '⚠️ '}Due: {formatDate(task.due_date)}
              </span>
            </div>
          )}
        </div>

        {/* Priority Badge */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className={cn('text-xs px-2 py-0.5 rounded', priorityConfig.bgColor, priorityConfig.color)}>
            {priorityConfig.label} Priority
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDate(task.created_at)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}


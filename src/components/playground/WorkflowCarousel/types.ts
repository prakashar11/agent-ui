/**
 * Workflow Carousel Types
 * 
 * Types for asset-centric security workflow tasks.
 */

export type WorkflowTaskType =
  | 'hygiene_review'
  | 'access_review'
  | 'patching'
  | 'threat_review'
  | 'ioc_review'
  | 'vulnerability_remediation'
  | 'configuration_audit'
  | 'compliance_check'
  | 'incident_response'
  | 'custom'

export type WorkflowStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled'

export type WorkflowPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'

export interface WorkflowTask {
  id: string
  title: string
  description: string
  task_type: WorkflowTaskType
  status: WorkflowStatus
  priority: WorkflowPriority
  asset_id?: string
  asset_name?: string
  assignee?: string
  due_date?: string
  created_at: string
  updated_at: string
  completed_at?: string
  properties: Record<string, unknown>
}

export interface WorkflowTaskFormData {
  title: string
  description: string
  task_type: WorkflowTaskType
  status: WorkflowStatus
  priority: WorkflowPriority
  asset_id?: string
  asset_name?: string
  assignee?: string
  due_date?: string
  properties?: Record<string, unknown>
}

export interface WorkflowDashboardStats {
  total_tasks: number
  by_status: Record<WorkflowStatus, number>
  by_priority: Record<WorkflowPriority, number>
  by_type: Record<WorkflowTaskType, number>
  overdue_count: number
  overdue_tasks: WorkflowTask[]
  upcoming_count: number
  upcoming_tasks: WorkflowTask[]
}

export interface TaskTypeOption {
  value: WorkflowTaskType
  label: string
  description: string
  icon: string
}

export const TASK_TYPE_OPTIONS: TaskTypeOption[] = [
  {
    value: 'hygiene_review',
    label: 'Hygiene Review',
    description: 'Review and configure asset hygiene settings',
    icon: '🛡️',
  },
  {
    value: 'access_review',
    label: 'Access Review',
    description: 'User Access Review (UAR) for identities and privileges',
    icon: '🔑',
  },
  {
    value: 'patching',
    label: 'Patching',
    description: 'Apply security patches to assets',
    icon: '🩹',
  },
  {
    value: 'threat_review',
    label: 'Threat Review',
    description: 'Review threats targeting assets',
    icon: '⚠️',
  },
  {
    value: 'ioc_review',
    label: 'IoC Review',
    description: 'Review IoCs and log events for potential incidents',
    icon: '🔍',
  },
  {
    value: 'vulnerability_remediation',
    label: 'Vulnerability Remediation',
    description: 'Remediate identified vulnerabilities',
    icon: '🔧',
  },
  {
    value: 'configuration_audit',
    label: 'Configuration Audit',
    description: 'Audit asset configuration against standards',
    icon: '📋',
  },
  {
    value: 'compliance_check',
    label: 'Compliance Check',
    description: 'Verify compliance with security policies',
    icon: '✅',
  },
  {
    value: 'incident_response',
    label: 'Incident Response',
    description: 'Handle security incident response',
    icon: '🚨',
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Custom workflow task',
    icon: '📝',
  },
]

export const STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; bgColor: string }> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
}

export const PRIORITY_CONFIG: Record<WorkflowPriority, { label: string; color: string; bgColor: string }> = {
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
  },
  high: {
    label: 'High',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  low: {
    label: 'Low',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
}


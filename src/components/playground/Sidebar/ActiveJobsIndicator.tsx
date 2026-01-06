'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { usePlaygroundStore, type ActiveJob } from '@/store'
import { useQueryState } from 'nuqs'
import { Loader2, Bot, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ActiveJobsIndicator() {
  const { 
    activeJobs,
    setCurrentContext,
    setSelectedCategory,
    agents,
    currentStorageKey
  } = usePlaygroundStore()
  const [, setAgentId] = useQueryState('agent')
  const [, setSessionId] = useQueryState('session')
  
  // Get active jobs as an array, excluding the current context
  const otherActiveJobs = Object.values(activeJobs).filter(
    job => job.storageKey !== currentStorageKey && job.status === 'running'
  )
  
  const handleNavigateToJob = (job: ActiveJob) => {
    // Find the agent to get its category
    const agent = agents.find(a => a.value === job.agentId)
    if (agent?.category) {
      setSelectedCategory(agent.category)
    }
    setAgentId(job.agentId)
    setSessionId(job.sessionId)
    setCurrentContext(job.agentId, job.sessionId)
  }
  
  if (otherActiveJobs.length === 0) {
    return null
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Running Jobs
        </span>
        <span className="text-xs text-muted-foreground/60">
          {otherActiveJobs.length}
        </span>
      </div>
      {otherActiveJobs.slice(0, 3).map((job) => (
        <motion.div
          key={job.agentId}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'group relative rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5',
            'hover:border-amber-500/40 hover:bg-amber-500/10 transition-colors cursor-pointer'
          )}
          onClick={() => handleNavigateToJob(job)}
        >
          {/* Content */}
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <div className="relative">
                <Bot className="h-4 w-4 text-amber-500" />
                <Loader2 className="h-2.5 w-2.5 text-amber-500 absolute -bottom-0.5 -right-0.5 bg-background rounded-full animate-spin" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {job.agentLabel}
              </p>
              {job.lastMessage && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {job.lastMessage.slice(0, 50)}...
                </p>
              )}
              <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
                <span>Switch to agent</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
      {otherActiveJobs.length > 3 && (
        <p className="text-xs text-muted-foreground text-center">
          +{otherActiveJobs.length - 3} more running
        </p>
      )}
    </div>
  )
}


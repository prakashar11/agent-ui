'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlaygroundStore, type BackgroundJobNotification } from '@/store'
import { useQueryState } from 'nuqs'
import { X, CheckCircle2, Bot, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackgroundJobNotifications() {
  const { 
    backgroundNotifications, 
    dismissNotification,
    setCurrentContext,
    setSelectedCategory,
    agents
  } = usePlaygroundStore()
  const [, setAgentId] = useQueryState('agent')
  const [, setSessionId] = useQueryState('session')
  
  // Filter to only show non-dismissed notifications
  const activeNotifications = backgroundNotifications.filter(n => !n.dismissed)
  
  const handleNavigateToSession = (notification: BackgroundJobNotification) => {
    // Find the agent to get its category
    const agent = agents.find(a => a.value === notification.agentId)
    if (agent?.category) {
      setSelectedCategory(agent.category)
    }
    setAgentId(notification.agentId)
    setSessionId(notification.sessionId)
    // Set the current context to load the session's messages
    setCurrentContext(notification.agentId, notification.sessionId)
    // Dismiss the notification
    dismissNotification(notification.id)
  }
  
  if (activeNotifications.length === 0) {
    return null
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Completed Jobs
        </span>
        <span className="text-xs text-muted-foreground/60">
          {activeNotifications.length}
        </span>
      </div>
      <AnimatePresence>
        {activeNotifications.slice(0, 5).map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, x: -20, height: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'group relative rounded-lg border border-positive/20 bg-positive/5 p-2.5',
              'hover:border-positive/40 hover:bg-positive/10 transition-colors cursor-pointer'
            )}
            onClick={() => handleNavigateToSession(notification)}
          >
            {/* Dismiss button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                dismissNotification(notification.id)
              }}
              className="absolute right-1.5 top-1.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-positive/20 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
            
            {/* Content */}
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <div className="relative">
                  <Bot className="h-4 w-4 text-positive" />
                  <CheckCircle2 className="h-2.5 w-2.5 text-positive absolute -bottom-0.5 -right-0.5 bg-background rounded-full" />
                </div>
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-xs font-medium text-foreground truncate">
                  {notification.agentLabel}
                </p>
                {notification.preview && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {notification.preview}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1 text-xs text-positive">
                  <span>View result</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {activeNotifications.length > 5 && (
        <p className="text-xs text-muted-foreground text-center">
          +{activeNotifications.length - 5} more
        </p>
      )}
    </div>
  )
}


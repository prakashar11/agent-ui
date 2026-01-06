'use client'

import { motion } from 'framer-motion'
import React from 'react'
import { usePlaygroundStore } from '@/store'
import { Folder, ArrowLeft } from 'lucide-react'
import AgentCarousel from './AgentCarousel'
import { useQueryState } from 'nuqs'

// Component shown when no category is selected - prompts user to select from sidebar
const CategorySelectionPrompt = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-6 py-8"
    >
      <div className="flex items-center justify-center gap-3 text-muted-foreground">
        <ArrowLeft className="h-5 w-5 animate-pulse" />
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-accent/50">
          <Folder className="h-8 w-8 text-primary/60" />
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Select a Category
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Choose a category from the sidebar to view available agents and tools.
        </p>
      </div>
    </motion.div>
  )
}

const ChatBlankState = () => {
  const { setSelectedCategory } = usePlaygroundStore()
  // Read category from URL for browser back/forward navigation support
  const [categoryParam] = useQueryState('category')
  const selectedCategory = categoryParam
  
  // Sync URL category to store
  React.useEffect(() => {
    setSelectedCategory(categoryParam)
  }, [categoryParam, setSelectedCategory])

  return (
    <section
      className="flex flex-col items-center text-center font-geist"
      aria-label="Welcome message"
    >
      <div className="flex w-full max-w-5xl flex-col gap-y-6">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h1 className="text-2xl font-[600] tracking-tight text-foreground">
            Cybersecurity Workbench Agent UI
          </h1>
                      </motion.div>

        {/* Content Section - Show AgentCarousel when category is selected, otherwise prompt to select */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-4"
          key={selectedCategory || 'select-category'}
        >
          {selectedCategory ? (
            <AgentCarousel />
          ) : (
            <CategorySelectionPrompt />
          )}
        </motion.div>
      </div>
    </section>
  )
}

export default ChatBlankState

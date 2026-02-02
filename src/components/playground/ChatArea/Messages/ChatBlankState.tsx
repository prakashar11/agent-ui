'use client'

import { motion } from 'framer-motion'
import React from 'react'
import { usePlaygroundStore } from '@/store'
import { Folder, ArrowLeft } from 'lucide-react'
import { useQueryState } from 'nuqs'
import AgentCarousel from './AgentCarousel'
import { VIRTUAL_AGENT_CONFIG } from '@/types/playground'
import MarkdownRenderer from '@/components/ui/typography/MarkdownRenderer'

// Shown when no category is selected – prompts user to pick a category in the sidebar
const CategorySelectionPrompt = () => (
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

/** Landing when a carousel/agent is selected and there are no messages: title + carousel name + agent_tip */
export const AgentLanding = ({ agentId }: { agentId: string }) => {
  const agents = usePlaygroundStore((state) => state.agents)
  const virtual = VIRTUAL_AGENT_CONFIG[agentId]
  const fromStore = agents.find((a) => a.value === agentId)
  const carouselName = virtual?.label ?? fromStore?.label ?? agentId
  const agentTip = virtual?.agent_tip ?? fromStore?.agent_tip

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center text-center font-geist py-8"
      aria-label="Agent landing"
    >
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-[600] tracking-tight text-foreground">
          Cybersecurity Workbench
        </h1>
        <p className="text-lg font-medium text-foreground/90">{carouselName}</p>
        {agentTip ? (
          <div className="mt-2 text-sm leading-relaxed text-muted-foreground text-left rounded-lg bg-muted/30 p-4">
            <MarkdownRenderer>{agentTip}</MarkdownRenderer>
          </div>
        ) : null}
      </div>
    </motion.section>
  )
}

const ChatBlankState = () => {
  const { setSelectedCategory } = usePlaygroundStore()
  const [categoryParam] = useQueryState('category')
  const [agentId] = useQueryState('agent')
  const selectedCategory = categoryParam

  React.useEffect(() => {
    setSelectedCategory(categoryParam)
  }, [categoryParam, setSelectedCategory])

  // When a category is selected but no agent: show category landing page (AgentCarousel)
  // so agent_tip and carousel descriptions are visible; user can select from cards or sidebar list
  const showCategoryLanding = selectedCategory && !agentId

  return (
    <section
      className="flex flex-col items-center text-center font-geist"
      aria-label="Welcome message"
    >
      <div className="flex w-full max-w-5xl flex-col gap-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h1 className="text-2xl font-[600] tracking-tight text-foreground">
            Cybersecurity Workbench Agent UI
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-4 w-full"
          key={selectedCategory || 'select-category'}
        >
          {showCategoryLanding ? (
            <AgentCarousel />
          ) : selectedCategory ? null : (
            <CategorySelectionPrompt />
          )}
        </motion.div>
      </div>
    </section>
  )
}

export default ChatBlankState

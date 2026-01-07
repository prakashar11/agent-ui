'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselDots,
} from '@/components/ui/carousel'
import { usePlaygroundStore } from '@/store'
import { useQueryState } from 'nuqs'
import { Bot, Sparkles, ArrowRight, Network, Table2, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import MarkdownRenderer from '@/components/ui/typography/MarkdownRenderer'
import useChatActions from '@/hooks/useChatActions'
import type { ComboboxAgent } from '@/types/playground'
import { GraphVisualization } from '@/components/playground/GraphVisualization'
import { AssetMemorySpreadsheet } from '@/components/playground/AssetMemorySpreadsheet'
import { WorkflowCarousel } from '@/components/playground/WorkflowCarousel'

// Generate consistent gradient based on category name hash
const GRADIENT_PALETTES = [
  'from-blue-500/20 via-indigo-500/10 to-purple-500/20',
  'from-amber-500/20 via-orange-500/10 to-red-500/20',
  'from-emerald-500/20 via-green-500/10 to-teal-500/20',
  'from-rose-500/20 via-pink-500/10 to-red-500/20',
  'from-purple-500/20 via-violet-500/10 to-fuchsia-500/20',
  'from-cyan-500/20 via-sky-500/10 to-blue-500/20',
  'from-indigo-500/20 via-blue-500/10 to-sky-500/20',
  'from-teal-500/20 via-emerald-500/10 to-green-500/20',
  'from-orange-500/20 via-amber-500/10 to-yellow-500/20',
  'from-pink-500/20 via-rose-500/10 to-red-500/20',
]

const getGradientForCategory = (category: string): string => {
  // Generate consistent hash from category name
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    const char = category.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % GRADIENT_PALETTES.length
  return GRADIENT_PALETTES[index]
}

interface AgentCardProps {
  agent: ComboboxAgent
  index: number
  isSelected: boolean
  onSelect: () => void
  categoryGradient: string
  isSingleCard?: boolean
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  index,
  isSelected,
  onSelect,
  categoryGradient,
  isSingleCard = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={cn('h-full', isSingleCard && 'w-full max-w-md mx-auto')}
    >
      <button
        onClick={onSelect}
        className={cn(
          'relative h-full w-full overflow-hidden rounded-2xl border p-5 text-left backdrop-blur-sm transition-all duration-300',
          `bg-gradient-to-br ${categoryGradient}`,
          isSelected
            ? 'border-primary/50 shadow-lg shadow-primary/10'
            : 'border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
        )}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-current" />
          <div className="absolute -bottom-3 -left-3 h-16 w-16 rounded-full bg-current" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col">
          {/* Header with icon and name */}
          <div className="mb-3 flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
              isSelected ? 'bg-primary/20' : 'bg-background/80'
            )}>
              <Bot className={cn(
                'h-5 w-5',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                'text-sm font-semibold tracking-tight leading-tight',
                isSelected ? 'text-primary' : 'text-foreground'
              )}>
                {agent.label}
              </h3>
              {agent.model?.provider && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {agent.model.provider}
                </p>
              )}
            </div>
          </div>

          {/* Agent tip / description */}
          {agent.agent_tip ? (
            <div className="flex-1 overflow-hidden">
              <div className="text-xs leading-relaxed text-muted-foreground [&_p]:my-0 [&_ul]:my-1 [&_li]:my-0 [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mb-1 overflow-y-auto max-h-[140px] scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                <MarkdownRenderer>{agent.agent_tip}</MarkdownRenderer>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground/50 italic">
                No description available
              </p>
            </div>
          )}

          {/* Footer with action hint */}
          <div className={cn(
            'mt-3 flex items-center justify-between pt-3 border-t',
            isSelected ? 'border-primary/20' : 'border-border/30'
          )}>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                {isSelected ? 'Selected' : 'Click to select'}
              </span>
            </div>
            <ArrowRight className={cn(
              'h-4 w-4 transition-transform',
              isSelected 
                ? 'text-primary translate-x-0' 
                : 'text-muted-foreground/30 group-hover:translate-x-1'
            )} />
          </div>
        </div>

        {/* Selected indicator */}
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-primary/50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </button>
    </motion.div>
  )
}

// Asset Graph Card Component
interface AssetGraphCardProps {
  index: number
  categoryGradient: string
  onOpenGraph: () => void
}

const AssetGraphCard: React.FC<AssetGraphCardProps> = ({
  index,
  categoryGradient,
  onOpenGraph,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="h-full"
    >
      <button
        onClick={onOpenGraph}
        className={cn(
          'relative h-full w-full overflow-hidden rounded-2xl border p-5 text-left backdrop-blur-sm transition-all duration-300',
          `bg-gradient-to-br ${categoryGradient}`,
          'border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
        )}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-current" />
          <div className="absolute -bottom-3 -left-3 h-16 w-16 rounded-full bg-current" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col">
          {/* Header with icon and name */}
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-background/80 transition-colors">
              <Network className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold tracking-tight leading-tight text-foreground">
                Asset Graph
              </h3>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Visual Explorer
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="flex-1 overflow-hidden">
            <div className="text-xs leading-relaxed text-muted-foreground">
              <p className="mb-2">
                <strong>Interactive visualization</strong> of your organization&apos;s assets, vulnerabilities, and threat relationships.
              </p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Explore asset hierarchies</li>
                <li>View vulnerability mappings</li>
                <li>Analyze threat connections</li>
                <li>Add and manage nodes</li>
              </ul>
            </div>
          </div>

          {/* Footer with action hint */}
          <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/30">
            <div className="flex items-center gap-1.5">
              <Network className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                Click to open
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </button>
    </motion.div>
  )
}

// Asset Spreadsheet Card Component
interface AssetSpreadsheetCardProps {
  index: number
  categoryGradient: string
  onOpenSpreadsheet: () => void
}

const AssetSpreadsheetCard: React.FC<AssetSpreadsheetCardProps> = ({
  index,
  categoryGradient,
  onOpenSpreadsheet,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="h-full"
    >
      <button
        onClick={onOpenSpreadsheet}
        className={cn(
          'relative h-full w-full overflow-hidden rounded-2xl border p-5 text-left backdrop-blur-sm transition-all duration-300',
          `bg-gradient-to-br ${categoryGradient}`,
          'border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
        )}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-current" />
          <div className="absolute -bottom-3 -left-3 h-16 w-16 rounded-full bg-current" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col">
          {/* Header with icon and name */}
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-background/80 transition-colors">
              <Table2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold tracking-tight leading-tight text-foreground">
                Asset Memory
              </h3>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Spreadsheet Editor
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="flex-1 overflow-hidden">
            <div className="text-xs leading-relaxed text-muted-foreground">
              <p className="mb-2">
                <strong>Spreadsheet-like interface</strong> for managing asset agentic memory with full CRUD operations.
              </p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Create and edit assets</li>
                <li>Inline cell editing</li>
                <li>Sort and filter data</li>
                <li>Export to CSV/JSON</li>
              </ul>
            </div>
          </div>

          {/* Footer with action hint */}
          <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/30">
            <div className="flex items-center gap-1.5">
              <Table2 className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                Click to open
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </button>
    </motion.div>
  )
}

// Workflow Tasks Card Component
interface WorkflowCardProps {
  index: number
  categoryGradient: string
  onOpenWorkflow: () => void
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({
  index,
  categoryGradient,
  onOpenWorkflow,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="h-full"
    >
      <button
        onClick={onOpenWorkflow}
        className={cn(
          'relative h-full w-full overflow-hidden rounded-2xl border p-5 text-left backdrop-blur-sm transition-all duration-300',
          `bg-gradient-to-br ${categoryGradient}`,
          'border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
        )}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-current" />
          <div className="absolute -bottom-3 -left-3 h-16 w-16 rounded-full bg-current" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col">
          {/* Header with icon and name */}
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-background/80 transition-colors">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold tracking-tight leading-tight text-foreground">
                Workflow Tasks
              </h3>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Asset Security Workflows
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="flex-1 overflow-hidden">
            <div className="text-xs leading-relaxed text-muted-foreground">
              <p className="mb-2">
                <strong>Manage security workflows</strong> for asset hygiene, access reviews, patching, and threat management.
              </p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Hygiene & configuration review</li>
                <li>User Access Review (UAR)</li>
                <li>Patching workflows</li>
                <li>Threat & IoC review</li>
              </ul>
            </div>
          </div>

          {/* Footer with action hint */}
          <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/30">
            <div className="flex items-center gap-1.5">
              <ClipboardCheck className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                Click to open
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </button>
    </motion.div>
  )
}

interface AgentCarouselProps {
  className?: string
}

const AgentCarousel: React.FC<AgentCarouselProps> = ({ className }) => {
  const { agents, setSelectedCategory, setSelectedModel, setHasStorage, setCurrentContext, selectedEndpoint } = usePlaygroundStore()
  const [agentId, setAgentId] = useQueryState('agent', { history: 'push' })
  const [, setSessionId] = useQueryState('session', { history: 'push' })
  const [categoryParam, setCategoryParam] = useQueryState('category', { history: 'push' })
  const { focusChatInput } = useChatActions()
  const [isGraphOpen, setIsGraphOpen] = useState(false)
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState(false)
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false)
  
  // Use category from URL for browser navigation support
  const selectedCategory = categoryParam
  
  // Sync URL category to store
  React.useEffect(() => {
    setSelectedCategory(categoryParam)
  }, [categoryParam, setSelectedCategory])

  // Filter agents by selected category
  const categoryAgents = React.useMemo(() => {
    if (!selectedCategory) return []
    return agents.filter((agent) => {
      const agentCategory = agent.category || 'Uncategorized'
      return agentCategory === selectedCategory
    })
  }, [agents, selectedCategory])

  const handleAgentSelect = (agent: ComboboxAgent) => {
    setSelectedModel(agent.model?.provider || '')
    setHasStorage(!!agent.storage)
    setAgentId(agent.value)
    // Switch to this agent's messages (null session = new chat)
    setCurrentContext(agent.value, null)
    setSessionId(null)
    if (agent.model?.provider) {
      focusChatInput()
    }
  }

  const handleBackToCategories = () => {
    setCategoryParam(null)
  }

  // Check if this is Asset Management category to show Asset Graph and Spreadsheet
  const isAssetManagement = selectedCategory?.toLowerCase().includes('asset') ?? false
  
  // Check if this is Utilities category to show Workflow Tasks
  const isUtilities = selectedCategory?.toLowerCase().includes('utilities') ?? false

  // For Asset Management and Utilities, we always have at least some tools even without agents
  // For other categories, we need at least one agent
  if (!selectedCategory || (categoryAgents.length === 0 && !isAssetManagement && !isUtilities)) {
    return null
  }

  const categoryGradient = getGradientForCategory(selectedCategory)
  
  // Calculate total items including special category tools
  // Asset Management gets +2 extra items: Asset Graph and Asset Memory Spreadsheet
  // Utilities gets +1 extra item: Workflow Tasks
  const extraItems = (isAssetManagement ? 2 : 0) + (isUtilities ? 1 : 0)
  const totalItems = categoryAgents.length + extraItems
  const isSingleItem = totalItems === 1
  const isTwoItems = totalItems === 2
  const isThreeItems = totalItems === 3
  const needsCarousel = totalItems > 3

  return (
    <div className={className}>
      {/* Header with back button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-5 text-center"
      >
        <button
          onClick={handleBackToCategories}
          className="mb-3 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowRight className="h-3 w-3 rotate-180" />
          <span>Back to categories</span>
        </button>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {selectedCategory}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isAssetManagement 
            ? `Select an agent or tool • ${categoryAgents.length} agent${categoryAgents.length !== 1 ? 's' : ''} + 2 tools`
            : isUtilities
            ? `Select an agent or tool • ${categoryAgents.length} agent${categoryAgents.length !== 1 ? 's' : ''} + 1 tool`
            : `Select an agent to start chatting • ${categoryAgents.length} agent${categoryAgents.length !== 1 ? 's' : ''} available`
          }
        </p>
      </motion.div>

      {/* Single Item - Centered without carousel */}
      {isSingleItem && (
        <div className="mx-auto w-full max-w-md px-4">
          <div className="h-[280px]">
            {isAssetManagement && categoryAgents.length === 0 ? (
              <AssetGraphCard
                index={0}
                categoryGradient={categoryGradient}
                onOpenGraph={() => setIsGraphOpen(true)}
              />
            ) : isUtilities && categoryAgents.length === 0 ? (
              <WorkflowCard
                index={0}
                categoryGradient={categoryGradient}
                onOpenWorkflow={() => setIsWorkflowOpen(true)}
              />
            ) : (
              <AgentCard
                agent={categoryAgents[0]}
                index={0}
                isSelected={agentId === categoryAgents[0].value}
                onSelect={() => handleAgentSelect(categoryAgents[0])}
                categoryGradient={categoryGradient}
                isSingleCard
              />
            )}
          </div>
        </div>
      )}

      {/* Two Items - Centered grid without carousel */}
      {isTwoItems && (
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryAgents.map((agent, index) => (
              <div key={agent.value} className="h-[280px]">
                <AgentCard
                  agent={agent}
                  index={index}
                  isSelected={agentId === agent.value}
                  onSelect={() => handleAgentSelect(agent)}
                  categoryGradient={categoryGradient}
                />
              </div>
            ))}
            {isAssetManagement && categoryAgents.length === 0 && (
              <>
                <div className="h-[280px]">
                  <AssetGraphCard
                    index={0}
                    categoryGradient={categoryGradient}
                    onOpenGraph={() => setIsGraphOpen(true)}
                  />
                </div>
                <div className="h-[280px]">
                  <AssetSpreadsheetCard
                    index={1}
                    categoryGradient={categoryGradient}
                    onOpenSpreadsheet={() => setIsSpreadsheetOpen(true)}
                  />
                </div>
              </>
            )}
            {isUtilities && (
              <div className="h-[280px]">
                <WorkflowCard
                  index={categoryAgents.length}
                  categoryGradient={categoryGradient}
                  onOpenWorkflow={() => setIsWorkflowOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Three Items - Centered grid without carousel */}
      {isThreeItems && (
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categoryAgents.map((agent, index) => (
              <div key={agent.value} className="h-[280px]">
                <AgentCard
                  agent={agent}
                  index={index}
                  isSelected={agentId === agent.value}
                  onSelect={() => handleAgentSelect(agent)}
                  categoryGradient={categoryGradient}
                />
              </div>
            ))}
            {isAssetManagement && (
              <>
                <div className="h-[280px]">
                  <AssetGraphCard
                    index={categoryAgents.length}
                    categoryGradient={categoryGradient}
                    onOpenGraph={() => setIsGraphOpen(true)}
                  />
                </div>
                <div className="h-[280px]">
                  <AssetSpreadsheetCard
                    index={categoryAgents.length + 1}
                    categoryGradient={categoryGradient}
                    onOpenSpreadsheet={() => setIsSpreadsheetOpen(true)}
                  />
                </div>
              </>
            )}
            {isUtilities && (
              <div className="h-[280px]">
                <WorkflowCard
                  index={categoryAgents.length}
                  categoryGradient={categoryGradient}
                  onOpenWorkflow={() => setIsWorkflowOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4+ Items - Use Carousel */}
      {needsCarousel && (
        <Carousel
          opts={{
            align: 'center',
            loop: true,
          }}
          className="mx-auto w-full max-w-4xl px-12"
        >
          <CarouselContent className="-ml-4">
            {categoryAgents.map((agent, index) => (
              <CarouselItem
                key={agent.value}
                className="pl-4 md:basis-1/2 lg:basis-1/2"
              >
                <div className="h-[280px]">
                  <AgentCard
                    agent={agent}
                    index={index}
                    isSelected={agentId === agent.value}
                    onSelect={() => handleAgentSelect(agent)}
                    categoryGradient={categoryGradient}
                  />
                </div>
              </CarouselItem>
            ))}
            {isAssetManagement && (
              <>
                <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/2">
                  <div className="h-[280px]">
                    <AssetGraphCard
                      index={categoryAgents.length}
                      categoryGradient={categoryGradient}
                      onOpenGraph={() => setIsGraphOpen(true)}
                    />
                  </div>
                </CarouselItem>
                <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/2">
                  <div className="h-[280px]">
                    <AssetSpreadsheetCard
                      index={categoryAgents.length + 1}
                      categoryGradient={categoryGradient}
                      onOpenSpreadsheet={() => setIsSpreadsheetOpen(true)}
                    />
                  </div>
                </CarouselItem>
              </>
            )}
            {isUtilities && (
              <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/2">
                <div className="h-[280px]">
                  <WorkflowCard
                    index={categoryAgents.length}
                    categoryGradient={categoryGradient}
                    onOpenWorkflow={() => setIsWorkflowOpen(true)}
                  />
                </div>
              </CarouselItem>
            )}
          </CarouselContent>
          <CarouselPrevious className="-left-2 border-border/50 bg-background/80 hover:bg-accent" />
          <CarouselNext className="-right-2 border-border/50 bg-background/80 hover:bg-accent" />
          <CarouselDots className="mt-4" />
        </Carousel>
      )}

      {/* Graph Visualization Modal */}
      <GraphVisualization
        isOpen={isGraphOpen}
        onClose={() => setIsGraphOpen(false)}
        endpoint={selectedEndpoint}
      />

      {/* Asset Memory Spreadsheet Modal */}
      <AssetMemorySpreadsheet
        isOpen={isSpreadsheetOpen}
        onClose={() => setIsSpreadsheetOpen(false)}
        endpoint={selectedEndpoint}
      />

      {/* Workflow Tasks Modal */}
      <WorkflowCarousel
        isOpen={isWorkflowOpen}
        onClose={() => setIsWorkflowOpen(false)}
        endpoint={selectedEndpoint}
      />
    </div>
  )
}

export default AgentCarousel

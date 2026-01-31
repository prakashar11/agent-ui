'use client'

import * as React from 'react'
import { usePlaygroundStore } from '@/store'
import { groupAgentsByCategory, getCategoryColor, getCategoryBorderColor } from '@/lib/agentCategories'
import { getGradientForCategory } from '@/components/playground/ChatArea/Messages/AgentCarousel'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Folder, 
  FolderOpen, 
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Wrench
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQueryState } from 'nuqs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  SECOPS_TOOLS_HARNESS_AGENT_ID,
  VIRTUAL_WORKFLOW_AGENT_ID,
  VIRTUAL_INTELLIGENCE_INGESTION_AGENT_ID,
  VIRTUAL_ASSET_GRAPH_AGENT_ID,
  VIRTUAL_ASSET_SPREADSHEET_AGENT_ID,
  VIRTUAL_HYGIENE_ESSENTIALS_AGENT_ID,
  VIRTUAL_AGENT_CONFIG,
} from '@/types/playground'
import type { ComboboxAgent } from '@/types/playground'
import useChatActions from '@/hooks/useChatActions'

type CarouselItem =
  | { type: 'agent'; id: string; label: string; agent: ComboboxAgent }
  | { type: 'virtual'; id: string; label: string; agent_tip?: string }

export function CategorySelector() {
  const { agents, setSelectedCategory, setCurrentContext, setSelectedModel, setHasStorage } = usePlaygroundStore()
  const { focusChatInput } = useChatActions()
  const [agentId, setAgentId] = useQueryState('agent', { history: 'push' })
  const [, setSessionId] = useQueryState('session', { history: 'push' })
  const [categoryParam, setCategoryParam] = useQueryState('category', { history: 'push' })
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null)

  const selectedCategory = categoryParam
  React.useEffect(() => {
    setSelectedCategory(categoryParam)
  }, [categoryParam, setSelectedCategory])

  React.useEffect(() => {
    setExpandedCategory((prev) => (categoryParam ? categoryParam : null))
  }, [categoryParam])

  const groupedAgents = React.useMemo(() => groupAgentsByCategory(agents), [agents])

  const handleCategoryClick = (category: string) => {
    if (expandedCategory !== category) {
      setExpandedCategory(category)
      setCategoryParam(category)
      setAgentId(null)
      setSessionId(null)
      setCurrentContext(null, null)
    } else {
      setExpandedCategory(null)
      setCategoryParam(null)
    }
  }

  const carouselItemsForGroup = (group: { category: string; agents: ComboboxAgent[] }): CarouselItem[] => {
    const items: CarouselItem[] = group.agents.map((agent) => ({
      type: 'agent',
      id: agent.value,
      label: agent.label,
      agent
    }))
    const pushVirtual = (id: string) => {
      const config = VIRTUAL_AGENT_CONFIG[id]
      if (config) items.push({ type: 'virtual', id, label: config.label, agent_tip: config.agent_tip })
    }
    if (group.category === 'Security Operations') pushVirtual(SECOPS_TOOLS_HARNESS_AGENT_ID)
    if (group.category?.toLowerCase().includes('utilities')) {
      pushVirtual(VIRTUAL_WORKFLOW_AGENT_ID)
      pushVirtual(VIRTUAL_INTELLIGENCE_INGESTION_AGENT_ID)
    }
    if (group.category?.toLowerCase().includes('asset')) {
      pushVirtual(VIRTUAL_ASSET_GRAPH_AGENT_ID)
      pushVirtual(VIRTUAL_ASSET_SPREADSHEET_AGENT_ID)
      pushVirtual(VIRTUAL_HYGIENE_ESSENTIALS_AGENT_ID)
    }
    return items
  }

  const handleCarouselSelect = (item: CarouselItem, category: string) => {
    if (item.type === 'agent') {
      setSelectedModel(item.agent.model?.provider || '')
      setHasStorage(!!item.agent.storage)
      setAgentId(item.agent.value)
      setCurrentContext(item.agent.value, null)
      setSessionId(null)
      if (item.agent.model?.provider) focusChatInput()
    } else {
      setAgentId(item.id)
      setCurrentContext(item.id, null)
      setSessionId(null)
      if (item.id === SECOPS_TOOLS_HARNESS_AGENT_ID) focusChatInput()
    }
    setCategoryParam(category)
  }

  const getSelectedCarouselName = (
    category: string,
    groupAgents: ComboboxAgent[],
    carouselItems: CarouselItem[]
  ): string | null => {
    if (!agentId) return null
    const agentInCategory = groupAgents.find((a) => a.value === agentId)
    if (agentInCategory) return agentInCategory.label
    const virtualInCategory = carouselItems.find((i) => i.id === agentId)
    return virtualInCategory ? virtualInCategory.label : null
  }

  if (groupedAgents.length === 0) {
    return (
      <div className="flex h-9 w-full items-center justify-center rounded-xl border border-primary/15 bg-accent text-xs text-muted-foreground">
        No categories available
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-1">
      {groupedAgents.map((group) => {
        const isExpanded = expandedCategory === group.category
        const carouselItems = carouselItemsForGroup(group)
        const selectedCarouselName = selectedCategory === group.category
          ? getSelectedCarouselName(group.category, group.agents, carouselItems)
          : null
        const colorClass = getCategoryColor(group.category)
        const borderColorClass = getCategoryBorderColor(group.category)
        const categoryGradient = getGradientForCategory(group.category)
        const IconComponent = isExpanded ? FolderOpen : Folder

        return (
          <div key={group.category} className="flex flex-col gap-0.5">
            <motion.button
              onClick={() => handleCategoryClick(group.category)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
                isExpanded
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-primary/15 bg-accent hover:border-primary/25 hover:bg-accent/80'
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className={cn('flex-shrink-0', colorClass)}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'text-xs font-medium uppercase tracking-wide truncate',
                  isExpanded ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                )}>
                  {group.category}
                </div>
                <div className="text-[10px] text-muted-foreground/70">
                  {group.agents.length} agent{group.agents.length !== 1 ? 's' : ''}
                  {group.category === 'Security Operations' && ' + SecOps harness'}
                  {group.category?.toLowerCase().includes('utilities') && ' + 2 tools'}
                  {group.category?.toLowerCase().includes('asset') && ' + 3 tools'}
                </div>
                {selectedCarouselName && !isExpanded && (
                  <div className="mt-0.5 truncate text-[10px] font-medium text-primary/90" title={selectedCarouselName}>
                    {selectedCarouselName}
                  </div>
                )}
              </div>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-primary" />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
              )}
            </motion.button>

            <AnimatePresence>
              {isExpanded && carouselItems.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-2"
                >
                  <div className="flex flex-col gap-0.5 border-l-2 border-primary/20 pl-3 py-1">
                    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                      {carouselItems.map((item) => {
                        const isSelected = agentId === item.id
                        const tip =
                          item.type === 'agent'
                            ? item.agent.agent_tip
                            : item.type === 'virtual'
                              ? item.agent_tip
                              : undefined
                        const buttonProps = {
                          type: 'button' as const,
                          onClick: (e: React.MouseEvent) => {
                            e.stopPropagation()
                            handleCarouselSelect(item, group.category)
                          },
                          className: cn(
                            'flex w-full items-center gap-2 rounded-lg border-l-2 px-2.5 py-1.5 text-left text-xs transition-colors',
                            isSelected
                              ? 'bg-primary/20 dark:bg-primary/30 text-primary font-medium border-primary dark:border-primary'
                              : cn(
                                  'bg-gradient-to-br',
                                  categoryGradient,
                                  borderColorClass,
                                  'text-foreground hover:opacity-90'
                                )
                          ),
                        }
                        const buttonContent = (
                          <>
                            {item.type === 'virtual' ? (
                              <Wrench className="h-3.5 w-3.5 flex-shrink-0" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                            )}
                            <span className="truncate">{item.label}</span>
                          </>
                        )
                        if (tip) {
                          return (
                            <Tooltip key={item.id}>
                              <TooltipTrigger asChild>
                                <button {...buttonProps}>{buttonContent}</button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                align="start"
                                className="max-w-xs text-xs z-[100] whitespace-pre-line"
                                sideOffset={8}
                              >
                                {tip}
                              </TooltipContent>
                            </Tooltip>
                          )
                        }
                        return (
                          <button key={item.id} {...buttonProps}>
                            {buttonContent}
                          </button>
                        )
                      })}
                    </TooltipProvider>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

export default CategorySelector


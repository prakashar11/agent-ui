'use client'

import * as React from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { usePlaygroundStore } from '@/store'
import { useQueryState } from 'nuqs'
import Icon from '@/components/ui/icon'
import { useEffect } from 'react'
import useChatActions from '@/hooks/useChatActions'
import { groupAgentsByCategory, getCategoryColor } from '@/lib/agentCategories'
import { ChevronDown, ChevronRight, ChevronsDown, ChevronsUp } from 'lucide-react'

const COLLAPSED_CATEGORIES_KEY = 'agent-ui-collapsed-categories'

export function GroupedAgentSelector() {
  const { agents, setCurrentContext, setSelectedModel, setHasStorage } =
    usePlaygroundStore()
  const { focusChatInput } = useChatActions()
  const [agentId, setAgentId] = useQueryState('agent', {
    parse: (value) => value || undefined,
    history: 'push'
  })
  const [, setSessionId] = useQueryState('session')

  // State for collapsed categories with localStorage persistence
  const [collapsedCategories, setCollapsedCategories] = React.useState<Set<string>>(new Set())

  // Load collapsed categories from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_CATEGORIES_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setCollapsedCategories(new Set(parsed))
        }
      }
    } catch (error) {
      console.warn('Failed to load collapsed categories from localStorage:', error)
    }
  }, [])

  // Save collapsed categories to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_CATEGORIES_KEY, JSON.stringify(Array.from(collapsedCategories)))
    } catch (error) {
      console.warn('Failed to save collapsed categories to localStorage:', error)
    }
  }, [collapsedCategories])

  // Group agents by category using the utility function
  const groupedAgents = React.useMemo(() => {
    return groupAgentsByCategory(agents)
  }, [agents])

  // Set the model when the component mounts if an agent is already selected
  useEffect(() => {
    if (agentId && agents.length > 0) {
      const agent = agents.find((agent) => agent.value === agentId)
      if (agent) {
        setSelectedModel(agent.model.provider || '')
        setHasStorage(!!agent.storage)
        if (agent.model.provider) {
          focusChatInput()
        }
        
        // Ensure the category containing the selected agent is expanded
        const agentCategory = agent.category || 'Uncategorized'
        setCollapsedCategories(prev => {
          const newSet = new Set(prev)
          newSet.delete(agentCategory)
          return newSet
        })
      } else {
        setAgentId(agents[0].value)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, agents, setSelectedModel])

  const handleOnValueChange = (value: string) => {
    const newAgent = value === agentId ? '' : value
    const selectedAgent = agents.find((agent) => agent.value === newAgent)
    setSelectedModel(selectedAgent?.model.provider || '')
    setHasStorage(!!selectedAgent?.storage)
    setAgentId(newAgent)
    // Switch to this agent's messages (null session = new chat)
    setCurrentContext(newAgent || null, null)
    setSessionId(null)
    if (selectedAgent?.model.provider) {
      focusChatInput()
    }
  }

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const expandAllCategories = () => {
    setCollapsedCategories(new Set())
  }

  const collapseAllCategories = () => {
    setCollapsedCategories(new Set(groupedAgents.map(group => group.category)))
  }

  const isCategoryCollapsed = (category: string) => collapsedCategories.has(category)

  const hasCollapsedCategories = collapsedCategories.size > 0
  const hasExpandedCategories = collapsedCategories.size < groupedAgents.length

  return (
    <TooltipProvider delayDuration={300}>
      <Select
        value={agentId || ''}
        onValueChange={(value) => handleOnValueChange(value)}
      >
        <SelectTrigger className="h-auto min-h-9 w-full rounded-xl border border-primary/15 bg-primaryAccent text-xs font-medium uppercase py-2 flex items-start gap-2 justify-start !items-start [&>svg]:flex-shrink-0 [&>svg]:mt-0.5">
          <div className="flex-1 min-w-0 break-words text-left whitespace-normal leading-relaxed">
            <SelectValue 
              placeholder="Select Agent" 
              className="break-words text-left w-full whitespace-normal leading-relaxed" 
            />
          </div>
        </SelectTrigger>
        <SelectContent className="border-none bg-primaryAccent font-dmmono shadow-lg max-h-96 overflow-y-auto">
          {/* Expand/Collapse All Buttons */}
          {groupedAgents.length > 1 && (
            <div className="flex items-center justify-between px-2 py-1 border-b border-primary/10">
              <div className="flex gap-1">
                {hasCollapsedCategories && (
                  <button
                    onClick={expandAllCategories}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-primary/5 rounded-sm transition-colors"
                  >
                    <ChevronsDown className="h-3 w-3" />
                    Expand All
                  </button>
                )}
                {hasExpandedCategories && (
                  <button
                    onClick={collapseAllCategories}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-primary/5 rounded-sm transition-colors"
                  >
                    <ChevronsUp className="h-3 w-3" />
                    Collapse All
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {groupedAgents.length} categories
              </div>
            </div>
          )}
          
          {groupedAgents.map((group, groupIndex) => (
            <React.Fragment key={group.category}>
              <SelectGroup>
                <div 
                  className="flex items-center justify-between cursor-pointer px-2 py-1.5 hover:bg-primary/5 rounded-sm transition-colors"
                  onClick={() => toggleCategory(group.category)}
                >
                  <SelectLabel 
                    className={`text-xs font-semibold uppercase tracking-wider ${getCategoryColor(group.category)}`}
                  >
                    {group.category}
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      ({group.agents.length})
                    </span>
                  </SelectLabel>
                  {isCategoryCollapsed(group.category) ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                {!isCategoryCollapsed(group.category) && (
                  <>
                    {group.agents.map((agent, index) => (
                      <Tooltip key={`${agent.value}-${index}`}>
                        <TooltipTrigger asChild>
                          <SelectItem
                            className="cursor-pointer ml-2 py-2 min-h-0"
                            value={agent.value}
                          >
                            <div className="flex items-start gap-3 text-xs font-medium uppercase min-h-0">
                              <Icon type={'agent'} size="xs" className="flex-shrink-0 mt-0.5" />
                              <span className="break-words leading-relaxed">
                                {agent.label}
                              </span>
                            </div>
                          </SelectItem>
                        </TooltipTrigger>
                        {agent.agent_tip && (
                          <TooltipContent 
                            side="right" 
                            align="center"
                            className="max-w-xs text-xs z-[100] whitespace-pre-line"
                            sideOffset={5}
                          >
                            {agent.agent_tip}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </>
                )}
              </SelectGroup>
              {groupIndex < groupedAgents.length - 1 && (
                <SelectSeparator className="my-1" />
              )}
            </React.Fragment>
          ))}
          {agents.length === 0 && (
            <SelectItem
              value="no-agents"
              className="cursor-not-allowed select-none text-center"
            >
              No agents found
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </TooltipProvider>
  )
} 
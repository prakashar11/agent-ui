'use client'

import * as React from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
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

export function AgentSelector() {
  const { agents, setCurrentContext, setSelectedModel, setHasStorage } =
    usePlaygroundStore()
  const { focusChatInput } = useChatActions()
  const [agentId, setAgentId] = useQueryState('agent', {
    parse: (value) => value || undefined,
    history: 'push'
  })
  const [sessionId, setSessionId] = useQueryState('session')

  // Set the model when the component mounts if an agent is already selected
  useEffect(() => {
    if (agentId && agents.length > 0) {
      const agent = agents.find((agent) => agent.value === agentId)
      if (agent) {
        setSelectedModel(agent.model.provider || '')
        setHasStorage(!!agent.storage)
        setCurrentContext(agentId, sessionId)
        if (agent.model.provider) {
          focusChatInput()
        }
      } else {
        setAgentId(agents[0].value)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, agents, setSelectedModel, sessionId])

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

  return (
    <TooltipProvider delayDuration={300}>
      <Select
        value={agentId || ''}
        onValueChange={(value) => handleOnValueChange(value)}
      >
        <SelectTrigger className="h-9 w-full rounded-xl border border-primary/15 bg-primaryAccent text-xs font-medium uppercase">
          <SelectValue placeholder="Select Agent" />
        </SelectTrigger>
        <SelectContent className="border-none bg-primaryAccent font-dmmono shadow-lg">
          {agents.map((agent, index) => (
            <Tooltip key={`${agent.value}-${index}`}>
              <TooltipTrigger asChild>
                <SelectItem
                  className="cursor-pointer"
                  value={agent.value}
                >
                  <div className="flex items-center gap-3 text-xs font-medium uppercase">
                    <Icon type={'agent'} size="xs" />
                    {agent.label}
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

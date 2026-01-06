import { useCallback } from 'react'
import { toast } from 'sonner'

import { usePlaygroundStore } from '../store'

import { ComboboxAgent, type PlaygroundChatMessage } from '@/types/playground'
import {
  getPlaygroundAgentsAPI,
  getPlaygroundStatusAPI
} from '@/api/playground'
import { useQueryState } from 'nuqs'

const useChatActions = () => {
  const { chatInputRef } = usePlaygroundStore()
  const selectedEndpoint = usePlaygroundStore((state) => state.selectedEndpoint)
  const [sessionId, setSessionId] = useQueryState('session', { history: 'push' })
  const setMessages = usePlaygroundStore((state) => state.setMessages)
  const setCurrentContext = usePlaygroundStore((state) => state.setCurrentContext)
  const clearSessionMessages = usePlaygroundStore((state) => state.clearSessionMessages)
  const setIsEndpointActive = usePlaygroundStore(
    (state) => state.setIsEndpointActive
  )
  const setIsEndpointLoading = usePlaygroundStore(
    (state) => state.setIsEndpointLoading
  )
  const setAgents = usePlaygroundStore((state) => state.setAgents)
  const setSelectedModel = usePlaygroundStore((state) => state.setSelectedModel)
  const setSelectedCategory = usePlaygroundStore((state) => state.setSelectedCategory)
  const [agentId, setAgentId] = useQueryState('agent', { history: 'push' })

  const getStatus = useCallback(async () => {
    try {
      const status = await getPlaygroundStatusAPI(selectedEndpoint)
      return status
    } catch {
      return 503
    }
  }, [selectedEndpoint])

  const getAgents = useCallback(async () => {
    try {
      const agents = await getPlaygroundAgentsAPI(selectedEndpoint)
      return agents
    } catch {
      toast.error('Error fetching agents')
      return []
    }
  }, [selectedEndpoint])

  const clearChat = useCallback(() => {
    // Clear messages for the current context
    const storageKey = usePlaygroundStore.getState().currentStorageKey
    if (storageKey) {
      clearSessionMessages(storageKey)
    } else {
    setMessages([])
    }
    setSessionId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSessionMessages, setMessages])

  const focusChatInput = useCallback(() => {
    setTimeout(() => {
      requestAnimationFrame(() => chatInputRef?.current?.focus())
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addMessage = useCallback(
    (message: PlaygroundChatMessage) => {
      setMessages((prevMessages) => [...prevMessages, message])
    },
    [setMessages]
  )

  const initializePlayground = useCallback(async () => {
    setIsEndpointLoading(true)
    try {
      const status = await getStatus()
      let agents: ComboboxAgent[] = []
      if (status === 200) {
        setIsEndpointActive(true)
        agents = await getAgents()
        if (agents.length > 0) {
          if (!agentId) {
            // No agent selected in URL
            // Check if user has a selected category (browsing mode) - don't auto-select agent
            const currentCategory = usePlaygroundStore.getState().selectedCategory
            if (!currentCategory) {
              // No category either - this is initial load, select first agent
              const firstAgent = agents[0]
              setAgentId(firstAgent.value)
              setSelectedModel(firstAgent.model.provider || '')
              setCurrentContext(firstAgent.value, null)
              if (firstAgent.category && setSelectedCategory) {
                setSelectedCategory(firstAgent.category)
              }
            }
            // If category is set but no agent, user is browsing - don't auto-select
          } else {
            // Agent already selected from URL - set the category based on that agent
            const selectedAgent = agents.find(a => a.value === agentId)
            if (selectedAgent) {
              setSelectedModel(selectedAgent.model?.provider || '')
              // Set context with agent and current session from URL
              setCurrentContext(agentId, sessionId)
              if (selectedAgent.category && setSelectedCategory) {
                setSelectedCategory(selectedAgent.category)
              }
            }
          }
        }
      } else {
        setIsEndpointActive(false)
      }
      setAgents(agents)
      return agents
    } catch {
      setIsEndpointLoading(false)
    } finally {
      setIsEndpointLoading(false)
    }
  }, [
    getStatus,
    getAgents,
    setIsEndpointActive,
    setIsEndpointLoading,
    setAgents,
    setAgentId,
    setSelectedModel,
    setSelectedCategory,
    setCurrentContext,
    agentId,
    sessionId
  ])

  return {
    clearChat,
    addMessage,
    getAgents,
    focusChatInput,
    initializePlayground
  }
}

export default useChatActions

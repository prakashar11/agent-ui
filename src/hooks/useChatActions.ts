import { useCallback } from 'react'
import { toast } from 'sonner'

import { usePlaygroundStore } from '../store'

import { ComboboxAgent, type PlaygroundChatMessage } from '@/types/playground'
import {
  getPlaygroundAgentsAPI,
  getPlaygroundStatusAPI
} from '@/api/playground'
import { useQueryState } from 'nuqs'
import { waitForBackend, isBackendReady } from '@/utils/waitForBackend'

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
  const setHasStorage = usePlaygroundStore((state) => state.setHasStorage)
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
      toast.error('Error fetching agents', { duration: 3000 })
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
      // Wait for backend to be fully ready before fetching agents
      // This handles the case where frontend starts before backend workers are initialized
      const isReady = await isBackendReady(selectedEndpoint)
      if (!isReady) {
        // Backend not ready yet, wait for it with compact progress toasts
        const toastId = toast.loading('Starting backend...', {
          duration: Infinity,
        })
        try {
          // Uses default timeout from waitForBackend.ts (24h for dev, reduce for production)
          // TODO: PRODUCTION - pass explicit maxRetries: 60 for faster failure detection
          await waitForBackend(selectedEndpoint, {
            // maxRetries: 60,  // Uncomment for production (60 seconds)
            delayMs: 1000,
            onProgress: (attempt) => {
              // Only show attempt count periodically to avoid toast spam during long waits
              if (attempt <= 10 || attempt % 10 === 0) {
                toast.loading(`Connecting... ${attempt}s`, { id: toastId })
              }
            },
            onReady: () => {
              // Dismiss loading toast completely, then show brief success
              toast.dismiss(toastId)
              toast.success('Backend ready', { duration: 1500 })
            },
          })
        } catch (error) {
          // Dismiss and show error
          toast.dismiss(toastId)
          toast.error('Backend unavailable', { duration: 4000 })
          setIsEndpointActive(false)
          setAgents([])
          return []
        }
      }

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
              setHasStorage(!!firstAgent.storage)
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
              setHasStorage(!!selectedAgent.storage)
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
    setHasStorage,
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

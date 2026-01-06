import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import {
  type PlaygroundChatMessage,
  type SessionEntry,
  type ComboboxAgent
} from '@/types/playground'

// Helper to create a storage key from agentId and sessionId
export const createStorageKey = (agentId: string, sessionId: string | null): string => {
  return sessionId ? `${agentId}:${sessionId}` : `${agentId}:new`
}

// Track active background jobs - now keyed by agentId:sessionId
export interface ActiveJob {
  agentId: string
  agentLabel: string
  sessionId: string | null
  storageKey: string  // The composite key for message storage
  startedAt: number
  status: 'running' | 'completed' | 'error'
  lastMessage?: string
}

// Notification for completed background jobs
export interface BackgroundJobNotification {
  id: string
  agentId: string
  agentLabel: string
  sessionId: string | null
  storageKey: string  // The composite key to navigate to
  completedAt: number
  preview?: string
  dismissed: boolean
}

interface PlaygroundStore {
  hydrated: boolean
  setHydrated: () => void
  streamingErrorMessage: string
  setStreamingErrorMessage: (streamingErrorMessage: string) => void
  endpoints: {
    endpoint: string
    id_playground_endpoint: string
  }[]
  setEndpoints: (
    endpoints: {
      endpoint: string
      id_playground_endpoint: string
    }[]
  ) => void
  isStreaming: boolean
  setIsStreaming: (isStreaming: boolean) => void
  isEndpointActive: boolean
  setIsEndpointActive: (isActive: boolean) => void
  isEndpointLoading: boolean
  setIsEndpointLoading: (isLoading: boolean) => void
  
  // Per-agent-session messages storage (keyed by agentId:sessionId)
  sessionMessages: Record<string, PlaygroundChatMessage[]>
  getSessionMessages: (storageKey: string) => PlaygroundChatMessage[]
  setSessionMessages: (
    storageKey: string,
    messages: PlaygroundChatMessage[] | ((prev: PlaygroundChatMessage[]) => PlaygroundChatMessage[])
  ) => void
  clearSessionMessages: (storageKey: string) => void
  
  // Legacy messages accessor for current view (for backward compatibility)
  messages: PlaygroundChatMessage[]
  setMessages: (
    messages:
      | PlaygroundChatMessage[]
      | ((prevMessages: PlaygroundChatMessage[]) => PlaygroundChatMessage[])
  ) => void
  
  // Current view context
  currentAgentId: string | null
  currentSessionId: string | null
  currentStorageKey: string | null
  setCurrentContext: (agentId: string | null, sessionId: string | null) => void
  
  // Active background jobs tracking (keyed by storageKey)
  activeJobs: Record<string, ActiveJob>
  setActiveJob: (storageKey: string, job: ActiveJob | null) => void
  getActiveJob: (storageKey: string) => ActiveJob | undefined
  
  // Background job notifications
  backgroundNotifications: BackgroundJobNotification[]
  addBackgroundNotification: (notification: Omit<BackgroundJobNotification, 'id' | 'dismissed'>) => void
  dismissNotification: (id: string) => void
  clearAllNotifications: () => void
  
  hasStorage: boolean
  setHasStorage: (hasStorage: boolean) => void
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>
  selectedEndpoint: string
  setSelectedEndpoint: (selectedEndpoint: string) => void
  agents: ComboboxAgent[]
  setAgents: (agents: ComboboxAgent[]) => void
  selectedCategory: string | null
  setSelectedCategory: (category: string | null) => void
  selectedModel: string
  setSelectedModel: (model: string) => void
  sessionsData: SessionEntry[] | null
  setSessionsData: (
    sessionsData:
      | SessionEntry[]
      | ((prevSessions: SessionEntry[] | null) => SessionEntry[] | null)
  ) => void
  isSessionsLoading: boolean
  setIsSessionsLoading: (isSessionsLoading: boolean) => void
  showToolCalls: boolean
  setShowToolCalls: (show: boolean) => void
  useArticleCardView: boolean
  setUseArticleCardView: (useCardView: boolean) => void
  agentFiles: FileList | null
  setAgentFiles: (files: FileList | null) => void
  resetAgentFileInput?: () => void
}

export const usePlaygroundStore = create<PlaygroundStore>()(
  persist(
    (set, get) => ({
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      streamingErrorMessage: '',
      setStreamingErrorMessage: (streamingErrorMessage) =>
        set(() => ({ streamingErrorMessage })),
      endpoints: [],
      setEndpoints: (endpoints) => set(() => ({ endpoints })),
      isStreaming: false,
      setIsStreaming: (isStreaming) => set(() => ({ isStreaming })),
      isEndpointActive: false,
      setIsEndpointActive: (isActive) =>
        set(() => ({ isEndpointActive: isActive })),
      isEndpointLoading: true,
      setIsEndpointLoading: (isLoading) =>
        set(() => ({ isEndpointLoading: isLoading })),
      
      // Per-agent-session messages storage (keyed by agentId:sessionId)
      sessionMessages: {},
      getSessionMessages: (storageKey: string) => {
        return get().sessionMessages[storageKey] || []
      },
      setSessionMessages: (storageKey, messages) =>
        set((state) => {
          const currentMessages = state.sessionMessages[storageKey] || []
          const newMessages = typeof messages === 'function' 
            ? messages(currentMessages) 
            : messages
          return {
            sessionMessages: {
              ...state.sessionMessages,
              [storageKey]: newMessages
            },
            // Also update legacy messages if this is the current context
            messages: state.currentStorageKey === storageKey ? newMessages : state.messages
          }
        }),
      clearSessionMessages: (storageKey) =>
        set((state) => {
          const newSessionMessages = Object.fromEntries(
            Object.entries(state.sessionMessages).filter(([key]) => key !== storageKey)
          )
          return {
            sessionMessages: newSessionMessages,
            messages: state.currentStorageKey === storageKey ? [] : state.messages
          }
        }),
      
      // Current view context
      currentAgentId: null,
      currentSessionId: null,
      currentStorageKey: null,
      setCurrentContext: (agentId, sessionId) =>
        set((state) => {
          const storageKey = agentId ? createStorageKey(agentId, sessionId) : null
          return {
            currentAgentId: agentId,
            currentSessionId: sessionId,
            currentStorageKey: storageKey,
            // Sync messages with the current context's messages
            messages: storageKey ? (state.sessionMessages[storageKey] || []) : []
          }
        }),
      
      // Legacy messages - now synced with currentStorageKey
      messages: [],
      setMessages: (messages) =>
        set((state) => {
          const storageKey = state.currentStorageKey
          const newMessages = typeof messages === 'function' 
            ? messages(state.messages) 
            : messages
          
          // If we have a current storage key, also update the per-session storage
          if (storageKey) {
            return {
              messages: newMessages,
              sessionMessages: {
                ...state.sessionMessages,
                [storageKey]: newMessages
              }
            }
          }
          return { messages: newMessages }
        }),
      
      // Active background jobs tracking (keyed by storageKey)
      activeJobs: {},
      setActiveJob: (storageKey, job) =>
        set((state) => {
          if (job === null) {
            const newActiveJobs = Object.fromEntries(
              Object.entries(state.activeJobs).filter(([key]) => key !== storageKey)
            )
            return { activeJobs: newActiveJobs }
          }
          return {
            activeJobs: {
              ...state.activeJobs,
              [storageKey]: job
            }
          }
        }),
      getActiveJob: (storageKey) => get().activeJobs[storageKey],
      
      // Background job notifications
      backgroundNotifications: [],
      addBackgroundNotification: (notification) =>
        set((state) => ({
          backgroundNotifications: [
            {
              ...notification,
              id: `${notification.storageKey}-${Date.now()}`,
              dismissed: false
            },
            ...state.backgroundNotifications
          ]
        })),
      dismissNotification: (id) =>
        set((state) => ({
          backgroundNotifications: state.backgroundNotifications.map(n =>
            n.id === id ? { ...n, dismissed: true } : n
          )
        })),
      clearAllNotifications: () =>
        set({ backgroundNotifications: [] }),
      
      hasStorage: false,
      setHasStorage: (hasStorage) => set(() => ({ hasStorage })),
      chatInputRef: { current: null },
      selectedEndpoint: 'http://localhost:7777',
      setSelectedEndpoint: (selectedEndpoint) =>
        set(() => ({ selectedEndpoint })),
      agents: [],
      setAgents: (agents) => set({ agents }),
      selectedCategory: 'Asset Management', // Default to Asset Management category
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      selectedModel: '',
      setSelectedModel: (selectedModel) => set(() => ({ selectedModel })),
      sessionsData: null,
      setSessionsData: (sessionsData) =>
        set((state) => ({
          sessionsData:
            typeof sessionsData === 'function'
              ? sessionsData(state.sessionsData)
              : sessionsData
        })),
      isSessionsLoading: false,
      setIsSessionsLoading: (isSessionsLoading) =>
        set(() => ({ isSessionsLoading })),
      showToolCalls: true, // default to showing tool calls
      setShowToolCalls: (show: boolean) => 
        set((state) => ({
          ...state, // preserve other state
          showToolCalls: show
        })),
      useArticleCardView: true, // default to card stack view
      setUseArticleCardView: (useCardView: boolean) => 
        set((state) => ({
          ...state, // preserve other state
          useArticleCardView: useCardView
        })),
      agentFiles: null,
      setAgentFiles: (files) => set(() => ({ agentFiles: files })),
    }),
    {
      name: 'endpoint-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedEndpoint: state.selectedEndpoint,
        showToolCalls: state.showToolCalls,
        useArticleCardView: state.useArticleCardView,
        selectedCategory: state.selectedCategory,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.()
      }
    },
  )
)

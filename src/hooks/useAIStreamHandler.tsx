import { useCallback, useRef } from 'react'

import { APIRoutes } from '@/api/routes'

import useChatActions from '@/hooks/useChatActions'
import { usePlaygroundStore, type ActiveJob, createStorageKey } from '../store'
import {
  RunEvent,
  RunResponseContent,
  type RunResponse
} from '@/types/playground'
import { constructEndpointUrl } from '@/lib/constructEndpointUrl'
import useAIResponseStream from './useAIResponseStream'
import { ToolCall } from '@/types/playground'
import { useQueryState } from 'nuqs'
import { getJsonMarkdown } from '@/lib/utils'

/**
 * useAIChatStreamHandler is responsible for making API calls and handling the stream response.
 * It now supports per-agent-session message storage to preserve responses when switching agents/sessions.
 */
const useAIChatStreamHandler = () => {
  const setMessages = usePlaygroundStore((state) => state.setMessages)
  const setSessionMessages = usePlaygroundStore((state) => state.setSessionMessages)
  const setActiveJob = usePlaygroundStore((state) => state.setActiveJob)
  const addBackgroundNotification = usePlaygroundStore((state) => state.addBackgroundNotification)
  const agents = usePlaygroundStore((state) => state.agents)
  const { focusChatInput } = useChatActions()
  const [agentId] = useQueryState('agent')
  const [sessionId, setSessionId] = useQueryState('session')
  const selectedEndpoint = usePlaygroundStore((state) => state.selectedEndpoint)
  const setStreamingErrorMessage = usePlaygroundStore(
    (state) => state.setStreamingErrorMessage
  )
  const setIsStreaming = usePlaygroundStore((state) => state.setIsStreaming)
  const setSessionsData = usePlaygroundStore((state) => state.setSessionsData)
  const hasStorage = usePlaygroundStore((state) => state.hasStorage)
  const { streamResponse } = useAIResponseStream()
  
  // Keep track of the storage key for the job (captured at job start)
  const jobStorageKeyRef = useRef<string | null>(null)
  const jobAgentIdRef = useRef<string | null>(null)

  // Update messages for a specific storage key (or current context if not specified)
  const updateMessagesForSession = useCallback((
    storageKey: string | null,
    updater: (prev: import('@/types/playground').PlaygroundChatMessage[]) => import('@/types/playground').PlaygroundChatMessage[]
  ) => {
    if (storageKey) {
      setSessionMessages(storageKey, updater)
    } else {
      setMessages(updater)
    }
  }, [setMessages, setSessionMessages])

  const updateMessagesWithErrorState = useCallback((storageKey?: string | null) => {
    const keyToUpdate = storageKey ?? jobStorageKeyRef.current
    updateMessagesForSession(keyToUpdate, (prevMessages) => {
      const newMessages = [...prevMessages]
      const lastMessage = newMessages[newMessages.length - 1]
      if (lastMessage && lastMessage.role === 'agent') {
        lastMessage.streamingError = true
      }
      return newMessages
    })
  }, [updateMessagesForSession])

  /**
   * Processes a new tool call and adds it to the message
   * @param toolCall - The tool call to add
   * @param prevToolCalls - The previous tool calls array
   * @returns Updated tool calls array
   */
  const processToolCall = useCallback(
    (toolCall: ToolCall, prevToolCalls: ToolCall[] = []) => {
      const toolCallId =
        toolCall.tool_call_id || `${toolCall.tool_name}-${toolCall.created_at}`

      const existingToolCallIndex = prevToolCalls.findIndex(
        (tc) =>
          (tc.tool_call_id && tc.tool_call_id === toolCall.tool_call_id) ||
          (!tc.tool_call_id &&
            toolCall.tool_name &&
            toolCall.created_at &&
            `${tc.tool_name}-${tc.created_at}` === toolCallId)
      )
      if (existingToolCallIndex >= 0) {
        const updatedToolCalls = [...prevToolCalls]
        updatedToolCalls[existingToolCallIndex] = {
          ...updatedToolCalls[existingToolCallIndex],
          ...toolCall
        }
        return updatedToolCalls
      } else {
        return [...prevToolCalls, toolCall]
      }
    },
    []
  )

  /**
   * Processes tool calls from a chunk, handling both single tool object and tools array formats
   * @param chunk - The chunk containing tool call data
   * @param existingToolCalls - The existing tool calls array
   * @returns Updated tool calls array
   */
  const processChunkToolCalls = useCallback(
    (
      chunk: RunResponseContent | RunResponse,
      existingToolCalls: ToolCall[] = []
    ) => {
      let updatedToolCalls = [...existingToolCalls]
      // Handle new single tool object format
      if (chunk.tool) {
        updatedToolCalls = processToolCall(chunk.tool, updatedToolCalls)
      }
      // Handle legacy tools array format
      if (chunk.tools && chunk.tools.length > 0) {
        for (const toolCall of chunk.tools) {
          updatedToolCalls = processToolCall(toolCall, updatedToolCalls)
        }
      }

      return updatedToolCalls
    },
    [processToolCall]
  )

  const handleStreamResponse = useCallback(
    async (input: string | FormData) => {
      if (!agentId) return
      
      // Capture the agent ID and session ID at job start - this ensures responses go to the correct context
      // even if user navigates away
      const jobAgentId = agentId
      const jobSessionId = sessionId
      // Create storage key - will be updated when session is created
      let jobStorageKey = createStorageKey(jobAgentId, jobSessionId)
      
      jobAgentIdRef.current = jobAgentId
      jobStorageKeyRef.current = jobStorageKey
      
      // Ensure current context is set to match job context (fixes race condition where
      // context might not be set yet when user sends message)
      const currentState = usePlaygroundStore.getState()
      if (currentState.currentStorageKey !== jobStorageKey) {
        currentState.setCurrentContext(jobAgentId, jobSessionId)
      }
      
      // Get agent label for notifications
      const agentInfo = agents.find(a => a.value === jobAgentId)
      const agentLabel = agentInfo?.label || jobAgentId
      
      setIsStreaming(true)

      const formData = input instanceof FormData ? input : new FormData()
      if (typeof input === 'string') {
        formData.append('message', input)
      }
      
      const userMessage = formData.get('message') as string

      // Track this as an active job
      const activeJob: ActiveJob = {
        agentId: jobAgentId,
        agentLabel,
        sessionId: jobSessionId,
        storageKey: jobStorageKey,
        startedAt: Date.now(),
        status: 'running',
        lastMessage: userMessage
      }
      setActiveJob(jobStorageKey, activeJob)

      // Use session-specific message updates
      updateMessagesForSession(jobStorageKey, (prevMessages) => {
        if (prevMessages.length >= 2) {
          const lastMessage = prevMessages[prevMessages.length - 1]
          const secondLastMessage = prevMessages[prevMessages.length - 2]
          if (
            lastMessage.role === 'agent' &&
            lastMessage.streamingError &&
            secondLastMessage.role === 'user'
          ) {
            return prevMessages.slice(0, -2)
          }
        }
        return prevMessages
      })

      // Add user message to the session's messages
      updateMessagesForSession(jobStorageKey, (prevMessages) => [
        ...prevMessages,
        {
          role: 'user' as const,
          content: userMessage,
          created_at: Math.floor(Date.now() / 1000)
        }
      ])

      // Add placeholder agent message
      updateMessagesForSession(jobStorageKey, (prevMessages) => [
        ...prevMessages,
        {
          role: 'agent' as const,
          content: '',
          tool_calls: [],
          streamingError: false,
          created_at: Math.floor(Date.now() / 1000) + 1
        }
      ])

      let lastContent = ''
      let newSessionId = sessionId
      try {
        const endpointUrl = constructEndpointUrl(selectedEndpoint)

        const playgroundRunUrl = APIRoutes.AgentRun(endpointUrl).replace(
          '{agent_id}',
          jobAgentId
        )

        formData.append('stream', 'true')
        formData.append('session_id', sessionId ?? '')

        await streamResponse({
          apiUrl: playgroundRunUrl,
          requestBody: formData,
          onChunk: (chunk: RunResponse) => {
            if (
              chunk.event === RunEvent.RunStarted ||
              chunk.event === RunEvent.ReasoningStarted
            ) {
              newSessionId = chunk.session_id as string
              setSessionId(chunk.session_id as string)
              
              // Migrate messages from "agent:new" to "agent:session-id" if this is a new session
              if (chunk.session_id && !jobSessionId) {
                const oldKey = jobStorageKey
                const newKey = createStorageKey(jobAgentId, chunk.session_id as string)
                
                // Migrate messages from old key to new key
                const currentMessages = usePlaygroundStore.getState().sessionMessages[oldKey] || []
                if (currentMessages.length > 0) {
                  setSessionMessages(newKey, currentMessages)
                }
                
                // Update the job storage key for remaining stream processing
                jobStorageKey = newKey
                jobStorageKeyRef.current = newKey
                
                // Update active job with new key
                const oldJob = usePlaygroundStore.getState().activeJobs[oldKey]
                if (oldJob) {
                  setActiveJob(oldKey, null) // Remove old key
                  setActiveJob(newKey, {
                    ...oldJob,
                    sessionId: chunk.session_id as string,
                    storageKey: newKey
                  })
                }
                
                // Update current context if we're still viewing this agent
                const state = usePlaygroundStore.getState()
                if (state.currentAgentId === jobAgentId && state.currentStorageKey === oldKey) {
                  usePlaygroundStore.getState().setCurrentContext(jobAgentId, chunk.session_id as string)
                }
                
                // Clear old "new" key messages
                usePlaygroundStore.getState().clearSessionMessages(oldKey)
              }
              
              if (
                hasStorage &&
                (!sessionId || sessionId !== chunk.session_id) &&
                chunk.session_id
              ) {
                const sessionData = {
                  session_id: chunk.session_id as string,
                  title: formData.get('message') as string,
                  created_at: chunk.created_at
                }
                setSessionsData((prevSessionsData) => {
                  const sessionExists = prevSessionsData?.some(
                    (session) => session.session_id === chunk.session_id
                  )
                  if (sessionExists) {
                    return prevSessionsData
                  }
                  return [sessionData, ...(prevSessionsData ?? [])]
                })
              }
            } else if (chunk.event === RunEvent.ToolCallStarted) {
              updateMessagesForSession(jobStorageKey, (prevMessages) => {
                const newMessages = [...prevMessages]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage && lastMessage.role === 'agent') {
                  lastMessage.tool_calls = processChunkToolCalls(
                    chunk,
                    lastMessage.tool_calls
                  )
                }
                return newMessages
              })
            } else if (chunk.event === RunEvent.ToolCallCompleted) {
              updateMessagesForSession(jobStorageKey, (prevMessages) => {
                const newMessages = [...prevMessages]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage && lastMessage.role === 'agent') {
                  lastMessage.tool_calls = processChunkToolCalls(
                    chunk,
                    lastMessage.tool_calls
                  )
                }
                return newMessages
              })
            } else if (
              chunk.event === RunEvent.RunResponse ||
              chunk.event === RunEvent.RunResponseContent
            ) {
              updateMessagesForSession(jobStorageKey, (prevMessages) => {
                const newMessages = [...prevMessages]
                const lastMessage = newMessages[newMessages.length - 1]
                if (
                  lastMessage &&
                  lastMessage.role === 'agent' &&
                  typeof chunk.content === 'string'
                ) {
                  const uniqueContent = chunk.content.replace(lastContent, '')
                  lastMessage.content += uniqueContent
                  lastContent = chunk.content

                  // Handle tool calls streaming
                  lastMessage.tool_calls = processChunkToolCalls(
                    chunk,
                    lastMessage.tool_calls
                  )
                  if (chunk.extra_data?.reasoning_steps) {
                    lastMessage.extra_data = {
                      ...lastMessage.extra_data,
                      reasoning_steps: chunk.extra_data.reasoning_steps
                    }
                  }

                  if (chunk.extra_data?.references) {
                    lastMessage.extra_data = {
                      ...lastMessage.extra_data,
                      references: chunk.extra_data.references
                    }
                  }

                  lastMessage.created_at =
                    chunk.created_at ?? lastMessage.created_at
                  if (chunk.images) {
                    lastMessage.images = chunk.images
                  }
                  if (chunk.videos) {
                    lastMessage.videos = chunk.videos
                  }
                  if (chunk.audio) {
                    lastMessage.audio = chunk.audio
                  }
                } else if (
                  lastMessage &&
                  lastMessage.role === 'agent' &&
                  typeof chunk?.content !== 'string' &&
                  chunk.content !== null
                ) {
                  const jsonBlock = getJsonMarkdown(chunk?.content)

                  lastMessage.content += jsonBlock
                  lastContent = jsonBlock
                } else if (
                  chunk.response_audio?.transcript &&
                  typeof chunk.response_audio?.transcript === 'string'
                ) {
                  const transcript = chunk.response_audio.transcript
                  lastMessage.response_audio = {
                    ...lastMessage.response_audio,
                    transcript:
                      lastMessage.response_audio?.transcript + transcript
                  }
                }
                return newMessages
              })
            } else if (chunk.event === RunEvent.ReasoningCompleted) {
              updateMessagesForSession(jobStorageKey, (prevMessages) => {
                const newMessages = [...prevMessages]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage && lastMessage.role === 'agent') {
                  if (chunk.extra_data?.reasoning_steps) {
                    lastMessage.extra_data = {
                      ...lastMessage.extra_data,
                      reasoning_steps: chunk.extra_data.reasoning_steps
                    }
                  }
                }
                return newMessages
              })
            } else if (chunk.event === RunEvent.RunCancelled) {
              // Handle cancellation - preserve existing messages, just mark as cancelled
              updateMessagesForSession(jobStorageKey, (prevMessages) => {
                const newMessages = [...prevMessages]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage && lastMessage.role === 'agent') {
                  // Mark as cancelled but preserve content
                  lastMessage.cancelled = true
                  // Add cancellation notice if content exists
                  if (lastMessage.content) {
                    lastMessage.content += '\n\n*Operation cancelled by user*'
                  } else {
                    lastMessage.content = '*Operation cancelled by user*'
                  }
                }
                return newMessages
              })
              setActiveJob(jobStorageKey, null)
              setIsStreaming(false)
            } else if (chunk.event === RunEvent.RunError) {
              updateMessagesWithErrorState(jobStorageKey)
              const errorContent = chunk.content as string
              setStreamingErrorMessage(errorContent)
              setActiveJob(jobStorageKey, null)
              if (hasStorage && newSessionId) {
                setSessionsData(
                  (prevSessionsData) =>
                    prevSessionsData?.filter(
                      (session) => session.session_id !== newSessionId
                    ) ?? null
                )
              }
            } else if (chunk.event === RunEvent.RunCompleted) {
              // Update storage key if session was created during this job
              if (newSessionId && jobStorageKey !== createStorageKey(jobAgentId, newSessionId)) {
                const oldStorageKey = jobStorageKey
                jobStorageKey = createStorageKey(jobAgentId, newSessionId)
                jobStorageKeyRef.current = jobStorageKey
                
                // Migrate messages from old key to new key if needed
                const oldMessages = usePlaygroundStore.getState().sessionMessages[oldStorageKey]
                if (oldMessages && oldMessages.length > 0) {
                  setSessionMessages(jobStorageKey, oldMessages)
                }
              }
              
              updateMessagesForSession(jobStorageKey, (prevMessages) => {
                const newMessages = prevMessages.map((message, index) => {
                  if (
                    index === prevMessages.length - 1 &&
                    message.role === 'agent'
                  ) {
                    let updatedContent: string
                    if (typeof chunk.content === 'string') {
                      updatedContent = chunk.content
                    } else {
                      try {
                        updatedContent = JSON.stringify(chunk.content)
                      } catch {
                        updatedContent = 'Error parsing response'
                      }
                    }
                    return {
                      ...message,
                      content: updatedContent,
                      tool_calls: processChunkToolCalls(
                        chunk,
                        message.tool_calls
                      ),
                      images: chunk.images ?? message.images,
                      videos: chunk.videos ?? message.videos,
                      response_audio: chunk.response_audio,
                      created_at: chunk.created_at ?? message.created_at,
                      extra_data: {
                        reasoning_steps:
                          chunk.extra_data?.reasoning_steps ??
                          message.extra_data?.reasoning_steps,
                        references:
                          chunk.extra_data?.references ??
                          message.extra_data?.references
                      }
                    }
                  }
                  return message
                })
                return newMessages
              })
              
              // Clear the active job
              setActiveJob(jobStorageKey, null)
              
              // If user navigated to a different context, show a notification
              const currentStorageKey = usePlaygroundStore.getState().currentStorageKey
              if (currentStorageKey !== jobStorageKey) {
                addBackgroundNotification({
                  agentId: jobAgentId,
                  agentLabel,
                  sessionId: newSessionId,
                  storageKey: jobStorageKey,
                  completedAt: Date.now(),
                  preview: typeof chunk.content === 'string' 
                    ? chunk.content.slice(0, 100) + (chunk.content.length > 100 ? '...' : '')
                    : 'Response received'
                })
              }
            }
          },
          onError: (error) => {
            updateMessagesWithErrorState(jobStorageKey)
            setStreamingErrorMessage(error.message)
            setActiveJob(jobStorageKey, null)
            if (hasStorage && newSessionId) {
              setSessionsData(
                (prevSessionsData) =>
                  prevSessionsData?.filter(
                    (session) => session.session_id !== newSessionId
                  ) ?? null
              )
            }
          },
          onComplete: () => {}
        })
      } catch (error) {
        updateMessagesWithErrorState(jobStorageKey)
        setStreamingErrorMessage(
          error instanceof Error ? error.message : String(error)
        )
        setActiveJob(jobStorageKey, null)
        if (hasStorage && newSessionId) {
          setSessionsData(
            (prevSessionsData) =>
              prevSessionsData?.filter(
                (session) => session.session_id !== newSessionId
              ) ?? null
          )
        }
      } finally {
        focusChatInput()
        setIsStreaming(false)
        jobAgentIdRef.current = null
        jobStorageKeyRef.current = null
      }
    },
    [
      updateMessagesForSession,
      updateMessagesWithErrorState,
      selectedEndpoint,
      streamResponse,
      agentId,
      agents,
      setStreamingErrorMessage,
      setIsStreaming,
      focusChatInput,
      setSessionsData,
      sessionId,
      setSessionId,
      hasStorage,
      processChunkToolCalls,
      setActiveJob,
      addBackgroundNotification,
      setSessionMessages
    ]
  )

  return { handleStreamResponse }
}

export default useAIChatStreamHandler

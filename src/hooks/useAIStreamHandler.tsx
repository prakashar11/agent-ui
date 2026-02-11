import { useCallback, useRef } from 'react'

import { APIRoutes } from '@/api/routes'

import useChatActions from '@/hooks/useChatActions'
import { usePlaygroundStore, type ActiveJob, createStorageKey } from '../store'
import {
  RunEvent,
  RunResponseContent,
  type RunResponse,
} from '@/types/playground'
import { constructEndpointUrl } from '@/lib/constructEndpointUrl'
import useAIResponseStream from './useAIResponseStream'
import { ToolCall } from '@/types/playground'
import { useQueryState } from 'nuqs'
import { getJsonMarkdown } from '@/lib/utils'
import { VIRTUAL_AGENT_CONFIG } from '@/types/playground'

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

  /**
   * Applies session from a virtual agent stream (first event with session_id).
   * Reusable by any virtual agent stream that sends stream_started + session_id.
   */
  const applyVirtualAgentSessionFromStream = useCallback(
    (
      newSessionId: string,
      jobAgentId: string,
      currentStorageKey: string,
      userMessage?: string
    ) => {
      setSessionId(newSessionId)
      const newKey = createStorageKey(jobAgentId, newSessionId)
      const currentMessages = usePlaygroundStore.getState().sessionMessages[currentStorageKey] || []
      if (currentMessages.length > 0) {
        setSessionMessages(newKey, currentMessages)
        usePlaygroundStore.getState().clearSessionMessages(currentStorageKey)
      }
      jobStorageKeyRef.current = newKey
      const oldJob = usePlaygroundStore.getState().activeJobs[currentStorageKey]
      if (oldJob) {
        setActiveJob(currentStorageKey, null)
        setActiveJob(newKey, { ...oldJob, sessionId: newSessionId, storageKey: newKey })
      }
      setSessionsData((prev) => {
        const exists = prev?.some((s) => s.session_id === newSessionId)
        if (exists) return prev ?? []
        return [
          {
            session_id: newSessionId,
            title: userMessage?.slice(0, 50) ?? 'New session',
            created_at: Math.floor(Date.now() / 1000),
          },
          ...(prev ?? []),
        ]
      })
      usePlaygroundStore.getState().setCurrentContext(jobAgentId, newSessionId)
    },
    [setSessionId, setSessionMessages, setActiveJob, setSessionsData]
  )

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

      // Virtual agents with custom stream: use request_stream_path from API (GET /v1/playground/virtual-agents),
      // or fallback from VIRTUAL_AGENT_CONFIG so generator output renders when API did not return the agent.
      const virtualAgent = agents.find((a) => a.value === jobAgentId && a.requestStreamPath)
      const fallbackStreamPath = jobAgentId ? VIRTUAL_AGENT_CONFIG[jobAgentId]?.requestStreamPath : undefined
      const streamPath = virtualAgent?.requestStreamPath ?? fallbackStreamPath
      console.log('[Stream] Virtual agent path check', {
        jobAgentId,
        streamPath: streamPath ?? null,
        fromApi: virtualAgent?.requestStreamPath != null,
        fromFallback: fallbackStreamPath != null,
      })
      if (streamPath != null) {
        const baseUrl = constructEndpointUrl(selectedEndpoint).replace(/\/$/, '')
        const streamUrl = `${baseUrl}${streamPath}`
        try {
          const response = await fetch(streamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              request: userMessage,
              session_id: jobSessionId ?? undefined,
            }),
          })
          if (!response.ok || !response.body) {
            const text = await response.text()
            let errMsg: string
            try {
              const data = JSON.parse(text)
              errMsg = data.error || data.detail || text
            } catch {
              errMsg = text || `Request failed (${response.status})`
            }
            updateMessagesForSession(jobStorageKey, (prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'agent') {
                next[next.length - 1] = { ...last, content: `**Error**\n\n${errMsg}`, streamingError: true, created_at: Math.floor(Date.now() / 1000) }
              }
              return next
            })
            return
          }
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let accumulated = ''
          let readCount = 0
          console.log('[Stream] Virtual agent SSE stream started', { streamPath, jobAgentId })
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              console.log('[Stream] Virtual agent SSE stream done', { readCount, jobAgentId })
              break
            }
            readCount += 1
            const decoded = decoder.decode(value, { stream: true })
            if (readCount <= 10 || readCount % 50 === 0) {
              console.log('[Stream] Virtual agent raw read', { readCount, bytes: value?.length, decodedLen: decoded.length })
            }
            buffer += decoded
            const lines = buffer.split('\n\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const raw = line.slice(6).trim()
              if (!raw) continue
              try {
                const currentStorageKey = jobStorageKeyRef.current ?? jobStorageKey
                const data = JSON.parse(raw) as { content?: string; done?: boolean; result?: string; error?: string; stream_started?: boolean; session_id?: string }
                console.log('[Stream] Virtual agent SSE parsed event', {
                  hasContent: data.content != null,
                  contentLen: data.content?.length,
                  done: data.done,
                  hasError: data.error != null,
                  stream_started: data.stream_started,
                  session_id: data.session_id
                })
                // Virtual agent stream: session created on first request; apply generic session update
                if (data.stream_started === true && data.session_id && !jobSessionId) {
                  applyVirtualAgentSessionFromStream(
                    data.session_id,
                    jobAgentId,
                    currentStorageKey,
                    userMessage
                  )
                }
                if (data.content != null) {
                  accumulated += data.content
                  if (accumulated.length <= 500 || accumulated.length % 2000 < (data.content?.length ?? 0)) {
                    console.log('[Stream] Virtual agent received content chunk', {
                      contentLen: data.content?.length,
                      accumulatedLen: accumulated.length,
                    })
                  }
                  updateMessagesForSession(currentStorageKey, (prev) => {
                    const next = [...prev]
                    const last = next[next.length - 1]
                    if (last && last.role === 'agent') {
                      next[next.length - 1] = { ...last, content: accumulated, streamingError: false, created_at: last.created_at ?? Math.floor(Date.now() / 1000) }
                    }
                    return next
                  })
                }
                if (data.done === true && data.result != null) {
                  // Prefer longer of streamed accumulated vs final result so we don't overwrite
                  // good streamed content with empty/truncated result when loop didn't complete properly
                  const finalContent =
                    accumulated.length >= data.result.length
                      ? accumulated
                      : data.result
                  updateMessagesForSession(currentStorageKey, (prev) => {
                    const next = [...prev]
                    const last = next[next.length - 1]
                    if (last && last.role === 'agent') {
                      next[next.length - 1] = { ...last, content: finalContent, streamingError: false, created_at: Math.floor(Date.now() / 1000) }
                    }
                    return next
                  })
                }
                if (data.error != null) {
                  updateMessagesForSession(currentStorageKey, (prev) => {
                    const next = [...prev]
                    const last = next[next.length - 1]
                    if (last && last.role === 'agent') {
                      next[next.length - 1] = { ...last, content: accumulated ? `${accumulated}\n\n**Error**\n\n${data.error}` : `**Error**\n\n${data.error}`, streamingError: true, created_at: Math.floor(Date.now() / 1000) }
                    }
                    return next
                  })
                }
              } catch {
                // skip malformed SSE line
              }
            }
          }
          // If no "done" event was received, keep accumulated content
          if (accumulated && !buffer.includes('"done"')) {
            updateMessagesForSession(jobStorageKeyRef.current ?? jobStorageKey, (prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'agent' && (last.content ?? '').length < accumulated.length) {
                next[next.length - 1] = { ...last, content: accumulated, created_at: Math.floor(Date.now() / 1000) }
              }
              return next
            })
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          const secOpsStorageKey = jobStorageKeyRef.current ?? jobStorageKey
          updateMessagesForSession(secOpsStorageKey, (prevMessages) => {
            const next = [...prevMessages]
            const last = next[next.length - 1]
            if (last && last.role === 'agent') {
              next[next.length - 1] = {
                ...last,
                content: `**Error**\n\n${errMsg}`,
                streamingError: true,
                created_at: Math.floor(Date.now() / 1000),
              }
            }
            return next
          })
        } finally {
          setActiveJob(jobStorageKeyRef.current ?? jobStorageKey, null)
          setIsStreaming(false)
          focusChatInput()
          jobAgentIdRef.current = null
          jobStorageKeyRef.current = null
          usePlaygroundStore.getState().triggerSessionsRefresh()
        }
        return
      }

      // Not a virtual agent with stream path: use Agno run (generator chunks will NOT stream to UI)
      console.log('[Stream] Not using virtual agent stream', { jobAgentId, streamPath: streamPath ?? null })

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
            // Log stream chunks reaching frontend (event + optional content preview)
            const contentPreview =
              typeof chunk?.content === 'string'
                ? `contentLen=${chunk.content.length} preview=${JSON.stringify(chunk.content.slice(0, 80))}${chunk.content.length > 80 ? '...' : ''}`
                : 'no-string-content'
            console.log('[Stream] Chunk received', {
              event: chunk?.event,
              session_id: chunk?.session_id,
              contentPreview
            })
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
                // Always sync store context to new session so main area shows running job instead of landing
                usePlaygroundStore.getState().setCurrentContext(jobAgentId, chunk.session_id as string)
                
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
              
              // Trigger sessions list refresh to show the new/updated session
              usePlaygroundStore.getState().triggerSessionsRefresh()
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
      applyVirtualAgentSessionFromStream,
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

'use client'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { TextArea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { usePlaygroundStore, createStorageKey } from '@/store'
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'
import { useQueryState } from 'nuqs'
import Icon from '@/components/ui/icon'

const ChatInput = () => {
  const { chatInputRef, agentFiles, setAgentFiles, resetAgentFileInput } = usePlaygroundStore()

  const { handleStreamResponse } = useAIChatStreamHandler()
  const [selectedAgent] = useQueryState('agent')
  const [sessionId] = useQueryState('session')
  const [inputMessage, setInputMessage] = useState('')
  
  // Get active jobs for per-session streaming state
  const activeJobs = usePlaygroundStore((state) => state.activeJobs)
  
  // Check if THIS specific agent+session is currently streaming
  // This allows other agents/sessions to accept input even when one is busy
  const isCurrentSessionStreaming = useMemo(() => {
    if (!selectedAgent) return false
    const storageKey = createStorageKey(selectedAgent, sessionId)
    const job = activeJobs[storageKey]
    return job?.status === 'running'
  }, [selectedAgent, sessionId, activeJobs])

  const handleSubmit = async () => {
    if (!inputMessage.trim()) return

    try {
      if (agentFiles && agentFiles.length > 0) {
        const formData = new FormData()
        Array.from(agentFiles).forEach((file) => {
          formData.append('files', file)
        })
        formData.append('message', inputMessage)
        await handleStreamResponse(formData)
        setAgentFiles(null)
        if (resetAgentFileInput) resetAgentFileInput()
      } else {
        await handleStreamResponse(inputMessage)
      }
      setInputMessage('')
    } catch (error) {
      toast.error(
        `Error in handleSubmit: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return (
    <div className="relative mx-auto mb-1 flex w-full max-w-5xl items-end justify-center gap-x-2 font-geist">
      <TextArea
        placeholder={'Ask anything'}
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' &&
            !e.nativeEvent.isComposing &&
            !e.shiftKey &&
            !isCurrentSessionStreaming
          ) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        className="w-full border border-accent bg-primaryAccent px-4 text-sm text-primary focus:border-accent"
        disabled={!selectedAgent}
        ref={chatInputRef}
      />
      <Button
        onClick={handleSubmit}
        disabled={!selectedAgent || !inputMessage.trim() || isCurrentSessionStreaming}
        size="icon"
        className="rounded-xl bg-primary p-5 text-primaryAccent"
      >
        <Icon type="send" color="primaryAccent" />
      </Button>
    </div>
  )
}

export default ChatInput

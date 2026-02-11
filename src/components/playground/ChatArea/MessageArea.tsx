'use client'

import { usePlaygroundStore, createStorageKey } from '@/store'
import { useEffect } from 'react'
import Messages from './Messages'
import ScrollToBottom from '@/components/playground/ChatArea/ScrollToBottom'
import ScrollToTop from '@/components/playground/ChatArea/ScrollToTop'
import { StickToBottom } from 'use-stick-to-bottom'
import { useQueryState } from 'nuqs'
import {
  VIRTUAL_WORKFLOW_AGENT_ID,
  VIRTUAL_INTELLIGENCE_INGESTION_AGENT_ID,
  VIRTUAL_ASSET_GRAPH_AGENT_ID,
  VIRTUAL_ASSET_SPREADSHEET_AGENT_ID,
  VIRTUAL_HYGIENE_ESSENTIALS_AGENT_ID,
} from '@/types/playground'
import { GraphVisualization } from '@/components/playground/GraphVisualization'
import { AssetMemorySpreadsheet } from '@/components/playground/AssetMemorySpreadsheet'
import { HygieneEssentialsSpreadsheet } from '@/components/playground/HygieneEssentialsSpreadsheet'
import { WorkflowCarousel } from '@/components/playground/WorkflowCarousel'
import { IntelligenceIngestionCarousel } from '@/components/playground/IntelligenceIngestionCarousel'

const clearVirtualAgent = (
  setAgentId: (v: string | null) => void,
  setCurrentContext: (agentId: string | null, sessionId: string | null) => void
) => {
  setAgentId(null)
  setCurrentContext(null, null)
}

const MessageArea = () => {
  const { messages, currentAgentId, setCurrentContext, selectedEndpoint, getActiveJob } = usePlaygroundStore()
  const [agentId] = useQueryState('agent')
  const [sessionId] = useQueryState('session')
  const [, setAgentId] = useQueryState('agent', { history: 'push' })

  // When URL has agent+session and there's an active job for that session, sync store context so main area shows running job (fixes race where stream set session in URL but context wasn't updated yet)
  useEffect(() => {
    if (agentId && sessionId && getActiveJob(createStorageKey(agentId, sessionId))) {
      setCurrentContext(agentId, sessionId)
    }
  }, [agentId, sessionId, getActiveJob, setCurrentContext])

  const onCloseVirtual = () => clearVirtualAgent(setAgentId, setCurrentContext)

  if (currentAgentId === VIRTUAL_ASSET_GRAPH_AGENT_ID) {
    return (
      <GraphVisualization
        isOpen
        onClose={onCloseVirtual}
        endpoint={selectedEndpoint}
      />
    )
  }
  if (currentAgentId === VIRTUAL_ASSET_SPREADSHEET_AGENT_ID) {
    return (
      <AssetMemorySpreadsheet
        isOpen
        onClose={onCloseVirtual}
        endpoint={selectedEndpoint}
      />
    )
  }
  if (currentAgentId === VIRTUAL_HYGIENE_ESSENTIALS_AGENT_ID) {
    return (
      <HygieneEssentialsSpreadsheet
        isOpen
        onClose={onCloseVirtual}
        endpoint={selectedEndpoint}
      />
    )
  }
  if (currentAgentId === VIRTUAL_WORKFLOW_AGENT_ID) {
    return (
      <WorkflowCarousel
        isOpen
        onClose={onCloseVirtual}
        endpoint={selectedEndpoint}
      />
    )
  }
  if (currentAgentId === VIRTUAL_INTELLIGENCE_INGESTION_AGENT_ID) {
    return (
      <IntelligenceIngestionCarousel
        isOpen
        onClose={onCloseVirtual}
        endpoint={selectedEndpoint}
      />
    )
  }

  return (
    <StickToBottom
      className="relative mb-4 flex max-h-[calc(100vh-64px)] min-h-0 flex-grow flex-col"
      resize="smooth"
      initial="smooth"
    >
      <StickToBottom.Content className="flex min-h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-5xl space-y-9 px-4 pb-4">
          <Messages messages={messages} />
        </div>
      </StickToBottom.Content>
      <ScrollToTop />
      <ScrollToBottom />
    </StickToBottom>
  )
}

export default MessageArea

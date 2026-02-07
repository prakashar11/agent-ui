export interface ToolCall {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id: string
  tool_name: string
  tool_args: Record<string, string>
  tool_call_error: boolean
  result?: string | null
  metrics: {
    time: number
  }
  created_at: number
}

export interface ReasoningSteps {
  title: string
  action?: string
  result: string
  reasoning: string
  confidence?: number
  next_action?: string
}
export interface ReasoningStepProps {
  index: number
  stepTitle: string
}
export interface ReasoningProps {
  reasoning: ReasoningSteps[]
}

export type ToolCallProps = {
  tools: ToolCall
}
interface ModelMessage {
  content: string | null
  context?: MessageContext[]
  created_at: number
  metrics?: {
    time: number
    prompt_tokens: number
    input_tokens: number
    completion_tokens: number
    output_tokens: number
  }
  name: string | null
  role: string
  tool_args?: unknown
  tool_call_id: string | null
  tool_calls: Array<{
    function: {
      arguments: string
      name: string
    }
    id: string
    type: string
  }> | null
}

export interface Model {
  name: string
  model: string
  provider: string
}

export interface Agent {
  agent_id: string
  name: string
  description: string
  model: Model
  storage?: boolean
  category?: string  // New field for agent categorization
  agent_tip?: string  // New field for agent tooltip/helpful text
}

/** Virtual agent id for SecOps tools harness: uses chat area and POST /v1/secops/request (not Agno agent run). */
export const SECOPS_TOOLS_HARNESS_AGENT_ID = 'virtual-secops-tools-harness'

/** Virtual agent id for Workflow Tasks carousel (Utilities category). Opens WorkflowCarousel view. */
export const VIRTUAL_WORKFLOW_AGENT_ID = 'virtual-workflow-tasks'

/** Virtual agent id for Intelligence / Threat Intel Ingestion carousel (Utilities category). Opens IntelligenceIngestionCarousel view. */
export const VIRTUAL_INTELLIGENCE_INGESTION_AGENT_ID = 'virtual-intelligence-ingestion'

/** Virtual agent id for Asset Graph carousel (Asset Management category). Opens GraphVisualization view. */
export const VIRTUAL_ASSET_GRAPH_AGENT_ID = 'virtual-asset-graph'

/** Virtual agent id for Asset Memory Spreadsheet carousel (Asset Management category). Opens AssetMemorySpreadsheet view. */
export const VIRTUAL_ASSET_SPREADSHEET_AGENT_ID = 'virtual-asset-spreadsheet'

/** Virtual agent id for Hygiene Essentials carousel (Asset Management category). Opens HygieneEssentialsSpreadsheet view. */
export const VIRTUAL_HYGIENE_ESSENTIALS_AGENT_ID = 'virtual-hygiene-essentials'

/**
 * Virtual agent IDs that have backend sessions (playground session API).
 * Used to fetch/show sessions and enable sessions panel for these agents.
 * Add new virtual agents here when they support GET /v1/playground/agents/{agentId}/sessions.
 */
export const VIRTUAL_AGENT_IDS_WITH_SESSIONS: readonly string[] = [
  SECOPS_TOOLS_HARNESS_AGENT_ID,
]

/** Returns true if the given agent is a virtual agent with backend sessions. */
export function isVirtualAgentWithSessions(
  agentId: string | null | undefined
): boolean {
  return Boolean(agentId && VIRTUAL_AGENT_IDS_WITH_SESSIONS.includes(agentId))
}

/** Config for virtual agents: label, optional agent_tip, and optional request stream path (fallback when API does not return it). */
export interface VirtualAgentConfig {
  label: string
  agent_tip?: string
  /** Relative path for POST stream (e.g. /v1/secops/request/stream). Used when GET /v1/playground/virtual-agents did not return this agent. */
  requestStreamPath?: string
}

/** Virtual agent id → config (label, optional agent_tip, optional requestStreamPath). Add requestStreamPath for agents that use a custom stream endpoint. */
export const VIRTUAL_AGENT_CONFIG: Record<string, VirtualAgentConfig> = {
  [SECOPS_TOOLS_HARNESS_AGENT_ID]: {
    label: 'SecOps tools harness',
    agent_tip: 'Run SecOps requests in natural language: threat intel, Sigma rules, log search, skills, asset graph.',
    requestStreamPath: '/v1/secops/request/stream',
  },
  [VIRTUAL_WORKFLOW_AGENT_ID]: {
    label: 'Workflow Tasks',
    agent_tip: 'Manage security workflows for asset hygiene, access reviews, patching, and threat management.',
  },
  [VIRTUAL_INTELLIGENCE_INGESTION_AGENT_ID]: {
    label: 'Intelligence Ingestion',
    agent_tip: 'Ingest threat intel feeds and bug bounty sources; run quick-start or custom ingestion jobs.',
  },
  [VIRTUAL_ASSET_GRAPH_AGENT_ID]: {
    label: 'Asset Graph',
    agent_tip: 'Visualize and explore asset relationships, attack paths, and remediation recommendations.',
  },
  [VIRTUAL_ASSET_SPREADSHEET_AGENT_ID]: {
    label: 'Asset Memory Spreadsheet',
    agent_tip: 'View and manage assets in a spreadsheet; filter, sort, and bulk edit asset data.',
  },
  [VIRTUAL_HYGIENE_ESSENTIALS_AGENT_ID]: {
    label: 'Hygiene Essentials',
    agent_tip: 'Track hygiene essentials and controls; manage maturity and compliance data.',
  },
}

interface MessageContext {
  query: string
  docs?: Array<Record<string, object>>
  time?: number
}

export enum RunEvent {
  RunStarted = 'RunStarted',
  RunResponse = 'RunResponse',
  RunResponseContent = 'RunResponseContent',
  RunCompleted = 'RunCompleted',
  RunError = 'RunError',
  RunCancelled = 'RunCancelled',
  ToolCallStarted = 'ToolCallStarted',
  ToolCallCompleted = 'ToolCallCompleted',
  UpdatingMemory = 'UpdatingMemory',
  ReasoningStarted = 'ReasoningStarted',
  ReasoningStep = 'ReasoningStep',
  ReasoningCompleted = 'ReasoningCompleted'
}

export interface ResponseAudio {
  id?: string
  content?: string
  transcript?: string
  channels?: number
  sample_rate?: number
}

export interface NewRunResponse {
  status: 'RUNNING' | 'PAUSED' | 'CANCELLED'
}

export interface RunResponseContent {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall
  tools?: Array<ToolCall>
  created_at: number
  extra_data?: PlaygroundAgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface RunResponse {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall
  tools?: Array<ToolCall>
  created_at: number
  extra_data?: PlaygroundAgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface AgentExtraData {
  reasoning_steps?: ReasoningSteps[]
  reasoning_messages?: ReasoningMessage[]
  references?: ReferenceData[]
}

export interface PlaygroundAgentExtraData extends AgentExtraData {
  reasoning_messages?: ReasoningMessage[]
  references?: ReferenceData[]
}

export interface ReasoningMessage {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id?: string
  tool_name?: string
  tool_args?: Record<string, string>
  tool_call_error?: boolean
  metrics?: {
    time: number
  }
  created_at?: number
}
export interface PlaygroundChatMessage {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  streamingError?: boolean
  cancelled?: boolean
  created_at: number
  tool_calls?: ToolCall[]
  extra_data?: {
    reasoning_steps?: ReasoningSteps[]
    reasoning_messages?: ReasoningMessage[]
    references?: ReferenceData[]
  }
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}

export interface ComboboxAgent {
  value: string
  label: string
  model: {
    provider: string
  }
  storage?: boolean
  category?: string  // New field for agent categorization
  agent_tip?: string  // New field for agent tooltip/helpful text
  /** When set, agent-ui uses this path (e.g. /v1/secops/request/stream) for stream requests instead of agno run. From GET /v1/playground/virtual-agents. */
  requestStreamPath?: string
}
export interface ImageData {
  revised_prompt: string
  url: string
}

export interface VideoData {
  id: number
  eta: number
  url: string
}

export interface AudioData {
  base64_audio?: string
  mime_type?: string
  url?: string
  id?: string
  content?: string
  channels?: number
  sample_rate?: number
}

export interface ReferenceData {
  query: string
  references: Reference[]
  time?: number
}

export interface Reference {
  content: string
  meta_data: {
    chunk: number
    chunk_size: number
  }
  name: string
}

export interface SessionEntry {
  session_id: string
  title: string
  created_at: number
}

export interface ChatEntry {
  message: {
    role: 'user' | 'system' | 'tool' | 'assistant'
    content: string
    created_at: number
  }
  response: {
    content: string
    tools?: ToolCall[]
    extra_data?: {
      reasoning_steps?: ReasoningSteps[]
      reasoning_messages?: ReasoningMessage[]
      references?: ReferenceData[]
    }
    images?: ImageData[]
    videos?: VideoData[]
    audio?: AudioData[]
    response_audio?: {
      transcript?: string
    }
    created_at: number
  }
}

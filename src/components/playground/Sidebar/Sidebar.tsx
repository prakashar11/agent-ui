'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CategorySelector } from '@/components/playground/Sidebar/CategorySelector'
import useChatActions from '@/hooks/useChatActions'
import { usePlaygroundStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import Icon from '@/components/ui/icon'
import { IconType } from '@/components/ui/icon/types'
import { getProviderIcon } from '@/lib/modelProvider'
import Sessions from './Sessions'
import { isValidUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { useQueryState } from 'nuqs'
import { Skeleton } from '@/components/ui/skeleton'
import ToolCallsToggle from './ToolCallsToggle'
import ArticleViewToggle from './ArticleViewToggle'
import { BackgroundJobNotifications } from './BackgroundJobNotifications'
import { ActiveJobsIndicator } from './ActiveJobsIndicator'

// Tech stack icons for "Built with" section
const TECH_ICONS: { type: IconType; link: string; name: string }[] = [
  { type: 'agno', link: 'https://agno.com', name: 'Agno' },
  { type: 'agent-ui', link: 'https://agno.link/agent-ui', name: 'Agent UI' },
  { type: 'nextjs', link: 'https://nextjs.org', name: 'Next.js' },
  { type: 'shadcn', link: 'https://ui.shadcn.com', name: 'shadcn/ui' },
  { type: 'tailwind', link: 'https://tailwindcss.com', name: 'Tailwind' },
]

const ENDPOINT_PLACEHOLDER = 'NO ENDPOINT ADDED'

// Reusable section header component for consistent styling
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-medium uppercase text-primary">{children}</div>
)

// Visual divider between sections
const SectionDivider = () => (
  <div className="w-full h-px bg-primary/10" />
)

const SidebarHeader = () => (
  <div className="flex items-center gap-2">
    <Icon type="agno" size="xs" />
    <span className="text-xs font-medium uppercase text-white">Agent UI</span>
  </div>
)

const NewChatButton = ({
  disabled,
  onClick
}: {
  disabled: boolean
  onClick: () => void
}) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    size="lg"
    className="h-9 w-full rounded-xl bg-primary text-xs font-medium text-background hover:bg-primary/80"
  >
    <Icon type="plus-icon" size="xs" className="text-background" />
    <span className="uppercase">New Chat</span>
  </Button>
)

const ModelDisplay = ({ model }: { model: string }) => (
  <div className="flex h-auto min-h-9 w-full items-center gap-3 rounded-xl border border-primary/15 bg-accent p-3 text-xs font-medium uppercase text-muted">
    {(() => {
      const icon = getProviderIcon(model)
      return icon ? <Icon type={icon} className="shrink-0" size="xs" /> : null
    })()}
    <span className="break-words leading-relaxed flex-1 min-w-0">
      {model}
    </span>
  </div>
)

const Endpoint = () => {
  const {
    selectedEndpoint,
    isEndpointActive,
    setSelectedEndpoint,
    setAgents,
    setSessionsData,
    setMessages
  } = usePlaygroundStore()
  const { initializePlayground } = useChatActions()
  const [isEditing, setIsEditing] = useState(false)
  const [endpointValue, setEndpointValue] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [, setAgentId] = useQueryState('agent', { history: 'push' })
  const [, setSessionId] = useQueryState('session', { history: 'push' })

  useEffect(() => {
    setEndpointValue(selectedEndpoint)
    setIsMounted(true)
  }, [selectedEndpoint])

  const getStatusColor = (isActive: boolean) =>
    isActive ? 'bg-positive' : 'bg-destructive'

  const handleSave = async () => {
    if (!isValidUrl(endpointValue)) {
      toast.error('Please enter a valid URL')
      return
    }
    const cleanEndpoint = endpointValue.replace(/\/$/, '').trim()
    setSelectedEndpoint(cleanEndpoint)
    setAgentId(null)
    setSessionId(null)
    setIsEditing(false)
    setIsHovering(false)
    setAgents([])
    setSessionsData([])
    setMessages([])
  }

  const handleCancel = () => {
    setEndpointValue(selectedEndpoint)
    setIsEditing(false)
    setIsHovering(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleRefresh = async () => {
    setIsRotating(true)
    await initializePlayground()
    setTimeout(() => setIsRotating(false), 500)
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="text-xs font-medium uppercase text-primary">Endpoint</div>
      {isEditing ? (
        <div className="flex w-full items-center gap-1">
          <input
            type="text"
            value={endpointValue}
            onChange={(e) => setEndpointValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex h-9 w-full items-center text-ellipsis rounded-xl border border-primary/15 bg-accent p-3 text-xs font-medium text-muted"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            className="hover:cursor-pointer hover:bg-transparent"
          >
            <Icon type="save" size="xs" />
          </Button>
        </div>
      ) : (
        <div className="flex w-full items-center gap-2">
          <motion.div
            className="relative flex h-9 flex-1 min-w-0 cursor-pointer items-center justify-between rounded-xl border border-primary/15 bg-accent px-3 uppercase"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => setIsEditing(true)}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <AnimatePresence mode="wait">
              {isHovering ? (
                <motion.div
                  key="endpoint-display-hover"
                  className="flex items-center justify-center w-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-primary">
                    <Icon type="edit" size="xxs" /> EDIT ENDPOINT
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="endpoint-display"
                  className="flex items-center justify-between w-full gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-xs font-medium text-muted truncate">
                    {isMounted
                      ? selectedEndpoint || ENDPOINT_PLACEHOLDER
                      : 'http://localhost:7777'}
                  </p>
                  <div
                    className={`size-2 shrink-0 rounded-full ${getStatusColor(isEndpointActive)}`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="shrink-0 hover:cursor-pointer hover:bg-transparent"
          >
            <motion.div
              key={isRotating ? 'rotating' : 'idle'}
              animate={{ rotate: isRotating ? 360 : 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <Icon type="refresh" size="xs" />
            </motion.div>
          </Button>
        </div>
      )}
    </div>
  )
}

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { clearChat, focusChatInput, initializePlayground } = useChatActions()
  const {
    messages,
    selectedEndpoint,
    isEndpointActive,
    selectedModel,
    hydrated,
    isEndpointLoading,
    agentFiles,
    setAgentFiles
  } = usePlaygroundStore()
  const [isMounted, setIsMounted] = useState(false)
  const [agentId] = useQueryState('agent')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [agentUploadProgress, setAgentUploadProgress] = useState<number | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [agentUploadError, setAgentUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIsMounted(true)
    if (hydrated) initializePlayground()
  }, [selectedEndpoint, initializePlayground, hydrated])

  const handleNewChat = () => {
    clearChat()
    focusChatInput()
  }

  const handleAgentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    setAgentFiles(files)
    setAgentUploadProgress(null)
    setAgentUploadError(null)
  }

  useEffect(() => {
    usePlaygroundStore.setState({ resetAgentFileInput: () => {
      if (fileInputRef.current) fileInputRef.current.value = ''
    } })
  }, [])

  return (
    <motion.aside
      className="relative flex h-screen shrink-0 grow-0 flex-col overflow-hidden px-2 py-3 font-dmmono"
      initial={{ width: '16rem' }}
      animate={{ width: isCollapsed ? '2.5rem' : '16rem' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <motion.button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute right-2 top-2 z-10 p-1"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        type="button"
        whileTap={{ scale: 0.95 }}
      >
        <Icon
          type="sheet"
          size="xs"
          className={`transform ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}
        />
      </motion.button>
      <motion.div
        className="w-60 h-full space-y-5 overflow-y-auto overflow-x-hidden pb-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: isCollapsed ? 0 : 1, x: isCollapsed ? -20 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{
          pointerEvents: isCollapsed ? 'none' : 'auto'
        }}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            HEADER & PRIMARY ACTION
        ═══════════════════════════════════════════════════════════════════ */}
        <SidebarHeader />
        <NewChatButton
          disabled={messages.length === 0}
          onClick={handleNewChat}
        />
        
        {isMounted && isEndpointActive && (
          <>
            {/* ═══════════════════════════════════════════════════════════════════
                CATEGORIES SECTION - Select Category to see agents in carousel
            ═══════════════════════════════════════════════════════════════════ */}
            <motion.div
              className="flex w-full flex-col items-start gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <SectionHeader>Categories</SectionHeader>
              {isEndpointLoading ? (
                <div className="flex w-full flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="h-12 w-full rounded-xl"
                    />
                  ))}
                </div>
              ) : (
                <CategorySelector />
              )}
            </motion.div>
            
            {/* ═══════════════════════════════════════════════════════════════════
                FILES SECTION
            ═══════════════════════════════════════════════════════════════════ */}
            {!isEndpointLoading && (
              <motion.div
                className="flex w-full flex-col items-start gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <SectionHeader>Files</SectionHeader>
                <div className="flex w-full flex-col gap-2 rounded-xl border border-primary/15 bg-accent p-3">
                  <div className="flex items-center gap-2">
                    <Icon type="plus-icon" size="xs" aria-hidden="true" className="flex-shrink-0" />
                    <label htmlFor="agent-file-upload" className="text-xs font-medium uppercase cursor-pointer flex-shrink-0">
                      Upload Files
                    </label>
                    <input
                      id="agent-file-upload"
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={handleAgentFileChange}
                      className="hidden"
                      accept=".pdf,.csv,.docx,.txt,.json,image/*,audio/*,video/*,.eml,.xlsx,.xls"
                      disabled={!agentId}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Supports: CSV, PDF, EML, JSON, Images, Audio
                  </div>
                  {agentFiles && agentFiles.length > 0 && (
                    <div className="flex flex-col text-xs text-primary gap-1 mt-1 border-t border-primary/10 pt-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Selected:</div>
                      {Array.from(agentFiles).map((file) => (
                        <div key={file.name} className="break-words leading-relaxed flex items-center gap-1">
                          <span className="text-positive">✓</span>
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            
            <SectionDivider />
            
            {/* ═══════════════════════════════════════════════════════════════════
                DISPLAY OPTIONS SECTION
            ═══════════════════════════════════════════════════════════════════ */}
            <motion.div
              className="flex flex-col gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.15 }}
            >
              <SectionHeader>Display</SectionHeader>
              <ToolCallsToggle />
              <ArticleViewToggle />
            </motion.div>
            
            <SectionDivider />
            
            {/* ═══════════════════════════════════════════════════════════════════
                SESSIONS SECTION
            ═══════════════════════════════════════════════════════════════════ */}
            <Sessions />
            
            <SectionDivider />
            
            {/* ═══════════════════════════════════════════════════════════════════
                BACKGROUND JOBS SECTION - Show running & completed jobs for other agents
            ═══════════════════════════════════════════════════════════════════ */}
            <motion.div
              className="flex flex-col gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.25 }}
            >
              <ActiveJobsIndicator />
              <BackgroundJobNotifications />
            </motion.div>
            
            <SectionDivider />
            
            {/* ═══════════════════════════════════════════════════════════════════
                CONNECTION SECTION - Endpoint & Model (at bottom)
            ═══════════════════════════════════════════════════════════════════ */}
            <motion.div
              className="flex w-full flex-col items-start gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Endpoint />
              {selectedModel && agentId && (
                <div className="flex w-full flex-col items-start gap-2">
                  <SectionHeader>Model</SectionHeader>
                  <ModelDisplay model={selectedModel} />
                </div>
              )}
            </motion.div>
            
            {/* ═══════════════════════════════════════════════════════════════════
                BUILT WITH SECTION - Tech stack icons at bottom
            ═══════════════════════════════════════════════════════════════════ */}
            <motion.div
              className="flex w-full flex-col items-start gap-2 pt-4 mt-auto border-t border-primary/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Built with
              </span>
              <div className="flex items-center gap-1">
                {TECH_ICONS.map((icon) => (
                  <Link
                    key={icon.type}
                    href={icon.link}
                    target="_blank"
                    rel="noopener"
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    title={icon.name}
                  >
                    <Icon type={icon.type} size="xxs" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
        
        {/* Show endpoint when not active (initial state) */}
        {isMounted && !isEndpointActive && (
          <Endpoint />
        )}
      </motion.div>
    </motion.aside>
  )
}

export default Sidebar

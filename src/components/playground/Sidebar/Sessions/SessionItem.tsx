import { useQueryState } from 'nuqs'
import { SessionEntry } from '@/types/playground'
import { Button } from '../../../ui/button'
import useSessionLoader from '@/hooks/useSessionLoader'
import { deletePlaygroundSessionAPI, renamePlaygroundSessionAPI } from '@/api/playground'
import { usePlaygroundStore } from '@/store'
import { toast } from 'sonner'
import Icon from '@/components/ui/icon'
import { useState, useRef, useEffect } from 'react'
import DeleteSessionModal from './DeleteSessionModal'
import useChatActions from '@/hooks/useChatActions'
import { cn } from '@/lib/utils'

type SessionItemProps = SessionEntry & {
  isSelected: boolean
  onSessionClick: () => void
}
const SessionItem = ({
  title,
  session_id,
  isSelected,
  onSessionClick
}: SessionItemProps) => {
  const [agentId] = useQueryState('agent')
  const { getSession } = useSessionLoader()
  const [, setSessionId] = useQueryState('session')
  const { selectedEndpoint, sessionsData, setSessionsData } =
    usePlaygroundStore()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(title)
  const [isRenaming, setIsRenaming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { clearChat } = useChatActions()

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Reset edited title when title prop changes
  useEffect(() => {
    setEditedTitle(title)
  }, [title])

  const handleGetSession = async () => {
    if (agentId) {
      onSessionClick()
      await getSession(session_id, agentId)
      setSessionId(session_id)
    }
  }

  const handleDeleteSession = async () => {
    if (agentId) {
      try {
        const response = await deletePlaygroundSessionAPI(
          selectedEndpoint,
          agentId,
          session_id
        )
        if (response.status === 200 && sessionsData) {
          setSessionsData(
            sessionsData.filter((session) => session.session_id !== session_id)
          )
          clearChat()
          toast.success('Session deleted', { duration: 2000 })
        } else {
          toast.error('Failed to delete session', { duration: 3000 })
        }
      } catch {
        toast.error('Failed to delete session', { duration: 3000 })
      } finally {
        setIsDeleteModalOpen(false)
      }
    }
  }

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditedTitle(title)
    setIsEditing(true)
  }

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditedTitle(title)
    setIsEditing(false)
  }

  const handleSaveEdit = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const trimmedTitle = editedTitle.trim()
    
    if (!trimmedTitle) {
      toast.error('Session name cannot be empty', { duration: 3000 })
      return
    }
    
    if (trimmedTitle === title) {
      setIsEditing(false)
      return
    }

    if (agentId) {
      setIsRenaming(true)
      const result = await renamePlaygroundSessionAPI(
        selectedEndpoint,
        agentId,
        session_id,
        trimmedTitle
      )
      
      if (result.success && sessionsData) {
        setSessionsData(
          sessionsData.map((session) =>
            session.session_id === session_id
              ? { ...session, title: trimmedTitle }
              : session
          )
        )
        toast.success('Session renamed', { duration: 2000 })
        setIsEditing(false)
      } else {
        toast.error(result.error || 'Failed to rename session', { duration: 3000 })
      }
      setIsRenaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }
  return (
    <>
      <div
        className={cn(
          'group flex h-auto min-h-11 w-full cursor-pointer items-start justify-between rounded-lg px-3 py-2 transition-colors duration-200',
          isSelected
            ? 'cursor-default bg-primary/10'
            : 'bg-background-secondary hover:bg-background-secondary/80'
        )}
        onClick={isEditing ? undefined : handleGetSession}
      >
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              disabled={isRenaming}
              className={cn(
                'w-full bg-transparent text-sm font-medium outline-none border-b border-primary/50 focus:border-primary pb-0.5',
                isSelected && 'text-primary'
              )}
              placeholder="Session name"
            />
          ) : (
            <h4
              className={cn('text-sm font-medium break-words leading-relaxed', isSelected && 'text-primary')}
            >
              {title}
            </h4>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleSaveEdit}
                disabled={isRenaming}
                title="Save"
              >
                <Icon type="check" size="xs" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCancelEdit}
                disabled={isRenaming}
                title="Cancel"
              >
                <Icon type="x" size="xs" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 transform opacity-0 transition-all duration-200 ease-in-out group-hover:opacity-100"
                onClick={handleStartEdit}
                title="Rename session"
              >
                <Icon type="edit" size="xs" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 transform opacity-0 transition-all duration-200 ease-in-out group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDeleteModalOpen(true)
                }}
                title="Delete session"
              >
                <Icon type="trash" size="xs" />
              </Button>
            </>
          )}
        </div>
      </div>
      <DeleteSessionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={handleDeleteSession}
        isDeleting={false}
      />
    </>
  )
}

export default SessionItem

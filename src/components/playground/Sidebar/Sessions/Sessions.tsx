'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { usePlaygroundStore, createStorageKey } from '@/store'
import { useQueryState } from 'nuqs'
import SessionItem from './SessionItem'
import SessionBlankState from './SessionBlankState'
import useSessionLoader from '@/hooks/useSessionLoader'
import { isVirtualAgentWithSessions } from '@/types/playground'

import { cn } from '@/lib/utils'
import { FC } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonListProps {
  skeletonCount: number
}

const SkeletonList: FC<SkeletonListProps> = ({ skeletonCount }) => {
  const skeletons = useMemo(
    () => Array.from({ length: skeletonCount }, (_, i) => i),
    [skeletonCount]
  )

  return skeletons.map((skeleton, index) => (
    <Skeleton
      key={skeleton}
      className={cn(
        'mb-1 h-11 rounded-lg px-3 py-2',
        index > 0 && 'bg-background-secondary'
      )}
    />
  ))
}

dayjs.extend(utc)

const formatDate = (
  timestamp: number,
  format: 'natural' | 'full' = 'full'
): string => {
  const date = dayjs.unix(timestamp).utc()
  return format === 'natural'
    ? date.format('HH:mm')
    : date.format('YYYY-MM-DD HH:mm:ss')
}

const Sessions = () => {
  const [agentId] = useQueryState('agent', {
    parse: (value) => value || undefined,
    history: 'push'
  })
  const [sessionId] = useQueryState('session')
  const {
    selectedEndpoint,
    isEndpointActive,
    isEndpointLoading,
    sessionsData,
    hydrated,
    hasStorage,
    setSessionsData,
    sessionsRefreshTrigger,
    getActiveJob,
    setCurrentContext
  } = usePlaygroundStore()
  const [isScrolling, setIsScrolling] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  )
  const { getSession, getSessions } = useSessionLoader()
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const { isSessionsLoading } = usePlaygroundStore()

  const handleScroll = () => {
    setIsScrolling(true)

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 1500)
  }

  // Cleanup the scroll timeout when component unmounts
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // Virtual agents with backend sessions: fetch for them even when hasStorage is false (e.g. direct URL load).
  const shouldFetchSessions = hasStorage || isVirtualAgentWithSessions(agentId)

  // Fetch sessions list and, when URL has sessionId, load that session first so GET .../sessions/{id} runs before GET .../sessions (avoids list-before-get order when hydrated is delayed).
  // Skip loading a session by ID when there is an active run for that session: the backend may not have persisted it yet (avoids 404 and "two session ids" race).
  useEffect(() => {
    if (!selectedEndpoint || !agentId || !shouldFetchSessions) {
      setSessionsData(() => null)
      return
    }
    if (!isEndpointLoading) {
      const run = async () => {
        if (sessionId && hydrated) {
          const storageKey = createStorageKey(agentId, sessionId)
          const activeJob = getActiveJob(storageKey)
          if (activeJob) {
            // URL has new session from stream; sync store context so main area shows running job output instead of landing
            setCurrentContext(agentId, sessionId)
          } else {
            await getSession(sessionId, agentId)
          }
        }
        if (sessionsRefreshTrigger === 0) {
          setSessionsData(() => null)
        }
        getSessions(agentId)
      }
      run()
    }
  }, [
    selectedEndpoint,
    agentId,
    getSessions,
    getSession,
    getActiveJob,
    setCurrentContext,
    isEndpointLoading,
    shouldFetchSessions,
    setSessionsData,
    sessionsRefreshTrigger,
    sessionId,
    hydrated
  ])

  useEffect(() => {
    if (sessionId) {
      setSelectedSessionId(sessionId)
    }
  }, [sessionId])

  const formattedSessionsData = useMemo(() => {
    if (!sessionsData || !Array.isArray(sessionsData)) return []

    return sessionsData.map((entry) => ({
      ...entry,
      created_at: entry.created_at,
      formatted_time: formatDate(entry.created_at, 'natural')
    }))
  }, [sessionsData])

  const handleSessionClick = useCallback(
    (id: string) => () => setSelectedSessionId(id),
    []
  )

  if (isSessionsLoading || isEndpointLoading)
    return (
      <div className="w-full">
        <div className="mb-2 text-xs font-medium uppercase text-primary">Sessions</div>
        <div className="mt-2 max-h-40 w-full overflow-y-auto">
          <SkeletonList skeletonCount={3} />
        </div>
      </div>
    )
  return (
    <div className="w-full">
      <div className="mb-2 w-full text-xs font-medium uppercase text-primary">Sessions</div>
      <div
        className={`max-h-48 overflow-y-auto font-geist transition-all duration-300 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:transition-opacity [&::-webkit-scrollbar]:duration-300 ${isScrolling ? '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-background [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:opacity-0' : '[&::-webkit-scrollbar]:opacity-100'}`}
        onScroll={handleScroll}
        onMouseOver={() => setIsScrolling(true)}
        onMouseLeave={handleScroll}
      >
        {!isEndpointActive ||
        !shouldFetchSessions ||
        (!isSessionsLoading && (!sessionsData || sessionsData.length === 0)) ? (
          <SessionBlankState />
        ) : (
          <div className="flex flex-col gap-y-1 pr-1">
            {formattedSessionsData.map((entry, index) => (
              <SessionItem
                key={`${entry.session_id}-${index}`}
                {...entry}
                isSelected={selectedSessionId === entry.session_id}
                onSessionClick={handleSessionClick(entry.session_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sessions

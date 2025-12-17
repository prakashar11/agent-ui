'use client'

import { FC, useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import MarkdownRenderer from '@/components/ui/typography/MarkdownRenderer'
import type { Article } from '@/utils/articleParser'
import { useStickToBottomContext } from 'use-stick-to-bottom'
import { GripVertical } from 'lucide-react'

interface SwipeableCardStackProps {
  articles: Article[]
  className?: string
  messageId?: string // Optional message ID to persist state across content updates
}

// Helper functions for localStorage
// Storage key format: 'card-stack-index-{firstArticleId}'
// Example: 'card-stack-index-article-0'
// 
// IMPORTANT: localStorage is created ONLY for article_0 (the first article's ID)
// This key remains stable when new articles are appended, allowing us to preserve
// currentIndex and scrollPosition across article additions.
const CURRENT_INDEX_STORAGE_PREFIX = 'card-stack-index-'
const CARD_HEIGHT_STORAGE_PREFIX = 'card-stack-height-'

interface CardStackState {
  currentIndex: number  // The index of the currently displayed card (0-based)
  scrollPosition: number  // The scroll position of the current card
}

interface CardHeightState {
  height: number  // The height of the card in pixels
}

/**
 * Generate a stable key from article IDs
 * 
 * Uses ONLY the first article ID (article_0) as the storage key.
 * This ensures:
 * - The key stays the same when articles are appended (article_0 doesn't change)
 * - Different article sets get separate storage (different first article = different key)
 * - currentIndex and scrollPosition are preserved when new articles stream in
 * 
 * @returns The first article's ID (e.g., "article-0") or "empty" if no articles
 */
const getArticleKey = (articles: Article[]): string => {
  if (articles.length === 0) return 'empty'
  // Use only the first article ID - this stays the same when articles are appended
  // Different article sets will have different first IDs, so they get separate storage
  const firstId = articles[0]?.id || 'unknown'
  return firstId
}

/**
 * Retrieve stored state from localStorage
 * 
 * Storage key: 'card-stack-index-{articleKey}' where articleKey is the first article ID (article_0)
 * Stores: { currentIndex: number, scrollPosition: number }
 * 
 * @param articleKey - The first article's ID (e.g., "article-0")
 * @returns CardStackState with currentIndex and scrollPosition, or null if not found
 */
const getStoredState = (articleKey: string): CardStackState | null => {
  try {
    const storageKey = `${CURRENT_INDEX_STORAGE_PREFIX}${articleKey}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as CardStackState
      if (parsed && typeof parsed.currentIndex === 'number' && parsed.currentIndex >= 0) {
        return {
          currentIndex: parsed.currentIndex,
          scrollPosition: typeof parsed.scrollPosition === 'number' && parsed.scrollPosition >= 0 
            ? parsed.scrollPosition 
            : 0
        }
      }
      // Fallback: try parsing as just a number (old format)
      const index = parseInt(stored, 10)
      if (!isNaN(index) && index >= 0) {
        return { currentIndex: index, scrollPosition: 0 }
      }
    }
  } catch {
    // Silently fail - localStorage might be disabled or quota exceeded
  }
  return null
}

/**
 * Save state to localStorage
 * 
 * Storage key: 'card-stack-index-{articleKey}' where articleKey is the first article ID (article_0)
 * Stores: { currentIndex: number, scrollPosition: number }
 * 
 * @param articleKey - The first article's ID (e.g., "article-0")
 * @param state - The state to store (currentIndex and scrollPosition)
 */
const setStoredState = (articleKey: string, state: CardStackState) => {
  try {
    const storageKey = `${CURRENT_INDEX_STORAGE_PREFIX}${articleKey}`
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // Silently fail - localStorage might be disabled or quota exceeded
  }
}

/**
 * Retrieve stored card height from localStorage
 * 
 * @param articleKey - The first article's ID (e.g., "article-0")
 * @returns CardHeightState with height, or null if not found
 */
const getStoredCardHeight = (articleKey: string): CardHeightState | null => {
  try {
    const storageKey = `${CARD_HEIGHT_STORAGE_PREFIX}${articleKey}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as CardHeightState
      if (parsed && typeof parsed.height === 'number' && parsed.height >= 400 && parsed.height <= 1200) {
        return parsed
      }
    }
  } catch {
    // Silently fail - localStorage might be disabled or quota exceeded
  }
  return null
}

/**
 * Save card height to localStorage
 * 
 * @param articleKey - The first article's ID (e.g., "article-0")
 * @param state - The state to store (height)
 */
const setStoredCardHeight = (articleKey: string, state: CardHeightState) => {
  try {
    const storageKey = `${CARD_HEIGHT_STORAGE_PREFIX}${articleKey}`
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // Silently fail - localStorage might be disabled or quota exceeded
  }
}

// Card content component that preserves scroll position
interface CardContentProps {
  article: Article
  index: number
  isCurrent: boolean
  savedScrollPosition: number
  onScrollChange: (position: number) => void
  cardHeight: number  // Dynamic card height
}

const CardContent: FC<CardContentProps> = ({ article, index, isCurrent, savedScrollPosition, onScrollChange, cardHeight }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastSavedPositionRef = useRef<number>(0)

  // Save scroll position when scrolling (only for current card)
  // Use requestAnimationFrame with throttling to keep scrolling smooth
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !isCurrent) return

    const handleScroll = () => {
      // Cancel any pending animation frame
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
      
      // Schedule update on next animation frame to keep scrolling smooth
      rafRef.current = requestAnimationFrame(() => {
        const position = container.scrollTop
        // Only notify parent if position changed significantly (avoid micro-updates)
        // This reduces unnecessary state updates and localStorage writes
        // Increased threshold from 10 to 20px for better performance
        if (Math.abs(position - lastSavedPositionRef.current) > 20) {
          lastSavedPositionRef.current = position
          // Notify parent to save to localStorage (only for current card)
          // This is already debounced in the parent component
          onScrollChange(position)
        }
        rafRef.current = null
      })
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isCurrent, onScrollChange])

  // Restore scroll position when content updates (only for current card)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !isCurrent) return

    if (savedScrollPosition > 0) {
      // Use requestAnimationFrame for smoother restoration
      // This ensures the DOM is ready and avoids conflict with scroll events
      const rafId = requestAnimationFrame(() => {
        if (container && isCurrent) {
          // Only restore if current scroll position is significantly different
          // This prevents fighting with user scrolling
          const currentScroll = container.scrollTop
          if (Math.abs(currentScroll - savedScrollPosition) > 50) {
            container.scrollTop = savedScrollPosition
          }
        }
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [index, article.content, isCurrent, savedScrollPosition])

  return (
    <div
      ref={scrollContainerRef}
      className="h-full w-full rounded-lg border border-border bg-background p-6 shadow-lg overflow-y-auto"
      style={{ maxHeight: `${cardHeight}px` }}
    >
      {/* Article Separator */}
      {index > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">
            Article {index + 1}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Article Content - title is already included in the markdown */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <MarkdownRenderer>{article.content}</MarkdownRenderer>
      </div>
    </div>
  )
}

const SwipeableCardStack: FC<SwipeableCardStackProps> = ({
  articles,
  className,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  messageId,
}) => {
  // Get scroll context to scroll to helper text position after cards render
  const { scrollRef } = useStickToBottomContext()
  
  // Memoize articles to prevent unnecessary re-renders
  const stableArticles = useMemo(() => articles, [articles.map(a => a.id).join(',')])
  
  // Generate a stable key based on article IDs (not messageId)
  // This ensures the key is stable even if messageId changes
  const articleKey = useMemo(() => getArticleKey(stableArticles), [stableArticles.map(a => a.id).join(',')])
  
  // Initialize or get cached state from localStorage
  const cachedState = getStoredState(articleKey)
  const initialIndex = cachedState && cachedState.currentIndex >= 0 && cachedState.currentIndex < stableArticles.length
    ? cachedState.currentIndex
    : 0
  const initialScrollPosition = cachedState?.scrollPosition ?? 0
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scrollPosition, setScrollPosition] = useState(initialScrollPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const helperTextRef = useRef<HTMLDivElement>(null) // Ref for helper text below cards
  
  // Card height state with localStorage persistence
  const cachedHeight = getStoredCardHeight(articleKey)
  const initialHeight = cachedHeight?.height ?? 800 // Default 800px
  const [cardHeight, setCardHeight] = useState(initialHeight)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartYRef = useRef<number>(0)
  const resizeStartHeightRef = useRef<number>(800)
  
  // Track previous state to detect when articles are appended vs replaced
  const previousArticlesLengthRef = useRef<number>(stableArticles.length)
  const previousArticlesIdsRef = useRef<Set<string>>(new Set(stableArticles.map(a => a.id)))
  const currentIndexRef = useRef<number>(initialIndex) // Track currentIndex in ref for stable access
  const hasInitializedRef = useRef<boolean>(false) // Track if we've done initial restoration

  // Handle scroll position changes and save to localStorage (debounced)
  // Don't update state during scrolling - only save to localStorage when scrolling stops
  const scrollSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedScrollPositionRef = useRef<number>(0) // Track last saved position to avoid redundant saves
  const handleScrollChange = useMemo(() => {
    return (position: number) => {
      // Don't update state during scrolling to avoid re-renders
      // Only save to localStorage when scrolling stops (debounced)
      
      // Skip if position hasn't changed significantly from last save
      if (Math.abs(position - lastSavedScrollPositionRef.current) < 5) {
        return
      }
      
      // Clear any pending save
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current)
      }
      
      // Schedule a save after scroll stops (300ms delay - faster response, better UX)
      // Reduced from 1500ms to 300ms for more responsive scroll position saving
      scrollSaveTimeoutRef.current = setTimeout(() => {
        lastSavedScrollPositionRef.current = position
        setScrollPosition(position)
        setStoredState(articleKey, {
          currentIndex: currentIndexRef.current,
          scrollPosition: position
        })
        scrollSaveTimeoutRef.current = null
      }, 300) // Changed from 1500ms to 300ms
    }
  }, [articleKey])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current)
      }
    }
  }, [])

  const SWIPE_THRESHOLD = 50 // Minimum distance to trigger swipe

  // Sync ref with state and save to localStorage whenever currentIndex changes
  useEffect(() => {
    currentIndexRef.current = currentIndex
    // Save to localStorage whenever currentIndex changes (after initialization)
    if (hasInitializedRef.current && stableArticles.length > 0) {
      setStoredState(articleKey, {
        currentIndex,
        scrollPosition: scrollPosition
      })
    }
  }, [currentIndex, articleKey, stableArticles.length, scrollPosition])

  useEffect(() => {
    const currentIds = new Set(stableArticles.map(a => a.id))
    const previousIds = previousArticlesIdsRef.current
    const previousLength = previousArticlesLengthRef.current
    const currentLength = stableArticles.length
    
    // Initial restoration - only do this once when we first see articles
    if (!hasInitializedRef.current && currentLength > 0) {
      hasInitializedRef.current = true
      
      // Get cached state from localStorage (based on article key)
      const cachedState = getStoredState(articleKey)
      if (cachedState && cachedState.currentIndex >= 0 && cachedState.currentIndex < currentLength) {
        // Restore from cache
        if (currentIndex !== cachedState.currentIndex) {
          setCurrentIndex(cachedState.currentIndex)
        }
        if (scrollPosition !== cachedState.scrollPosition) {
          setScrollPosition(cachedState.scrollPosition)
        }
        currentIndexRef.current = cachedState.currentIndex
      } else {
        // No valid cache - ensure we start at 0
        if (currentIndex !== 0) {
          setCurrentIndex(0)
        }
        if (scrollPosition !== 0) {
          setScrollPosition(0)
        }
        currentIndexRef.current = 0
        setStoredState(articleKey, { currentIndex: 0, scrollPosition: 0 })
      }
      
      previousArticlesLengthRef.current = currentLength
      previousArticlesIdsRef.current = currentIds
      return
    }
    
    // Only proceed if length actually changed
    if (currentLength === previousLength) {
      // Length unchanged - don't modify currentIndex, just update refs
      previousArticlesIdsRef.current = currentIds
      // Ensure currentIndex is still valid (in case articles were replaced with same count)
      if (currentIndex >= currentLength && currentLength > 0) {
        const adjustedIndex = currentLength - 1
        setCurrentIndex(adjustedIndex)
        currentIndexRef.current = adjustedIndex
        setStoredState(articleKey, { currentIndex: adjustedIndex, scrollPosition })
      }
      return
    }
    
    // Check if articles were added (length increased)
    const articlesAdded = currentLength > previousLength
    
    if (articlesAdded) {
      // Check if previous articles are still present (appended) or all new (replaced)
      const previousArticlesStillPresent = previousIds.size > 0 && 
        Array.from(previousIds).some(id => currentIds.has(id))
      
      if (previousArticlesStillPresent) {
        // New articles were appended - preserve current view
        // Since articleKey is based on first article ID, it stays the same when articles are appended
        // So we can preserve the currentIndex from the ref (which was saved to localStorage)
        const preservedIndex = currentIndexRef.current
        
        // Ensure preserved index is valid (in case it's out of bounds)
        const validPreservedIndex = preservedIndex >= 0 && preservedIndex < currentLength
          ? preservedIndex
          : Math.max(0, Math.min(preservedIndex, currentLength - 1))
        
        // Only update if the state doesn't match the preserved index
        if (currentIndex !== validPreservedIndex) {
          setCurrentIndex(validPreservedIndex)
          currentIndexRef.current = validPreservedIndex
        }
        // Save the preserved index to localStorage (articleKey is the same, so it updates the same entry)
        setStoredState(articleKey, { currentIndex: validPreservedIndex, scrollPosition })
        // Don't reset offsetX - keep any drag state
      } else {
        // Articles were replaced (not appended) - reset to first
        setCurrentIndex(0)
        setScrollPosition(0)
        setOffsetX(0)
      }
    } else if (currentLength < previousLength) {
      // Articles were removed - adjust index if out of bounds
      setCurrentIndex(prevIndex => {
        if (prevIndex >= currentLength && currentLength > 0) {
          return currentLength - 1
        }
        return prevIndex
      })
    }
    
    // Ensure currentIndex is within bounds before updating
    if (currentIndex >= currentLength && currentLength > 0) {
      const adjustedIndex = currentLength - 1
      setCurrentIndex(adjustedIndex)
      currentIndexRef.current = adjustedIndex
    }
    
    // Update refs
    previousArticlesLengthRef.current = currentLength
    previousArticlesIdsRef.current = currentIds
    
    // Save currentIndex and scrollPosition to localStorage
    setStoredState(articleKey, { currentIndex: currentIndexRef.current, scrollPosition })
  }, [stableArticles.length, stableArticles.map(a => a.id).join(','), articleKey])
  
  // Scroll to helper text (below cards) after cards finish rendering to show metadata
  // Track previous article count to only scroll when articles are added/changed
  const previousArticleCountRef = useRef<number>(0)
  useEffect(() => {
    const currentCount = stableArticles.length
    const previousCount = previousArticleCountRef.current
    
    // Only scroll if articles exist and count changed (new articles added or articles changed)
    if (currentCount > 0 && (currentCount !== previousCount || previousCount === 0)) {
      // Wait for cards and helper text to fully render, then scroll to helper text
      // This positions the view so metadata (which is rendered below cards) is visible
      const scrollTimeout = setTimeout(() => {
        const scrollContainer = scrollRef?.current
        const helperElement = helperTextRef.current
        
        if (scrollContainer && helperElement) {
          // Calculate the position of the helper text relative to the scroll container
          const containerRect = scrollContainer.getBoundingClientRect()
          const elementRect = helperElement.getBoundingClientRect()
          
          // Calculate scroll position to show helper text at the bottom of viewport
          // This ensures metadata below it is visible
          const scrollTop = scrollContainer.scrollTop + (elementRect.top - containerRect.top) + (elementRect.height / 2)
          
          scrollContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          })
        } else if (helperElement) {
          // Fallback: use scrollIntoView if scrollRef not available
          helperElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end',
            inline: 'nearest'
          })
        }
      }, 800) // Increased delay to ensure cards and helper text are fully rendered
      
      previousArticleCountRef.current = currentCount
      
      return () => {
        clearTimeout(scrollTimeout)
      }
    } else {
      previousArticleCountRef.current = currentCount
    }
  }, [stableArticles.length, stableArticles.map(a => a.id).join(','), scrollRef])
  
  // Mark when user manually navigates
  const handleUserNavigation = (newIndex: number) => {
    setCurrentIndex(newIndex)
    setScrollPosition(0) // Reset scroll when navigating to a different card
    setOffsetX(0)
    // Immediately update localStorage when user navigates
    setStoredState(articleKey, { currentIndex: newIndex, scrollPosition: 0 })
  }

  const goToPrevious = () => {
    if (stableArticles.length <= 1) return
    
    // Circular navigation: if at first card, go to last card
    const newIndex = currentIndex > 0 
      ? currentIndex - 1 
      : stableArticles.length - 1
    handleUserNavigation(newIndex)
  }

  const goToNext = () => {
    if (stableArticles.length <= 1) return
    
    // Circular navigation: if at last card, go to first card
    const newIndex = currentIndex < stableArticles.length - 1
      ? currentIndex + 1
      : 0
    handleUserNavigation(newIndex)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return

    const currentX = e.touches[0].clientX
    const diff = currentX - startX
    setOffsetX(diff)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return

    setIsDragging(false)

    // Determine swipe direction (circular navigation)
    if (Math.abs(offsetX) > SWIPE_THRESHOLD && stableArticles.length > 1) {
      if (offsetX > 0) {
        // Swipe right - go to previous (or last if at first)
        const newIndex = currentIndex > 0 
          ? currentIndex - 1 
          : stableArticles.length - 1
        handleUserNavigation(newIndex)
      } else if (offsetX < 0) {
        // Swipe left - go to next (or first if at last)
        const newIndex = currentIndex < stableArticles.length - 1
          ? currentIndex + 1
          : 0
        handleUserNavigation(newIndex)
      }
    }

    setOffsetX(0)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    const currentX = e.clientX
    const diff = currentX - startX
    setOffsetX(diff)
  }

  const handleMouseUp = () => {
    if (!isDragging) return

    setIsDragging(false)

    // Determine swipe direction (circular navigation)
    if (Math.abs(offsetX) > SWIPE_THRESHOLD && stableArticles.length > 1) {
      if (offsetX > 0) {
        // Swipe right - go to previous (or last if at first)
        const newIndex = currentIndex > 0 
          ? currentIndex - 1 
          : stableArticles.length - 1
        handleUserNavigation(newIndex)
      } else if (offsetX < 0) {
        // Swipe left - go to next (or first if at last)
        const newIndex = currentIndex < stableArticles.length - 1
          ? currentIndex + 1
          : 0
        handleUserNavigation(newIndex)
      }
    }

    setOffsetX(0)
  }

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false)
      setOffsetX(0)
    }
  }

  // Ensure currentIndex is always within bounds
  useEffect(() => {
    if (stableArticles.length > 0 && (currentIndex < 0 || currentIndex >= stableArticles.length)) {
      const safeIndex = Math.max(0, Math.min(currentIndex, stableArticles.length - 1))
      setCurrentIndex(safeIndex)
      currentIndexRef.current = safeIndex
    }
  }, [currentIndex, stableArticles.length])

  // Save card height to localStorage when it changes
  useEffect(() => {
    setStoredCardHeight(articleKey, { height: cardHeight })
  }, [cardHeight, articleKey])

  // Handle resize mouse events
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStartYRef.current = e.clientY
    resizeStartHeightRef.current = cardHeight
  }, [cardHeight])

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const deltaY = e.clientY - resizeStartYRef.current
    const newHeight = Math.max(400, Math.min(1200, resizeStartHeightRef.current + deltaY))
    setCardHeight(newHeight)
  }, [isResizing])

  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  // Handle resize touch events
  const handleResizeTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStartYRef.current = e.touches[0].clientY
    resizeStartHeightRef.current = cardHeight
  }, [cardHeight])

  const handleResizeTouchMove = useCallback((e: TouchEvent) => {
    if (!isResizing) return
    
    const deltaY = e.touches[0].clientY - resizeStartYRef.current
    const newHeight = Math.max(400, Math.min(1200, resizeStartHeightRef.current + deltaY))
    setCardHeight(newHeight)
  }, [isResizing])

  const handleResizeTouchEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  // Add global event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove)
      document.addEventListener('mouseup', handleResizeMouseUp)
      document.addEventListener('touchmove', handleResizeTouchMove, { passive: false })
      document.addEventListener('touchend', handleResizeTouchEnd)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleResizeMouseMove)
      document.removeEventListener('mouseup', handleResizeMouseUp)
      document.removeEventListener('touchmove', handleResizeTouchMove)
      document.removeEventListener('touchend', handleResizeTouchEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMouseMove)
      document.removeEventListener('mouseup', handleResizeMouseUp)
      document.removeEventListener('touchmove', handleResizeTouchMove)
      document.removeEventListener('touchend', handleResizeTouchEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp, handleResizeTouchMove, handleResizeTouchEnd])

  if (stableArticles.length === 0) {
    console.warn('SwipeableCardStack: No articles provided')
    return null
  }

  // Ensure currentIndex is within bounds for rendering
  const safeCurrentIndex = currentIndex >= 0 && currentIndex < stableArticles.length
    ? currentIndex
    : Math.max(0, Math.min(currentIndex, stableArticles.length - 1))

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentArticle = stableArticles[safeCurrentIndex]

  return (
    <div className={cn('relative w-full my-4', className)}>
      {/* Card Container with Side Navigation Arrows */}
      <div className="relative flex items-center gap-2">
        {/* Left Arrow - positioned on left side of card */}
        {stableArticles.length > 1 && (
          <button
            onClick={goToPrevious}
            className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background transition-all hover:bg-accent hover:scale-110 shadow-md z-10"
            aria-label="Previous article"
          >
            <span className="text-xl">←</span>
          </button>
        )}

        {/* Card Stack Container */}
        <div 
          className="relative flex-1"
          style={{ 
            minHeight: '400px',
            height: `${cardHeight}px`,
            maxHeight: '1200px'
          }}
        >
          {/* Stack of cards with current card on top */}
          {stableArticles.map((article, index) => {
            const isCurrent = index === safeCurrentIndex
            
            // Calculate next and previous with circular navigation
            const nextIndex = safeCurrentIndex === stableArticles.length - 1 ? 0 : safeCurrentIndex + 1
            const prevIndex = safeCurrentIndex === 0 ? stableArticles.length - 1 : safeCurrentIndex - 1
            const isNext = index === nextIndex
            const isPrevious = index === prevIndex

            // Calculate z-index and positioning
            // For circular navigation, calculate distance considering wrap-around
            const distance = Math.abs(index - safeCurrentIndex)
            const wrapDistance = Math.min(distance, stableArticles.length - distance)
            const zIndex = stableArticles.length - wrapDistance
            
            let translateX = 0
            let translateY = 0
            let scale = 1
            let opacity = 1

            if (isCurrent) {
              // Current card - can be dragged
              translateX = offsetX
              scale = 1
              opacity = 1
            } else if (isNext) {
              // Next card - slightly behind and to the right
              translateX = 20
              translateY = -10
              scale = 0.95
              opacity = 0.7
            } else if (isPrevious) {
              // Previous card - slightly behind and to the left
              translateX = -20
              translateY = -10
              scale = 0.95
              opacity = 0.7
            } else {
              // Other cards - hidden
              opacity = 0
              scale = 0.9
            }

            return (
              <div
                key={article.id}
                ref={isCurrent ? cardRef : null}
                className={cn(
                  'absolute inset-0 transition-all duration-500 ease-in-out',
                  isCurrent && 'cursor-grab active:cursor-grabbing'
                )}
                style={{
                  zIndex,
                  transform: `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`,
                  opacity,
                  pointerEvents: isCurrent ? 'auto' : 'none',
                }}
                onTouchStart={isCurrent ? handleTouchStart : undefined}
                onTouchMove={isCurrent ? handleTouchMove : undefined}
                onTouchEnd={isCurrent ? handleTouchEnd : undefined}
                onMouseDown={isCurrent ? handleMouseDown : undefined}
                onMouseMove={isCurrent ? handleMouseMove : undefined}
                onMouseUp={isCurrent ? handleMouseUp : undefined}
                onMouseLeave={isCurrent ? handleMouseLeave : undefined}
              >
                <CardContent
                  article={article}
                  index={index}
                  isCurrent={isCurrent}
                  savedScrollPosition={index === safeCurrentIndex ? scrollPosition : 0}
                  onScrollChange={handleScrollChange}
                  cardHeight={cardHeight}
                />
              </div>
            )
          })}
        </div>

        {/* Right Arrow - positioned on right side of card */}
        {stableArticles.length > 1 && (
          <button
            onClick={goToNext}
            className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background transition-all hover:bg-accent hover:scale-110 shadow-md z-10"
            aria-label="Next article"
          >
            <span className="text-xl">→</span>
          </button>
        )}
      </div>

      {/* Resize Handle - positioned below card container */}
      <div className="relative w-full flex justify-center -mt-3 mb-1">
        <div
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-border bg-background cursor-ns-resize",
            "hover:bg-accent hover:border-primary transition-all shadow-md z-50",
            isResizing && "bg-accent border-primary shadow-lg"
          )}
          onMouseDown={handleResizeMouseDown}
          onTouchStart={handleResizeTouchStart}
          title="Drag to resize card height"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Resize</span>
        </div>
      </div>

      {/* Navigation Slider (Dots) - at the bottom */}
      {stableArticles.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {stableArticles.map((article, index) => (
            <button
              key={article.id}
              onClick={() => {
                handleUserNavigation(index)
              }}
              className={cn(
                'h-2 rounded-full transition-all',
                index === safeCurrentIndex
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-muted-foreground/50 hover:bg-muted-foreground'
              )}
              aria-label={`Go to article ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Article Counter */}
      {stableArticles.length > 1 && (
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {safeCurrentIndex + 1} of {stableArticles.length}
        </div>
      )}

      {/* Swipe Hints - ref used to scroll to this position to show metadata below */}
      {stableArticles.length > 1 && (
        <div 
          ref={helperTextRef}
          className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground"
        >
          {safeCurrentIndex > 0 && (
            <span className="flex items-center gap-1">
              <span>←</span> Swipe right or click arrow for previous
            </span>
          )}
          {safeCurrentIndex < stableArticles.length - 1 && (
            <span className="flex items-center gap-1">
              Swipe left or click arrow for next <span>→</span>
            </span>
          )}
        </div>
      )}
      {/* If only one article, still add ref for scrolling */}
      {stableArticles.length === 1 && (
        <div ref={helperTextRef} className="mt-4" />
      )}
    </div>
  )
}

export default SwipeableCardStack


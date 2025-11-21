'use client'

import { FC, useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import MarkdownRenderer from '@/components/ui/typography/MarkdownRenderer'
import type { Article } from '@/utils/articleParser'

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

interface CardStackState {
  currentIndex: number  // The index of the currently displayed card (0-based)
  scrollPosition: number  // The scroll position of the current card
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
  } catch (e) {
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
  } catch (e) {
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
}

const CardContent: FC<CardContentProps> = ({ article, index, isCurrent, savedScrollPosition, onScrollChange }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Save scroll position when scrolling (only for current card)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !isCurrent) return

    const handleScroll = () => {
      const position = container.scrollTop
      // Notify parent to save to localStorage (only for current card)
      onScrollChange(position)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [isCurrent, onScrollChange])

  // Restore scroll position when content updates (only for current card)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !isCurrent) return

    if (savedScrollPosition > 0) {
      // Use a small delay to ensure DOM is fully updated after content change
      const timeoutId = setTimeout(() => {
        if (container) {
          container.scrollTop = savedScrollPosition
        }
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [index, article.content, isCurrent, savedScrollPosition])

  return (
    <div
      ref={scrollContainerRef}
      className="h-full w-full rounded-lg border border-border bg-background p-6 shadow-lg overflow-y-auto max-h-[800px]"
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
  messageId,
}) => {
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
  
  // Track previous state to detect when articles are appended vs replaced
  const previousArticlesLengthRef = useRef<number>(stableArticles.length)
  const previousArticlesIdsRef = useRef<Set<string>>(new Set(stableArticles.map(a => a.id)))
  const currentIndexRef = useRef<number>(initialIndex) // Track currentIndex in ref for stable access
  const hasInitializedRef = useRef<boolean>(false) // Track if we've done initial restoration

  // Handle scroll position changes and save to localStorage
  const handleScrollChange = useMemo(() => {
    return (position: number) => {
      setScrollPosition(position)
      // Save to localStorage alongside currentIndex
      setStoredState(articleKey, {
        currentIndex: currentIndexRef.current,
        scrollPosition: position
      })
    }
  }, [articleKey])

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
  
  // Mark when user manually navigates
  const handleUserNavigation = (newIndex: number) => {
    setCurrentIndex(newIndex)
    setScrollPosition(0) // Reset scroll when navigating to a different card
    setOffsetX(0)
    // Immediately update localStorage when user navigates
    setStoredState(articleKey, { currentIndex: newIndex, scrollPosition: 0 })
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      handleUserNavigation(currentIndex - 1)
    }
  }

  const goToNext = () => {
    if (currentIndex < stableArticles.length - 1) {
      handleUserNavigation(currentIndex + 1)
    }
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

    // Determine swipe direction
    if (Math.abs(offsetX) > SWIPE_THRESHOLD) {
      if (offsetX > 0 && currentIndex > 0) {
        // Swipe right - go to previous
        handleUserNavigation(currentIndex - 1)
      } else if (offsetX < 0 && currentIndex < stableArticles.length - 1) {
        // Swipe left - go to next
        handleUserNavigation(currentIndex + 1)
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

    // Determine swipe direction
    if (Math.abs(offsetX) > SWIPE_THRESHOLD) {
      if (offsetX > 0 && currentIndex > 0) {
        // Swipe right - go to previous
        handleUserNavigation(currentIndex - 1)
      } else if (offsetX < 0 && currentIndex < stableArticles.length - 1) {
        // Swipe left - go to next
        handleUserNavigation(currentIndex + 1)
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

  if (stableArticles.length === 0) {
    console.warn('SwipeableCardStack: No articles provided')
    return null
  }

  // Ensure currentIndex is within bounds for rendering
  const safeCurrentIndex = currentIndex >= 0 && currentIndex < stableArticles.length
    ? currentIndex
    : Math.max(0, Math.min(currentIndex, stableArticles.length - 1))

  const currentArticle = stableArticles[safeCurrentIndex]

  return (
    <div className={cn('relative w-full my-4', className)}>
      {/* Card Stack Container */}
      <div className="relative w-full min-h-[400px] max-h-[800px]">
        {/* Stack of cards with current card on top */}
        {stableArticles.map((article, index) => {
          const isCurrent = index === safeCurrentIndex
          const isNext = index === safeCurrentIndex + 1
          const isPrevious = index === safeCurrentIndex - 1

          // Calculate z-index and positioning
          let zIndex = stableArticles.length - Math.abs(index - safeCurrentIndex)
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
                'absolute inset-0 transition-all duration-300 ease-out',
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
              />
            </div>
          )
        })}
      </div>

      {/* Navigation Controls */}
      {stableArticles.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          {/* Left Arrow Button */}
          <button
            onClick={goToPrevious}
            disabled={safeCurrentIndex === 0}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-all hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed',
              safeCurrentIndex === 0 && 'opacity-30'
            )}
            aria-label="Previous article"
          >
            <span className="text-lg">←</span>
          </button>

          {/* Navigation Dots */}
          <div className="flex justify-center gap-2">
            {stableArticles.map((article, index) => (
              <button
                key={article.id}
                onClick={() => {
                  handleUserNavigation(index)
                }}
                className={cn(
                  'h-2 w-2 rounded-full transition-all',
                  index === safeCurrentIndex
                    ? 'w-8 bg-primary'
                    : 'bg-muted-foreground/50 hover:bg-muted-foreground'
                )}
                aria-label={`Go to article ${index + 1}`}
              />
            ))}
          </div>

          {/* Right Arrow Button */}
          <button
            onClick={goToNext}
            disabled={safeCurrentIndex === stableArticles.length - 1}
              className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-all hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed',
              safeCurrentIndex === stableArticles.length - 1 && 'opacity-30'
            )}
            aria-label="Next article"
          >
            <span className="text-lg">→</span>
          </button>
        </div>
      )}

      {/* Article Counter */}
      {stableArticles.length > 1 && (
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {safeCurrentIndex + 1} of {stableArticles.length}
        </div>
      )}

      {/* Swipe Hints */}
      {stableArticles.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
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
    </div>
  )
}

export default SwipeableCardStack


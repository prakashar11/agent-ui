'use client'

import type React from 'react'
import { useState, useEffect, useRef } from 'react'

import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'

const ScrollToTop: React.FC = () => {
  const [isAtTop, setIsAtTop] = useState(true)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Find the scrollable container - it's the StickToBottom wrapper with max-h class
    const findScrollableContainer = (): HTMLElement | null => {
      // The StickToBottom component creates a scrollable container
      // Look for the element with max-h-[calc(100vh-64px)] which is the MessageArea container
      const elements = document.querySelectorAll('[class*="max-h"]')
      for (const el of Array.from(elements)) {
        const styles = window.getComputedStyle(el)
        if (
          (styles.overflowY === 'auto' || styles.overflowY === 'scroll' || styles.overflow === 'auto') &&
          el.scrollHeight > el.clientHeight
        ) {
          // This is likely our scrollable container
          return el as HTMLElement
        }
      }
      return null
    }

    const setupScrollListener = (container: HTMLElement) => {
      const handleScroll = () => {
        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }

        // Debounce scroll check
        scrollTimeoutRef.current = setTimeout(() => {
          const scrollTop = container.scrollTop
          // Consider at top if within 10px of the top
          setIsAtTop(scrollTop <= 10)
        }, 50)
      }

      // Initial check
      handleScroll()

      container.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        container.removeEventListener('scroll', handleScroll)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
      }
    }

    // Try to find container, with retry logic in case DOM isn't ready
    let container = findScrollableContainer()
    let cleanup: (() => void) | undefined

    if (!container) {
      // Retry after a short delay
      const timeout = setTimeout(() => {
        container = findScrollableContainer()
        containerRef.current = container
        if (container) {
          cleanup = setupScrollListener(container)
        }
      }, 100)
      return () => {
        clearTimeout(timeout)
        cleanup?.()
      }
    }
    
    containerRef.current = container
    cleanup = setupScrollListener(container)

    return () => {
      cleanup?.()
    }
  }, [])

  const scrollToTop = () => {
    const container = containerRef.current
    if (container) {
      container.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    } else {
      // Fallback: scroll window to top
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }

  return (
    <AnimatePresence>
      {!isAtTop && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
        >
          <Button
            onClick={scrollToTop}
            type="button"
            size="icon"
            variant="secondary"
            className="border border-border bg-background text-primary shadow-md transition-shadow duration-300 hover:bg-background-secondary"
          >
            <Icon type="arrow-up" size="xs" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ScrollToTop


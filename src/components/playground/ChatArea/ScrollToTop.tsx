'use client'

import type React from 'react'
import { useState, useEffect } from 'react'

import { motion, AnimatePresence } from 'framer-motion'
import { useStickToBottomContext } from 'use-stick-to-bottom'

import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'

const ScrollToTop: React.FC = () => {
  const { scrollRef } = useStickToBottomContext()
  const [isAtTop, setIsAtTop] = useState(true)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    const checkScrollPosition = () => {
      const scrollTop = container.scrollTop || 0
      // Consider at top if within 10px of the top
      setIsAtTop(scrollTop <= 10)
    }

    // Initial check
    checkScrollPosition()

    // Listen to scroll events
    container.addEventListener('scroll', checkScrollPosition, { passive: true })

    return () => {
      container.removeEventListener('scroll', checkScrollPosition)
    }
  }, [scrollRef])

  const scrollToTop = () => {
    const container = scrollRef.current
    if (container) {
      container.scrollTo({
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

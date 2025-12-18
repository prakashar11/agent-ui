'use client'

import { FC, useEffect, useRef, useState, useId } from 'react'
import mermaid from 'mermaid'

// Initialize mermaid with configuration
let mermaidInitialized = false

const initializeMermaid = () => {
  if (mermaidInitialized) return
  
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis'
    },
    sequence: {
      useMaxWidth: true,
      wrap: true
    },
    gantt: {
      useMaxWidth: true
    }
  })
  
  mermaidInitialized = true
}

interface MermaidRendererProps {
  code: string
}

const MermaidRenderer: FC<MermaidRendererProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const uniqueId = useId().replace(/:/g, '-')

  useEffect(() => {
    const renderDiagram = async () => {
      // Only check for code - containerRef is not needed for rendering
      if (!code) {
        setIsLoading(false)
        setError('No diagram code provided')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        initializeMermaid()
        
        // Clean up the code - remove any leading/trailing whitespace
        let cleanCode = code.toString().trim()
        
        // Sanitize common issues in LLM-generated mermaid:
        // 1. Remove markdown links from node labels: [text](url) -> text
        cleanCode = cleanCode.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        
        // 2. Escape problematic characters in labels
        // Replace any remaining URLs that might break parsing
        cleanCode = cleanCode.replace(/(https?:\/\/[^\s\])"]+)/g, (url) => {
          // Shorten URLs to just domain for display
          try {
            const domain = new URL(url).hostname
            return domain
          } catch {
            return 'link'
          }
        })
        
        // 3. Quote node labels that contain special characters (hyphens, dots, etc.)
        // Fix labels like CVE((CVE-2025-14174)) -> CVE(("CVE-2025-14174"))
        // Match node definitions with special chars that aren't already quoted
        cleanCode = cleanCode.replace(
          /(\w+)\(\(([^"'][^)]*-[^)]*)\)\)/g,
          '$1(("$2"))'
        )
        
        // 4. Fix labels like NODE[Label with-hyphen] -> NODE["Label with-hyphen"]
        cleanCode = cleanCode.replace(
          /(\w+)\[([^"\[\]]*-[^"\[\]]*)\]/g,
          (match, node, label) => {
            // Don't double-quote if already quoted
            if (label.startsWith('"') || label.startsWith("'")) return match
            return `${node}["${label}"]`
          }
        )
        
        // Skip pre-validation - mermaid.parse() behaves differently across versions
        // Just try to render directly and catch any errors
        
        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${uniqueId}`,
          cleanCode
        )
        
        setSvg(renderedSvg)
      } catch (err) {
        console.error('Mermaid rendering error:', err)
        // Try a more aggressive cleanup and retry
        try {
          let fallbackCode = code.toString().trim()
          // Remove all markdown link syntax
          fallbackCode = fallbackCode.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          // Remove URLs entirely
          fallbackCode = fallbackCode.replace(/https?:\/\/[^\s\])"<>]+/g, '')
          // Remove empty brackets
          fallbackCode = fallbackCode.replace(/\[\s*\]/g, '')
          
          const { svg: fallbackSvg } = await mermaid.render(
            `mermaid-fallback-${uniqueId}`,
            fallbackCode
          )
          setSvg(fallbackSvg)
        } catch {
          // Fallback also failed, use original error
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
        }
      } finally {
        setIsLoading(false)
      }
    }

    renderDiagram()
  }, [code, uniqueId])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-background-secondary/50 p-8 border border-border/50">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Rendering diagram...</span>
        </div>
      </div>
    )
  }

  // Error state - show the code as fallback
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 overflow-hidden">
        <div className="px-3 py-2 bg-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Mermaid Diagram Error: {error}</span>
        </div>
        <pre className="p-4 text-sm font-mono overflow-x-auto whitespace-pre text-muted-foreground">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  // Success - render the SVG
  return (
    <div
      ref={containerRef}
      className="mermaid-container overflow-x-auto rounded-lg bg-background-secondary/30 p-4 border border-border/50"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default MermaidRenderer


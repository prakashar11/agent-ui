'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APIRoutes } from '@/api/routes'
import { toast } from 'sonner'
import { Shield, Send, Loader2, ArrowRight } from 'lucide-react'
import MarkdownRenderer from '@/components/ui/typography/MarkdownRenderer'

interface SecOpsCarouselProps {
  isOpen: boolean
  onClose: () => void
  endpoint: string
}

export const SecOpsCarousel: React.FC<SecOpsCarouselProps> = ({
  isOpen,
  onClose,
  endpoint,
}) => {
  const [request, setRequest] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = request.trim()
    if (!trimmed) {
      toast.error('Enter a SecOps request', { duration: 3000 })
      return
    }
    if (!endpoint) {
      toast.error('No API endpoint configured', { duration: 3000 })
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const response = await fetch(APIRoutes.SecOpsRequest(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: trimmed }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = data.detail ?? (typeof data.detail === 'string' ? data.detail : 'Request failed')
        setResult(`**Error**\n\n${message}`)
        toast.error('SecOps request failed', { duration: 3000 })
        return
      }

      if (data.success && data.result != null) {
        setResult(data.result)
        toast.success('Request completed', { duration: 2000 })
      } else {
        setResult(data.error ? `**Error**\n\n${data.error}` : 'No result returned.')
        if (data.error) toast.error('SecOps request failed', { duration: 3000 })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network or server error'
      setResult(`**Error**\n\n${message}`)
      toast.error('Unable to reach server', { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setRequest('')
    setResult(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              SecOps tools harness
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Invoke SecOps APIs with your input. Threat intel, Sigma rules, log search, skills, asset graph. Pass your request in natural language; the harness runs the right tools.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label htmlFor="secops-request" className="block text-sm font-medium text-foreground mb-2">
                Request
              </label>
              <textarea
                id="secops-request"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="e.g. List Sigma rules for T1566 phishing, or search threat intel for domain example.com"
                className={cn(
                  'w-full min-h-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary'
                )}
                disabled={loading}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !request.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Run request
            </Button>

            {result != null && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Result
                </h3>
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm prose prose-invert max-w-none dark:prose-invert">
                  <MarkdownRenderer>{result}</MarkdownRenderer>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

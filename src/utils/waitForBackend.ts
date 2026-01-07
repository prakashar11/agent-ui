/**
 * Backend Readiness Utilities
 * 
 * Provides functions to wait for the backend server to be fully initialized
 * before making API calls. This prevents errors when the frontend starts
 * before the backend workers are ready.
 */

import { APIRoutes } from '@/api/routes'

// =============================================================================
// CONFIGURATION - UPDATE FOR PRODUCTION
// =============================================================================
// 
// DEV: Long timeout (24 hours) for development where backend may start slowly
// PRODUCTION: Reduce to 30-60 retries (30-60 seconds) for faster failure detection
//
// TODO: In production, change these values:
//   - DEFAULT_MAX_RETRIES: 30-60 (fail fast if backend is down)
//   - DEFAULT_DELAY_MS: 1000-2000 (balance between responsiveness and load)
// =============================================================================

/** Default max retries - 24 hours for dev (86400 retries * 1s = 86400s = 24h) */
const DEFAULT_MAX_RETRIES = 86400  // TODO: PRODUCTION - change to 60

/** Default delay between retries in milliseconds */
const DEFAULT_DELAY_MS = 1000  // TODO: PRODUCTION - keep at 1000 or increase to 2000

export interface BackendReadyResponse {
  status: 'ready' | 'starting'
  ready_since?: number
  uptime_seconds?: number
  agents_loaded?: number
  timestamp: number
  message?: string
}

export interface WaitForBackendOptions {
  /** Maximum number of retry attempts (default: 86400 for dev, reduce for production) */
  maxRetries?: number
  /** Delay between retries in milliseconds (default: 1000) */
  delayMs?: number
  /** Callback for progress updates */
  onProgress?: (attempt: number, maxRetries: number, status?: string) => void
  /** Callback when backend becomes ready */
  onReady?: (response: BackendReadyResponse) => void
  /** Callback on error (non-fatal, will retry) */
  onRetry?: (error: Error, attempt: number) => void
}

/**
 * Wait for the backend server to be fully ready.
 * 
 * Polls the /ready endpoint until it returns 200, indicating all workers
 * are initialized and the server is ready to handle requests.
 * 
 * NOTE: Default timeout is 24 hours for development. For production,
 * update DEFAULT_MAX_RETRIES at the top of this file to 30-60.
 * 
 * @param endpoint - Backend URL (e.g., 'http://localhost:7777')
 * @param options - Configuration options
 * @returns Promise that resolves to the ready response, or rejects after max retries
 * 
 * @example
 * ```typescript
 * // Basic usage (waits up to 24 hours in dev)
 * await waitForBackend('http://localhost:7777')
 * 
 * // Production usage (fail fast)
 * await waitForBackend('http://localhost:7777', {
 *   maxRetries: 60,  // 60 seconds
 *   delayMs: 1000,
 *   onProgress: (attempt, max) => console.log(`Waiting... ${attempt}/${max}`),
 *   onReady: (response) => console.log('Backend ready!', response),
 * })
 * ```
 */
export async function waitForBackend(
  endpoint: string,
  options: WaitForBackendOptions = {}
): Promise<BackendReadyResponse> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    delayMs = DEFAULT_DELAY_MS,
    onProgress,
    onReady,
    onRetry,
  } = options

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(APIRoutes.Ready(endpoint))
      
      if (response.ok) {
        const data: BackendReadyResponse = await response.json()
        if (data.status === 'ready') {
          onReady?.(data)
          return data
        }
      }
      
      // 503 = still starting, keep polling
      if (response.status === 503) {
        const data = await response.json().catch(() => ({}))
        onProgress?.(attempt, maxRetries, data.message || 'Server starting...')
      } else {
        onProgress?.(attempt, maxRetries, `Unexpected status: ${response.status}`)
      }
    } catch (error) {
      // Network error - server might not be running yet
      const err = error instanceof Error ? error : new Error(String(error))
      onRetry?.(err, attempt)
      onProgress?.(attempt, maxRetries, 'Connecting...')
    }

    // Wait before next attempt
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw new Error(`Backend not ready after ${maxRetries} attempts (${(maxRetries * delayMs) / 1000}s)`)
}

/**
 * Check if the backend is currently ready (single check, no retry).
 * 
 * @param endpoint - Backend URL
 * @returns Promise that resolves to true if ready, false otherwise
 */
export async function isBackendReady(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(APIRoutes.Ready(endpoint))
    if (response.ok) {
      const data: BackendReadyResponse = await response.json()
      return data.status === 'ready'
    }
    return false
  } catch {
    return false
  }
}

/**
 * Get detailed backend status.
 * 
 * @param endpoint - Backend URL
 * @returns Promise with server status details
 */
export async function getBackendStatus(endpoint: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(APIRoutes.ServerStatus(endpoint))
    if (response.ok) {
      return await response.json()
    }
    return null
  } catch {
    return null
  }
}

/**
 * React hook-friendly version that can be used with useEffect.
 * Returns a cleanup function to abort waiting.
 * 
 * @example
 * ```typescript
 * useEffect(() => {
 *   const cleanup = waitForBackendWithCleanup(
 *     endpoint,
 *     { onReady: () => setIsReady(true) }
 *   )
 *   return cleanup
 * }, [endpoint])
 * ```
 */
export function waitForBackendWithCleanup(
  endpoint: string,
  options: WaitForBackendOptions & {
    onError?: (error: Error) => void
  } = {}
): () => void {
  let cancelled = false

  const { onError, ...waitOptions } = options

  ;(async () => {
    try {
      await waitForBackend(endpoint, {
        ...waitOptions,
        onProgress: (attempt, max, status) => {
          if (cancelled) return
          waitOptions.onProgress?.(attempt, max, status)
        },
      })
    } catch (error) {
      if (!cancelled) {
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }
  })()

  return () => {
    cancelled = true
  }
}


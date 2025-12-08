/**
 * Utility to parse articles from markdown content.
 * Uses explicit markers (CARD_CONTENT_START, CARD_CONTENT_STOP, ARTICLE_SEPARATOR)
 * for robust article detection and separation, avoiding brittle Markdown pattern matching.
 */

export interface Article {
  id: string
  content: string
  title?: string
}

export interface ParsedContent {
  articles: Article[]
  nonArticleContent: string  // Deprecated: use nonArticlePrefix and nonArticleSuffix instead
  nonArticlePrefix?: string  // Content before CARD_CONTENT_START (e.g., collapsible status)
  nonArticleSuffix?: string  // Content after CARD_CONTENT_STOP (e.g., metadata)
  agentStatusContent?: string
}

const ARTICLE_SEPARATOR = '---ARTICLE_SEPARATOR---'
const CARD_CONTENT_START = '---CARD_CONTENT_START---'
const CARD_CONTENT_STOP = '---CARD_CONTENT_STOP---'

/**
 * Detects if content contains article summaries that should be displayed as cards.
 * Uses explicit markers for robust detection, avoiding brittle Markdown pattern matching.
 */
export function containsArticles(content: string): boolean {
  // Most reliable: check for explicit separator
  if (content.includes(ARTICLE_SEPARATOR)) {
    return true
  }

  // Check for CARD_CONTENT_START marker - content between START and STOP is article content
  if (content.includes(CARD_CONTENT_START)) {
    return true
  }

  // Legacy support: check for legacy patterns (for backward compatibility with old content)
  // This is a fallback only for content that doesn't use explicit markers
  const legacyPatterns = [
    /^#\s+Summary\s+\d+/m, // # Summary 1, # Summary 2, etc.
    /^##\s+Article\s+\d+/m, // ## Article 1, ## Article 2, etc.
    /^##\s+Summary\s+\d+/m, // ## Summary 1
  ]

  return legacyPatterns.some(pattern => pattern.test(content))
}

/**
 * Extracts agent status section from content (any <details> section)
 * ROBUST: Detects any <details> section, not just "Agent Status"
 * This allows agents to use any summary text without breaking rendering
 */
function extractAgentStatus(content: string): { statusContent: string; remainingContent: string } {
  // Match any <details> section (robust - not dependent on specific text)
  // Pattern handles newlines and whitespace variations
  // This will match the first <details> section found
  const statusPattern = /<details[^>]*>[\s\S]*?<\/details>/i
  const match = content.match(statusPattern)
  
  if (match) {
    const statusContent = match[0]
    // Return both the status content and the full content
    // The status will naturally be in nonArticlePrefix if it's before CARD_CONTENT_START
    // We extract it separately for agentStatusContent rendering, but don't remove it
    return { statusContent, remainingContent: content }
  }
  
  return { statusContent: '', remainingContent: content }
}

/**
 * Splits markdown content into individual articles.
 * Uses explicit markers (CARD_CONTENT_START, CARD_CONTENT_STOP, ARTICLE_SEPARATOR)
 * for robust parsing, avoiding brittle Markdown structure pattern matching.
 */
export function parseArticles(content: string): ParsedContent {
  // Extract agent status section if present (for separate rendering if needed)
  // ROBUST: Status section is kept in content so it naturally appears in nonArticlePrefix
  // if it's before CARD_CONTENT_START
  const { statusContent } = extractAgentStatus(content)
  
  const result: ParsedContent = {
    articles: [],
    nonArticleContent: '',
    agentStatusContent: statusContent || undefined
  }
  // Use full content (status section is kept in content for natural placement)
  let contentToParse = content
  
  // Check for CARD_CONTENT_START and CARD_CONTENT_STOP markers
  // Everything before START is non-article content
  // Everything between START and STOP is card content (articles)
  // Everything after STOP is non-article content
  let nonArticlePrefix = ''
  let nonArticleSuffix = ''
  
  if (contentToParse.includes(CARD_CONTENT_START)) {
    const startParts = contentToParse.split(CARD_CONTENT_START)
    nonArticlePrefix = startParts[0].trim()
    const cardContent = startParts.slice(1).join(CARD_CONTENT_START).trim()
    
    // Check for CARD_CONTENT_STOP within the card content
    if (cardContent.includes(CARD_CONTENT_STOP)) {
      const stopParts = cardContent.split(CARD_CONTENT_STOP)
      contentToParse = stopParts[0].trim() // Content between START and STOP
      nonArticleSuffix = stopParts.slice(1).join(CARD_CONTENT_STOP).trim() // Content after STOP
    } else {
      contentToParse = cardContent // No STOP marker, use all content after START
    }
  }
  
  // ROBUST PARSING: Rely on explicit markers, not Markdown structure patterns
  // If content is between CARD_CONTENT_START and CARD_CONTENT_STOP, it's article content
  // Split only by explicit ARTICLE_SEPARATOR, not by content structure
  
  if (contentToParse.includes(ARTICLE_SEPARATOR)) {
    // Split by explicit separator (most reliable method)
    const parts = contentToParse.split(ARTICLE_SEPARATOR)
    const articles: Article[] = []

    parts.forEach((part) => {
      const trimmed = part.trim()
      if (!trimmed) return

      // All parts separated by ARTICLE_SEPARATOR are articles
      // Extract title from first header if present, otherwise use default
      const titleMatch = trimmed.match(/^(?:#+\s+)(.+?)(?:\n|$)/m)
      const title = titleMatch ? titleMatch[1].trim() : undefined

      articles.push({
        id: `article-${articles.length}`,
        content: trimmed,
        title,
      })
    })

    result.articles = articles
    result.nonArticlePrefix = nonArticlePrefix.trim() || undefined
    result.nonArticleSuffix = nonArticleSuffix.trim() || undefined
    
    // Prevent duplication: Only set agentStatusContent if status is NOT in nonArticlePrefix
    if (statusContent) {
      const statusInPrefix = result.nonArticlePrefix?.includes(statusContent) || false
      if (statusInPrefix) {
        result.agentStatusContent = undefined
      } else {
        result.agentStatusContent = statusContent
      }
    }
    
    const nonArticleParts = [nonArticlePrefix]
    if (nonArticleSuffix) nonArticleParts.push(nonArticleSuffix)
    result.nonArticleContent = nonArticleParts.filter(p => p).join('\n\n').trim()
    return result
  }

  // No ARTICLE_SEPARATOR found - treat entire content as single article
  // This is robust: content between CARD_CONTENT_START and CARD_CONTENT_STOP is always an article
  // regardless of internal structure (no brittle pattern matching)
  const trimmed = contentToParse.trim()
  if (trimmed) {
    // Extract title from first header if present
    const titleMatch = trimmed.match(/^(?:#+\s+)(.+?)(?:\n|$)/m)
    const title = titleMatch ? titleMatch[1].trim() : undefined

    result.articles = [{
      id: 'article-0',
      content: trimmed,
      title,
    }]
  }

  result.nonArticlePrefix = nonArticlePrefix.trim() || undefined
  result.nonArticleSuffix = nonArticleSuffix.trim() || undefined
  
  // Prevent duplication: Only set agentStatusContent if status is NOT in nonArticlePrefix
  // If status is in nonArticlePrefix, it will be rendered there (card stack view)
  // If status is NOT in nonArticlePrefix, set agentStatusContent for separate rendering (scrollable view)
  if (statusContent) {
    const statusInPrefix = result.nonArticlePrefix?.includes(statusContent) || false
    if (statusInPrefix) {
      // Status is already in nonArticlePrefix, don't duplicate
      result.agentStatusContent = undefined
    } else {
      // Status is not in nonArticlePrefix, keep it for separate rendering
      result.agentStatusContent = statusContent
    }
  }
  
  const nonArticleParts = [nonArticlePrefix]
  if (nonArticleSuffix) nonArticleParts.push(nonArticleSuffix)
  result.nonArticleContent = nonArticleParts.filter(p => p).join('\n\n').trim()
  
  return result
}

/**
 * Adds explicit separators between articles in markdown content.
 * This is called from the backend to mark article boundaries.
 */
export function addArticleSeparators(content: string): string {
  // Replace article headers with separator + header
  return content.replace(
    /^(#+\s+(?:Summary|Article)\s+\d+)/gm,
    `${ARTICLE_SEPARATOR}\n$1`
  )
}


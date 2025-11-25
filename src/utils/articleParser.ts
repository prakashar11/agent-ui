/**
 * Utility to parse articles from markdown content.
 * Detects article boundaries based on markdown headers.
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
 * Articles are typically separated by:
 * - Explicit separators (---ARTICLE_SEPARATOR---)
 * - Headers like "# {title}" or "## {title}" followed by article content
 * - Multiple article headers indicating multiple articles
 */
export function containsArticles(content: string): boolean {
  // First check for explicit separator (most reliable indicator)
  if (content.includes(ARTICLE_SEPARATOR)) {
    return true
  }

  // Check for article-like patterns:
  // 1. Headers that look like article titles (followed by Source, Date, etc.)
  // 2. Multiple headers indicating multiple articles
  // 3. Common article patterns from backend
  
  // Count how many article-like headers we have
  // Articles typically have: # Title, then - **Source:**, - **Date:**
  const articleHeaderPattern = /^#+\s+.+$/m
  const headers = content.match(new RegExp(articleHeaderPattern, 'gm')) || []
  
  // If we have multiple headers, likely multiple articles
  if (headers.length > 1) {
    return true
  }
  
  // For single article, check if it has article-like structure
  // Look for patterns like: # Title, then - **Source:**, - **Date:**
  if (headers.length === 1) {
    // Check if content after header has article-like structure
    const hasSource = /- \*\*Source:\*\*/.test(content)
    const hasDate = /- \*\*Date:\*\*/.test(content)
    const hasSummary = /- \*\*Overall Summary:\*\*|## Summary|# Summary/.test(content)
    
    // If it has article-like structure, treat as article
    if (hasSource && (hasDate || hasSummary)) {
      return true
    }
  }
  
  // Also check for legacy patterns (for backward compatibility)
  const legacyPatterns = [
    /^#\s+Summary\s+\d+/m, // # Summary 1, # Summary 2, etc.
    /^##\s+Article\s+\d+/m, // ## Article 1, ## Article 2, etc.
    /^##\s+Summary\s+\d+/m, // ## Summary 1
  ]

  return legacyPatterns.some(pattern => pattern.test(content))
}

/**
 * Extracts agent status section from content (the <details> section with "Agent Status")
 */
function extractAgentStatus(content: string): { statusContent: string; remainingContent: string } {
  // Match <details> section with "Agent Status" in the summary
  // Pattern handles newlines and whitespace variations
  const statusPattern = /<details[^>]*>\s*<summary[^>]*>\s*Agent Status\s*<\/summary>[\s\S]*?<\/details>/i
  const match = content.match(statusPattern)
  
  if (match) {
    const statusContent = match[0]
    // Remove the status section from content, including surrounding whitespace
    const remainingContent = content.replace(statusPattern, '').replace(/\n{3,}/g, '\n\n').trim()
    return { statusContent, remainingContent }
  }
  
  return { statusContent: '', remainingContent: content }
}

/**
 * Splits markdown content into individual articles.
 * Articles are separated by headers starting with "# Summary" or "## Article"
 * or by explicit separators.
 */
export function parseArticles(content: string): ParsedContent {
  // First, extract agent status section if present
  const { statusContent, remainingContent } = extractAgentStatus(content)
  
  const result: ParsedContent = {
    articles: [],
    nonArticleContent: '',
    agentStatusContent: statusContent || undefined
  }
  // Use remaining content after extracting agent status
  let contentToParse = statusContent ? remainingContent : content
  
  // Check for CARD_CONTENT_START and CARD_CONTENT_STOP markers
  // Everything before START is non-article content
  // Everything between START and STOP is card content (articles)
  // Everything after STOP is non-article content
  let nonArticlePrefix = ''
  let nonArticleSuffix = ''
  
  if (contentToParse.includes(CARD_CONTENT_START)) {
    const startParts = contentToParse.split(CARD_CONTENT_START)
    nonArticlePrefix = startParts[0].trim()
    let cardContent = startParts.slice(1).join(CARD_CONTENT_START).trim()
    
    // Check for CARD_CONTENT_STOP within the card content
    if (cardContent.includes(CARD_CONTENT_STOP)) {
      const stopParts = cardContent.split(CARD_CONTENT_STOP)
      contentToParse = stopParts[0].trim() // Content between START and STOP
      nonArticleSuffix = stopParts.slice(1).join(CARD_CONTENT_STOP).trim() // Content after STOP
    } else {
      contentToParse = cardContent // No STOP marker, use all content after START
    }
  }
  
  // First, check for explicit separators
  if (contentToParse.includes(ARTICLE_SEPARATOR)) {
    // Split by separator and clean up whitespace
    const parts = contentToParse.split(ARTICLE_SEPARATOR)
    const articles: Article[] = []
    let nonArticleContent = ''

    parts.forEach((part, index) => {
      // Trim each part to remove leading/trailing whitespace
      const trimmed = part.trim()
      if (!trimmed) return

      // Check if this part contains an article (starts with article header pattern)
      const hasArticleHeader = trimmed.match(/^#+\s+(?:Summary|Article)\s+\d+/m)
      
      if (hasArticleHeader) {
        // This is an article - extract title from first header
        const titleMatch = trimmed.match(/^(?:#+\s+)(.+?)(?:\n|$)/m)
        const title = titleMatch ? titleMatch[1].trim() : undefined

        articles.push({
          id: `article-${articles.length}`,
          content: trimmed,
          title,
        })
      } else if (index === 0) {
        // First part without article header - treat as non-article content
        // But check if it might be article content that just doesn't start with header
        // If it's substantial content, it might be the first article
        if (trimmed.length > 100 || trimmed.includes('##') || trimmed.includes('**')) {
          // Likely article content - treat as article
          const titleMatch = trimmed.match(/^(?:#+\s+)(.+?)(?:\n|$)/m)
          const title = titleMatch ? titleMatch[1].trim() : undefined

          articles.push({
            id: `article-${articles.length}`,
            content: trimmed,
            title,
          })
        } else {
          // Small content - treat as non-article (status, metadata, etc.)
          nonArticleContent += trimmed + '\n\n'
        }
      } else {
        // Subsequent parts without article header - treat as article anyway
        // (might be continuation or malformed)
        const titleMatch = trimmed.match(/^(?:#+\s+)(.+?)(?:\n|$)/m)
        const title = titleMatch ? titleMatch[1].trim() : undefined

        articles.push({
          id: `article-${articles.length}`,
          content: trimmed,
          title,
        })
      }
    })

    result.articles = articles
    // Keep prefix and suffix separate for proper rendering order
    result.nonArticlePrefix = nonArticlePrefix.trim() || undefined
    result.nonArticleSuffix = nonArticleSuffix.trim() || undefined
    // Also set nonArticleContent for backward compatibility (combines prefix and suffix)
    const nonArticleParts = [nonArticlePrefix]
    if (nonArticleContent) nonArticleParts.push(nonArticleContent)
    if (nonArticleSuffix) nonArticleParts.push(nonArticleSuffix)
    result.nonArticleContent = nonArticleParts.filter(p => p).join('\n\n').trim()
    return result
  }

  // Otherwise, try to split by article headers
  // Pattern: Any # or ## header that looks like an article title
  // Articles typically start with # Title or ## Title, followed by - **Source:**, - **Date:**
  const articleHeaderPattern = /^#+\s+.+$/m
  const lines = contentToParse.split('\n')
  const articles: Article[] = []
  let currentArticle: string[] = []
  let nonArticleContent: string[] = []
  let inArticle = false
  let articleStartIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check if this line starts a new article header
    // Look for # or ## followed by text, and check if next few lines have article structure
    if (articleHeaderPattern.test(line)) {
      // Check if this looks like an article by checking next few lines for article structure
      const nextLines = lines.slice(i, Math.min(i + 5, lines.length)).join('\n')
      const hasArticleStructure = /- \*\*Source:\*\*|## Summary|# Summary/.test(nextLines)
      
      if (hasArticleStructure) {
        // Save previous article if exists
        if (currentArticle.length > 0) {
          const articleContent = currentArticle.join('\n')
          const titleMatch = articleContent.match(/^(?:#+\s+)(.+?)(?:\n|$)/m)
          const title = titleMatch ? titleMatch[1].trim() : undefined

          articles.push({
            id: `article-${articles.length}`,
            content: articleContent,
            title,
          })
          currentArticle = []
        }

        // Start new article
        currentArticle.push(line)
        inArticle = true
        articleStartIndex = i
      } else if (!inArticle) {
        // Header but not article-like - treat as non-article content
        nonArticleContent.push(line)
      } else {
        // Continue current article
        currentArticle.push(line)
      }
    } else if (inArticle) {
      // Continue current article
      currentArticle.push(line)
      
      // Check if we've reached the end of this article (next header or end of content)
      // For now, we'll continue until we hit another header or end
    } else {
      // Non-article content (status, metadata, etc.)
      nonArticleContent.push(line)
    }
  }

  // Add last article if exists
  if (currentArticle.length > 0) {
    const articleContent = currentArticle.join('\n')
    const titleMatch = articleContent.match(/^(?:#+\s+)(.+?)(?:\n|$)/m)
    const title = titleMatch ? titleMatch[1].trim() : undefined

    articles.push({
      id: `article-${articles.length}`,
      content: articleContent,
      title,
    })
  }

  result.articles = articles
  // Combine non-article prefix (before CARD_CONTENT_START), parsing results, and suffix (after CARD_CONTENT_STOP)
  const parsedNonArticleContent = nonArticleContent.join('\n').trim()
  const nonArticleParts = [nonArticlePrefix]
  if (parsedNonArticleContent) nonArticleParts.push(parsedNonArticleContent)
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


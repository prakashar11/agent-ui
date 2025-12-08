import Icon from '@/components/ui/icon'
import MarkdownRenderer from '@/components/ui/typography/MarkdownRenderer'
import SwipeableCardStack from '@/components/ui/SwipeableCardStack'
import { usePlaygroundStore } from '@/store'
import type { PlaygroundChatMessage } from '@/types/playground'
import Videos from './Multimedia/Videos'
import Images from './Multimedia/Images'
import Audios from './Multimedia/Audios'
import { memo } from 'react'
import AgentThinkingLoader from './AgentThinkingLoader'
import { containsArticles, parseArticles } from '@/utils/articleParser'

/**
 * Strips markdown code block wrapper from content.
 * Some LLMs wrap their markdown responses in ```markdown ... ``` which breaks rendering.
 */
function stripMarkdownWrapper(content: string): string {
  if (!content) return content
  
  const trimmed = content.trim()
  
  // Check for ```markdown or ```md wrapper
  if (trimmed.startsWith('```markdown')) {
    let stripped = trimmed.slice('```markdown'.length).trim()
    if (stripped.endsWith('```')) {
      stripped = stripped.slice(0, -3).trim()
    }
    return stripped
  }
  
  if (trimmed.startsWith('```md')) {
    let stripped = trimmed.slice('```md'.length).trim()
    if (stripped.endsWith('```')) {
      stripped = stripped.slice(0, -3).trim()
    }
    return stripped
  }
  
  // Check for plain ``` wrapper with markdown content
  if (trimmed.startsWith('```\n') || trimmed.startsWith('```\r\n')) {
    const firstNewline = trimmed.indexOf('\n')
    const afterFence = trimmed.slice(firstNewline + 1).trim()
    // If content looks like markdown, strip the wrapper
    if (afterFence.startsWith('#') || afterFence.startsWith('-') || afterFence.startsWith('*')) {
      let stripped = afterFence
      if (stripped.endsWith('```')) {
        stripped = stripped.slice(0, -3).trim()
      }
      return stripped
    }
  }
  
  return content
}

interface MessageProps {
  message: PlaygroundChatMessage
}

const AgentMessage = ({ message }: MessageProps) => {
  const { streamingErrorMessage, useArticleCardView } = usePlaygroundStore()
  let messageContent
  if (message.streamingError) {
    messageContent = (
      <p className="text-destructive">
        Oops! Something went wrong while streaming.{' '}
        {streamingErrorMessage ? (
          <>{streamingErrorMessage}</>
        ) : (
          'Please try refreshing the page or try again later.'
        )}
      </p>
    )
  } else if (message.content) {
    // Strip any markdown code block wrapper from LLM output
    const cleanContent = stripMarkdownWrapper(message.content)
    
    // Check if content contains articles that should be displayed as swipeable cards
    const hasArticles = containsArticles(cleanContent)
    
    if (hasArticles && useArticleCardView) {
      // Card stack view
      const parsed = parseArticles(cleanContent)
      const { articles, nonArticlePrefix, nonArticleSuffix } = parsed
      
      // Debug logging
      console.log('MessageItem: Article detection', {
        hasArticles,
        useArticleCardView,
        articlesCount: articles.length,
        hasNonArticlePrefix: !!nonArticlePrefix,
        hasNonArticleSuffix: !!nonArticleSuffix,
        nonArticleSuffixLength: nonArticleSuffix?.length || 0,
        nonArticleSuffixPreview: nonArticleSuffix?.substring(0, 100) || 'N/A',
        contentPreview: cleanContent.substring(0, 200)
      })
      
      messageContent = (
        <div className="flex w-full flex-col gap-4">
          {/* Non-article content BEFORE cards (e.g., collapsible status section) */}
          {nonArticlePrefix && (
            <div>
              <MarkdownRenderer>{nonArticlePrefix}</MarkdownRenderer>
            </div>
          )}
          
          {/* Swipeable article cards */}
          {articles.length > 0 ? (
            <SwipeableCardStack 
              articles={articles} 
              messageId={`${message.role}-${message.created_at}`}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              No articles found in content. Falling back to scrollable view.
            </div>
          )}
          
          {/* Non-article content AFTER cards (e.g., metadata with completion message) */}
          {nonArticleSuffix && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <MarkdownRenderer>{nonArticleSuffix}</MarkdownRenderer>
            </div>
          )}
          
          {message.videos && message.videos.length > 0 && (
            <Videos videos={message.videos} />
          )}
          {message.images && message.images.length > 0 && (
            <Images images={message.images} />
          )}
          {message.audio && message.audio.length > 0 && (
            <Audios audio={message.audio} />
          )}
        </div>
      )
    } else {
      // Scrollable list view (default or when toggle is off)
    messageContent = (
      <div className="flex w-full flex-col gap-4">
        <MarkdownRenderer>{cleanContent}</MarkdownRenderer>
        {message.videos && message.videos.length > 0 && (
          <Videos videos={message.videos} />
        )}
        {message.images && message.images.length > 0 && (
          <Images images={message.images} />
        )}
        {message.audio && message.audio.length > 0 && (
          <Audios audio={message.audio} />
        )}
      </div>
    )
    }
  } else if (message.response_audio) {
    if (!message.response_audio.transcript) {
      messageContent = (
        <div className="mt-2 flex items-start">
          <AgentThinkingLoader />
        </div>
      )
    } else {
      messageContent = (
        <div className="flex w-full flex-col gap-4">
          <MarkdownRenderer>
            {message.response_audio.transcript}
          </MarkdownRenderer>
          {message.response_audio.content && message.response_audio && (
            <Audios audio={[message.response_audio]} />
          )}
        </div>
      )
    }
  } else {
    messageContent = (
      <div className="mt-2">
        <AgentThinkingLoader />
      </div>
    )
  }

  return (
    <div className="flex flex-row items-start gap-4 font-geist">
      <div className="flex-shrink-0">
        <Icon type="agent" size="sm" />
      </div>
      {messageContent}
    </div>
  )
}

const UserMessage = memo(({ message }: MessageProps) => {
  return (
    <div className="flex items-start pt-4 text-start max-md:break-words">
      <div className="flex flex-row gap-x-3">
        <p className="flex items-center gap-x-2 text-sm font-medium text-muted">
          <Icon type="user" size="sm" />
        </p>
        <div className="text-md rounded-lg py-1 font-geist text-secondary">
          {message.content}
        </div>
      </div>
    </div>
  )
})

AgentMessage.displayName = 'AgentMessage'
UserMessage.displayName = 'UserMessage'
export { AgentMessage, UserMessage }

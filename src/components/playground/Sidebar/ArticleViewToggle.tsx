import { memo } from "react"
import { Switch } from "@/components/ui/switch"
import Icon from "@/components/ui/icon"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip/tooltip"
import { usePlaygroundStore } from "@/store"

const ArticleViewToggle = memo(() => {
  const useArticleCardView = usePlaygroundStore((state) => state.useArticleCardView)
  const setUseArticleCardView = usePlaygroundStore((state) => state.setUseArticleCardView)

  const handleToggleChange = (checked: boolean) => {
    setUseArticleCardView(checked)
  }

  return (
    <div
      className="flex w-full items-center justify-between rounded-xl border border-primary/15 bg-accent p-3"
      data-testid="article-view-toggle"
    >
      <div className="flex items-center gap-2">
        <Icon type="sheet" size="xs" aria-hidden="true" />
        <span className="text-xs font-medium uppercase">
          Card Stack View
        </span>
      </div>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Switch
              checked={useArticleCardView}
              onCheckedChange={handleToggleChange}
              className={`${!useArticleCardView ? "bg-black" : "bg-primary"} transition-colors`}
              aria-label="Toggle article view mode"
            />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>{useArticleCardView ? "Switch to scrollable list" : "Switch to card stack"} view</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
})

ArticleViewToggle.displayName = "ArticleViewToggle"

export default ArticleViewToggle


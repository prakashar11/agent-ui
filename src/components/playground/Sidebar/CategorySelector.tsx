'use client'

import * as React from 'react'
import { usePlaygroundStore } from '@/store'
import { groupAgentsByCategory, getCategoryColor } from '@/lib/agentCategories'
import { motion } from 'framer-motion'
import { 
  Folder, 
  FolderOpen, 
  ChevronRight 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function CategorySelector() {
  const { agents, selectedCategory, setSelectedCategory } = usePlaygroundStore()

  // Group agents by category
  const groupedAgents = React.useMemo(() => {
    return groupAgentsByCategory(agents)
  }, [agents])

  const handleCategoryClick = (category: string) => {
    // Toggle category selection
    if (selectedCategory === category) {
      setSelectedCategory(null)
    } else {
      setSelectedCategory(category)
    }
  }

  if (groupedAgents.length === 0) {
    return (
      <div className="flex h-9 w-full items-center justify-center rounded-xl border border-primary/15 bg-accent text-xs text-muted-foreground">
        No categories available
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-1">
      {groupedAgents.map((group) => {
        const isSelected = selectedCategory === group.category
        const colorClass = getCategoryColor(group.category)
        const IconComponent = isSelected ? FolderOpen : Folder

        return (
          <motion.button
            key={group.category}
            onClick={() => handleCategoryClick(group.category)}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
              isSelected
                ? 'border-primary/30 bg-primary/10'
                : 'border-primary/15 bg-accent hover:border-primary/25 hover:bg-accent/80'
            )}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className={cn('flex-shrink-0', colorClass)}>
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                'text-xs font-medium uppercase tracking-wide truncate',
                isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
              )}>
                {group.category}
              </div>
              <div className="text-[10px] text-muted-foreground/70">
                {group.agents.length} agent{group.agents.length !== 1 ? 's' : ''}
              </div>
            </div>
            <ChevronRight className={cn(
              'w-4 h-4 flex-shrink-0 transition-transform duration-200',
              isSelected 
                ? 'text-primary rotate-90' 
                : 'text-muted-foreground/50 group-hover:text-muted-foreground'
            )} />
          </motion.button>
        )
      })}
    </div>
  )
}

export default CategorySelector


import { ComboboxAgent } from '@/types/playground'

// Helper function to group agents by category
export function groupAgentsByCategory(agents: ComboboxAgent[]) {
  const groups: Record<string, ComboboxAgent[]> = {}
  
  agents.forEach((agent) => {
    const category = agent.category || 'Uncategorized'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(agent)
  })
  
  // Sort categories alphabetically
  const sortedCategories = Object.keys(groups).sort((a, b) => {
    // Put "Uncategorized" at the end
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })
  
  return sortedCategories.map(category => ({
    category,
    agents: groups[category].sort((a, b) => a.label.localeCompare(b.label))
  }))
}

// Helper function to get category color (for future styling)
export function getCategoryColor(category: string): string {
  // Generate a consistent color based on the category name
  const colors = [
    'text-red-500',
    'text-blue-500', 
    'text-green-500',
    'text-purple-500',
    'text-orange-500',
    'text-indigo-500',
    'text-teal-500',
    'text-pink-500',
    'text-yellow-500',
    'text-cyan-500'
  ]
  
  // Use a simple hash function to get consistent colors for the same category
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    const char = category.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  const colorIndex = Math.abs(hash) % colors.length
  return category === 'Uncategorized' ? 'text-gray-500' : colors[colorIndex]
} 
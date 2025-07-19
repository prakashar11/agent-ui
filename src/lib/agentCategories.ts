import { ComboboxAgent } from '@/types/playground'

// Predefined categories for common agent types
export const AGENT_CATEGORIES = {
  SECURITY: 'Security & Compliance',
  DATA_ANALYSIS: 'Data Analysis',
  AUTOMATION: 'Automation & Workflow',
  COMMUNICATION: 'Communication',
  RESEARCH: 'Research & Knowledge',
  DEVELOPMENT: 'Development & Code',
  BUSINESS: 'Business & Operations',
  UNCATEGORIZED: 'Uncategorized'
} as const

export type AgentCategory = typeof AGENT_CATEGORIES[keyof typeof AGENT_CATEGORIES]

// Category icons (you can extend this based on your icon system)
export const CATEGORY_ICONS: Record<AgentCategory, string> = {
  [AGENT_CATEGORIES.SECURITY]: 'shield',
  [AGENT_CATEGORIES.DATA_ANALYSIS]: 'chart',
  [AGENT_CATEGORIES.AUTOMATION]: 'zap',
  [AGENT_CATEGORIES.COMMUNICATION]: 'message',
  [AGENT_CATEGORIES.RESEARCH]: 'search',
  [AGENT_CATEGORIES.DEVELOPMENT]: 'code',
  [AGENT_CATEGORIES.BUSINESS]: 'briefcase',
  [AGENT_CATEGORIES.UNCATEGORIZED]: 'help-circle'
}

// Helper function to group agents by category
export function groupAgentsByCategory(agents: ComboboxAgent[]) {
  const groups: Record<string, ComboboxAgent[]> = {}
  
  agents.forEach((agent) => {
    const category = agent.category || AGENT_CATEGORIES.UNCATEGORIZED
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(agent)
  })
  
  // Sort categories: predefined categories first, then alphabetical
  const sortedCategories = Object.keys(groups).sort((a, b) => {
    const aIndex = Object.values(AGENT_CATEGORIES).indexOf(a as AgentCategory)
    const bIndex = Object.values(AGENT_CATEGORIES).indexOf(b as AgentCategory)
    
    // If both are predefined categories, sort by their order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex
    }
    
    // If only one is predefined, put it first
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    
    // If neither is predefined, sort alphabetically
    return a.localeCompare(b)
  })
  
  return sortedCategories.map(category => ({
    category,
    agents: groups[category].sort((a, b) => a.label.localeCompare(b.label))
  }))
}

// Helper function to get category color (for future styling)
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    [AGENT_CATEGORIES.SECURITY]: 'text-red-500',
    [AGENT_CATEGORIES.DATA_ANALYSIS]: 'text-blue-500',
    [AGENT_CATEGORIES.AUTOMATION]: 'text-green-500',
    [AGENT_CATEGORIES.COMMUNICATION]: 'text-purple-500',
    [AGENT_CATEGORIES.RESEARCH]: 'text-orange-500',
    [AGENT_CATEGORIES.DEVELOPMENT]: 'text-indigo-500',
    [AGENT_CATEGORIES.BUSINESS]: 'text-teal-500',
    [AGENT_CATEGORIES.UNCATEGORIZED]: 'text-gray-500'
  }
  
  return colors[category] || colors[AGENT_CATEGORIES.UNCATEGORIZED]
}

// Helper function to suggest category based on agent name/description
export function suggestCategory(agentName: string, description?: string): AgentCategory {
  const text = `${agentName} ${description || ''}`.toLowerCase()
  
  if (text.includes('security') || text.includes('compliance') || text.includes('audit') || text.includes('vulnerability')) {
    return AGENT_CATEGORIES.SECURITY
  }
  
  if (text.includes('data') || text.includes('analysis') || text.includes('analytics') || text.includes('report')) {
    return AGENT_CATEGORIES.DATA_ANALYSIS
  }
  
  if (text.includes('automation') || text.includes('workflow') || text.includes('pipeline') || text.includes('orchestration')) {
    return AGENT_CATEGORIES.AUTOMATION
  }
  
  if (text.includes('communication') || text.includes('chat') || text.includes('email') || text.includes('notification')) {
    return AGENT_CATEGORIES.COMMUNICATION
  }
  
  if (text.includes('research') || text.includes('knowledge') || text.includes('search') || text.includes('query')) {
    return AGENT_CATEGORIES.RESEARCH
  }
  
  if (text.includes('development') || text.includes('code') || text.includes('programming') || text.includes('debug')) {
    return AGENT_CATEGORIES.DEVELOPMENT
  }
  
  if (text.includes('business') || text.includes('operation') || text.includes('process') || text.includes('management')) {
    return AGENT_CATEGORIES.BUSINESS
  }
  
  return AGENT_CATEGORIES.UNCATEGORIZED
} 
# Agent Categories Feature

This document explains the agent categorization feature that allows grouping agents by category in the agent-ui interface.

## Overview

The agent categorization feature provides a hierarchical view of agents organized by categories, making it easier for users to find and select the appropriate agent for their needs.

## Changes Made

### 1. Type Definitions (`src/types/playground.ts`)
- Added `category?: string` field to `Agent` interface
- Added `category?: string` field to `ComboboxAgent` interface

### 2. API Integration (`src/api/playground.ts`)
- Updated `getPlaygroundAgentsAPI` to include category field in agent transformation
- Defaults to "Uncategorized" if no category is provided

### 3. Store Updates (`src/store.ts`)
- Updated to use `ComboboxAgent` type instead of local `Agent` interface
- Ensures type consistency across the application

### 4. New Components
- **GroupedAgentSelector** (`src/components/playground/Sidebar/GroupedAgentSelector.tsx`): Replaces the original AgentSelector with categorized view
- **Agent Categories Utility** (`src/lib/agentCategories.ts`): Provides helper functions for category management

### 5. UI Integration
- Updated `Sidebar.tsx` to use `GroupedAgentSelector` instead of `AgentSelector`

## Predefined Categories

The system includes predefined categories for common agent types:

- **Security & Compliance**: Security, audit, vulnerability assessment agents
- **Data Analysis**: Analytics, reporting, data processing agents
- **Automation & Workflow**: Pipeline, orchestration, automation agents
- **Communication**: Chat, email, notification agents
- **Research & Knowledge**: Search, query, knowledge base agents
- **Development & Code**: Programming, debugging, code analysis agents
- **Business & Operations**: Process management, business operations agents
- **Uncategorized**: Default category for agents without explicit categorization

## How It Works

### Agent Grouping
1. Agents are fetched from the API with their category information
2. The `groupAgentsByCategory` utility function organizes agents by category
3. Categories are sorted with predefined categories first, then alphabetically
4. Agents within each category are sorted alphabetically by name

### UI Display
1. The `GroupedAgentSelector` component displays agents in a hierarchical dropdown
2. Each category is shown as a group label with colored text
3. Agents are listed under their respective categories
4. Visual separators distinguish between different categories

### Category Suggestions
The `suggestCategory` function can automatically suggest categories based on agent names and descriptions, using keyword matching.

## Usage

### For Agent Developers
To add category support to your agents, ensure your Agno agent includes a `category` field:

```python
@dataclass
class Agent:
    name: str
    description: str
    category: str = "Uncategorized"  # Add this field
    # ... other fields
```

### For Frontend Developers
The categorization is handled automatically by the UI components. No additional configuration is required.

## Customization

### Adding New Categories
To add new categories, update the `AGENT_CATEGORIES` object in `src/lib/agentCategories.ts`:

```typescript
export const AGENT_CATEGORIES = {
  // ... existing categories
  NEW_CATEGORY: 'New Category Name'
} as const
```

### Category Colors
Update the `getCategoryColor` function to add colors for new categories:

```typescript
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    // ... existing colors
    [AGENT_CATEGORIES.NEW_CATEGORY]: 'text-pink-500'
  }
  // ...
}
```

### Category Icons
Add icons for new categories in the `CATEGORY_ICONS` object:

```typescript
export const CATEGORY_ICONS: Record<AgentCategory, string> = {
  // ... existing icons
  [AGENT_CATEGORIES.NEW_CATEGORY]: 'star'
}
```

## Backward Compatibility

- Agents without a category field will be assigned to "Uncategorized"
- The original `AgentSelector` component is still available if needed
- All existing functionality remains unchanged

## Future Enhancements

Potential improvements for the categorization feature:

1. **Category Management UI**: Allow users to create custom categories
2. **Category Filtering**: Add filters to show only specific categories
3. **Category Search**: Search within specific categories
4. **Category Statistics**: Show agent counts per category
5. **Category Icons**: Add visual icons for each category
6. **Category Descriptions**: Add descriptions for each category
7. **Category Permissions**: Restrict access to certain categories based on user roles 
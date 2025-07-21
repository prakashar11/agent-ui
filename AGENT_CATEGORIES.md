# Agent Categories Feature

This document explains the agent categorization feature that allows grouping agents by category in the agent-ui interface.

## Overview

The agent categorization feature provides a hierarchical view of agents organized by categories, making it easier for users to find and select the appropriate agent for their needs. Categories are defined by the backend and can be customized by users.

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

## Dynamic Categories

The system now supports dynamic categories defined by the backend:

- **Backend-Defined**: Categories are created and managed by the backend
- **User-Customizable**: Users can create custom categories through the backend
- **Flexible**: No hardcoded category limitations
- **Default Fallback**: Agents without a category are assigned to "Uncategorized"

## How It Works

### Agent Grouping
1. Agents are fetched from the API with their category information
2. The `groupAgentsByCategory` utility function organizes agents by category
3. Categories are sorted alphabetically (with "Uncategorized" at the end)
4. Agents within each category are sorted alphabetically by name

### UI Display
1. The `GroupedAgentSelector` component displays agents in a hierarchical dropdown
2. Each category is shown as a group label with colored text
3. Agents are listed under their respective categories
4. Visual separators distinguish between different categories
5. **Collapsible Categories**: Users can expand/collapse individual categories
6. **Expand/Collapse All**: Buttons to control all categories at once
7. **Persistent State**: Collapsed state is saved in localStorage

### Dynamic Color Assignment
The `getCategoryColor` function automatically assigns consistent colors to categories:
- Uses a hash function to ensure the same category always gets the same color
- Provides a palette of 10 different colors
- "Uncategorized" always gets gray color
- Colors are consistent across sessions

## Usage

### For Backend Developers
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

## Backend Category Management

### Creating Categories
Categories are managed entirely by the backend:
- No frontend hardcoded categories
- Users can create custom categories through backend APIs
- Categories are stored and retrieved from the backend

### Category Assignment
- Agents can be assigned to any category created in the backend
- If no category is specified, agents default to "Uncategorized"
- Categories are case-sensitive and should be consistent

## UI Features

### Collapsible Interface
- **Individual Toggle**: Click category headers to expand/collapse
- **Expand All**: Button to expand all categories at once
- **Collapse All**: Button to collapse all categories at once
- **Auto-Expand**: Selected agent's category is automatically expanded

### Persistent State
- Collapsed/expanded state is saved in localStorage
- User preferences persist across browser sessions
- State is restored when the page is reloaded

### Text Wrapping
- Agent names wrap properly when they're too long
- Button height adjusts automatically to accommodate wrapped text
- Maintains consistent font size and styling

## Backward Compatibility

- Agents without a category field will be assigned to "Uncategorized"
- The original `AgentSelector` component is still available if needed
- All existing functionality remains unchanged

## Future Enhancements

Potential improvements for the categorization feature:

1. **Category Management UI**: Allow users to create custom categories from the frontend
2. **Category Filtering**: Add filters to show only specific categories
3. **Category Search**: Search within specific categories
4. **Category Statistics**: Show agent counts per category
5. **Category Icons**: Add visual icons for each category (backend-defined)
6. **Category Descriptions**: Add descriptions for each category
7. **Category Permissions**: Restrict access to certain categories based on user roles
8. **Category Sorting**: Allow custom category ordering
9. **Category Themes**: Different color themes for different category types 
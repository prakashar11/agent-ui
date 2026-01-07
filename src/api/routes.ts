export const APIRoutes = {
  GetPlaygroundAgents: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/playground/agents`,
  AgentRun: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/playground/agents/{agent_id}/runs`,
  PlaygroundStatus: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/playground/status`,
  GetPlaygroundSessions: (PlaygroundApiUrl: string, agentId: string) =>
    `${PlaygroundApiUrl}/v1/playground/agents/${agentId}/sessions`,
  GetPlaygroundSession: (
    PlaygroundApiUrl: string,
    agentId: string,
    sessionId: string
  ) =>
    `${PlaygroundApiUrl}/v1/playground/agents/${agentId}/sessions/${sessionId}`,

  DeletePlaygroundSession: (
    PlaygroundApiUrl: string,
    agentId: string,
    sessionId: string
  ) =>
    `${PlaygroundApiUrl}/v1/playground/agents/${agentId}/sessions/${sessionId}`,

  RenamePlaygroundSession: (
    PlaygroundApiUrl: string,
    agentId: string,
    sessionId: string
  ) =>
    `${PlaygroundApiUrl}/v1/playground/agents/${agentId}/sessions/${sessionId}/rename`,

  // Asset Memory CRUD API Routes
  AssetMemoryList: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/assets`,
  AssetMemoryGet: (PlaygroundApiUrl: string, assetId: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/assets/${assetId}`,
  AssetMemoryCreate: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/assets`,
  AssetMemoryUpdate: (PlaygroundApiUrl: string, assetId: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/assets/${assetId}`,
  AssetMemoryDelete: (PlaygroundApiUrl: string, assetId: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/assets/${assetId}`,
  AssetMemoryBulkCreate: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/assets/bulk`,
  AssetMemoryBulkDelete: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/assets/bulk-delete`,
  AssetMemoryStats: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/stats`,
  AssetMemorySessions: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/sessions`,
  AssetMemoryExport: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/export`,
  AssetMemoryMetadataTypes: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/metadata/types`,
  AssetMemoryMetadataCriticalities: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/metadata/criticalities`,
  AssetMemoryMetadataEnvironments: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-memory/metadata/environments`,

  // Workflow API Routes
  WorkflowTasksList: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/tasks`,
  WorkflowTaskGet: (PlaygroundApiUrl: string, taskId: string) =>
    `${PlaygroundApiUrl}/v1/workflow/tasks/${taskId}`,
  WorkflowTaskCreate: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/tasks`,
  WorkflowTaskUpdate: (PlaygroundApiUrl: string, taskId: string) =>
    `${PlaygroundApiUrl}/v1/workflow/tasks/${taskId}`,
  WorkflowTaskDelete: (PlaygroundApiUrl: string, taskId: string) =>
    `${PlaygroundApiUrl}/v1/workflow/tasks/${taskId}`,
  WorkflowTaskComplete: (PlaygroundApiUrl: string, taskId: string) =>
    `${PlaygroundApiUrl}/v1/workflow/tasks/${taskId}/complete`,
  WorkflowTasksBulkCreate: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/tasks/bulk`,
  WorkflowTasksBulkDelete: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/tasks/bulk-delete`,
  WorkflowStats: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/stats`,
  WorkflowDashboard: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/dashboard`,
  WorkflowOverdue: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/overdue`,
  WorkflowUpcoming: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/upcoming`,
  WorkflowAssetTasks: (PlaygroundApiUrl: string, assetId: string) =>
    `${PlaygroundApiUrl}/v1/workflow/assets/${assetId}/tasks`,
  WorkflowMetadataTaskTypes: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/metadata/task-types`,
  WorkflowMetadataStatuses: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/metadata/statuses`,
  WorkflowMetadataPriorities: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/workflow/metadata/priorities`,
  // Asset picker for workflow
  WorkflowAssetsPicker: (PlaygroundApiUrl: string, search?: string) =>
    `${PlaygroundApiUrl}/v1/workflow/assets${search ? `?search=${encodeURIComponent(search)}` : ''}`,
  WorkflowAssetWorkflows: (PlaygroundApiUrl: string, assetId: string) =>
    `${PlaygroundApiUrl}/v1/workflow/assets/${assetId}/workflows`,
}

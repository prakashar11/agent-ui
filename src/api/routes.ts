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
}

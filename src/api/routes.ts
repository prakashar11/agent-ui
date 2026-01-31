// Pagination parameters interface
export interface PaginationParams {
  page?: number;
  per_page?: number;
  since?: string;
  until?: string;
}

// Helper to build query string from pagination params
const buildPaginationQuery = (params: PaginationParams): string => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', String(params.page));
  if (params.per_page) queryParams.append('per_page', String(params.per_page));
  if (params.since) queryParams.append('since', params.since);
  if (params.until) queryParams.append('until', params.until);
  return queryParams.toString();
};

export const APIRoutes = {
  // Health & Readiness Check
  Health: (PlaygroundApiUrl: string) => `${PlaygroundApiUrl}/health`,
  Ready: (PlaygroundApiUrl: string) => `${PlaygroundApiUrl}/ready`,
  ServerStatus: (PlaygroundApiUrl: string) => `${PlaygroundApiUrl}/v1/status`,

  // Playground
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

  // Asset Graph API Routes (with pagination support)
  AssetGraphData: (PlaygroundApiUrl: string, params?: PaginationParams & { node_type?: string; include_edges?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    if (params?.since) queryParams.append('since', params.since);
    if (params?.until) queryParams.append('until', params.until);
    if (params?.node_type) queryParams.append('node_type', params.node_type);
    if (params?.include_edges !== undefined) queryParams.append('include_edges', String(params.include_edges));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-graph/data${query ? `?${query}` : ''}`;
  },
  AssetGraphStats: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-graph/stats`,
  AssetGraphRefresh: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-graph/refresh`,
  AssetGraphSearch: (PlaygroundApiUrl: string, params?: PaginationParams & { q: string; node_type?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.q) queryParams.append('q', params.q);
    if (params?.node_type) queryParams.append('node_type', params.node_type);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-graph/search${query ? `?${query}` : ''}`;
  },
  AssetGraphCategoryThreats: (PlaygroundApiUrl: string, category: string, params?: PaginationParams) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-graph/category/${encodeURIComponent(category)}/threats${query ? `?${query}` : ''}`;
  },
  AssetGraphConnectedNodes: (PlaygroundApiUrl: string, nodeId: string, params?: PaginationParams & { max_hops?: number; direction?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.max_hops !== undefined) queryParams.append('max_hops', String(params.max_hops));
    if (params?.direction) queryParams.append('direction', params.direction);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-graph/metapath/connected/${encodeURIComponent(nodeId)}${query ? `?${query}` : ''}`;
  },
  AssetGraphExploitability: (PlaygroundApiUrl: string, params?: PaginationParams & { min_score?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    if (params?.min_score !== undefined) queryParams.append('min_score', String(params.min_score));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-graph/exploitability${query ? `?${query}` : ''}`;
  },
  AssetGraphExploitabilityForAsset: (PlaygroundApiUrl: string, assetId: string) =>
    `${PlaygroundApiUrl}/v1/asset-graph/exploitability/${encodeURIComponent(assetId)}`,
  AssetGraphRemediation: (PlaygroundApiUrl: string, params?: PaginationParams & { min_exploitability?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    if (params?.min_exploitability !== undefined) queryParams.append('min_exploitability', String(params.min_exploitability));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-graph/remediation${query ? `?${query}` : ''}`;
  },
  AssetGraphRemediationForAsset: (PlaygroundApiUrl: string, assetId: string, limit?: number) => {
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', String(limit));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-graph/remediation/${encodeURIComponent(assetId)}${query ? `?${query}` : ''}`;
  },
  AssetGraphHygieneEssentials: (PlaygroundApiUrl: string, params?: PaginationParams & { category?: string; maturity_level?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.maturity_level) queryParams.append('maturity_level', params.maturity_level);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-graph/hygiene-essentials${query ? `?${query}` : ''}`;
  },
  AssetGraphHygieneCategories: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-graph/hygiene-essentials/categories`,
  AssetGraphHygieneMaturityLevels: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/asset-graph/hygiene-essentials/maturity-levels`,

  // Asset Memory CRUD API Routes (with pagination support)
  AssetMemoryList: (PlaygroundApiUrl: string, params?: PaginationParams & { asset_type?: string; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    if (params?.since) queryParams.append('since', params.since);
    if (params?.until) queryParams.append('until', params.until);
    if (params?.asset_type) queryParams.append('asset_type', params.asset_type);
    if (params?.status) queryParams.append('status', params.status);
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/asset-memory/assets${query ? `?${query}` : ''}`;
  },
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

  // Workflow API Routes (with pagination support)
  WorkflowTasksList: (PlaygroundApiUrl: string, params?: PaginationParams & { status?: string; priority?: string; task_type?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.per_page) queryParams.append('per_page', String(params.per_page));
    if (params?.since) queryParams.append('since', params.since);
    if (params?.until) queryParams.append('until', params.until);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.task_type) queryParams.append('task_type', params.task_type);
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/workflow/tasks${query ? `?${query}` : ''}`;
  },
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

  // SecOps Harness API Routes
  SecOpsRequest: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/secops/request`,

  // Threat Intel Ingestion API Routes
  ThreatIntelIngestion: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/intel/ingest`,
  ThreatIntelIngestionSync: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/intel/ingest/sync`,
  ThreatIntelIngestionStatus: (PlaygroundApiUrl: string, jobId: string) =>
    `${PlaygroundApiUrl}/v1/intel/ingest/status/${encodeURIComponent(jobId)}`,
  ThreatIntelIngestionJobs: (PlaygroundApiUrl: string, limit?: number) => {
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', String(limit));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/intel/ingest/jobs${query ? `?${query}` : ''}`;
  },
  ThreatIntelIngestionDeleteJob: (PlaygroundApiUrl: string, jobId: string) =>
    `${PlaygroundApiUrl}/v1/intel/ingest/jobs/${encodeURIComponent(jobId)}`,
  ThreatIntelIngestionClearJobs: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/intel/ingest/jobs`,
  ThreatIntelFeeds: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/intel/feeds`,
  ThreatIntelAssetCategories: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/intel/asset-categories`,

  // Bug Bounty Intelligence Ingestion API Routes
  BugBountyIngestion: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/ingest`,
  BugBountyIngestionSync: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/ingest/sync`,
  BugBountyIngestionStatus: (PlaygroundApiUrl: string, jobId: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/ingest/status/${encodeURIComponent(jobId)}`,
  BugBountyIngestionJobs: (PlaygroundApiUrl: string, limit?: number) => {
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', String(limit));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/bug-bounty/ingest/jobs${query ? `?${query}` : ''}`;
  },
  BugBountyIngestionDeleteJob: (PlaygroundApiUrl: string, jobId: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/ingest/jobs/${encodeURIComponent(jobId)}`,
  BugBountyIngestionClearJobs: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/ingest/jobs`,

  // Bug Bounty Predefined URLs API Routes
  BugBountyPredefinedUrls: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/predefined-urls`,
  BugBountyPredefinedUrl: (PlaygroundApiUrl: string, urlId: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/predefined-urls/${encodeURIComponent(urlId)}`,
  BugBountyPredefinedUrlCreate: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/predefined-urls`,
  BugBountyPredefinedUrlUpdate: (PlaygroundApiUrl: string, urlId: string) =>
    `${PlaygroundApiUrl}/v1/bug-bounty/predefined-urls/${encodeURIComponent(urlId)}`,

  // Graph Maintenance API Routes
  ThreatIntelOrphanedNodes: (PlaygroundApiUrl: string) =>
    `${PlaygroundApiUrl}/v1/intel/graph/orphaned-nodes`,
  ThreatIntelCleanupOrphanedNodes: (
    PlaygroundApiUrl: string,
    options?: { dryRun?: boolean; deleteThreats?: boolean; deleteAttacks?: boolean; deleteIndicators?: boolean }
  ) => {
    const queryParams = new URLSearchParams();
    if (options?.dryRun !== undefined) queryParams.append('dry_run', String(options.dryRun));
    if (options?.deleteThreats !== undefined) queryParams.append('delete_threats', String(options.deleteThreats));
    if (options?.deleteAttacks !== undefined) queryParams.append('delete_attacks', String(options.deleteAttacks));
    if (options?.deleteIndicators !== undefined) queryParams.append('delete_indicators', String(options.deleteIndicators));
    const query = queryParams.toString();
    return `${PlaygroundApiUrl}/v1/intel/graph/orphaned-nodes${query ? `?${query}` : ''}`;
  },
}

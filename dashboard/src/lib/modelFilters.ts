export type ModelEndpoint = 'chat_completions' | 'messages' | 'responses';

export interface ModelsFilter {
  provider?: string;
  endpoint?: ModelEndpoint;
  search?: string;
}

export function normalizeModelsFilter(filter: ModelsFilter = {}): ModelsFilter {
  return {
    provider: filter.provider || undefined,
    endpoint: filter.endpoint || undefined,
    search: filter.search?.trim() || undefined,
  };
}

export function filterKey(filter: ModelsFilter): string {
  return `${filter.provider || ''}|${filter.endpoint || ''}|${filter.search || ''}`;
}

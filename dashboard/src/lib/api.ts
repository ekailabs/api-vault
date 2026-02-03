// API Configuration with smart runtime detection
const API_BASE_URL = (() => {
  // Server-side: use env var
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  }
  
  // Client-side: check if placeholder wasn't replaced
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl !== '__API_URL_PLACEHOLDER__') {
    return envUrl;
  }
  
  // Smart fallback: derive from browser location (works for ROFL and proxies)
  const { protocol, hostname } = window.location;
  if (hostname.includes('p3000')) {
    // ROFL-style proxy URL pattern (p3000 -> p3001)
    return `${protocol}//${hostname.replace('p3000', 'p3001')}`;
  }
  
  // Default for local dev
  return 'http://localhost:3001';
})();
// Types based on your backend response
export interface UsageRecord {
  id: number;
  request_id: string;
  provider: string;
  model: string;
  timestamp: string;
  input_tokens: number;
  cache_write_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost: number;
  cache_write_cost: number;
  cache_read_cost: number;
  output_cost: number;
  total_cost: number;
  currency: string;
  payment_method?: string;
  created_at: string;
}

export interface UsageResponse {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  costByProvider: Record<string, number>;
  costByModel: Record<string, number>;
  records: UsageRecord[];
}

export interface ConfigStatusResponse {
  providers: Record<string, boolean>;
  mode: 'byok' | 'hybrid' | 'x402-only';
  hasApiKeys: boolean;
  x402Enabled: boolean;
  server: {
    environment: string;
    port: number;
  };
}

export interface ModelCatalogEntry {
  id: string;
  provider: string;
  endpoint: 'chat_completions' | 'messages' | 'responses';
  pricing: {
    input: number;
    output: number;
    cache_write?: number;
    cache_read?: number;
    currency: string;
    unit: string;
  } | null;
  source: string;
}

export interface ModelsResponse {
  total: number;
  limit: number;
  offset: number;
  items: ModelCatalogEntry[];
}

export interface BudgetResponse {
  amountUsd: number | null;
  alertOnly: boolean;
  window: 'monthly';
  spentMonthToDate: number;
  remaining: number | null;
}

// API service functions
export const apiService = {
  // Fetch usage data
  async getUsage(fromDate?: Date, toDate?: Date): Promise<UsageResponse> {
    let url = `${API_BASE_URL}/usage`;

    if (fromDate || toDate) {
      const params = new URLSearchParams();
      if (fromDate) {
        params.append('startTime', fromDate.toISOString());
      }
      if (toDate) {
        params.append('endTime', toDate.toISOString());
      }
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        handleAuthError();
      }
      throw new Error(`Failed to fetch usage data: ${response.statusText}`);
    }
    return response.json();
  },

  // Check health
  async getHealth() {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Failed to fetch health: ${response.statusText}`);
    }
    return response.json();
  },

  async downloadUsageCsv(fromDate?: Date, toDate?: Date) {
    const params = new URLSearchParams();
    if (fromDate) params.append('startTime', fromDate.toISOString());
    if (toDate) params.append('endTime', toDate.toISOString());
    params.append('format', 'csv');

    const url = `${API_BASE_URL}/usage?${params.toString()}`;
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        handleAuthError();
      }
      throw new Error(`Failed to export CSV: ${response.statusText}`);
    }

    const blob = await response.blob();
    const link = document.createElement('a');
    const downloadUrl = window.URL.createObjectURL(blob);
    link.href = downloadUrl;

    const startLabel = fromDate ? fromDate.toISOString().slice(0, 10) : 'start';
    const endLabel = toDate ? toDate.toISOString().slice(0, 10) : 'end';
    link.download = `usage-${startLabel}-${endLabel}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  async getConfigStatus(): Promise<ConfigStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/config/status`);
    if (!response.ok) {
      throw new Error(`Failed to fetch config status: ${response.statusText}`);
    }
    return response.json();
  },

  async getModels(params?: { provider?: string; endpoint?: 'chat_completions' | 'messages' | 'responses'; search?: string; limit?: number; offset?: number }): Promise<ModelsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.provider) searchParams.append('provider', params.provider);
    if (params?.endpoint) searchParams.append('endpoint', params.endpoint);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.offset) searchParams.append('offset', String(params.offset));

    const url = `${API_BASE_URL}/v1/models${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        handleAuthError();
      }
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    return response.json();
  },

  async getBudget(): Promise<BudgetResponse> {
    const response = await fetch(`${API_BASE_URL}/budget`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        handleAuthError();
      }
      throw new Error(`Failed to fetch budget: ${response.statusText}`);
    }
    return response.json();
  },

  async updateBudget(payload: { amountUsd: number | null; alertOnly?: boolean }): Promise<BudgetResponse> {
    const response = await fetch(`${API_BASE_URL}/budget`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleAuthError();
      }
      throw new Error(`Failed to update budget: ${response.statusText}`);
    }

    return response.json();
  },
};

/**
 * Get authorization headers with token from localStorage
 */
function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ekai_auth_token') : null;
  if (token) {
    return {
      'Authorization': `Bearer ${token}`
    };
  }
  return {};
}

/**
 * Handle authentication errors by clearing auth and redirecting to login
 */
function handleAuthError(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ekai_auth_token');
    localStorage.removeItem('ekai_auth_address');
    localStorage.removeItem('ekai_auth_expiration');
    window.location.href = '/login';
  }
}

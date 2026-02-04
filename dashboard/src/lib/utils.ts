import { UsageRecord } from './api';

// Date grouping utilities
export const groupByDate = (records: UsageRecord[], groupBy: 'hour' | 'day' = 'day') => {
  const grouped: Record<string, {
    cost: number;
    tokens: number;
    requests: number;
    inputTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    outputTokens: number;
  }> = {};

  records.forEach(record => {
    const date = new Date(record.timestamp);
    let key: string;

    if (groupBy === 'hour') {
      // Group by hour: YYYY-MM-DD HH:00
      key = date.toISOString().slice(0, 13) + ':00:00Z';
    } else {
      // Group by day: YYYY-MM-DD
      key = date.toISOString().slice(0, 10);
    }

    if (!grouped[key]) {
      grouped[key] = {
        cost: 0,
        tokens: 0,
        requests: 0,
        inputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 0
      };
    }

    grouped[key].cost += record.total_cost;
    grouped[key].tokens += record.total_tokens;
    grouped[key].requests += 1;
    grouped[key].inputTokens += record.input_tokens;
    grouped[key].cacheWriteTokens += record.cache_write_input_tokens;
    grouped[key].cacheReadTokens += record.cache_read_input_tokens;
    grouped[key].outputTokens += record.output_tokens;
  });

  return grouped;
};

// Convert grouped data to chart format
export const formatForChart = (grouped: Record<string, {
  cost: number;
  tokens: number;
  requests: number;
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}>) => {
  return Object.entries(grouped)
    .map(([date, data]) => ({
      date,
      cost: Number(data.cost.toFixed(6)),
      tokens: data.tokens,
      requests: data.requests,
      inputTokens: data.inputTokens,
      cacheWriteTokens: data.cacheWriteTokens,
      cacheReadTokens: data.cacheReadTokens,
      outputTokens: data.outputTokens,
      formattedDate: new Date(date).toLocaleDateString(),
      formattedTime: new Date(date).toLocaleTimeString()
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Calculate burn rate (daily average)
export const calculateBurnRate = (records: UsageRecord[]) => {
  if (records.length === 0) return 0;

  const grouped = groupByDate(records, 'day');
  const dailyCosts = Object.values(grouped).map(d => d.cost);
  
  if (dailyCosts.length === 0) return 0;
  
  const totalCost = dailyCosts.reduce((sum, cost) => sum + cost, 0);
  const averageDailyCost = totalCost / dailyCosts.length;
  
  return Number(averageDailyCost.toFixed(6));
};

// Detect anomalies (spikes in spending)
export const detectAnomalies = (records: UsageRecord[]) => {
  const grouped = groupByDate(records, 'day');
  const dailyCosts = Object.entries(grouped).map(([date, data]) => ({
    date,
    cost: data.cost
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (dailyCosts.length < 3) return [];

  const costs = dailyCosts.map(d => d.cost);
  const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
  const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
  const stdDev = Math.sqrt(variance);
  const threshold = mean + (2 * stdDev); // 2 standard deviations

  return dailyCosts.filter(d => d.cost > threshold);
};

// Format currency
export const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  }).format(amount);
};

// Format large numbers with abbreviated units
export const formatNumber = (num: number) => {
  if (num >= 1000000000) { // Billions
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) { // Millions
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) { // Thousands
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Get human-readable provider name
export const getProviderName = (provider: string | undefined | null): string => {
  if (!provider) return 'Unknown';

  const providerMap: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    xai: 'xAI',
    openrouter: 'OpenRouter',
    zai: 'Z.ai',
  };

  return providerMap[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1);
};

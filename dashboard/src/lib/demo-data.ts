// Demo data generator for dashboard preview
// This generates realistic sample data client-side (no database pollution)

import { UsageRecord } from './api';

const DEMO_MODELS = [
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', avgTokens: 8000 },
  { provider: 'openai', model: 'gpt-4o', avgTokens: 5000 },
  { provider: 'openai', model: 'gpt-4o-mini', avgTokens: 15000 },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', avgTokens: 10000 },
  { provider: 'google', model: 'gemini-1.5-flash', avgTokens: 12000 },
  { provider: 'google', model: 'gemini-1.5-pro', avgTokens: 8000 },
];

// Generate a random number within a range
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate demo records for the last 30 days
export function generateDemoData(): UsageRecord[] {
  const records: UsageRecord[] = [];
  const now = new Date();

  // Generate 80-120 requests spread over last 30 days
  const numRecords = rand(80, 120);

  for (let i = 0; i < numRecords; i++) {
    // Random time in last 30 days
    const daysAgo = rand(0, 29);
    const hoursAgo = rand(0, 23);
    const timestamp = new Date(now);
    timestamp.setDate(timestamp.getDate() - daysAgo);
    timestamp.setHours(hoursAgo, rand(0, 59), rand(0, 59));

    // Pick a random model
    const modelInfo = DEMO_MODELS[rand(0, DEMO_MODELS.length - 1)];

    // Generate realistic token counts
    const inputTokens = rand(modelInfo.avgTokens * 0.3, modelInfo.avgTokens * 0.7);
    const outputTokens = rand(modelInfo.avgTokens * 0.2, modelInfo.avgTokens * 0.5);
    const cacheWriteTokens = Math.random() > 0.7 ? rand(1000, 5000) : 0;
    const cacheReadTokens = Math.random() > 0.6 ? rand(500, 3000) : 0;
    const totalTokens = inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens;

    // Calculate costs (simplified pricing)
    const inputCost = inputTokens * 0.000003;
    const outputCost = outputTokens * 0.000015;
    const cacheWriteCost = cacheWriteTokens * 0.00000375;
    const cacheReadCost = cacheReadTokens * 0.0000003;
    const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;

    records.push({
      id: i + 1,
      request_id: `demo-${i + 1}-${Date.now()}`,
      provider: modelInfo.provider,
      model: modelInfo.model,
      timestamp: timestamp.toISOString(),
      input_tokens: inputTokens,
      cache_write_input_tokens: cacheWriteTokens,
      cache_read_input_tokens: cacheReadTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      input_cost: inputCost,
      cache_write_cost: cacheWriteCost,
      cache_read_cost: cacheReadCost,
      output_cost: outputCost,
      total_cost: totalCost,
      currency: 'USD',
      payment_method: Math.random() > 0.5 ? 'api_key' : 'x402',
      created_at: timestamp.toISOString(),
    });
  }

  // Sort by timestamp descending (most recent first)
  return records.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// Calculate aggregated stats from records (same as useUsageData hook)
export function aggregateDemoData(records: UsageRecord[]) {
  const totalCost = records.reduce((sum, r) => sum + r.total_cost, 0);
  const totalTokens = records.reduce((sum, r) => sum + r.total_tokens, 0);
  const totalRequests = records.length;

  const costByProvider: Record<string, number> = {};
  const costByModel: Record<string, number> = {};

  records.forEach(record => {
    costByProvider[record.provider] = (costByProvider[record.provider] || 0) + record.total_cost;
    costByModel[record.model] = (costByModel[record.model] || 0) + record.total_cost;
  });

  return {
    records,
    totalCost,
    totalTokens,
    totalRequests,
    costByProvider,
    costByModel,
    loading: false,
    error: null,
    data: null,
    refetch: async () => {},
  };
}

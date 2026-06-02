import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_SECONDS = 15 * 60;
const PRICE_UNIT = 1_000_000;

interface OpenRouterModel {
  id: string;
  name?: string;
  created?: number;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_write?: string;
    input_cache_read?: string;
  };
  architecture?: {
    output_modalities?: string[];
  };
  expiration_date?: string | null;
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

interface CatalogEntry {
  id: string;
  provider: string;
  endpoint: 'chat_completions';
  pricing: {
    input: number;
    output: number;
    cache_write?: number;
    cache_read?: number;
    currency: 'USD';
    unit: '1M tokens';
  } | null;
  source: 'openrouter';
}

function pricePerMillion(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed * PRICE_UNIT;
}

function getProviderFromModelId(id: string): string {
  return id.split('/')[0] || 'openrouter';
}

function isExpired(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false;
  const expiration = Date.parse(expirationDate);
  return Number.isFinite(expiration) && expiration <= Date.now();
}

function toCatalogEntry(model: OpenRouterModel): CatalogEntry | null {
  if (!model.id || isExpired(model.expiration_date)) return null;

  const input = pricePerMillion(model.pricing?.prompt);
  const output = pricePerMillion(model.pricing?.completion);
  const cacheWrite = pricePerMillion(model.pricing?.input_cache_write);
  const cacheRead = pricePerMillion(model.pricing?.input_cache_read);

  return {
    id: model.id,
    provider: getProviderFromModelId(model.id),
    endpoint: 'chat_completions',
    pricing: input !== undefined && output !== undefined
      ? {
          input,
          output,
          ...(cacheWrite !== undefined ? { cache_write: cacheWrite } : {}),
          ...(cacheRead !== undefined ? { cache_read: cacheRead } : {}),
          currency: 'USD',
          unit: '1M tokens',
        }
      : null,
    source: 'openrouter',
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const provider = searchParams.get('provider')?.trim().toLowerCase();
  const search = searchParams.get('search')?.trim().toLowerCase();
  const endpoint = searchParams.get('endpoint')?.trim();
  const limitParam = Number(searchParams.get('limit') ?? 500);
  const offsetParam = Number(searchParams.get('offset') ?? 0);
  const limit = Number.isFinite(limitParam) ? Math.max(0, limitParam) : 500;
  const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

  if (endpoint && endpoint !== 'chat_completions') {
    return NextResponse.json({
      total: 0,
      limit,
      offset,
      items: [],
    });
  }

  const headers: Record<string, string> = {};
  if (process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  const upstream = await fetch(`${OPENROUTER_MODELS_URL}?output_modalities=text`, {
    headers,
    next: { revalidate: CACHE_SECONDS },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `OpenRouter models request failed: ${upstream.statusText}` },
      { status: upstream.status },
    );
  }

  const payload = await upstream.json() as OpenRouterModelsResponse;
  let items = (payload.data ?? [])
    .map(toCatalogEntry)
    .filter((entry): entry is CatalogEntry => entry !== null);

  if (provider) {
    items = items.filter(item => item.provider.toLowerCase() === provider);
  }

  if (search) {
    items = items.filter(item =>
      item.id.toLowerCase().includes(search) ||
      item.provider.toLowerCase().includes(search),
    );
  }

  items.sort((a, b) => a.id.localeCompare(b.id));

  return NextResponse.json(
    {
      total: items.length,
      limit,
      offset,
      items: items.slice(offset, offset + limit),
    },
    {
      headers: {
        'Cache-Control': `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    },
  );
}

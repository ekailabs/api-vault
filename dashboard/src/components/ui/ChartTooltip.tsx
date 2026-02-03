import { formatNumber } from '@/lib/utils';

interface TooltipPayload {
  formattedDate?: string;
  formattedTime?: string;
  value?: number;
  tokens?: number;
  requests?: number;
  name?: string;
  percentage?: number;
  inputTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  outputTokens?: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; color: string; payload: TooltipPayload }[];
  label?: string;
  type?: 'tokens' | 'provider' | 'model';
}

export default function ChartTooltip({ active, payload, label, type = 'tokens' }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
      {type === 'tokens' && (
        <>
          <p className="font-semibold">{data.formattedDate || label}</p>
          {data.inputTokens !== undefined && data.cacheWriteTokens !== undefined &&
           data.cacheReadTokens !== undefined && data.outputTokens !== undefined ? (
            <>
              <div className="space-y-1 mt-2">
                <p className="text-blue-600 text-sm">
                  <span className="font-semibold">Input:</span> {formatNumber(data.inputTokens)}
                </p>
                <p className="text-purple-600 text-sm">
                  <span className="font-semibold">Cache Write:</span> {formatNumber(data.cacheWriteTokens)}
                </p>
                <p className="text-green-600 text-sm">
                  <span className="font-semibold">Cache Read:</span> {formatNumber(data.cacheReadTokens)}
                </p>
                <p className="text-amber-600 text-sm">
                  <span className="font-semibold">Output:</span> {formatNumber(data.outputTokens)}
                </p>
                <hr className="border-gray-300 my-1" />
                <p className="text-gray-900 text-sm font-semibold">
                  <span className="font-semibold">Total:</span> {formatNumber(
                    data.inputTokens + data.cacheWriteTokens + data.cacheReadTokens + data.outputTokens
                  )}
                </p>
              </div>
            </>
          ) : (
            <p className="text-green-600">
              <span className="font-semibold">Tokens:</span> {formatNumber(data.tokens || data.value || 0)}
            </p>
          )}
        </>
      )}

      {(type === 'provider' || type === 'model') && (
        <>
          <p className="font-semibold">{data.name}</p>
          <p className="text-blue-600">
            <span className="font-semibold">Tokens:</span> {formatNumber(data.value || 0)}
          </p>
          <p className="text-gray-600">
            <span className="font-semibold">Percentage:</span> {data.percentage}%
          </p>
        </>
      )}
    </div>
  );
}
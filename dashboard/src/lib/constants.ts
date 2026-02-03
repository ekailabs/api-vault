export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500  
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
];

// Smart API URL detection (works for ROFL, proxies, and local dev)
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  }

  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl !== '__API_URL_PLACEHOLDER__') {
    return envUrl;
  }

  const { protocol, hostname, port } = window.location;
  if (hostname.includes('p3000')) {
    return `${protocol}//${hostname.replace('p3000', 'p3001')}`;
  }

  if (port === '3000') {
    return `${protocol}//${hostname}:3001`;
  }

  return 'http://localhost:3001';
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
} as const;
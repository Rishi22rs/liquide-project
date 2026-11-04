import { toPaise, type Quote } from '../domain/portfolio';
import { SYMBOLS } from './holdings';
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export function parseQuotes(payload: unknown): Record<string, Quote> {
  if (!record(payload) || payload.status !== 'success' || !record(payload.message) || !Array.isArray(payload.message.data)) {
    throw new Error('The price service returned an invalid response.');
  }
  const quotes: Record<string, Quote> = {};
  for (const item of payload.message.data as unknown[]) {
    if (!record(item) || typeof item.symbol !== 'string' || !SYMBOLS.some(s => s === item.symbol)) continue;
    const quote: { -readonly [K in keyof Quote]: Quote[K] } = { symbol: item.symbol, seq: 0 };
    for (const field of ['ltp','open','high','low','prevClose'] as const) {
      const value = item[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) quote[field] = toPaise(value);
    }
    if (typeof item.volume === 'number' && Number.isSafeInteger(item.volume) && item.volume >= 0) quote.volume = item.volume;
    quotes[item.symbol] = quote;
  }
  return quotes;
}
export async function fetchQuotes(): Promise<Record<string, Quote>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.v2.liquide.life/api/markets/ohlc', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbols: SYMBOLS }), signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Price request failed (${response.status}).`);
    const payload: unknown = await response.json();
    return parseQuotes(payload);
  } finally { clearTimeout(timeout); }
}
